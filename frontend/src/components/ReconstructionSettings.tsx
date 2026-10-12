import { Loader2, Play, AlertCircle } from "lucide-react";
import type { ReconstructionMethod } from "@/types/reconstruction";
import { Tex } from "./Tex";

interface Props {
  lambda: number;
  setLambda: (v: number) => void;
  method: ReconstructionMethod;
  setMethod: (m: ReconstructionMethod) => void;
  canRun: boolean;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}

// Log-scale slider: 0.001 – 1.0
const toSlider = (l: number) => Math.log10(l);
const fromSlider = (s: number) => +Math.pow(10, s).toPrecision(2);

export function ReconstructionSettings({
  lambda,
  setLambda,
  method,
  setMethod,
  canRun,
  loading,
  error,
  onRun,
}: Props) {
  return (
    <section className="panel p-5">
      <h2 className="mb-4 text-sm font-semibold">
        <span className="text-primary">2.</span> Reconstruction Settings
      </h2>
      <div className="mb-1 flex items-center justify-between text-sm">
        <label htmlFor="lambda">
          Regularization Parameter (<Tex math="\lambda" />)
        </label>
        <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
          λ = {lambda}
        </span>
      </div>
      <input
        id="lambda"
        type="range"
        min={-3}
        max={0}
        step={0.05}
        value={toSlider(lambda)}
        onChange={(e) => setLambda(fromSlider(+e.target.value))}
        className="range-input mt-2 w-full"
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0.001</span>
        <span>0.01</span>
        <span>0.1</span>
        <span>1.0</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Controls the trade-off between data fidelity and smoothness.
      </p>

      <label htmlFor="method" className="mt-5 mb-2 block text-sm">
        Method
      </label>
      <select
        id="method"
        value={method}
        onChange={(e) => setMethod(e.target.value as ReconstructionMethod)}
        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
      >
        <option value="tikhonov">Tikhonov Regularization</option>
        <option value="smoothness">Smoothness Regularization</option>
      </select>

      <button
        onClick={onRun}
        disabled={!canRun || loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Reconstructing...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" /> Run Reconstruction
          </>
        )}
      </button>
      {error && (
        <p className="mt-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </section>
  );
}
