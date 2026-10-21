// DEMO MODE ONLY — enabled explicitly with VITE_DEMO_MODE=true.
// This does NOT perform the real least-squares reconstruction; it returns a
// lightly smoothed copy of the input so the UI can be demonstrated.
import type { ReconstructionRequest, ReconstructionResult } from "@/types/reconstruction";

export async function mockReconstruct(req: ReconstructionRequest): Promise<ReconstructionResult> {
  const start = performance.now();
  const bitmap = await createImageBitmap(req.file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = `blur(${Math.min(4, 0.5 + req.lambda * 3).toFixed(2)}px)`;
  ctx.drawImage(bitmap, 0, 0);
  await new Promise((r) => setTimeout(r, 1400));
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const reconstructedImage = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not encode the demo result."));
    };
    reader.onerror = () => reject(new Error("Could not encode the demo result."));
    reader.readAsDataURL(blob);
  });
  const l = req.lambda;
  return {
    reconstructed_image: reconstructedImage,
    psnr: +(34 - Math.abs(Math.log10(l) + 2) * 1.8 + Math.random()).toFixed(2),
    ssim: +(0.97 - Math.abs(Math.log10(l) + 2) * 0.02).toFixed(3),
    reconstruction_error: +(0.018 + Math.abs(Math.log10(l) + 2) * 0.006).toFixed(4),
    time_taken: +((performance.now() - start) / 1000).toFixed(2),
  };
}
