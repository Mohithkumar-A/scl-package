import { Sigma } from "lucide-react";
import { Tex } from "./Tex";

const vars: [string, string][] = [
  ["x", "reconstructed image represented as a vector"],
  ["A", "sampling/operator matrix representing known pixels"],
  ["b", "observed pixel values"],
  ["L", "smoothness/difference regularization operator"],
  ["\\lambda", "regularization parameter"],
];

export function MathematicalModel() {
  return (
    <section className="panel p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Sigma className="h-4 w-4 text-accent" /> Mathematical Model</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface px-2 py-3 text-sm">
        <Tex block math="\min_{x}\; \|Ax-b\|_2^2 + \lambda\|Lx\|_2^2" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Normal equations:</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface px-2 py-2 text-sm">
        <Tex block math="(A^TA + \lambda L^TL)\,x = A^Tb" />
      </div>
      <ul className="mt-4 space-y-2">
        {vars.map(([s, d]) => (
          <li key={s} className="flex gap-3 text-xs">
            <span className="w-5 shrink-0 text-primary"><Tex math={s} /></span>
            <span className="text-muted-foreground">{d}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
