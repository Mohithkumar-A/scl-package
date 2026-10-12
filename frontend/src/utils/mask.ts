import type { GridResolution, GridSelection, MaskDimensions } from "@/types/reconstruction";

export const MASK_LIMITS = {
  maxPixels: 24_000_000,
  maxRegions: 100,
} as const;

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
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width * dimensions.height > MASK_LIMITS.maxPixels
  ) {
    throw new Error("Image dimensions exceed the supported mask size.");
  }
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
      const neighbors = [
        col > 0 ? index - 1 : -1,
        col < resolution - 1 ? index + 1 : -1,
        row > 0 ? index - resolution : -1,
        row < resolution - 1 ? index + resolution : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && cells[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue.push(neighbor);
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
  if (dimensions.width < 1 || dimensions.height < 1)
    return "The uploaded image has invalid dimensions.";
  if (dimensions.width * dimensions.height > MASK_LIMITS.maxPixels) {
    return `This image exceeds the ${MASK_LIMITS.maxPixels.toLocaleString()}-pixel processing limit.`;
  }
  if (selectedPixelCount(selection, dimensions) === 0)
    return "Select at least one damaged grid cell.";
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
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width * dimensions.height > MASK_LIMITS.maxPixels
  ) {
    throw new Error("Image dimensions exceed the supported mask size.");
  }
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
