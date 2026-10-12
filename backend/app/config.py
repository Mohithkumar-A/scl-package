"""Application configuration and tunable thresholds for the inpainting backend.

All limits and solver parameters are configurable via environment variables.
"""

from __future__ import annotations

import os
from typing import List
from pydantic import BaseModel, Field


class Settings(BaseModel):
    # Server configuration
    host: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    debug: bool = Field(default_factory=lambda: os.getenv("DEBUG", "false").lower() in ("true", "1"))

    # Allowed CORS Origins
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]
    )

    # Computational limits
    max_image_width: int = Field(default_factory=lambda: int(os.getenv("MAX_IMAGE_WIDTH", "4096")))
    max_image_height: int = Field(default_factory=lambda: int(os.getenv("MAX_IMAGE_HEIGHT", "4096")))
    max_total_pixels: int = Field(default_factory=lambda: int(os.getenv("MAX_TOTAL_PIXELS", "16777216")))
    max_masked_pixels: int = Field(default_factory=lambda: int(os.getenv("MAX_MASKED_PIXELS", "2000000")))
    max_masked_percentage: float = Field(default_factory=lambda: float(os.getenv("MAX_MASKED_PERCENTAGE", "85.0")))
    max_connected_regions: int = Field(default_factory=lambda: int(os.getenv("MAX_CONNECTED_REGIONS", "100")))
    max_connected_region_pixels: int = Field(
        default_factory=lambda: int(os.getenv("MAX_CONNECTED_REGION_PIXELS", "1000000"))
    )

    # Solver parameters
    solver_max_iterations: int = Field(default_factory=lambda: int(os.getenv("SOLVER_MAX_ITERATIONS", "500")))
    solver_tolerance: float = Field(default_factory=lambda: float(os.getenv("SOLVER_TOLERANCE", "0.0001")))
    default_lambda: float = Field(default_factory=lambda: float(os.getenv("DEFAULT_LAMBDA", "0.01")))
    min_lambda: float = Field(default_factory=lambda: float(os.getenv("MIN_LAMBDA", "0.000001")))
    max_lambda: float = Field(default_factory=lambda: float(os.getenv("MAX_LAMBDA", "100.0")))
    request_timeout_seconds: float = Field(
        default_factory=lambda: float(os.getenv("REQUEST_TIMEOUT_SECONDS", "60.0"))
    )


settings = Settings()
