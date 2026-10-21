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


def test_reconstruction_modifies_damaged_pixels():
    """Verify that damaged pixels within the mask are actually reconstructed and modified."""
    h, w = 30, 30
    # Clean background is 180 (e.g. sky)
    img_arr = np.full((h, w, 3), 180, dtype=np.uint8)
    # Damage: a dark tear (pixel value 20) in rows 10:20, cols 10:20
    img_arr[10:20, 10:20, :] = 20
    img_bytes = make_png_bytes(img_arr, mode="RGB")

    # Mask precisely covering the damage
    mask_arr = np.zeros((h, w), dtype=np.uint8)
    mask_arr[10:20, 10:20] = 255
    mask_bytes = make_png_bytes(mask_arr, mode="L")

    resp = reconstruct_image_service(img_bytes, mask_bytes, lambda_value=0.01)

    assert resp.masked_pixels == 100
    assert resp.changed_pixels == 100  # All 100 damaged pixels were changed
    assert resp.converged is True

    # Decode returned image and verify the damaged dark tear was restored toward 180
    b64_data = resp.reconstructed_image.split(",", 1)[1]
    recon_bytes = base64.b64decode(b64_data)
    recon_decoded = decode_image(recon_bytes)
    recon_arr = np.round(recon_decoded.channels).astype(np.uint8)

    # The reconstructed region should be restored close to the surrounding sky (180), not 20
    reconstructed_patch = recon_arr[10:20, 10:20, :]
    assert np.all(reconstructed_patch > 160)
    assert np.all(reconstructed_patch <= 180)

    # Surrounding pixels must remain exactly 180
    unmasked = mask_arr == 0
    assert np.array_equal(recon_arr[unmasked], img_arr[unmasked])


def test_reconstruction_independent_components_no_color_leak():
    """Verify that multiple disconnected damage regions in different areas
    (e.g., sky vs forest) reconstruct using their respective local boundaries
    without leaking color into each other.
    """
    h, w = 60, 60
    img_arr = np.zeros((h, w, 3), dtype=np.uint8)
    # Sky region at top
    img_arr[:30, :, :] = [180, 210, 240]
    # Forest region at bottom
    img_arr[30:, :, :] = [30, 80, 30]

    img_bytes = make_png_bytes(img_arr, mode="RGB")

    # Hole 1 in the sky: rows 10:20, cols 10:20
    # Hole 2 in the forest: rows 40:50, cols 10:20
    mask_arr = np.zeros((h, w), dtype=np.uint8)
    mask_arr[10:20, 10:20] = 255
    mask_arr[40:50, 10:20] = 255
    mask_bytes = make_png_bytes(mask_arr, mode="L")

    resp = reconstruct_image_service(img_bytes, mask_bytes, lambda_value=0.01)

    assert resp.connected_regions == 2
    assert resp.masked_pixels == 200

    b64_data = resp.reconstructed_image.split(",", 1)[1]
    recon_bytes = base64.b64decode(b64_data)
    recon_decoded = decode_image(recon_bytes)
    recon_arr = np.round(recon_decoded.channels).astype(np.uint8)

    # Sky hole (rows 10:20, cols 10:20) should be restored to sky colors (~180, 210, 240)
    # It must NOT be darkened by the forest boundary below
    sky_patch = recon_arr[10:20, 10:20, :]
    assert np.all(sky_patch[:, :, 0] >= 175)
    assert np.all(sky_patch[:, :, 2] >= 235)

    # Forest hole (rows 40:50, cols 10:20) should be restored to forest colors (~30, 80, 30)
    # It must NOT be brightened/grayed by the sky boundary above
    forest_patch = recon_arr[40:50, 10:20, :]
    assert np.all(forest_patch[:, :, 0] <= 35)
    assert np.all(forest_patch[:, :, 2] <= 35)
