"""Integration tests for FastAPI HTTP routes and structured error responses."""

import io
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def make_png_buffer(arr: np.ndarray, mode: str = "RGB") -> io.BytesIO:
    """Helper to convert array to in-memory PNG buffer."""
    pil_img = Image.fromarray(arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def test_health_check_endpoint():
    """Verify GET /api/health probe."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_reconstruct_endpoint_success():
    """Verify POST /api/reconstruct successfully processes valid uploads."""
    img_arr = np.full((16, 16, 3), 100, dtype=np.uint8)
    mask_arr = np.zeros((16, 16), dtype=np.uint8)
    mask_arr[4:8, 4:8] = 255

    img_buf = make_png_buffer(img_arr, mode="RGB")
    mask_buf = make_png_buffer(mask_arr, mode="L")

    response = client.post(
        "/api/reconstruct",
        files={
            "image": ("test.png", img_buf, "image/png"),
            "mask": ("mask.png", mask_buf, "image/png"),
        },
        data={"lambda": "0.01", "method": "tikhonov"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["reconstructed_image"].startswith("data:image/png;base64,")
    assert data["image_width"] == 16
    assert data["image_height"] == 16
    assert data["masked_pixels"] == 16
    assert data["converged"] is True
    assert data["psnr"] is None  # authentic reporting
    assert data["ssim"] is None


def test_reconstruct_empty_mask_error():
    """Verify structured error when no damage is marked."""
    img_arr = np.full((16, 16, 3), 100, dtype=np.uint8)
    mask_arr = np.zeros((16, 16), dtype=np.uint8)  # all zeros = empty

    img_buf = make_png_buffer(img_arr, mode="RGB")
    mask_buf = make_png_buffer(mask_arr, mode="L")

    response = client.post(
        "/api/reconstruct",
        files={
            "image": ("test.png", img_buf, "image/png"),
            "mask": ("mask.png", mask_buf, "image/png"),
        },
        data={"lambda": "0.01", "method": "tikhonov"},
    )

    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "EMPTY_MASK"


def test_reconstruct_dimension_mismatch_error():
    """Verify structured error when mask dimensions differ from image."""
    img_arr = np.full((20, 20, 3), 100, dtype=np.uint8)
    mask_arr = np.zeros((10, 10), dtype=np.uint8)  # 10x10 vs 20x20
    mask_arr[2:5, 2:5] = 255

    img_buf = make_png_buffer(img_arr, mode="RGB")
    mask_buf = make_png_buffer(mask_arr, mode="L")

    response = client.post(
        "/api/reconstruct",
        files={
            "image": ("test.png", img_buf, "image/png"),
            "mask": ("mask.png", mask_buf, "image/png"),
        },
        data={"lambda": "0.01", "method": "tikhonov"},
    )

    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "MASK_DIMENSION_MISMATCH"


def test_reconstruct_invalid_lambda_error():
    """Verify structured error when lambda is negative or invalid."""
    img_arr = np.full((16, 16, 3), 100, dtype=np.uint8)
    mask_arr = np.zeros((16, 16), dtype=np.uint8)
    mask_arr[4:8, 4:8] = 255

    img_buf = make_png_buffer(img_arr, mode="RGB")
    mask_buf = make_png_buffer(mask_arr, mode="L")

    response = client.post(
        "/api/reconstruct",
        files={
            "image": ("test.png", img_buf, "image/png"),
            "mask": ("mask.png", mask_buf, "image/png"),
        },
        data={"lambda": "-1.0", "method": "tikhonov"},
    )

    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_LAMBDA"


def test_reconstruct_unsupported_method_error():
    """Verify structured error when unsupported method identifier is passed."""
    img_arr = np.full((16, 16, 3), 100, dtype=np.uint8)
    mask_arr = np.zeros((16, 16), dtype=np.uint8)
    mask_arr[4:8, 4:8] = 255

    img_buf = make_png_buffer(img_arr, mode="RGB")
    mask_buf = make_png_buffer(mask_arr, mode="L")

    response = client.post(
        "/api/reconstruct",
        files={
            "image": ("test.png", img_buf, "image/png"),
            "mask": ("mask.png", mask_buf, "image/png"),
        },
        data={"lambda": "0.01", "method": "deep_learning_inpaint"},
    )

    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "UNSUPPORTED_METHOD"
