import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DamageGrid } from "@/components/DamageGrid";

describe("DamageGrid Component", () => {
  const defaultProps = {
    src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    originalSrc:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    dims: { width: 400, height: 300 },
    passCount: 0,
    brushPixelCount: 0,
    onBrushChange: vi.fn(),
  };

  it("renders zoom controls and allows zooming in, out, and resetting to fit", () => {
    render(<DamageGrid {...defaultProps} />);

    // Initial zoom indicator (in indicator span and preset button)
    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);

    // Zoom In button
    const zoomInBtn = screen.getByTitle("Zoom in (25%)");
    fireEvent.click(zoomInBtn);

    // Indicator should increase to 125%
    expect(screen.getByText("125%")).toBeInTheDocument();

    // Fit button should appear when zoomed
    const fitBtn = screen.getByTitle("Reset to 100% Fit");
    expect(fitBtn).toBeInTheDocument();

    // Click Zoom In again to reach 150%
    fireEvent.click(zoomInBtn);
    expect(screen.getAllByText("150%").length).toBeGreaterThanOrEqual(1);

    // Click Fit button to reset to 100%
    fireEvent.click(fitBtn);
    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);
  });

  it("adjusts brush size using +/- buttons", () => {
    render(<DamageGrid {...defaultProps} />);

    expect(screen.getByText("Size: 10px")).toBeInTheDocument();

    const increaseBtn = screen.getByTitle("Increase brush size");
    fireEvent.click(increaseBtn);
    expect(screen.getByText("Size: 12px")).toBeInTheDocument();

    const decreaseBtn = screen.getByTitle("Decrease brush size");
    fireEvent.click(decreaseBtn);
    expect(screen.getByText("Size: 10px")).toBeInTheDocument();
  });

  it("renders underlay view toggle when passCount > 0", () => {
    const { rerender } = render(<DamageGrid {...defaultProps} passCount={0} />);
    expect(screen.queryByText(/Canvas Underlay:/)).not.toBeInTheDocument();

    rerender(<DamageGrid {...defaultProps} passCount={2} />);
    expect(screen.getByText(/Canvas Underlay:/)).toBeInTheDocument();
    expect(screen.getByText("Restored (Pass 2)")).toBeInTheDocument();
    expect(screen.getByText("Original Photo")).toBeInTheDocument();
  });
});
