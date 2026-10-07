export type ReconstructionMethod = "tikhonov" | "smoothness";

export interface ReconstructionRequest {
  file: File;
  lambda: number;
  method: ReconstructionMethod;
}

export interface ReconstructionResult {
  reconstructed_image: string; // URL or data URL
  psnr: number;
  ssim: number;
  reconstruction_error: number;
  time_taken: number;
}

export interface UploadedImage {
  file: File;
  url: string;
  width: number;
  height: number;
}
