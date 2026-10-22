"""Scientific calculation of verifiable mathematical diagnostics.

Strictly avoids fabricating PSNR or SSIM when a clean ground-truth reference
is unavailable. Reports least-squares optimality residuals and convergence status.
"""

from __future__ import annotations

from typing import Optional, Tuple
import numpy as np


def compute_metrics(
    masked_pixels: int,
    total_pixels: int,
    iterations: int,
    converged: bool,
    final_residual: float,
    time_taken: float,
    changed_pixels: Optional[int] = None,
) -> dict:
    """Compile mathematically authentic computation diagnostics.

    Returns:
        dict containing verified metrics, with psnr and ssim explicitly null
        because live user uploads lack an uncorrupted ground-truth reference.
    """
    masked_percentage = (masked_pixels / total_pixels) * 100.0 if total_pixels > 0 else 0.0

    return {
        "psnr": None,  # Ground-truth reference image is not available for real damaged uploads
        "ssim": None,  # Ground-truth reference image is not available for real damaged uploads
        "reconstruction_error": round(float(final_residual), 6),
        "time_taken": round(float(time_taken), 3),
        "masked_pixels": masked_pixels,
        "masked_percentage": round(masked_percentage, 2),
        "iterations": iterations,
        "converged": converged,
        "final_residual": round(float(final_residual), 6),
        "changed_pixels": changed_pixels,
    }
