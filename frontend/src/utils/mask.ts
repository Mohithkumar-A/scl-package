import type { GridResolution, GridSelection, MaskDimensions } from "@/types/reconstruction";

export const MASK_LIMITS = {
  maxWidth: 4096,
  maxHeight: 4096,
  maxImagePixels: 16_777_216,
  maxMaskedPixels: 2_000_000,
  maxMaskedPercentage: 85,
  maxRegions: 100,
} as const;

function imageDimensionsError(dimensions: MaskDimensions): string | null {
  if (dimensions.width < 1 || dimensions.height < 1) {
    return "The uploaded image has invalid dimensions.";
  }
  if (dimensions.width > MASK_LIMITS.maxWidth || dimensions.height > MASK_LIMITS.maxHeight) {
    return `Image dimensions cannot exceed ${MASK_LIMITS.maxWidth} × ${MASK_LIMITS.maxHeight} pixels.`;
  }
  if (dimensions.width * dimensions.height > MASK_LIMITS.maxImagePixels) {
    return `This image exceeds the ${MASK_LIMITS.maxImagePixels.toLocaleString()}-pixel processing limit.`;
  }
  return null;
}

export type BrushOperation = "paint" | "erase";

/** Owns an intrinsic-resolution brush mask and its undo/redo history. */
export class BrushMaskState {
  readonly canvas: HTMLCanvasElement;
  private readonly undoStack: ImageData[] = [];
  private readonly redoStack: ImageData[] = [];
  private readonly maxHistorySnapshots = 30;
  private readonly maxHistoryBytes = 128 * 1024 * 1024;

  constructor(
    readonly dimensions: MaskDimensions,
    initialPixels?: Uint8Array,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = dimensions.width;
    this.canvas.height = dimensions.height;
    if (initialPixels) this.replaceBinaryPixels(initialPixels);
  }

  /** Replace the mask from intrinsic-resolution 0/1 pixel data without creating undo history. */
  replaceBinaryPixels(pixels: Uint8Array): void {
    const expectedLength = this.dimensions.width * this.dimensions.height;
    if (pixels.length !== expectedLength) {
      throw new Error("Damage mask dimensions must match the uploaded image.");
    }
    const context = this.context();
    const imageData = context.createImageData(this.dimensions.width, this.dimensions.height);
    for (let pixel = 0; pixel < pixels.length; pixel++) {
      if (pixels[pixel] === 0) continue;
      const offset = pixel * 4;
      imageData.data[offset] = 255;
      imageData.data[offset + 1] = 255;
      imageData.data[offset + 2] = 255;
      imageData.data[offset + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  beginStroke(x: number, y: number, width: number, operation: BrushOperation): void {
    const context = this.context();
    this.saveUndo(context);
    context.globalCompositeOperation = operation === "paint" ? "source-over" : "destination-out";
    if (operation === "paint") context.fillStyle = "white";
    context.beginPath();
    context.arc(x, y, width / 2, 0, Math.PI * 2);
    context.fill();
  }

  continueStroke(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    width: number,
    operation: BrushOperation,
  ): void {
    const context = this.context();
    context.globalCompositeOperation = operation === "paint" ? "source-over" : "destination-out";
    if (operation === "paint") context.strokeStyle = "white";
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    const context = this.context();
    this.redoStack.push(context.getImageData(0, 0, this.canvas.width, this.canvas.height));
    context.putImageData(previous, 0, 0);
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    const context = this.context();
    this.pushUndo(context.getImageData(0, 0, this.canvas.width, this.canvas.height));
    context.putImageData(next, 0, 0);
    return true;
  }

  clear(): void {
    const context = this.context();
    this.saveUndo(context);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  countPixels(): number {
    return countMaskCanvasPixels(this.canvas, this.dimensions);
  }

  private context(): CanvasRenderingContext2D {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the damage mask.");
    return context;
  }

  private saveUndo(context: CanvasRenderingContext2D): void {
    this.pushUndo(context.getImageData(0, 0, this.canvas.width, this.canvas.height));
    this.redoStack.length = 0;
  }

  private pushUndo(snapshot: ImageData): void {
    const bytesPerSnapshot = this.dimensions.width * this.dimensions.height * 4;
    const memoryBoundedLimit = Math.max(1, Math.floor(this.maxHistoryBytes / bytesPerSnapshot));
    const historyLimit = Math.min(this.maxHistorySnapshots, memoryBoundedLimit);
    if (this.undoStack.length >= historyLimit) this.undoStack.shift();
    this.undoStack.push(snapshot);
  }
}

export function createGridSelection(resolution: GridResolution = 20): GridSelection {
  return { resolution, cells: Array(resolution * resolution).fill(false) };
}

export function toggleGridCell(
  selection: GridSelection,
  index: number,
  value?: boolean,
): GridSelection {
  if (index < 0 || index >= selection.cells.length) return selection;
  const cells = selection.cells.slice();
  cells[index] = value ?? !cells[index];
  return { ...selection, cells };
}

/** Remap selected-cell coverage when the grid resolution changes. */
export function remapGridSelection(
  selection: GridSelection,
  resolution: GridResolution,
): GridSelection {
  if (selection.resolution === resolution) return selection;
  const oldResolution = selection.resolution;
  const cells = Array(resolution * resolution).fill(false) as boolean[];
  const targetCellArea = oldResolution * oldResolution;

  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      let selectedArea = 0;
      for (let oldRow = 0; oldRow < oldResolution; oldRow++) {
        const overlapY = Math.max(
          0,
          Math.min((row + 1) * oldResolution, (oldRow + 1) * resolution) -
            Math.max(row * oldResolution, oldRow * resolution),
        );
        if (overlapY === 0) continue;
        for (let oldCol = 0; oldCol < oldResolution; oldCol++) {
          if (!selection.cells[oldRow * oldResolution + oldCol]) continue;
          const overlapX = Math.max(
            0,
            Math.min((col + 1) * oldResolution, (oldCol + 1) * resolution) -
              Math.max(col * oldResolution, oldCol * resolution),
          );
          selectedArea += overlapX * overlapY;
        }
      }
      cells[row * resolution + col] = selectedArea * 2 >= targetCellArea;
    }
  }

  return { resolution, cells };
}

export function mapGridCellAtPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  resolution: GridResolution,
): number | null {
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x >= width || y >= height) return null;
  const col = Math.min(resolution - 1, Math.floor((x / width) * resolution));
  const row = Math.min(resolution - 1, Math.floor((y / height) * resolution));
  return row * resolution + col;
}

