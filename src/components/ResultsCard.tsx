import { Activity, Gauge, Sigma, Timer } from "lucide-react";
import type { ReconstructionResult } from "@/types/reconstruction";

export function ResultsCard({ result }: { result: ReconstructionResult | null }) {
  const items = [
    { k: "PSNR", v: result ? `${result.psnr} dB` : "—", I: Activity },
    { k: "SSIM", v: result ? String(result.ssim) : "—", I: Gauge },
    { k: "Reconstruction Error", v: result ? String(result.reconstruction_error) : "—", I: Sigma },
    { k: "Time Taken", v: result ? `${result.time_taken} s` : "—", I: Timer },
  ];
  return (
    <section className="panel p-5">
      <h2 className="mb-4 text-sm font-semibold">Results</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map(({ k, v, I }) => (
          <div key={k} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><I className="h-3.5 w-3.5 text-accent" />{k}</div>
            <div className={`mt-1.5 font-mono text-base font-semibold ${result ? "text-foreground" : "text-muted-foreground"}`}>{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
