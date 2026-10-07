import { useState } from "react";

export function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="panel p-4">
      <div className="mb-3 flex justify-between text-xs text-muted-foreground"><span>Input (Damaged)</span><span>Reconstructed</span></div>
      <div className="checker relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-xl border border-border select-none">
        <img src={after} alt="Reconstructed" className="absolute inset-0 h-full w-full object-contain" />
        <img src={before} alt="Input" className="absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${pos}%` }} />
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)}
          aria-label="Comparison position" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
    </div>
  );
}
