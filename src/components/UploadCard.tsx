import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import type { UploadedImage } from "@/types/reconstruction";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;

interface Props {
  image: UploadedImage | null;
  onChange: (img: UploadedImage | null) => void;
}

export function UploadCard({ image, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (file?: File) => {
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) return setError("Unsupported format. Use JPG, PNG or WEBP.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File too large (max ${MAX_MB} MB).`);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => onChange({ file, url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => setError("Could not read this image.");
    img.src = url;
  };

  return (
    <section className="panel p-5">
      <h2 className="mb-4 text-sm font-semibold"><span className="text-primary">1.</span> Upload Image</h2>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          drag ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/60"
        }`}
      >
        <UploadCloud className="mb-3 h-9 w-9 text-primary" />
        <p className="text-sm font-medium">Drag & drop an image here</p>
        <p className="my-2 text-xs text-muted-foreground">or</p>
        <span className="rounded-lg bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">Choose File</span>
        <p className="mt-3 text-xs text-muted-foreground">Supported formats: JPG, PNG, WEBP</p>
        <input ref={inputRef} type="file" accept={TYPES.join(",")} hidden
          onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      {image && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
          <img src={image.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{image.file.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{image.width} × {image.height}</p>
          </div>
          <button aria-label="Remove image" onClick={() => onChange(null)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
