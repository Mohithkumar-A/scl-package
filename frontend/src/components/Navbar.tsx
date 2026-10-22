import { Link } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/theory", label: "Theory" },
  { to: "/bonafide", label: "Bonafide" },
] as const;

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-lg font-semibold leading-tight">Image Inpainting</span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Recover missing or damaged regions in images using Linear Algebra
            </span>
          </span>
        </Link>
        <nav className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-primary/15 !text-primary font-medium" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