export function selectedPixelCount(selection: GridSelection, dimensions: MaskDimensions): number {
  const { resolution, cells } = selection;
  let pixels = 0;
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      if (!cells[row * resolution + col]) continue;
      const bounds = getGridCellPixelBounds(row, col, resolution, dimensions);
      pixels += (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
    }
  }
  return pixels;
}

export function getGridCellPixelBounds(
  row: number,
  col: number,
  resolution: GridResolution,
  dimensions: MaskDimensions,
) {
  return {
    left: Math.floor((col * dimensions.width) / resolution),
    right: Math.floor(((col + 1) * dimensions.width) / resolution),
    top: Math.floor((row * dimensions.height) / resolution),
    bottom: Math.floor(((row + 1) * dimensions.height) / resolution),
  };
}

/** Raw one-byte mask: 0 preserves a pixel and 1 marks it for reconstruction. */
export function createBinaryMaskPixels(
  selection: GridSelection,
  dimensions: MaskDimensions,
): Uint8Array {
  const dimensionsError = imageDimensionsError(dimensions);
  if (dimensionsError) throw new Error(dimensionsError);
  const pixels = new Uint8Array(dimensions.width * dimensions.height);
  for (let row = 0; row < selection.resolution; row++) {
    for (let col = 0; col < selection.resolution; col++) {
      if (!selection.cells[row * selection.resolution + col]) continue;
      const bounds = getGridCellPixelBounds(row, col, selection.resolution, dimensions);
      for (let y = bounds.top; y < bounds.bottom; y++) {
        pixels.fill(1, y * dimensions.width + bounds.left, y * dimensions.width + bounds.right);
      }
    }
  }
  return pixels;
}

