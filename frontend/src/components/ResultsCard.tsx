import { Activity, Gauge, Sigma, Timer } from "lucide-react";
import type { ReconstructionResult } from "@/types/reconstruction";

export function ResultsCard({ result }: { result: ReconstructionResult | null }) {
  const items = [
    {
      k: "PSNR",
      v: result ? (result.psnr != null ? `${result.psnr} dB` : "N/A (No Ref)") : "—",
      I: Activity,
    },
    {
      k: "SSIM",
      v: result ? (result.ssim != null ? String(result.ssim) : "N/A (No Ref)") : "—",
      I: Gauge,
    },
    {
      k: "Linear System Error",
      v: result ? String(result.reconstruction_error) : "—",
      I: Sigma,
    },
    {
      k: "Time Taken",
      v: result ? `${result.time_taken} s` : "—",
      I: Timer,
    },
  ];
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Results</h2>
        {result?.iterations != null && (
          <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {result.iterations} iters · {result.converged ? "Converged" : "Max iters"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map(({ k, v, I }) => (
          <div key={k} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <I className="h-3.5 w-3.5 text-accent" />
              {k}
            </div>
            <div
              className={`mt-1.5 font-mono text-base font-semibold ${result ? "text-foreground" : "text-muted-foreground"}`}
            >
              {v}
            </div>
          </div>
        ))}
      </div>
      {result && (
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground flex flex-col gap-1">
          {result.masked_pixels != null && (
            <div className="flex justify-between">
              <span>Masked Pixels:</span>
              <span className="font-mono text-foreground">
                {result.masked_pixels.toLocaleString()} ({result.masked_percentage ?? 0}%)
              </span>
            </div>
          )}
          {result.changed_pixels != null && (
            <div className="flex justify-between">
              <span>Reconstructed / Modified:</span>
              <span className="font-mono text-primary font-semibold">
                {result.changed_pixels.toLocaleString()} px
              </span>
            </div>
          )}
          {result.final_residual != null && (
            <div className="flex justify-between">
              <span>Final Residual:</span>
              <span className="font-mono text-foreground">
                {result.final_residual.toExponential(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
