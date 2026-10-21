import type { ReconstructionRequest, ReconstructionResult } from "@/types/reconstruction";
import { mockReconstruct } from "./mock";

const envUrl = import.meta.env["VITE_API_URL"]?.trim();
export const API_URL: string = envUrl || "http://localhost:8000";
export const isDemoMode = import.meta.env["VITE_DEMO_MODE"] === "true";

/** POST /api/reconstruct — multipart: image, lambda, method */
export async function reconstructImage(req: ReconstructionRequest): Promise<ReconstructionResult> {
  if (isDemoMode) return mockReconstruct(req);

  // Development boundary diagnostics
  console.debug("[Inpainting API] Sending reconstruction request:", {
    imageName: req.file.name,
    imageDimensions: `${req.maskDimensions.width}x${req.maskDimensions.height}`,
    maskSize: req.mask.size,
    maskType: req.mask.type,
    lambda: req.lambda,
    method: req.method,
    endpoint: `${API_URL.replace(/\/$/, "")}/api/reconstruct`,
  });

  const form = new FormData();
  form.append("image", req.file);
  form.append("mask", req.mask, "mask.png");
  form.append("lambda", String(req.lambda));
  form.append("method", req.method);

  const candidates = [
    API_URL ? `${API_URL.replace(/\/$/, "")}/api/reconstruct` : null,
    "/api/reconstruct",
    "http://127.0.0.1:8000/api/reconstruct",
    "http://localhost:8000/api/reconstruct",
  ].filter(Boolean) as string[];

  const uniqueEndpoints = Array.from(new Set(candidates));
  let lastError: Error | null = null;
  let res: Response | null = null;

  for (const endpoint of uniqueEndpoints) {
    try {
      console.debug(`[Inpainting API] Attempting fetch to ${endpoint}`);
      res = await fetch(endpoint, {
        method: "POST",
        body: form,
      });
      if (res.status === 404 && endpoint === "/api/reconstruct") {
        continue;
      }
      break;
    } catch (err) {
      console.warn(`[Inpainting API] Failed to connect to ${endpoint}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (!res) {
    throw new Error(
      lastError?.message
        ? `Could not connect to backend at ${API_URL}: ${lastError.message}. Ensure backend is running on port 8000.`
        : "Could not connect to reconstruction backend. Ensure the server is running on port 8000.",
    );
  }

  if (!res.ok) {
    let errorMessage = `Server responded with ${res.status}`;
    try {
      const errorJson = await res.json();
      if (errorJson?.error?.message) {
        errorMessage = errorJson.error.message;
      } else if (typeof errorJson?.detail === "string") {
        errorMessage = errorJson.detail;
      }
    } catch {
      const text = await res.text().catch(() => "");
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  const data = (await res.json()) as ReconstructionResult;
  // Accept raw base64 as well as URLs/data URLs
  if (data.reconstructed_image && !/^(data:|https?:|blob:)/.test(data.reconstructed_image)) {
    data.reconstructed_image = `data:image/png;base64,${data.reconstructed_image}`;
  }
  return data;
}
