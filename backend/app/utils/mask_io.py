"""Mask decoding and binary conversion utilities."""

from __future__ import annotations

import io
from typing import Tuple
import numpy as np
from PIL import Image

from app.api.errors import (
    InvalidMaskError,
    MaskDimensionMismatchError,
)


def decode_binary_mask(mask_bytes: bytes, expected_width: int, expected_height: int) -> np.ndarray:
    """Decode a mask image into a 2D boolean array of shape (height, width).

    Convention:
      - True (1): reconstruct damaged pixel
      - False (0): preserve known pixel
    """
    if not mask_bytes:
        raise InvalidMaskError("Mask upload is empty.")

    try:
        pil_mask = Image.open(io.BytesIO(mask_bytes))
        pil_mask.load()
    except Exception as exc:
        raise InvalidMaskError(f"Failed to decode mask: {exc}") from exc

    width, height = pil_mask.size
    if width != expected_width or height != expected_height:
        raise MaskDimensionMismatchError(
            f"Mask dimensions ({width}x{height}) do not match image dimensions ({expected_width}x{expected_height})."
        )

    # Convert to grayscale luminance
    gray = pil_mask.convert("L")
    arr = np.array(gray, dtype=np.uint8)

    # Threshold: white / non-zero = damaged (1/True), black = preserve (0/False)
    mask = arr > 127

    return mask
