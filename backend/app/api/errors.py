"""Structured error models and custom exceptions for the inpainting API."""

from __future__ import annotations

from typing import Optional
from fastapi import HTTPException
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class InpaintingException(HTTPException):
    """Base exception for inpainting application errors with structured error codes."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(
            status_code=status_code,
            detail={"error": {"code": code, "message": message}},
        )


class InvalidImageError(InpaintingException):
    def __init__(self, message: str = "The uploaded image could not be decoded or is invalid.") -> None:
        super().__init__(status_code=400, code="INVALID_IMAGE", message=message)


class UnsupportedFormatError(InpaintingException):
    def __init__(self, message: str = "The image format is not supported. Use JPEG, PNG, or WEBP.") -> None:
        super().__init__(status_code=415, code="UNSUPPORTED_FORMAT", message=message)


class ImageTooLargeError(InpaintingException):
    def __init__(self, message: str = "Image dimensions exceed the allowed computational limit.") -> None:
        super().__init__(status_code=413, code="IMAGE_TOO_LARGE", message=message)


class InvalidMaskError(InpaintingException):
    def __init__(self, message: str = "The damage mask is invalid or could not be decoded.") -> None:
        super().__init__(status_code=422, code="INVALID_MASK", message=message)


class MaskDimensionMismatchError(InpaintingException):
    def __init__(self, message: str = "Mask dimensions must exactly match the uploaded image dimensions.") -> None:
        super().__init__(status_code=422, code="MASK_DIMENSION_MISMATCH", message=message)


class EmptyMaskError(InpaintingException):
    def __init__(self, message: str = "No damaged pixels were marked for reconstruction.") -> None:
        super().__init__(status_code=422, code="EMPTY_MASK", message=message)


class FullImageMaskError(InpaintingException):
    def __init__(self, message: str = "Cannot reconstruct: the entire image is marked as damaged without boundary reference.") -> None:
        super().__init__(status_code=422, code="FULL_IMAGE_MASK", message=message)


class MaskTooLargeError(InpaintingException):
    def __init__(self, message: str = "The total masked area exceeds the configured reconstruction limit.") -> None:
        super().__init__(status_code=413, code="MASK_TOO_LARGE", message=message)


class RegionTooLargeError(InpaintingException):
    def __init__(self, message: str = "A single connected damage region exceeds the maximum allowed size.") -> None:
        super().__init__(status_code=413, code="REGION_TOO_LARGE", message=message)


class TooManyRegionsError(InpaintingException):
    def __init__(self, message: str = "The selection contains too many disconnected damage regions.") -> None:
        super().__init__(status_code=422, code="TOO_MANY_REGIONS", message=message)


class InsufficientBoundaryError(InpaintingException):
    def __init__(self, message: str = "Damaged region lacks sufficient known boundary pixels for a well-posed solve.") -> None:
        super().__init__(status_code=422, code="INSUFFICIENT_BOUNDARY", message=message)


class InvalidLambdaError(InpaintingException):
    def __init__(self, message: str = "Regularization parameter lambda must be a positive finite number.") -> None:
        super().__init__(status_code=422, code="INVALID_LAMBDA", message=message)


class SolverNotConvergedError(InpaintingException):
    def __init__(self, message: str = "Numerical solver failed to converge within the maximum iteration budget.") -> None:
        super().__init__(status_code=503, code="SOLVER_NOT_CONVERGED", message=message)


class ComputationLimitExceededError(InpaintingException):
    def __init__(self, message: str = "The requested reconstruction exceeded computational time or memory limits.") -> None:
        super().__init__(status_code=503, code="COMPUTATION_LIMIT_EXCEEDED", message=message)
