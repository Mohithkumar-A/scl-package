"""Integration tests for the end-to-end image inpainting reconstruction service."""

import base64
import io
import numpy as np
import pytest
from PIL import Image

from app.services.reconstruction_service import reconstruct_image_service
from app.utils.image_io import decode_image


def make_png_bytes(arr: np.ndarray, mode: str = "RGB") -> bytes:
    """Helper to convert numpy array to PNG bytes."""
    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def test_reconstruction_preserves_unmasked_pixels():
    """Unselected pixels must remain completely identical to the input."""
    h, w = 24, 24
    # Create random synthetic RGB image
    np.random.seed(42)
    img_arr = np.random.randint(50, 200, (h, w, 3), dtype=np.uint8)
    img_bytes = make_png_bytes(img_arr, mode="RGB")

    # Create mask with damaged patch in center (8:16, 8:16)
    mask_arr = np.zeros((h, w), dtype=np.uint8)
    mask_arr[8:16, 8:16] = 255
    mask_bytes = make_png_bytes(mask_arr, mode="L")

    resp = reconstruct_image_service(
        image_bytes=img_bytes,
        mask_bytes=mask_bytes,
        lambda_value=0.01,
        method="tikhonov",
    )

    assert resp.image_width == w
    assert resp.image_height == h
    assert resp.masked_pixels == 64
    assert resp.connected_regions == 1
    assert resp.psnr is None  # no ground-truth reference
    assert resp.ssim is None

    # Decode returned base64 image and check pixels
    b64_data = resp.reconstructed_image.split(",", 1)[1]
    recon_bytes = base64.b64decode(b64_data)
    recon_decoded = decode_image(recon_bytes)
    recon_arr = np.round(recon_decoded.channels).astype(np.uint8)

    # Check that unmasked pixels are preserved
    unmasked = mask_arr == 0
    assert np.array_equal(recon_arr[unmasked], img_arr[unmasked])


def test_reconstruction_multiple_disconnected_regions():
    """Verify inpainting with multiple separated damage holes."""
    h, w = 30, 30
    img_arr = np.full((h, w, 3), 128, dtype=np.uint8)
    img_bytes = make_png_bytes(img_arr, mode="RGB")

    mask_arr = np.zeros((h, w), dtype=np.uint8)
    mask_arr[2:5, 2:5] = 255      # region 1
    mask_arr[20:25, 20:25] = 255  # region 2
    mask_bytes = make_png_bytes(mask_arr, mode="L")

    resp = reconstruct_image_service(img_bytes, mask_bytes, lambda_value=0.01)
    assert resp.connected_regions == 2
    assert resp.masked_pixels == 9 + 25
    assert resp.converged is True


def test_reconstruction_grayscale_image():
    """Verify single-channel grayscale (L) image processing."""
    h, w = 20, 20
    img_arr = np.full((h, w), 80, dtype=np.uint8)
    img_bytes = make_png_bytes(img_arr, mode="L")

    mask_arr = np.zeros((h, w), dtype=np.uint8)
    mask_arr[5:10, 5:10] = 255
    mask_bytes = make_png_bytes(mask_arr, mode="L")

    resp = reconstruct_image_service(img_bytes, mask_bytes, lambda_value=0.01)
    assert resp.masked_pixels == 25
    assert resp.time_taken >= 0


def test_reconstruction_rgba_preserves_alpha():
    """Verify RGBA image reconstruction preserves alpha channel verbatim."""
    h, w = 16, 16
    rgba_arr = np.zeros((h, w, 4), dtype=np.uint8)
    rgba_arr[:, :, :3] = 150
    rgba_arr[:, :, 3] = 200  # distinct non-opaque alpha
    img_bytes = make_png_bytes(rgba_arr, mode="RGBA")

    mask_arr = np.zeros((h, w), dtype=np.uint8)
    mask_arr[4:8, 4:8] = 255
    mask_bytes = make_png_bytes(mask_arr, mode="L")

    resp = reconstruct_image_service(img_bytes, mask_bytes, lambda_value=0.01)

    b64_data = resp.reconstructed_image.split(",", 1)[1]
    recon_bytes = base64.b64decode(b64_data)
    recon_decoded = decode_image(recon_bytes)
    assert recon_decoded.alpha is not None
    assert np.array_equal(recon_decoded.alpha, rgba_arr[:, :, 3])
