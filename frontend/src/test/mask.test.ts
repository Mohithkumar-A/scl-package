import { describe, expect, it } from "vitest";
import {
  countSelectedRegions,
  createBinaryMaskPixels,
  createGridSelection,
  mapGridCellAtPoint,
  remapGridSelection,
  selectedPixelCount,
  toggleGridCell,
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
  it("counts 4-connected regions", () => {
    let s = createGridSelection(10);
    s = toggleGridCell(s, 0);
    s = toggleGridCell(s, 1); // adjacent to 0
    s = toggleGridCell(s, 22); // separate
    expect(countSelectedRegions(s)).toBe(2);
    s = toggleGridCell(s, 33); // diagonal to 22 — still separate (4-connected)
    expect(countSelectedRegions(s)).toBe(3);
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
});

describe("validateSelection", () => {
  it("requires at least one selected cell", () => {
    expect(validateSelection(createGridSelection(10), dims)).toMatch(/Select at least one/);
    const s = toggleGridCell(createGridSelection(10), 0);
    expect(validateSelection(s, dims)).toBeNull();
  });
});
