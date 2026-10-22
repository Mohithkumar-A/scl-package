import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Tex } from "@/components/Tex";
import type { ReactNode } from "react";

export const Route = createFileRoute("/theory")({
  head: () => ({
    meta: [
      { title: "Theory — Image Inpainting" },
      {
        name: "description",
        content:
          "The implemented image inpainting model: regularized least squares solved with matrix-free LSQR.",
      },
      { property: "og:title", content: "Theory — Image Inpainting" },
      {
        property: "og:description",
        content:
          "The implemented image inpainting model: regularized least squares solved with matrix-free LSQR.",
      },
    ],
  }),
  component: Theory,
});

function Block({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="panel p-6">
      <h2 className="mb-3 flex items-center gap-3 font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/50 bg-accent/10 font-mono text-sm text-accent">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

const Eq = ({ m }: { m: string }) => (
  <div className="overflow-x-auto rounded-xl border border-border bg-surface px-3 py-2">
    <Tex block math={m} />
  </div>
);

function Theory() {
  return (
    <PageShell
      title="Theory"
      subtitle="The equations below match the backend's residual model, Tikhonov prior, and matrix-free LSQR solve."
    >
      <Block n={1} title="Unknown pixels and fixed image data">
        <p>
          The mask marks a set <Tex math="\Omega" /> of damaged pixels. The backend assigns one
          unknown to each marked pixel and stacks those values into{" "}
          <Tex math="x\in\mathbb{R}^{N}" />. Unmarked pixels remain fixed at their input
          intensities. Each color channel is solved independently.
        </p>
        <p>
          The numerical neighborhood is the four-connected pixel grid. For each unknown{" "}
          <Tex math="p" />, its neighbors are split into unknown neighbors{" "}
          <Tex math="\mathcal{N}_U(p)" /> and known neighbors <Tex math="\mathcal{N}_K(p)" />.
        </p>
      </Block>
      <Block n={2} title="Build the residuals">
        <p>
          The backend minimizes squared errors for three constraints. Each row compares a prediction
          made from the unknown vector with a target value:
        </p>
        <Eq m="\begin{aligned}r_{pq}&=x_p-x_q && p,q\in\Omega,\ p\sim q\\r_{pq}&=x_p-I_q && p\in\Omega,\ q\notin\Omega,\ p\sim q\\r_{p,0}&=\sqrt{\lambda}(x_p-x_p^{(0)}) && p\in\Omega\end{aligned}" />
        <p>
          Here <Tex math="I_q" /> is the known pixel value, <Tex math="p\sim q" /> means
          four-neighbor adjacency, and <Tex math="x_p^{(0)}" /> is the prior estimate used for that
          damaged pixel.
        </p>
      </Block>
      <Block n={3} title="Least squares with Tikhonov regularization">
        <p>
          Stack all residual rows into an operator <Tex math="C" /> and their targets into{" "}
          <Tex math="d" />. The backend's exact objective is:
        </p>
        <Eq m="\min_x\; E(x)=\frac12\|Cx-d\|_2^2" />
        <p>
          The prior residual is scaled by <Tex math="\sqrt{\lambda}" />, so its squared contribution
          is <Tex math="\frac{\lambda}{2}\|x-x^{(0)}\|_2^2" />. The current UI submits the fixed
          value <Tex math="\lambda=0.01" />; the API accepts other positive values within the
          backend's configured range.
        </p>
        <p>
          For damaged pixels with known four-neighbors, <Tex math="x_p^{(0)}" /> is their mean
          intensity. For interior pixels without known four-neighbors, the backend propagates a
          nearby known boundary color inward using an eight-connected breadth-first traversal.
        </p>
      </Block>
      <Block n={4} title="The equivalent linear system and uniqueness">
        <p>
          The least-squares optimality condition is <Tex math="C^T(Cx-d)=0" />. It is equivalent to
          the normal equations below. The backend does not form these matrices; this equation shows
          the model they solve.
        </p>
        <Eq m="C^TCx=C^Td,\qquad (\deg(p)+\lambda)x_p-\sum_{q\in\mathcal{N}_U(p)}x_q=\sum_{q\in\mathcal{N}_K(p)}I_q+\lambda x_p^{(0)}" />
        <p>
          Since <Tex math="\lambda>0" />, for every nonzero vector <Tex math="z" /> the model
          satisfies <Tex math="z^TC^TCz=\|Cz\|_2^2\geq\lambda\|z\|_2^2>0" />. Thus the normal matrix
          is symmetric positive definite and the quadratic objective has one unique minimum.
        </p>
      </Block>
      <Block n={5} title="How the backend solves and checks it">
        <p>
          The service uses matrix-free LSQR (Golub–Kahan bidiagonalization). It evaluates products{" "}
          <Tex math="Cv" />
          and <Tex math="C^Tw" /> from stored grid edges, boundary indices, and prior weights
          instead of storing a dense <Tex math="C" /> or explicitly forming <Tex math="C^TC" />. It
          starts from the prior estimate and checks the relative normal residual:
        </p>
        <Eq m="\frac{\|C^T(d-Cx)\|_2}{\|C^Td\|_2+10^{-12}}<\text{tolerance}" />
        <p>
          The tolerance defaults to <Tex math="10^{-4}" /> and the iteration limit to 500. A nonzero
          data residual <Tex math="Cx-d" /> may remain at a valid least-squares minimum; the normal
          residual measures optimality. The solution is inserted only at masked pixels, then clipped
          and rounded for image encoding. Preserved pixels and alpha are retained. PSNR and SSIM are{" "}
          <code className="font-mono text-foreground">null</code>
          for user uploads because no clean reference image is available.
        </p>
      </Block>
    </PageShell>
  );
}
