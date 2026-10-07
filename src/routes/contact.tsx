import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Image Inpainting" },
      { name: "description", content: "Project information for the Image Inpainting Scientific Computing Lab project." },
      { property: "og:title", content: "Contact — Image Inpainting" },
      { property: "og:description", content: "Project information for the Image Inpainting Scientific Computing Lab project." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <PageShell title="Contact" subtitle="Project information">
      <section className="panel p-6">
        <h2 className="text-xl font-semibold">Image Inpainting</h2>
        <p className="mt-1 text-muted-foreground">Scientific Computing Lab Project</p>
        <h3 className="mt-6 mb-3 text-sm font-semibold">Technology</h3>
        <div className="flex flex-wrap gap-2">
          {["Python", "FastAPI", "React", "NumPy", "SciPy"].map((t) => (
            <span key={t} className="rounded-lg border border-border bg-surface px-3 py-1 font-mono text-xs">{t}</span>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
