import { Tex } from "./Tex";

const steps = [
  { t: "Model the Image", d: "Represent the damaged image as a vector and identify known pixel information.", m: "x \\in \\mathbb{R}^{n}" },
  { t: "Formulate the Problem", d: "Construct the linear system using known pixels and regularization constraints.", m: "Ax \\approx b" },
  { t: "Solve Using Linear Algebra", d: "Solve the regularized least-squares system numerically.", m: "(A^TA+\\lambda L^TL)x = A^Tb" },
  { t: "Reconstruct", d: "Convert the recovered vector back into image form.", m: "x^* \\mapsto I" },
];

export function ReconstructionProcess({ activeStep }: { activeStep: number }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-5 text-sm font-semibold">Reconstruction Process</h2>
      <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const active = activeStep > i;
          const segmentDone = activeStep > i + 1;
          return (
            <div key={s.t} className="flex flex-col">
              <div className="flex h-2 items-center">
                <span className={`h-2 w-2 shrink-0 rounded-full ring-4 transition-colors ${active ? "bg-primary ring-primary/20" : "bg-border ring-transparent"}`} />
                {i < steps.length - 1 && (
                  <span className={`h-px flex-1 -mr-6 transition-colors ${segmentDone ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
              <h3 className="mt-3 text-sm font-medium leading-snug">{s.t}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
              <div className="mt-auto pt-3 text-xs"><Tex math={s.m} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
