import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  AlertCircle,
  Columns2,
  Download,
  ImagePlus,
  Info,
  Loader2,
  Paintbrush,
  Play,
  RotateCcw,
  Sparkles,
  SplitSquareVertical,
} from "lucide-react";
import { UploadCard } from "@/components/UploadCard";
import { DamageGrid } from "@/components/DamageGrid";
import { createMaskCanvasPNG, dataUrlToFile, validateMaskPixelCount } from "@/utils/mask";
import { CompareSlider } from "@/components/CompareSlider";
import { LoadingState } from "@/components/LoadingState";
import { reconstructImage, isDemoMode } from "@/services/api";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/state/studio-context";
import type { UploadedImage } from "@/types/reconstruction";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image Inpainting — Linear Algebra Restoration" },
      {
        name: "description",
        content:
          "Reconstruct damaged image regions with Tikhonov-regularized least squares and matrix-free LSQR.",
      },
      { property: "og:title", content: "Image Inpainting — Linear Algebra Restoration" },
      {
        property: "og:description",
        content:
          "Reconstruct damaged image regions with Tikhonov-regularized least squares and matrix-free LSQR.",
      },
    ],
  }),
  component: Home,
});

// The frontend uses a fixed default; direct API clients may select another validated value.
const DEFAULT_LAMBDA = 0.01;

