"""Image decoding, validation, color-channel extraction, and encoding utilities."""

from __future__ import annotations

import base64
import io
from typing import Optional, Tuple
import numpy as np
from PIL import Image

from app.api.errors import (
    ImageTooLargeError,
    InvalidImageError,
    UnsupportedFormatError,
)
from app.config import settings


class DecodedImage:
    def __init__(
        self,
        channels: np.ndarray,  # shape (H, W, C) float32 in [0, 255]
        alpha: Optional[np.ndarray],  # shape (H, W) uint8 in [0, 255] or None
        original_mode: str,
        width: int,
        height: int,
    ) -> None:
        self.channels = channels
        self.alpha = alpha
        self.original_mode = original_mode
        self.width = width
        self.height = height


def decode_image(image_bytes: bytes) -> DecodedImage:
    """Decode raw image bytes into normalized numpy channel arrays and metadata.

    Supports RGB, RGBA, Grayscale (L), and Palette images.
    Preserves alpha channel verbatim so transparency is untouched.
    """
    if not image_bytes:
        raise InvalidImageError("Image upload is empty.")

    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        pil_image.load()
    except Exception as exc:
        raise InvalidImageError(f"Failed to decode image: {exc}") from exc

    width, height = pil_image.size
    if width <= 0 or height <= 0:
        raise InvalidImageError("Image has invalid or zero dimensions.")

    if width > settings.max_image_width or height > settings.max_image_height:
        raise ImageTooLargeError(
            f"Image dimensions ({width}x{height}) exceed maximum allowed ({settings.max_image_width}x{settings.max_image_height})."
        )

    if width * height > settings.max_total_pixels:
        raise ImageTooLargeError(
            f"Total pixels ({width * height:,}) exceeds computational budget ({settings.max_total_pixels:,})."
        )

    orig_mode = pil_image.mode
    alpha: Optional[np.ndarray] = None

    if orig_mode == "L":
        # Grayscale single-channel
        arr = np.array(pil_image, dtype=np.float32)[:, :, np.newaxis]
    elif orig_mode == "RGB":
        arr = np.array(pil_image, dtype=np.float32)
    elif orig_mode == "RGBA":
        rgba = np.array(pil_image, dtype=np.uint8)
        arr = rgba[:, :, :3].astype(np.float32)
        alpha = rgba[:, :, 3]
    elif orig_mode == "P":
        # Palette mode: convert based on presence of transparency
        if "transparency" in pil_image.info:
            converted = pil_image.convert("RGBA")
            rgba = np.array(converted, dtype=np.uint8)
            arr = rgba[:, :, :3].astype(np.float32)
            alpha = rgba[:, :, 3]
        else:
            converted = pil_image.convert("RGB")
            arr = np.array(converted, dtype=np.float32)
    elif orig_mode in ("CMYK", "YCbCr"):
        converted = pil_image.convert("RGB")
        arr = np.array(converted, dtype=np.float32)
    else:
        raise UnsupportedFormatError(f"Unsupported image color mode '{orig_mode}'.")

    return DecodedImage(
        channels=arr,
        alpha=alpha,
        original_mode=orig_mode,
        width=width,
        height=height,
    )


def encode_image_to_base64_png(
    channels: np.ndarray,  # shape (H, W, C) float in [0, 255]
    alpha: Optional[np.ndarray] = None,
    original_mode: str = "RGB",
) -> str:
    """Encode reconstructed channels back into a standard PNG base64 data URL."""
    # Clip intensity to valid 8-bit dynamic range [0, 255]
    clipped = np.clip(np.round(channels), 0, 255).astype(np.uint8)

    if clipped.ndim == 3 and clipped.shape[2] == 1:
        # Grayscale
        pil_img = Image.fromarray(clipped[:, :, 0])
        if original_mode != "L":
            pil_img = pil_img.convert("RGB")
    elif alpha is not None:
        # Combine RGB channels with original alpha
        h, w, c = clipped.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        rgba[:, :, :3] = clipped
        rgba[:, :, 3] = alpha
        pil_img = Image.fromarray(rgba)
    else:
        pil_img = Image.fromarray(clipped)

    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG", optimize=True)
    b64_str = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64_str}"