export function countSelectedRegions(selection: GridSelection): number {
  const { resolution, cells } = selection;
  const visited = new Uint8Array(cells.length);
  let regions = 0;
  for (let start = 0; start < cells.length; start++) {
    if (!cells[start] || visited[start]) continue;
    regions++;
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor]!;
      const row = Math.floor(index / resolution);
      const col = index % resolution;
      for (
        let neighborRow = Math.max(0, row - 1);
        neighborRow <= Math.min(resolution - 1, row + 1);
        neighborRow++
      ) {
        for (
          let neighborCol = Math.max(0, col - 1);
          neighborCol <= Math.min(resolution - 1, col + 1);
          neighborCol++
        ) {
          if (neighborRow === row && neighborCol === col) continue;
          const neighbor = neighborRow * resolution + neighborCol;
          if (cells[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
    }
  }
  return regions;
}

export function validateSelection(
  selection: GridSelection,
  dimensions: MaskDimensions,
): string | null {
  const dimensionsError = imageDimensionsError(dimensions);
  if (dimensionsError) return dimensionsError;
  const totalPixels = dimensions.width * dimensions.height;
  const maskedPixels = selectedPixelCount(selection, dimensions);
  if (maskedPixels === 0) return "Select at least one damaged grid cell.";
  if (maskedPixels > MASK_LIMITS.maxMaskedPixels) {
    return `Selected damage exceeds the ${MASK_LIMITS.maxMaskedPixels.toLocaleString()}-pixel processing limit.`;
  }
  if ((maskedPixels / totalPixels) * 100 > MASK_LIMITS.maxMaskedPercentage) {
    return `Selected damaged area exceeds the ${MASK_LIMITS.maxMaskedPercentage}% processing limit.`;
  }
  const regions = countSelectedRegions(selection);
  if (regions > MASK_LIMITS.maxRegions) {
    return `Selection has ${regions} separate regions; the current limit is ${MASK_LIMITS.maxRegions}.`;
  }
  return null;
}

export async function createBinaryMaskPNG(
  selection: GridSelection,
  dimensions: MaskDimensions,
): Promise<Blob> {
  const dimensionsError = imageDimensionsError(dimensions);
  if (dimensionsError) throw new Error(dimensionsError);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the damage mask.");

  context.fillStyle = "black";
  context.fillRect(0, 0, dimensions.width, dimensions.height);
  context.fillStyle = "white";
  const { resolution, cells } = selection;
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      if (!cells[row * resolution + col]) continue;
      const bounds = getGridCellPixelBounds(row, col, resolution, dimensions);
      context.fillRect(
        bounds.left,
        bounds.top,
        bounds.right - bounds.left,
        bounds.bottom - bounds.top,
      );
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the damage mask."));
    }, "image/png");
  });
}

/** Converts an arbitrary brush canvas into a standard binary PNG Blob (white=reconstruct, black=preserve). */
export async function createMaskCanvasPNG(
  maskCanvas: HTMLCanvasElement,
  dimensions: MaskDimensions,
): Promise<Blob> {
  const dimensionsError = imageDimensionsError(dimensions);
  if (dimensionsError) throw new Error(dimensionsError);
  if (maskCanvas.width !== dimensions.width || maskCanvas.height !== dimensions.height) {
    throw new Error("Damage mask dimensions must match the uploaded image.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the damage mask.");

  // Black background = preserve
  context.fillStyle = "black";
  context.fillRect(0, 0, dimensions.width, dimensions.height);

  const sourceContext = maskCanvas.getContext("2d");
  if (!sourceContext) throw new Error("Could not read the damage mask.");
  const data = sourceContext.getImageData(0, 0, dimensions.width, dimensions.height).data;
  const outData = context.createImageData(dimensions.width, dimensions.height);
  const out = outData.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha > 20) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    } else {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    }
  }
  context.putImageData(outData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the damage mask."));
    }, "image/png");
  });
}

/** Counts non-zero pixels in a brush mask canvas */
export function countMaskCanvasPixels(
  maskCanvas: HTMLCanvasElement,
  dimensions: MaskDimensions,
): number {
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return 0;
  try {
    const imgData = ctx.getImageData(0, 0, dimensions.width, dimensions.height);
    const data = imgData.data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i] ?? 0;
      if (alpha > 20) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/** Validates mask pixel count against image dimensions and limits */
export function validateMaskPixelCount(count: number, dimensions: MaskDimensions): string | null {
  const dimensionsError = imageDimensionsError(dimensions);
  if (dimensionsError) return dimensionsError;
  const total = dimensions.width * dimensions.height;
  if (count === 0) {
    return "Highlight or select at least one damaged area.";
  }
  if (count > total) {
    return "The damage mask contains more pixels than the uploaded image.";
  }
  if (count > MASK_LIMITS.maxMaskedPixels) {
    return `Selection exceeds the ${MASK_LIMITS.maxMaskedPixels.toLocaleString()}-pixel processing limit.`;
  }
  if ((count / total) * 100 > MASK_LIMITS.maxMaskedPercentage) {
    return `Selected damaged area exceeds the ${MASK_LIMITS.maxMaskedPercentage}% processing limit.`;
  }
  return null;
}

/**
 * Converts a Base64 data URL (e.g. "data:image/png;base64,...") to a standard File object.
 * Safe for all browser environments and Vitest/Node test environments without network overhead.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "image/png";
  const b64Data = parts[1] || "";

  const binaryString =
    typeof atob === "function"
      ? atob(b64Data)
      : typeof Buffer !== "undefined"
        ? Buffer.from(b64Data, "base64").toString("binary")
        : "";

  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}
