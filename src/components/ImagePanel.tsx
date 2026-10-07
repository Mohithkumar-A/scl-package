import type { ReactNode } from "react";

interface Props {
  title: string;
  src?: string | null | undefined;
  dims?: { width: number; height: number } | null;
  empty: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
}

export function ImagePanel({ title, src, dims, empty, footer, overlay }: Props) {
  return (
    <div className="panel flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {dims && <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{dims.width} × {dims.height}</span>}
      </div>
      <div className="checker relative flex h-[300px] items-center justify-center overflow-hidden rounded-xl border border-border lg:h-[380px]">
        {src ? <img src={src} alt={title} className="max-h-full max-w-full object-contain" /> : empty}
        {overlay}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
