"""FastAPI route handlers for inpainting endpoints."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.api.errors import InpaintingException, InvalidLambdaError
from app.api.schemas import HealthResponse, ReconstructionResponse
from app.services.reconstruction_service import reconstruct_image_service

router = APIRouter(prefix="/api", tags=["inpainting"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Simple health probe reporting service readiness."""
    return HealthResponse()


@router.post("/reconstruct", response_model=ReconstructionResponse)
async def reconstruct(
    image: UploadFile = File(..., description="Uploaded damaged image file (PNG, JPEG, WEBP)"),
    mask: UploadFile = File(..., description="Binary PNG damage mask (white=reconstruct, black=preserve)"),
    lambda_val: Optional[float] = Form(None, alias="lambda", description="Regularization parameter lambda"),
    lambda_value: Optional[float] = Form(None, description="Alternate field name for lambda"),
    method: str = Form("tikhonov", description="Reconstruction method identifier"),
) -> ReconstructionResponse:
    """Perform least-squares reconstruction with Tikhonov smoothness regularization."""
    # Resolve lambda from either form field alias
    chosen_lambda = lambda_val if lambda_val is not None else lambda_value
    if chosen_lambda is None:
        raise InvalidLambdaError("Missing regularization parameter lambda.")

    # Read uploaded file contents
    image_bytes = await image.read()
    mask_bytes = await mask.read()

    return reconstruct_image_service(
        image_bytes=image_bytes,
        mask_bytes=mask_bytes,
        lambda_value=chosen_lambda,
        method=method,
    )
