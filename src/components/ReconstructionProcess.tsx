import { ArrowRight } from "lucide-react";
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
      <div className="grid gap-4 md:grid-cols-4">
        {steps.map((s, i) => {
          const active = activeStep > i;
          return (
            <div key={s.t} className="relative">
              <div className={`flex items-center gap-2 border-l-2 pl-3 ${active ? "border-primary" : "border-border"}`}>
                {i < steps.length - 1 && <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />}
              </div>
              <h3 className="mt-3 text-sm font-medium">{s.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
              <div className="mt-2 overflow-x-auto text-xs"><Tex math={s.m} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
