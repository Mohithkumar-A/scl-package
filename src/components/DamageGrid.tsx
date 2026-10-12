import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eraser, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GridResolution, GridSelection, MaskDimensions } from "@/types/reconstruction";
import { createGridSelection, mapGridCellAtPoint, remapGridSelection, selectedPixelCount, toggleGridCell } from "@/utils/mask";

interface Props {
  src?: string | null;
  dims?: MaskDimensions | null;
  selection: GridSelection;
  disabled?: boolean;
  onSelectionChange: (selection: GridSelection) => void;
}

const resolutions: GridResolution[] = [10, 20, 40];

export function DamageGrid({ src, dims, selection, disabled = false, onSelectionChange }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectionRef = useRef<GridSelection>(createGridSelection());
  const historyRef = useRef<GridSelection[]>([]);
  const pointerRef = useRef<{ active: boolean; value: boolean; visited: Set<number> }>({ active: false, value: false, visited: new Set() });
  const [focusedCell, setFocusedCell] = useState(0);
  const [imageBounds, setImageBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
  selectionRef.current = selection;

  const commit = useCallback((next: GridSelection, undoable = true) => {
    if (undoable) historyRef.current.push(selectionRef.current);
    selectionRef.current = next;
    onSelectionChange(next);
  }, [onSelectionChange]);

  useEffect(() => {
    const imageEl = imageRef.current;
    const frameEl = frameRef.current;
    if (!imageEl || !frameEl) return;
    const update = () => {
      const imageRect = imageEl.getBoundingClientRect();
      const frameRect = frameEl.getBoundingClientRect();
      setImageBounds({ left: imageRect.left - frameRect.left, top: imageRect.top - frameRect.top, width: imageRect.width, height: imageRect.height });
    };
    const observer = new ResizeObserver(update);
    observer.observe(imageEl);
    observer.observe(frameEl);
    imageEl.addEventListener("load", update);
    update();
    return () => {
      observer.disconnect();
      imageEl.removeEventListener("load", update);
    };
  }, [src, dims?.width, dims?.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || imageBounds.width === 0 || imageBounds.height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(imageBounds.width * ratio);
    canvas.height = Math.round(imageBounds.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    const cellWidth = imageBounds.width / selection.resolution;
    const cellHeight = imageBounds.height / selection.resolution;
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim();
    const border = styles.getPropertyValue("--border").trim();
    for (let index = 0; index < selection.cells.length; index++) {
      const row = Math.floor(index / selection.resolution);
      const col = index % selection.resolution;
      const x = col * cellWidth;
      const y = row * cellHeight;
      if (selection.cells[index]) {
        context.globalAlpha = 0.5;
        context.fillStyle = primary;
        context.fillRect(x, y, cellWidth, cellHeight);
      }
      context.globalAlpha = 1;
      context.strokeStyle = border;
      context.lineWidth = 1;
      context.strokeRect(x, y, cellWidth, cellHeight);
    }
  }, [imageBounds, selection]);

  const updateAtPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const index = mapGridCellAtPoint(clientX - rect.left, clientY - rect.top, rect.width, rect.height, selectionRef.current.resolution);
    const drag = pointerRef.current;
    if (index === null || drag.visited.has(index)) return;
    drag.visited.add(index);
    const next = toggleGridCell(selectionRef.current, index, drag.value);
    selectionRef.current = next;
    onSelectionChange(next);
  };

  const finishDrag = () => {
    const drag = pointerRef.current;
    drag.active = false;
    drag.visited.clear();
  };

  const changeResolution = (resolution: GridResolution) => {
    if (resolution === selection.resolution) return;
    const remapped = remapGridSelection(selection, resolution);
    historyRef.current = [];
    commit(remapped, false);
  };

  const clear = () => commit(createGridSelection(selection.resolution));
  const selectAll = () => commit({ ...selection, cells: Array(selection.cells.length).fill(true) });
  const undo = () => {
    const previous = historyRef.current.pop();
    if (previous) commit(previous, false);
  };
  const count = selection.cells.reduce((total, cell) => total + Number(cell), 0);
  const totalPixels = dims ? dims.width * dims.height : 0;
  const selectedPixels = dims ? selectedPixelCount(selection, dims) : 0;
  const percent = totalPixels ? (selectedPixels / totalPixels) * 100 : 0;

  return (
    <section className="panel flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Input Image (Damaged)</h3>
        {dims && <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{dims.width} × {dims.height}</span>}
      </div>
      <div ref={frameRef} className="checker relative flex h-[300px] select-none items-center justify-center overflow-hidden rounded-xl border border-border lg:h-[380px]">
        {src ? <img ref={imageRef} src={src} alt="Input image with damage-selection grid" draggable={false} className="max-h-full max-w-full object-contain" /> : <div className="px-4 text-center text-sm text-muted-foreground">Upload an image to select damaged regions</div>}
        {src && <canvas ref={canvasRef} role="grid" aria-label={`Damage selection grid, ${selection.resolution} by ${selection.resolution}; ${count} cells selected`}
          aria-rowcount={selection.resolution} aria-colcount={selection.resolution} aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0} className={`absolute touch-none ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
          style={{ left: imageBounds.left, top: imageBounds.top, width: imageBounds.width, height: imageBounds.height }}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const rect = event.currentTarget.getBoundingClientRect();
            const index = mapGridCellAtPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, selectionRef.current.resolution);
            if (index === null) return;
            const value = !selectionRef.current.cells[index];
            pointerRef.current = { active: true, value, visited: new Set() };
            historyRef.current.push(selectionRef.current);
            setFocusedCell(index);
            updateAtPoint(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => { if (pointerRef.current.active) updateAtPoint(event.clientX, event.clientY); }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={(event) => {
            if (disabled) return;
            const row = Math.floor(focusedCell / selection.resolution);
            const col = focusedCell % selection.resolution;
            const moves: Record<string, number> = {
              ArrowUp: row > 0 ? -selection.resolution : 0,
              ArrowDown: row < selection.resolution - 1 ? selection.resolution : 0,
              ArrowLeft: col > 0 ? -1 : 0,
              ArrowRight: col < selection.resolution - 1 ? 1 : 0,
            };
            if (event.key in moves) {
              event.preventDefault();
              setFocusedCell((current) => current + (moves[event.key] ?? 0));
            } else if (["Enter", " "].includes(event.key)) {
              event.preventDefault();
              commit(toggleGridCell(selectionRef.current, focusedCell));
            }
          }} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Grid
          <select aria-label="Grid resolution" disabled={disabled} value={selection.resolution} onChange={(event) => changeResolution(Number(event.target.value) as GridResolution)}
            className="rounded-md border border-input bg-surface px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {resolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution} × {resolution}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" title="Select all cells" disabled={disabled} onClick={selectAll}><Check />Select all</Button>
          <Button variant="ghost" size="sm" title="Clear selection" disabled={disabled || count === 0} onClick={clear}><Eraser />Clear</Button>
          <Button variant="ghost" size="icon" title="Undo last selection" aria-label="Undo last selection" disabled={disabled || historyRef.current.length === 0} onClick={undo}><Undo2 /></Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 border border-primary bg-primary/50" />Selected = damaged region</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 border border-border" />Unselected = preserve</span>
        </div>
        <span className="font-mono text-foreground" aria-live="polite">{count} cells · {percent.toFixed(2)}% of image</span>
      </div>
      {count === 1 && selection.resolution < 40 && <p className="mt-2 text-xs text-accent">For finer damage boundaries, consider the 40 × 40 grid.</p>}
    </section>
  );
}