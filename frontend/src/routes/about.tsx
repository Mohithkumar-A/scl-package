import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Image Inpainting" },
      {
        name: "description",
        content: "About the Image Inpainting Scientific Computing Lab project.",
      },
      { property: "og:title", content: "About — Image Inpainting" },
      {
        property: "og:description",
        content: "About the Image Inpainting Scientific Computing Lab project.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <PageShell title="About" subtitle="A Scientific Computing Lab project">
      <section className="panel p-6 leading-relaxed text-muted-foreground">
        <p>
          <span className="text-foreground font-medium">Image Inpainting</span> is the process of
          reconstructing missing or damaged image regions using mathematical constraints. A brush
          mask marks the damaged pixels; the backend formulates a Tikhonov-regularized least-squares
          problem and solves it with matrix-free LSQR to recover a plausible image.
        </p>
      </section>
      <section className="panel p-6">
        <h2 className="mb-4 font-semibold">The application uses</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            "Linear systems",
            "Least squares",
            "Regularization",
            "Matrix operators",
            "Numerical linear algebra",
          ].map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {c}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
