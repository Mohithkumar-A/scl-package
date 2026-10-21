import { useState } from "react";

export function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="h-2 w-2 rounded-full bg-destructive/80" /> Original Damaged
        </span>
        <span className="text-[11px] text-muted-foreground">← Drag handle to compare →</span>
        <span className="flex items-center gap-1.5 font-medium text-primary">
          Inpainted Result <span className="h-2 w-2 rounded-full bg-primary" />
        </span>
      </div>

      <div className="checker relative mx-auto flex max-h-[68vh] min-h-[400px] w-full select-none items-center justify-center overflow-hidden rounded-2xl border border-border bg-[#070b14] p-3 shadow-2xl">
        <div className="relative inline-block max-h-[64vh] max-w-full">
          {/* Inpainted After Image */}
          <img
            src={after}
            alt="Inpainted result"
            draggable={false}
            className="block max-h-[64vh] max-w-full select-none rounded-lg object-contain shadow-md"
          />

          {/* Original Before Image with Clip Path */}
          <img
            src={before}
            alt="Original damaged photograph"
            draggable={false}
            className="absolute inset-0 block h-full w-full select-none rounded-lg object-contain"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />

          {/* Vertical Comparison Divider */}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
            style={{ left: `${pos}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-cyan-400 bg-background/95 text-cyan-400 shadow-lg">
              <span className="text-[10px] font-bold">↔</span>
            </div>
          </div>

          {/* Invisible Range Input for Dragging */}
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(+e.target.value)}
            aria-label="Before/After comparison position"
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0 z-10"
          />
        </div>
      </div>
    </div>
  );
}
