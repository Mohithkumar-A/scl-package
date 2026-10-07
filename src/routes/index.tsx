import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, ImageOff, Sparkles, Info } from "lucide-react";
import { UploadCard } from "@/components/UploadCard";
import { ReconstructionSettings } from "@/components/ReconstructionSettings";
import { ImagePanel } from "@/components/ImagePanel";
import { CompareSlider } from "@/components/CompareSlider";
import { ReconstructionProcess } from "@/components/ReconstructionProcess";
import { MathematicalModel } from "@/components/MathematicalModel";
import { ResultsCard } from "@/components/ResultsCard";
import { LoadingState } from "@/components/LoadingState";
import { reconstructImage, isDemoMode } from "@/services/api";
import type { ReconstructionMethod, ReconstructionResult, UploadedImage } from "@/types/reconstruction";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image Inpainting — Linear Algebra Reconstruction" },
      { name: "description", content: "Reconstruct damaged image regions using least squares and Tikhonov regularization." },
      { property: "og:title", content: "Image Inpainting — Linear Algebra Reconstruction" },
      { property: "og:description", content: "Reconstruct damaged image regions using least squares and Tikhonov regularization." },
    ],
  }),
  component: Home,
});

function Home() {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [lambda, setLambda] = useState(0.01);
  const [method, setMethod] = useState<ReconstructionMethod>("tikhonov");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconstructionResult | null>(null);
  const [view, setView] = useState<"side" | "compare">("side");

  const onImage = (img: UploadedImage | null) => { setImage(img); setResult(null); setError(null); };

  const run = async () => {
    if (!image) return;
    setLoading(true); setError(null);
    try {
      setResult(await reconstructImage({ file: image.file, lambda, method }));
    } catch (e) {
      setError(e instanceof Error ? `Reconstruction failed: ${e.message}` : "Reconstruction failed.");
    } finally { setLoading(false); }
  };

  const dims = image ? { width: image.width, height: image.height } : null;
  const step = result ? 4 : loading ? 3 : image ? 1 : 0;
  const baseName = image?.file.name.replace(/\.[^.]+$/, "") ?? "image";

  return (
    <main className="mx-auto w-full max-w-[1920px] px-4 py-6 lg:px-6">
      {isDemoMode && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-accent">
          <Info className="h-4 w-4 shrink-0" /> Demo mode: no backend configured (set VITE_API_URL). Results are simulated for demonstration.
        </div>
      )}
      <div className="panel grid items-stretch gap-5 p-5 lg:grid-cols-[22fr_58fr_20fr] md:grid-cols-2">
        <aside className="flex h-full flex-col gap-5 md:col-span-1 lg:col-span-1">
          <UploadCard image={image} onChange={onImage} />
          <ReconstructionSettings lambda={lambda} setLambda={setLambda} method={method} setMethod={setMethod}
            canRun={!!image} loading={loading} error={error} onRun={run} />
        </aside>

        <div className="flex h-full flex-col gap-5 md:col-span-2 lg:col-span-1">
          <div className="flex justify-end">
            <div className="inline-flex rounded-lg border border-border bg-card p-1 text-xs">
              {(["side", "compare"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} disabled={v === "compare" && !result}
                  className={`rounded-md px-3 py-1.5 transition-colors disabled:opacity-40 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {v === "side" ? "Side by Side" : "Compare"}
                </button>
              ))}
            </div>
          </div>

          {view === "compare" && result && image ? (
            <CompareSlider before={image.url} after={result.reconstructed_image} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <ImagePanel title="Input Image (Damaged)" src={image?.url} dims={dims}
                empty={<Empty icon={<ImageOff className="h-8 w-8" />} text="Upload a damaged image to begin" />} />
              <ImagePanel title="Reconstructed Image" src={result?.reconstructed_image} dims={result ? dims : null}
                empty={<Empty icon={<Sparkles className="h-8 w-8" />} text="Reconstructed image will appear here" />}
                overlay={loading ? <LoadingState /> : null}
                footer={result && (
                  <a href={result.reconstructed_image} download={`${baseName}_reconstructed.png`}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:border-primary/60">
                    <Download className="h-3.5 w-3.5" /> Download Image
                  </a>
                )} />
            </div>
          )}

          <ReconstructionProcess activeStep={step} />
        </div>

        <aside className="flex h-full flex-col gap-5">
          <ResultsCard result={result} />
          <MathematicalModel />
        </aside>
      </div>
    </main>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground">
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card">
        {icon}
      </span>
      <p className="max-w-[26ch] text-sm">{text}</p>
    </div>
  );
}
