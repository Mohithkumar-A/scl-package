export type ReconstructionMethod = "tikhonov" | "smoothness";
export type GridResolution = 10 | 20 | 40;
export type MaskTool = "brush" | "grid";

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
  psnr: number | null;
  ssim: number | null;
  reconstruction_error: number;
  time_taken: number;
  iterations?: number;
  converged?: boolean;
  final_residual?: number;
  masked_pixels?: number;
  masked_percentage?: number;
  connected_regions?: number;
  method?: string;
  lambda_value?: number;
  image_width?: number;
  image_height?: number;
  changed_pixels?: number;
}

export interface UploadedImage {
  file: File;
  url: string;
  width: number;
  height: number;
}
