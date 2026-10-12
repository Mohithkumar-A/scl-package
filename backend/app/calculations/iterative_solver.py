"""Custom, transparent iterative linear system solvers for image inpainting.

Implements Jacobi and Gauss-Seidel iterative methods line-by-line without
delegating the core numerical solve to any external/opaque inpainting library.

Mathematical Formulation:
    Solve A x = b where A = D - E - F:
        - D is the positive diagonal matrix (diag_k = d_k + lambda).
        - (E + F) represents 4-neighbor adjacency among unknown pixels with A_{k,m} = -1.

    Jacobi Iteration:
        x^(k+1)_i = ( b_i + sum_{m in unk_nbrs(i)} x^(k)_m ) / A_{ii}

    Gauss-Seidel Iteration (in-place sweep):
        x_i <- ( b_i + sum_{m in unk_nbrs(i)} x_m ) / A_{ii}

    Residual vector:
        r_i = b_i - ( A_{ii} x_i - sum_{m in unk_nbrs(i)} x_m )
        ||r||_2 = sqrt( sum(r_i^2) )
        rel_residual = ||r||_2 / ( ||b||_2 + 1e-12 )
"""

from __future__ import annotations

import math
from typing import List, Optional
import numpy as np

from app.api.errors import InpaintingException
from app.calculations.tikhonov import TikhonovSystem


class SolverResult:
    """Detailed metadata and solution vector from the iterative solver."""

    def __init__(
        self,
        x: np.ndarray,
        iterations: int,
        converged: bool,
        final_residual: float,
        method_name: str,
    ) -> None:
        self.x = x
        self.iterations = iterations
        self.converged = converged
        self.final_residual = final_residual
        self.method_name = method_name


def compute_residual(system: TikhonovSystem, x: np.ndarray) -> Tuple[np.ndarray, float, float]:
    """Calculate the explicit residual r = b - A x and its relative 2-norm."""
    N = system.num_unknowns
    diag = system.diag
    b = system.b
    nbrs = system.topology.unknown_neighbors

    Ax = np.zeros(N, dtype=np.float64)
    for i in range(N):
        neighbor_sum = float(np.sum(x[nbrs[i]])) if len(nbrs[i]) > 0 else 0.0
        Ax[i] = diag[i] * x[i] - neighbor_sum

    r = b - Ax
    res_norm = float(np.linalg.norm(r))
    b_norm = float(np.linalg.norm(b))
    rel_res = res_norm / (b_norm + 1e-12)
    return r, res_norm, rel_res


def solve_gauss_seidel(
    system: TikhonovSystem,
    max_iterations: int = 500,
    tolerance: float = 1e-4,
) -> SolverResult:
    """Solve the symmetric positive-definite system A x = b via Gauss-Seidel iteration.

    Steps:
        1. Validates strictly positive, finite diagonal entries.
        2. Initializes iterate x with the boundary-mean prior estimate.
        3. Executes successive in-place sweeps updating x_i.
        4. Detects NaN or Inf values immediately.
        5. Computes residual norm and checks convergence tolerance.
        6. Enforces maximum iteration ceiling.
    """
    N = system.num_unknowns
    if N == 0:
        return SolverResult(x=np.array([]), iterations=0, converged=True, final_residual=0.0, method_name="Gauss-Seidel")

    # Step 1: Validate diagonal entries
    diag = system.diag
    if np.any(diag <= 0) or not np.all(np.isfinite(diag)):
        raise InpaintingException(
            status_code=500,
            code="INVALID_DIAGONAL",
            message="Linear system contains non-positive or non-finite diagonal elements.",
        )

    # Step 2: Initialize estimate
    x = system.initial_guess.copy()
    if not np.all(np.isfinite(x)):
        x = np.zeros(N, dtype=np.float64)

    b = system.b
    nbrs = system.topology.unknown_neighbors
    b_norm = float(np.linalg.norm(b)) + 1e-12

    converged = False
    iterations_run = 0
    final_rel_res = 1.0

    # Pre-unpack neighbors for high-performance iteration
    nbr_lists = [nbrs[i] for i in range(N)]

    for it in range(1, max_iterations + 1):
        iterations_run = it

        # Step 3: In-place Gauss-Seidel update sweep
        for i in range(N):
            m_indices = nbr_lists[i]
            nbr_sum = float(np.sum(x[m_indices])) if len(m_indices) > 0 else 0.0
            x[i] = (b[i] + nbr_sum) / diag[i]

        # Step 4: Detect non-finite values
        if not np.all(np.isfinite(x)):
            raise InpaintingException(
                status_code=500,
                code="NUMERICAL_INSTABILITY",
                message="Non-finite values encountered during iterative update.",
            )

        # Step 5: Check convergence every 5 iterations or at final iteration
        if it % 5 == 0 or it == max_iterations:
            _, _, rel_res = compute_residual(system, x)
            final_rel_res = rel_res
            if rel_res < tolerance:
                converged = True
                break

    return SolverResult(
        x=x,
        iterations=iterations_run,
        converged=converged,
        final_residual=final_rel_res,
        method_name="Gauss-Seidel",
    )


def solve_jacobi(
    system: TikhonovSystem,
    max_iterations: int = 500,
    tolerance: float = 1e-4,
) -> SolverResult:
    """Solve A x = b via classical Jacobi iteration."""
    N = system.num_unknowns
    if N == 0:
        return SolverResult(x=np.array([]), iterations=0, converged=True, final_residual=0.0, method_name="Jacobi")

    diag = system.diag
    if np.any(diag <= 0) or not np.all(np.isfinite(diag)):
        raise InpaintingException(
            status_code=500,
            code="INVALID_DIAGONAL",
            message="Linear system contains non-positive or non-finite diagonal elements.",
        )

    x = system.initial_guess.copy()
    x_next = np.zeros(N, dtype=np.float64)
    b = system.b
    nbrs = system.topology.unknown_neighbors

    converged = False
    iterations_run = 0
    final_rel_res = 1.0

    for it in range(1, max_iterations + 1):
        iterations_run = it

        # Jacobi update using previous iterate x
        for i in range(N):
            m_indices = nbrs[i]
            nbr_sum = float(np.sum(x[m_indices])) if len(m_indices) > 0 else 0.0
            x_next[i] = (b[i] + nbr_sum) / diag[i]

        if not np.all(np.isfinite(x_next)):
            raise InpaintingException(
                status_code=500,
                code="NUMERICAL_INSTABILITY",
                message="Non-finite values encountered during Jacobi iteration.",
            )

        x[:] = x_next[:]

        if it % 5 == 0 or it == max_iterations:
            _, _, rel_res = compute_residual(system, x)
            final_rel_res = rel_res
            if rel_res < tolerance:
                converged = True
                break

    return SolverResult(
        x=x,
        iterations=iterations_run,
        converged=converged,
        final_residual=final_rel_res,
        method_name="Jacobi",
    )