function Home() {
  const {
    originalImage,
    setOriginalImage,
    workingImage,
    setWorkingImage,
    passCount,
    setPassCount,
    result,
    setResult,
    view,
    setView,
    brushPixelCount,
    setBrushPixelCount,
    maskState,
    setMaskState,
    activeRequestIdRef,
  } = useStudio();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Overall reset occurs ONLY when replacing or uploading a new image
  const onImage = (img: UploadedImage | null) => {
    activeRequestIdRef.current++;
    setOriginalImage(img);
    setWorkingImage(img ? { file: img.file, url: img.url } : null);
    setMaskState(null);
    setPassCount(0);
    setResult(null);
    setError(null);
    setBrushPixelCount(0);
    setView("paint");
  };

  // Revert back to the original image without re-uploading from disk
  const revertToOriginal = () => {
    if (!originalImage) return;
    activeRequestIdRef.current++;
    setWorkingImage({ file: originalImage.file, url: originalImage.url });
    setMaskState(null);
    setPassCount(0);
    setResult(null);
    setError(null);
    setBrushPixelCount(0);
    setView("paint");
  };

  // Execute inpainting pass on the current working image
  const run = async () => {
    if (!originalImage || !workingImage) return;
    const dims = { width: originalImage.width, height: originalImage.height };

    const validationError = validateMaskPixelCount(brushPixelCount, dims);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!brushCanvasRef.current) {
      setError("Brush canvas is not ready. Please paint over the damaged area.");
      return;
    }

    const currentRequestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const mask = await createMaskCanvasPNG(brushCanvasRef.current, dims);

      // Submit reconstruction applying the new mask to the CURRENT working image file
      const res = await reconstructImage({
        file: workingImage.file,
        mask,
        maskDimensions: dims,
        lambda: DEFAULT_LAMBDA,
        method: "tikhonov",
      });

      if (currentRequestId === activeRequestIdRef.current) {
        const nextPass = passCount + 1;
        const newFile = dataUrlToFile(res.reconstructed_image, `${baseName}_pass${nextPass}.png`);

        // Update working image with the newly inpainted result for subsequent passes
        setWorkingImage({
          file: newFile,
          url: res.reconstructed_image,
        });
        setPassCount(nextPass);
        setResult(res);
        setBrushPixelCount(0);
        setView("compare");
      }
    } catch (e) {
      if (currentRequestId === activeRequestIdRef.current) {
        setError(
          e instanceof Error ? `Reconstruction failed: ${e.message}` : "Reconstruction failed.",
        );
      }
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const dims = originalImage ? { width: originalImage.width, height: originalImage.height } : null;
  const hasDamage = brushPixelCount > 0;
  const baseName = originalImage?.file.name.replace(/\.[^.]+$/, "") ?? "image";

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 py-5 lg:px-8">
      {isDemoMode && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-accent">
          <Info className="h-4 w-4 shrink-0" /> Demo mode: simulated reconstruction.
        </div>
      )}

      {/* When no image is uploaded: Clean Centered Upload Card */}
      {!originalImage || !workingImage ? (
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              Image Inpainting Studio
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tikhonov-Regularized Least Squares with Matrix-Free LSQR
            </p>
          </div>

          <div className="w-full">
            <UploadCard image={originalImage} onChange={onImage} />
          </div>
        </div>
      ) : (
        /* When image is uploaded: Full-Stage Interactive Workspace */
        <div className="flex flex-col gap-4">
          {/* Top Control Bar */}
          <div className="panel flex flex-wrap items-center justify-between gap-3.5 p-3.5 shadow-md">
            {/* Left: Image Info, Pass Indicator, Revert, and Change Image */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className="max-w-[180px] truncate font-mono text-sm font-semibold text-foreground sm:max-w-[280px]">
                  {originalImage.file.name}
                </span>
                {dims && (
                  <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    {dims.width} × {dims.height}
                  </span>
                )}
              </div>

              {/* Pass Badge */}
              {passCount > 0 ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  <Sparkles className="h-3 w-3" />
                  Pass {passCount} Applied
                </div>
              ) : (
                <span className="rounded-lg border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                  Original
                </span>
              )}

              {/* Revert to Original Image (Visible when passes > 0) */}
              {passCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={revertToOriginal}
                  title="Revert back to the initial damaged image"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revert to Original
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onImage(null)}
                className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Change Image
              </Button>
            </div>

            {/* Center: View Switcher */}
            <div className="inline-flex rounded-lg border border-border bg-surface p-1 text-xs">
              <button
                type="button"
                onClick={() => setView("paint")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  view === "paint"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Paintbrush className="h-3.5 w-3.5" />
                Paint Mask
              </button>
              <button
                type="button"
                disabled={!result}
                onClick={() => setView("compare")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-40 ${
                  view === "compare"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <SplitSquareVertical className="h-3.5 w-3.5" />
                Compare Slider
              </button>
              <button
                type="button"
                disabled={!result}
                onClick={() => setView("side")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-40 ${
                  view === "side"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                Side by Side
              </button>
            </div>

            {/* Right: Primary Run Inpainting CTA */}
            <div className="flex items-center gap-3">
              <Button
                onClick={run}
                disabled={!hasDamage || loading}
                size="sm"
                className="h-9 gap-2 px-5 text-xs font-semibold shadow-md shadow-primary/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Solving Linear System...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    {passCount > 0 ? "Inpaint Next Pass" : "Run Inpainting"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Error notification banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Stage: DamageGrid is kept persistently mounted so strokes & zoom are never lost */}
          <div className="relative w-full">
            {/* Paint View */}
            <div className={view === "paint" ? "block w-full" : "hidden"}>
              <DamageGrid
                src={workingImage.url}
                originalSrc={originalImage.url}
                dims={dims}
                passCount={passCount}
                disabled={loading}
                brushCanvasRef={brushCanvasRef}
                brushPixelCount={brushPixelCount}
                persistedMaskState={maskState}
                onMaskStateChange={setMaskState}
                onBrushChange={(count) => {
                  activeRequestIdRef.current++;
                  setBrushPixelCount(count);
                  setError(null);
                }}
              />
            </div>

            {/* Compare View */}
            <div className={view === "compare" && result ? "block w-full" : "hidden"}>
              {result && (
                <div className="panel flex flex-col gap-3 p-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                    <span className="text-sm font-semibold text-foreground">
                      Interactive Comparison: Original Damaged vs Restored{" "}
                      {passCount > 1 ? `(${passCount} Cumulative Passes)` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setView("paint")}
                        className="h-8 gap-1.5 text-xs font-medium"
                      >
                        <Paintbrush className="h-3.5 w-3.5" />
                        Paint Remaining Defects
                      </Button>
                      <a
                        href={workingImage.url}
                        download={`${baseName}_restored.png`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:border-primary/60 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> Download Result
                      </a>
                    </div>
                  </div>
                  <CompareSlider before={originalImage.url} after={workingImage.url} />
                </div>
              )}
            </div>

            {/* Side-by-Side View */}
            <div className={view === "side" && result ? "block w-full" : "hidden"}>
              {result && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setView("paint")}
                      className="h-8 gap-1.5 text-xs font-medium"
                    >
                      <Paintbrush className="h-3.5 w-3.5" />
                      Paint Remaining Defects
                    </Button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="panel flex flex-col p-4 shadow-xl">
                      <h3 className="mb-2.5 text-sm font-semibold text-muted-foreground">
                        Original (Damaged)
                      </h3>
                      <div className="checker relative flex h-[420px] lg:h-[540px] items-center justify-center overflow-hidden rounded-xl border border-border bg-[#070b14]">
                        <img
                          src={originalImage.url}
                          alt="Original damaged"
                          className="max-h-full max-w-full object-contain select-none"
                        />
                      </div>
                    </div>

                    <div className="panel flex flex-col p-4 shadow-xl">
                      <div className="mb-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-primary">
                          Inpainted Result {passCount > 1 ? `(Pass ${passCount})` : ""}
                        </h3>
                        <a
                          href={workingImage.url}
                          download={`${baseName}_restored.png`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:border-primary/60 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </div>
                      <div className="checker relative flex h-[420px] lg:h-[540px] items-center justify-center overflow-hidden rounded-xl border border-border bg-[#070b14]">
                        <img
                          src={workingImage.url}
                          alt="Inpainted result"
                          className="max-h-full max-w-full object-contain select-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
                <LoadingState />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
