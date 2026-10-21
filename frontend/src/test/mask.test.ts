import { describe, expect, it } from "vitest";
import {
  countSelectedRegions,
  createBinaryMaskPixels,
  createGridSelection,
  mapGridCellAtPoint,
  remapGridSelection,
  selectedPixelCount,
  toggleGridCell,
  validateMaskPixelCount,
  validateSelection,
} from "@/utils/mask";

const dims = { width: 100, height: 50 };

describe("createGridSelection", () => {
  it("creates an empty grid of resolution squared cells", () => {
    const s = createGridSelection(20);
    expect(s.cells).toHaveLength(400);
    expect(s.cells.every((c) => !c)).toBe(true);
  });
});

describe("toggleGridCell", () => {
  it("toggles a cell and ignores out-of-range indices", () => {
    const s = createGridSelection(10);
    const on = toggleGridCell(s, 5);
    expect(on.cells[5]).toBe(true);
    expect(toggleGridCell(on, 5).cells[5]).toBe(false);
    expect(toggleGridCell(s, -1)).toBe(s);
    expect(toggleGridCell(s, 100)).toBe(s);
  });
});

describe("mapGridCellAtPoint", () => {
  it("maps points to the correct cell and rejects points outside", () => {
    expect(mapGridCellAtPoint(0, 0, 100, 100, 10)).toBe(0);
    expect(mapGridCellAtPoint(99, 99, 100, 100, 10)).toBe(99);
    expect(mapGridCellAtPoint(55, 5, 100, 100, 10)).toBe(5);
    expect(mapGridCellAtPoint(-1, 50, 100, 100, 10)).toBeNull();
    expect(mapGridCellAtPoint(100, 50, 100, 100, 10)).toBeNull();
    expect(mapGridCellAtPoint(50, 50, 0, 100, 10)).toBeNull();
  });
});

describe("selectedPixelCount", () => {
  it("counts exact pixels covered by selected cells", () => {
    let s = createGridSelection(10);
    s = toggleGridCell(s, 0); // top-left cell: 10x5 pixels in a 100x50 image
    expect(selectedPixelCount(s, dims)).toBe(50);
    const all = { ...s, cells: s.cells.map(() => true) };
    expect(selectedPixelCount(all, dims)).toBe(100 * 50);
  });
});

describe("countSelectedRegions", () => {
  it("counts 8-connected regions", () => {
    let s = createGridSelection(10);
    s = toggleGridCell(s, 0);
    s = toggleGridCell(s, 1); // adjacent to 0
    s = toggleGridCell(s, 22); // separate
    expect(countSelectedRegions(s)).toBe(2);
    s = toggleGridCell(s, 33); // diagonal to 22 — part of the same region (8-connected)
    expect(countSelectedRegions(s)).toBe(2);

    const diagonal = toggleGridCell(toggleGridCell(createGridSelection(10), 0), 11);
    expect(countSelectedRegions(diagonal)).toBe(1);
  });
});

describe("remapGridSelection", () => {
  it("preserves coverage when changing resolution", () => {
    let s = createGridSelection(10);
    s = toggleGridCell(s, 0); // top-left 10x10 block
    const remapped = remapGridSelection(s, 20);
    expect(remapped.resolution).toBe(20);
    // top-left 10x10 cell of a 10-grid covers the top-left 2x2 cells of a 20-grid
    expect(remapped.cells[0]).toBe(true);
    expect(remapped.cells[1]).toBe(true);
    expect(remapped.cells[20]).toBe(true);
    expect(remapped.cells[21]).toBe(true);
    expect(remapped.cells.filter(Boolean)).toHaveLength(4);
  });
});

describe("createBinaryMaskPixels", () => {
  it("produces an exact-size mask with 1s only in selected cells", () => {
    let s = createGridSelection(10);
    s = toggleGridCell(s, 0);
    const pixels = createBinaryMaskPixels(s, dims);
    expect(pixels).toHaveLength(100 * 50);
    expect(pixels[0]).toBe(1);
    expect(pixels[9]).toBe(1); // still inside first cell (width 10)
    expect(pixels[10]).toBe(0); // second cell, unselected
    expect(pixels[5 * 100]).toBe(0); // second row of cells
  });

  it("rejects images beyond the pixel limit", () => {
    const s = createGridSelection(10);
    expect(() => createBinaryMaskPixels(s, { width: 5000, height: 5000 })).toThrow();
  });

  it("rejects image dimensions beyond the backend per-dimension limit", () => {
    const s = createGridSelection(10);
    expect(() => createBinaryMaskPixels(s, { width: 4097, height: 4096 })).toThrow();
  });
});

describe("validateSelection", () => {
  it("requires at least one selected cell", () => {
    expect(validateSelection(createGridSelection(10), dims)).toMatch(/Select at least one/);
    const s = toggleGridCell(createGridSelection(10), 0);
    expect(validateSelection(s, dims)).toBeNull();
  });
});

describe("validateMaskPixelCount", () => {
  it("requires at least one painted pixel", () => {
    expect(validateMaskPixelCount(0, dims)).toMatch(/Highlight or select/);
  });

  it("validates valid pixel counts", () => {
    expect(validateMaskPixelCount(100, dims)).toBeNull();
  });

  it("rejects invalid dimensions", () => {
    expect(validateMaskPixelCount(10, { width: 0, height: 0 })).toMatch(/invalid dimensions/);
  });

  it("rejects selection exceeding 85% processing limit", () => {
    expect(validateMaskPixelCount(4500, { width: 100, height: 50 })).toMatch(
      /85% processing limit/,
    );
  });

  it("rejects selections exceeding the backend default masked-pixel limit", () => {
    expect(validateMaskPixelCount(2_000_001, { width: 2000, height: 2000 })).toMatch(
      /2,000,000-pixel processing limit/,
    );
  });

  it("rejects a mask whose dimensions exceed the image pixel limit", () => {
    expect(validateMaskPixelCount(1, { width: 4097, height: 4096 })).toMatch(
      /dimensions cannot exceed 4096 × 4096/,
    );
  });
});

describe("BrushMaskState", () => {
  it("keeps brush selection and bounded history in intrinsic mask state", async () => {
    const { BrushMaskState } = await import("@/utils/mask");
    const state = new BrushMaskState({ width: 40, height: 30 });

    expect(state.canvas.width).toBe(40);
    expect(state.canvas.height).toBe(30);
    expect(state.canUndo).toBe(false);
    expect(state.beginStroke(10, 12, 6, "paint")).toBeUndefined();
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
    expect(state.undo()).toBe(true);
    expect(state.canRedo).toBe(true);
    expect(state.redo()).toBe(true);
  });
});

describe("dataUrlToFile", () => {
  it("converts a base64 png data URL to a standard File object", async () => {
    const { dataUrlToFile } = await import("@/utils/mask");
    // 1x1 white PNG data url
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    const file = dataUrlToFile(dataUrl, "restored_pass1.png");
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("restored_pass1.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
  });
});
