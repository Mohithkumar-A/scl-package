import { useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";

const concepts = ["Linear Systems", "Least Squares", "Null Space", "Rank and Nullity", "Regularization (Tikhonov)", "Matrix Operators"];

export function KeyConcepts() {
  const [open, setOpen] = useState(true);
  return (
    <section className="panel p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-sm font-semibold" aria-expanded={open}>
        Key Concepts
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-4 space-y-2.5">
          {concepts.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" />{c}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
