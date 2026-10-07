import katex from "katex";
import "katex/dist/katex.min.css";

export function Tex({ math, block = false, className }: { math: string; block?: boolean; className?: string }) {
  const html = katex.renderToString(math, { displayMode: block, throwOnError: false });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
