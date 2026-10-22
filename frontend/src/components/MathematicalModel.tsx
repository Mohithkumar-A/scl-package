import { Sigma } from "lucide-react";
import { Tex } from "./Tex";

const vars: [string, string][] = [
  ["x", "intensities of the masked pixels only"],
  ["C", "residual operator for smoothness, boundary and prior terms"],
  ["d", "target values for the residual rows"],
  ["x^{(0)}", "local prior estimated from nearby known pixels"],
  ["\\lambda", "Tikhonov prior weight; UI default is 0.01"],
];

export function MathematicalModel() {
  return (
    <section className="panel p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Sigma className="h-4 w-4 text-accent" /> Mathematical Model
      </h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface px-2 py-3 text-sm">
        <Tex block math="\\min_x \\frac12\\|Cx-d\\|_2^2" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Least-squares optimality condition:</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface px-2 py-2 text-sm">
        <Tex block math="C^T(Cx-d)=0" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        The prior residual is weighted by <Tex math="\\sqrt{\\lambda}" />, giving the penalty{" "}
        <Tex math="\\frac{\\lambda}{2}\\|x-x^{(0)}\\|_2^2" />. The backend applies the residual
        operator and its transpose with matrix-free LSQR.
      </p>
      <ul className="mt-4 space-y-2">
        {vars.map(([symbol, description]) => (
          <li key={symbol} className="flex gap-3 text-xs">
            <span className="w-5 shrink-0 text-primary">
              <Tex math={symbol} />
            </span>
            <span className="text-muted-foreground">{description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
