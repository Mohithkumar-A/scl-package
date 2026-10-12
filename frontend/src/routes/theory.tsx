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
          "Problem formulation, null space, Tikhonov regularization and normal equations for image inpainting.",
      },
      { property: "og:title", content: "Theory — Image Inpainting" },
      {
        property: "og:description",
        content:
          "Problem formulation, null space, Tikhonov regularization and normal equations for image inpainting.",
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
      subtitle="The linear algebra behind the reconstruction — useful for viva preparation."
    >
      <Block n={1} title="Problem Formulation">
        <p>
          Flatten an <Tex math="m\times n" /> image into a vector <Tex math="x\in\mathbb{R}^{N}" />,{" "}
          <Tex math="N=mn" />. Let <Tex math="A\in\mathbb{R}^{k\times N}" /> select the{" "}
          <Tex math="k" /> known (undamaged) pixels and <Tex math="b" /> hold their values:
        </p>
        <Eq m="Ax = b" />
        <p>
          Since <Tex math="k < N" />, there are fewer equations than unknowns — the system is{" "}
          <span className="text-foreground">underdetermined</span>, so the known pixels alone cannot
          fix the missing ones.
        </p>
      </Block>
      <Block n={2} title="Null Space">
        <p>
          If <Tex math="x_0" /> satisfies <Tex math="Ax=b" />, then so does every{" "}
          <Tex math="x_0 + z" /> with <Tex math="z\in\mathcal{N}(A)" />:
        </p>
        <Eq m="A(x_0+z) = Ax_0 + Az = b,\quad z\in\mathcal{N}(A)" />
        <p>
          By rank–nullity, <Tex math="\dim\mathcal{N}(A) = N - \operatorname{rank}(A) = N-k > 0" />.
          Any values in the damaged pixels are "consistent" — we need an extra criterion to pick
          one.
        </p>
      </Block>
      <Block n={3} title="Regularization (Tikhonov)">
        <p>
          We prefer smooth images. Let <Tex math="L" /> be a finite-difference (gradient/Laplacian)
          operator; penalize <Tex math="\|Lx\|^2" />:
        </p>
        <Eq m="\min_x\; \|Ax-b\|_2^2 + \lambda\,\|Lx\|_2^2" />
        <p>
          Small <Tex math="\lambda" /> trusts the data; large <Tex math="\lambda" /> enforces
          smoothness. If <Tex math="\mathcal{N}(A)\cap\mathcal{N}(L)=\{0\}" />, the solution is
          unique.
        </p>
      </Block>
      <Block n={4} title="Normal Equations">
        <p>
          Setting the gradient of the objective to zero gives a symmetric positive definite sparse
          system:
        </p>
        <Eq m="(A^TA + \lambda L^TL)\,x = A^Tb" />
        <p>
          It is solved numerically with sparse direct solvers or conjugate gradients (e.g. SciPy{" "}
          <code className="font-mono text-foreground">spsolve</code> /{" "}
          <code className="font-mono text-foreground">cg</code>).
        </p>
      </Block>
      <Block n={5} title="Reconstruction">
        <p>
          The solution vector <Tex math="x^*" /> is reshaped back into an <Tex math="m\times n" />{" "}
          array (per colour channel), clipped to the valid intensity range, and encoded as an image.
          Quality is reported with PSNR, SSIM and the residual error.
        </p>
        <Eq m="\text{PSNR} = 10\log_{10}\!\left(\frac{\text{MAX}^2}{\text{MSE}}\right)" />
      </Block>
    </PageShell>
  );
}
