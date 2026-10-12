"""Mathematical formulation of the Tikhonov Regularization Linear System.

Objective:
    min_x  || B x - b ||_2^2  +  lambda || L x - c ||_2^2

In our discrete harmonic inpainting formulation:
    - Unknown pixels: x in R^N
    - Known pixels: fixed Dirichlet boundary values from undamaged regions.
    - Smoothness operator L: discrete 2D Laplacian operator.
    - Regularization parameter lambda: enforces strict diagonal dominance and stability.

Euler-Lagrange optimality condition:
    (L + lambda * I) x = b

For each unknown pixel k at grid position (r, c):
    (d_k + lambda) x_k - sum_{m in unk_nbrs(k)} x_m = sum_{(nr, nc) in kn_nbrs(k)} I(nr, nc) + lambda * x_0(k)

where:
    - d_k is the number of valid spatial neighbors inside the image bounds (2 <= d_k <= 4).
    - unk_nbrs(k) are neighboring pixels that are also unknown.
    - kn_nbrs(k) are neighboring pixels that are known (undamaged).
    - x_0(k) is the boundary prior (local mean of known neighbors).
"""

from __future__ import annotations

from typing import Tuple
import numpy as np

from app.api.errors import InvalidLambdaError
from app.calculations.difference_operators import GridTopology
from app.config import settings


class TikhonovSystem:
    """Represents the linear system A x = b for a single color channel."""

    def __init__(
        self,
        num_unknowns: int,
        diag: np.ndarray,      # shape (N,): diagonal elements A_{k,k} = d_k + lambda
        b: np.ndarray,         # shape (N,): right-hand side vector
        initial_guess: np.ndarray,  # shape (N,): initial iterate x^(0)
        topology: GridTopology,
    ) -> None:
        self.num_unknowns = num_unknowns
        self.diag = diag
        self.b = b
        self.initial_guess = initial_guess
        self.topology = topology


def construct_tikhonov_system(
    channel: np.ndarray,      # shape (H, W): 2D float channel
    topology: GridTopology,
    lambda_val: float,
) -> TikhonovSystem:
    """Assemble the diagonal, right-hand side vector, and initial iterate for one channel.

    Args:
        channel: 2D image channel (height, width) with known pixel values.
        topology: GridTopology mapping 1D unknowns to 2D coordinates and neighbors.
        lambda_val: Regularization parameter lambda > 0.

    Returns:
        TikhonovSystem ready for the numerical iterative solver.
    """
    if not np.isfinite(lambda_val) or lambda_val <= 0:
        raise InvalidLambdaError(f"Lambda must be a positive finite number; got {lambda_val}.")

    if lambda_val < settings.min_lambda or lambda_val > settings.max_lambda:
        raise InvalidLambdaError(
            f"Lambda {lambda_val} is outside allowed range [{settings.min_lambda}, {settings.max_lambda}]."
        )

    N = topology.num_unknowns
    diag = topology.degree + lambda_val
    b = np.zeros(N, dtype=np.float64)
    initial_guess = np.zeros(N, dtype=np.float64)

    # Compute global boundary channel mean as fallback prior
    boundary_values = []
    for kn_nbrs in topology.known_boundary_coords:
        for nr, nc in kn_nbrs:
            boundary_values.append(channel[nr, nc])

    global_boundary_mean = float(np.mean(boundary_values)) if boundary_values else float(np.mean(channel))

    for idx in range(N):
        kn_nbrs = topology.known_boundary_coords[idx]
        if kn_nbrs:
            known_sum = sum(float(channel[nr, nc]) for nr, nc in kn_nbrs)
            local_prior = known_sum / len(kn_nbrs)
        else:
            known_sum = 0.0
            local_prior = global_boundary_mean

        # Right-hand side b_k = sum(known neighbors) + lambda * prior
        b[idx] = known_sum + lambda_val * local_prior
        initial_guess[idx] = local_prior

    return TikhonovSystem(
        num_unknowns=N,
        diag=diag,
        b=b,
        initial_guess=initial_guess,
        topology=topology,
    )
