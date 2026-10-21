import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eraser,
  Eye,
  Hand,
  Maximize2,
  Minus,
  Paintbrush,
  Plus,
  Redo2,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { MaskDimensions } from "@/types/reconstruction";
import { BrushMaskState } from "@/utils/mask";

interface Props {
  src?: string | null;
  originalSrc?: string | null;
  dims?: MaskDimensions | null;
  passCount?: number;
  disabled?: boolean;
  brushCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  brushPixelCount?: number;
  onBrushChange?: (count: number) => void;
}

const brushPresets = [
  { label: "4px", size: 4 },
  { label: "8px", size: 8 },
  { label: "16px", size: 16 },
  { label: "28px", size: 28 },
];

const zoomPresets = [1, 1.5, 2, 3];

export function DamageGrid({
  src,
  originalSrc,
  dims,
  passCount = 0,
  disabled = false,
  brushCanvasRef,
  brushPixelCount = 0,
  onBrushChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskStateRef = useRef<BrushMaskState | null>(null);

  // Track sources for image change vs pass update
  const prevOriginalSrcRef = useRef<string | null>(null);
  const prevSrcRef = useRef<string | null>(null);

  // Brush settings
  const [brushOp, setBrushOp] = useState<"paint" | "erase">("paint");
  const [brushSize, setBrushSize] = useState<number>(10);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Zoom state: 1.0 = 100% Fit, up to 4.0 = 400%
  const [zoom, setZoom] = useState<number>(1);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Underlay toggle: when passCount > 0, allow comparing with the original damaged background
  const [showOriginalUnderlay, setShowOriginalUnderlay] = useState(false);

  // Undo / Redo history stacks
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Painting interaction tracking
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Panning interaction tracking
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  // Listen for container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSize) : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  }, []);

  // Listen for Spacebar key to enable pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT") {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        isPanningRef.current = false;
        panStartRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Calculate base fit dimensions from aspect ratio and container size
  const aspect = dims && dims.height > 0 ? dims.width / dims.height : 1.333;
  const padding = 28;
  const availWidth = Math.max(260, (containerSize.width > 0 ? containerSize.width : 900) - padding);
  const availHeight = Math.max(
    260,
    (containerSize.height > 0 ? containerSize.height : 540) - padding,
  );

  let baseWidth = availWidth;
  let baseHeight = availWidth / aspect;
  if (baseHeight > availHeight) {
    baseHeight = availHeight;
    baseWidth = availHeight * aspect;
  }
  baseWidth = Math.max(100, Math.round(baseWidth));
  baseHeight = Math.max(100, Math.round(baseHeight));

  // Physical rendered dimensions under zoom
  const displayWidth = Math.round(baseWidth * zoom);
  const displayHeight = Math.round(baseHeight * zoom);

  // Synchronize display canvas size and draw current mask highlight
  const renderDisplay = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas || displayWidth <= 0 || displayHeight <= 0) return;

    const ratio = window.devicePixelRatio || 1;
    displayCanvas.width = Math.round(displayWidth * ratio);
    displayCanvas.height = Math.round(displayHeight * ratio);

    const ctx = displayCanvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const intrinsic = maskStateRef.current?.canvas;
    if (intrinsic && intrinsic.width > 0 && intrinsic.height > 0) {
      ctx.drawImage(intrinsic, 0, 0, displayWidth, displayHeight);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "rgba(14, 165, 233, 0.75)";
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }, [displayWidth, displayHeight]);

  // Synchronize intrinsic canvas on new image upload OR pass update
  useEffect(() => {
    if (!dims || dims.width <= 0 || dims.height <= 0) return;

    const isNewUpload = prevOriginalSrcRef.current !== (originalSrc ?? src);
    const isNewPass = prevSrcRef.current !== src;

    if (isNewUpload || isNewPass) {
      prevOriginalSrcRef.current = originalSrc ?? src ?? null;
      prevSrcRef.current = src ?? null;

      const maskState = new BrushMaskState(dims);
      maskStateRef.current = maskState;
      const canvas = maskState.canvas;
      if (brushCanvasRef) {
        brushCanvasRef.current = canvas;
      }
      setCanUndo(false);
      setCanRedo(false);

      if (isNewUpload) {
        setZoom(1);
        setShowOriginalUnderlay(false);
      }
      onBrushChange?.(0);
      renderDisplay();
    } else {
      renderDisplay();
    }
  }, [src, originalSrc, dims, brushCanvasRef, onBrushChange, renderDisplay]);

  // Re-render display canvas whenever display dimensions or zoom change
  useEffect(() => {
    renderDisplay();
  }, [displayWidth, displayHeight, renderDisplay]);

  // Map pointer coordinates on canvas to intrinsic image pixel coordinates
  const getIntrinsicCoords = (clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !dims || displayWidth <= 0 || displayHeight <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.max(0, Math.min(dims.width, ((clientX - rect.left) / rect.width) * dims.width));
    const y = Math.max(
      0,
      Math.min(dims.height, ((clientY - rect.top) / rect.height) * dims.height),
    );
    return { x, y, scaleX: dims.width / rect.width };
  };

  const handleBrushDown = (clientX: number, clientY: number) => {
    if (disabled || !dims) return;
    const coords = getIntrinsicCoords(clientX, clientY);
    if (!coords) return;

    const maskState = maskStateRef.current;
    if (!maskState) return;

    setCanUndo(true);
    setCanRedo(false);

    isPaintingRef.current = true;
    lastPointRef.current = { x: coords.x, y: coords.y };

    maskState.beginStroke(coords.x, coords.y, brushSize * coords.scaleX, brushOp);

    renderDisplay();
  };

  const handleBrushMove = (clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: clientX - rect.left, y: clientY - rect.top });
    }
    if (!isPaintingRef.current || !dims) return;

    const coords = getIntrinsicCoords(clientX, clientY);
    if (!coords || !lastPointRef.current) return;

    const maskState = maskStateRef.current;
    if (!maskState) return;
    maskState.continueStroke(
      lastPointRef.current.x,
      lastPointRef.current.y,
      coords.x,
      coords.y,
      brushSize * coords.scaleX,
      brushOp,
    );

    lastPointRef.current = { x: coords.x, y: coords.y };
    renderDisplay();
  };

  const handleBrushUp = () => {
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;
    lastPointRef.current = null;

    onBrushChange?.(maskStateRef.current?.countPixels() ?? 0);
    renderDisplay();
  };

  // Pointer event handlers with Pan support
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    // Middle-click (1), Right-click (2), or Spacebar held enables dragging/panning
    if (e.button === 1 || e.button === 2 || isSpacePressed) {
      e.preventDefault();
      isPanningRef.current = true;
      const container = containerRef.current;
      if (container) {
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
      }
      return;
    }

    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    handleBrushDown(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current && panStartRef.current && containerRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      return;
    }

    handleBrushMove(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      return;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    handleBrushUp();
  };

  const handleUndo = () => {
    const maskState = maskStateRef.current;
    if (!maskState || !maskState.undo()) return;
    onBrushChange?.(maskState.countPixels());
    setCanUndo(maskState.canUndo);
    setCanRedo(maskState.canRedo);
    renderDisplay();
  };

  const handleRedo = () => {
    const maskState = maskStateRef.current;
    if (!maskState || !maskState.redo()) return;
    onBrushChange?.(maskState.countPixels());
    setCanUndo(maskState.canUndo);
    setCanRedo(maskState.canRedo);
    renderDisplay();
  };

  const handleClear = () => {
    const maskState = maskStateRef.current;
    if (!maskState) return;
    maskState.clear();
    setCanUndo(true);
    setCanRedo(false);
    onBrushChange?.(0);
    renderDisplay();
  };

  const stepBrushSize = (delta: number) => {
    setBrushSize((prev) => Math.max(2, Math.min(64, prev + delta)));
  };

  const stepZoom = (delta: number) => {
    setZoom((prev) => Math.max(1, Math.min(4, +(prev + delta).toFixed(2))));
  };

  const totalPixels = dims ? dims.width * dims.height : 0;
  const brushPercent = totalPixels ? (brushPixelCount / totalPixels) * 100 : 0;

  // Active background image source (can toggle to show original image if passCount > 0)
  const activeBackground = showOriginalUnderlay && originalSrc ? originalSrc : (src ?? originalSrc);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Expansive Canvas Stage with Scroll & Pan Support when Zoomed */}
      <div
        ref={containerRef}
        className="checker relative flex min-h-[460px] max-h-[74vh] w-full select-none overflow-auto rounded-2xl border border-border bg-[#070b14] p-3 shadow-2xl"
      >
        {activeBackground ? (
          <div
            ref={wrapperRef}
            className="relative m-auto shrink-0 select-none shadow-xl"
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
            }}
          >
            <img
              ref={imageRef}
              src={activeBackground}
              alt="Photograph for inpainting"
              draggable={false}
              className="block h-full w-full select-none rounded-lg object-contain"
              onLoad={() => renderDisplay()}
            />

            <canvas
              ref={displayCanvasRef}
              role="img"
              aria-label={`Damage highlight brush canvas, ${brushPixelCount} pixels marked`}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
              className={`absolute inset-0 h-full w-full touch-none rounded-lg ${
                disabled ? "cursor-not-allowed" : isSpacePressed ? "cursor-grab" : "cursor-none"
              }`}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={() => {
                setCursorPos(null);
                handleBrushUp();
              }}
            />

            {/* Pixel-exact circular cursor preview */}
            {cursorPos && !disabled && !isSpacePressed && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400 bg-cyan-400/25 shadow-md ring-1 ring-white/50"
                style={{
                  left: cursorPos.x,
                  top: cursorPos.y,
                  width: brushSize,
                  height: brushSize,
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground m-auto">
            <Paintbrush className="mb-3 h-10 w-10 text-primary/60" />
            <p className="text-sm font-medium">Upload an image to start painting damaged areas</p>
          </div>
        )}
      </div>

      {/* Clean Controls Toolbar with Outside Zoom, Size, and History */}
      {src && (
        <div className="panel flex flex-col gap-3 p-3.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mode & Underlay View Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                <Button
                  variant={brushOp === "paint" ? "default" : "ghost"}
                  size="sm"
                  disabled={disabled}
                  onClick={() => setBrushOp("paint")}
                  className="h-8 gap-1.5 px-3 text-xs font-medium"
                >
                  <Paintbrush className="h-3.5 w-3.5" />
                  Paint Damage
                </Button>
                <Button
                  variant={brushOp === "erase" ? "default" : "ghost"}
                  size="sm"
                  disabled={disabled}
                  onClick={() => setBrushOp("erase")}
                  className="h-8 gap-1.5 px-3 text-xs font-medium"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Eraser
                </Button>
              </div>

              {/* Show Original Underlay Toggle for continuing iterative inpaint */}
              {passCount > 0 && originalSrc && (
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
                  <span className="text-[10px] text-muted-foreground px-1 font-medium flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Canvas Underlay:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOriginalUnderlay(false)}
                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                      !showOriginalUnderlay
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Restored (Pass {passCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOriginalUnderlay(true)}
                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                      showOriginalUnderlay
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Original Photo
                  </button>
                </div>
              )}
            </div>

            {/* Outside Zoom Controls */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1">
              <span className="text-xs font-medium text-muted-foreground mr-0.5 flex items-center gap-1">
                <ZoomIn className="h-3.5 w-3.5" /> Zoom:
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled || zoom <= 1}
                onClick={() => stepZoom(-0.25)}
                title="Zoom out (25%)"
                className="h-7 w-7 text-xs"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="font-mono text-xs font-semibold text-primary px-1 min-w-[4ch] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled || zoom >= 4}
                onClick={() => stepZoom(0.25)}
                title="Zoom in (25%)"
                className="h-7 w-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>

              <div className="hidden items-center gap-1 sm:flex ml-1">
                {zoomPresets.map((pz) => (
                  <button
                    key={pz}
                    type="button"
                    disabled={disabled}
                    onClick={() => setZoom(pz)}
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                      zoom === pz
                        ? "border-primary bg-primary/20 font-semibold text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {Math.round(pz * 100)}%
                  </button>
                ))}
              </div>

              {zoom !== 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(1)}
                  title="Reset to 100% Fit"
                  className="h-6 ml-1 px-1.5 text-[10px] font-mono"
                >
                  <Maximize2 className="h-2.5 w-2.5 mr-1" />
                  Fit
                </Button>
              )}
            </div>

            {/* Brush Size (+ / - buttons, presets, slider) */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5">
              <span className="font-mono text-xs font-medium text-foreground">
                Size: {brushSize}px
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={disabled || brushSize <= 2}
                  onClick={() => stepBrushSize(-2)}
                  title="Decrease brush size"
                  className="h-7 w-7"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={disabled || brushSize >= 64}
                  onClick={() => stepBrushSize(2)}
                  title="Increase brush size"
                  className="h-7 w-7"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="hidden items-center gap-1 sm:flex">
                {brushPresets.map((preset) => (
                  <button
                    key={preset.size}
                    type="button"
                    disabled={disabled}
                    onClick={() => setBrushSize(preset.size)}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                      brushSize === preset.size
                        ? "border-primary bg-primary/20 font-semibold text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="w-20 sm:w-24">
                <Slider
                  min={2}
                  max={60}
                  step={1}
                  value={[brushSize]}
                  disabled={disabled}
                  onValueChange={(val) => setBrushSize(val[0] ?? 10)}
                />
              </div>
            </div>

            {/* Undo, Redo, Reset */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
              <Button
                variant="ghost"
                size="sm"
                title="Undo last stroke"
                disabled={disabled || !canUndo}
                onClick={handleUndo}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Redo stroke"
                disabled={disabled || !canRedo}
                onClick={handleRedo}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <Redo2 className="h-3.5 w-3.5" />
                Redo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Clear all paint strokes"
                disabled={disabled || brushPixelCount === 0}
                onClick={handleClear}
                className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          {/* Status info bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              {zoom > 1 ? (
                <>
                  <Hand className="h-3 w-3 text-primary/70" />
                  <span>
                    Zoomed {Math.round(zoom * 100)}%. Scroll container, or hold Space / Right-click
                    to pan.
                  </span>
                </>
              ) : (
                <span>
                  Trace damaged cracks or tears. Use Zoom for high-precision hairline repairs.
                </span>
              )}
            </span>
            <span
              className={`font-mono ${
                brushPercent > 85 ? "font-semibold text-destructive" : "text-foreground"
              }`}
              aria-live="polite"
            >
              {brushPixelCount.toLocaleString()} px marked · {brushPercent.toFixed(2)}% of image
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
