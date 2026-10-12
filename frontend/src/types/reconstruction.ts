export type ReconstructionMethod = "tikhonov" | "smoothness";
export type GridResolution = 10 | 20 | 40;

export interface GridSelection {
  resolution: GridResolution;
  cells: boolean[];
}

export interface MaskDimensions {
  width: number;
  height: number;
}

export interface ReconstructionRequest {
  file: File;
  mask: Blob;
  maskDimensions: MaskDimensions;
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
