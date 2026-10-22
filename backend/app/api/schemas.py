"""Pydantic schemas for the inpainting API endpoints."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    description: str = "Linear Algebra Image Inpainting API"


class ImageDimensions(BaseModel):
    width: int
    height: int


class ReconstructionResponse(BaseModel):
    # Core response fields expected by frontend
    reconstructed_image: str = Field(
        ...,
        description="Data URL (data:image/png;base64,...) containing the reconstructed PNG image.",
    )
    psnr: Optional[float] = Field(
        None,
        description="Peak Signal-to-Noise Ratio (dB) against clean reference; null since real uploads lack ground truth.",
    )
    ssim: Optional[float] = Field(
        None,
        description="Structural Similarity Index against clean reference; null since real uploads lack ground truth.",
    )
    reconstruction_error: float = Field(
        ...,
        description="Relative least-squares optimality residual ||C^T(d-Cx)|| / (||C^T d|| + eps) upon solver completion.",
    )
    time_taken: float = Field(
        ...,
        description="Total computational time in seconds.",
    )

    # Scientific computing diagnostics and solver metadata
    image_width: int
    image_height: int
    masked_pixels: int
    masked_percentage: float
    connected_regions: int
    method: str
    lambda_value: float
    iterations: int
    converged: bool
    final_residual: float
    changed_pixels: Optional[int] = Field(
        None,
        description="Number of masked pixels whose output value differs from the input value (tolerance > 0.5 intensity).",
    )
