"""Unit tests for mask decoding, binary validation, and connected-component analysis."""

import numpy as np
import pytest

from app.api.errors import (
    EmptyMaskError,
    FullImageMaskError,
    InsufficientBoundaryError,
    MaskDimensionMismatchError,
    MaskTooLargeError,
    TooManyRegionsError,
)
from app.calculations.mask_validation import analyze_connected_regions, validate_mask
from app.utils.mask_io import decode_binary_mask
from PIL import Image
import io


def create_png_mask(arr: np.ndarray) -> bytes:
    """Helper to encode a 2D uint8 array into PNG bytes."""
    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def test_decode_binary_mask_convention():
    """Verify 0=preserve, 1=reconstruct thresholding convention."""
    arr = np.zeros((10, 10), dtype=np.uint8)
    arr[2:5, 3:6] = 255  # white = damaged
    png_bytes = create_png_mask(arr)

    mask = decode_binary_mask(png_bytes, 10, 10)
    assert mask.shape == (10, 10)
    assert mask.dtype == bool
    assert mask[0, 0] is np.False_ or mask[0, 0] == False
    assert mask[3, 4] is np.True_ or mask[3, 4] == True
    assert np.count_nonzero(mask) == 9


def test_decode_mask_dimension_mismatch():
    """Verify error when mask dimensions differ from image."""
    arr = np.zeros((20, 20), dtype=np.uint8)
    png_bytes = create_png_mask(arr)
    with pytest.raises(MaskDimensionMismatchError):
        decode_binary_mask(png_bytes, 15, 20)


def test_empty_mask_validation():
    """Empty mask must be rejected."""
    mask = np.zeros((50, 50), dtype=bool)
    with pytest.raises(EmptyMaskError):
        validate_mask(mask)


def test_full_image_mask_validation():
    """Full-image mask lacking known boundaries must be rejected."""
    mask = np.ones((50, 50), dtype=bool)
    with pytest.raises(FullImageMaskError):
        validate_mask(mask)


def test_connected_regions_8_connectivity():
    """Verify 8-connectivity treats diagonal adjacent pixels as single region."""
    mask = np.zeros((10, 10), dtype=bool)
    # Diagonal pixels: (2, 2) and (3, 3)
    mask[2, 2] = True
    mask[3, 3] = True
    # Separate disconnected pixel at (7, 7)
    mask[7, 7] = True

    count, max_sz, sizes = analyze_connected_regions(mask)
    assert count == 2
    assert max_sz == 2
    assert sorted(sizes) == [1, 2]


def test_edge_and_corner_damage():
    """Regions touching image boundaries and corners must be valid."""
    mask = np.zeros((10, 10), dtype=bool)
    mask[0, 0] = True  # top-left corner
    mask[0, 1] = True
    mask[9, 8] = True  # bottom edge
    mask[9, 9] = True  # bottom-right corner

    val = validate_mask(mask)
    assert val.masked_pixels == 4
    assert val.region_count == 2


def test_too_many_regions_limit(monkeypatch):
    """Enforce maximum disconnected regions limit."""
    import app.config

    monkeypatch.setattr(app.config.settings, "max_connected_regions", 3)

    mask = np.zeros((20, 20), dtype=bool)
    # Create 4 separate regions
    mask[1, 1] = True
    mask[5, 5] = True
    mask[10, 10] = True
    mask[15, 15] = True

    with pytest.raises(TooManyRegionsError):
        validate_mask(mask)


def test_masked_percentage_limit(monkeypatch):
    """Enforce total masked percentage limit."""
    import app.config

    monkeypatch.setattr(app.config.settings, "max_masked_percentage", 20.0)

    mask = np.zeros((10, 10), dtype=bool)
    mask[:5, :] = True  # 50% masked

    with pytest.raises(MaskTooLargeError):
        validate_mask(mask)
