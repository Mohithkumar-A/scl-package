import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Solving linear system..." }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="font-mono text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
