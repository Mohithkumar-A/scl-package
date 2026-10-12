import type { ReconstructionRequest, ReconstructionResult } from "@/types/reconstruction";
import { mockReconstruct } from "./mock";

export const API_URL: string | undefined = import.meta.env['VITE_API_URL'];
export const isDemoMode = !API_URL;

/** POST /api/reconstruct — multipart: image, lambda, method */
export async function reconstructImage(req: ReconstructionRequest): Promise<ReconstructionResult> {
  if (isDemoMode) return mockReconstruct(req);

  const form = new FormData();
  form.append("image", req.file);
  form.append("mask", req.mask, "mask.png");
  form.append("lambda", String(req.lambda));
  form.append("method", req.method);

  const res = await fetch(`${API_URL!.replace(/\/$/, "")}/api/reconstruct`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Server responded with ${res.status}`);
  }
  const data = (await res.json()) as ReconstructionResult;
  // Accept raw base64 as well as URLs/data URLs
  if (data.reconstructed_image && !/^(data:|https?:|blob:)/.test(data.reconstructed_image)) {
    data.reconstructed_image = `data:image/png;base64,${data.reconstructed_image}`;
  }
  return data;
}
