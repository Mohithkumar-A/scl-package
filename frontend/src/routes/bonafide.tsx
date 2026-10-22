import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/bonafide")({
  head: () => ({
    meta: [
      { title: "Bonafide — Image Inpainting" },
      {
        name: "description",
        content:
          "Bonafide project record for the Image Inpainting Scientific Computing Lab project.",
      },
      { property: "og:title", content: "Bonafide — Image Inpainting" },
      {
        property: "og:description",
        content:
          "Bonafide project record for the Image Inpainting Scientific Computing Lab project.",
      },
    ],
  }),
  component: Bonafide,
});

const team = [
  { name: "Mohithkumar A", reg: "25PD12" },
  { name: "Srriram A R", reg: "25PD34" },
];

function Bonafide() {
  return (
    <PageShell title="Bonafide" subtitle="Project bonafide record">
      <section className="panel mx-auto max-w-2xl border-2 border-primary/30 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Scientific Computing Lab
        </p>
        <h2 className="mt-2 text-2xl font-bold">Bonafide Project Record</h2>
        <div className="mx-auto mt-4 h-px w-24 bg-primary/60" />

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          This is to certify that the following students have completed the Scientific Computing Lab
          project titled
        </p>
        <p className="mt-2 text-lg font-semibold text-primary">
          “Image Inpainting Using Linear Algebra”
        </p>

        <div className="mt-8 space-y-3">
          {team.map((m) => (
            <div
              key={m.reg}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-3"
            >
              <span className="font-medium">{m.name}</span>
              <span className="font-mono text-sm text-muted-foreground">{m.reg}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SCL Package
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Python", "NumPy", "FastAPI", "Matrix-free LSQR"].map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-border bg-card px-3 py-1 font-mono text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Topic
            </h3>
            <p className="mt-2 text-sm font-medium">
              Image Reconstruction via Least Squares &amp; Tikhonov Regularization
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
