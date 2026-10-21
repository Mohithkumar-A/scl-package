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


def compute_residual(system: TikhonovSystem, x: np.ndarray) -> tuple[np.ndarray, float, float]:
    """Calculate the explicit residual r = b - A x and its relative 2-norm."""
    N = system.num_unknowns
    if N == 0:
        return np.array([]), 0.0, 0.0
    diag = system.diag
    b = system.b

    # Vectorized residual calculation using dense neighbor matrix
    if hasattr(system.topology, "nbr_matrix"):
        nbr_matrix = system.topology.nbr_matrix
        x_padded = np.zeros(N + 1, dtype=np.float64)
        x_padded[:N] = x
        nbr_vals = x_padded[nbr_matrix]
        nbr_sum = np.sum(nbr_vals, axis=1)
        Ax = diag * x - nbr_sum
    else:
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

    Uses high-performance vectorized Red-Black Gauss-Seidel ordering on the 4-connected
    Cartesian topology: adjacent grid points alternate colors, allowing each color group
    to be updated simultaneously without loop overhead while maintaining exact Gauss-Seidel
    convergence properties.
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

    # Step 2: Initialize iterate with boundary-mean prior estimate
    x_padded = np.zeros(N + 1, dtype=np.float64)
    init_x = system.initial_guess.copy()
    if not np.all(np.isfinite(init_x)):
        init_x = np.zeros(N, dtype=np.float64)
    x_padded[:N] = init_x

    b = system.b
    b_norm = float(np.linalg.norm(b)) + 1e-12

    # Check if vectorized topology is available
    has_vectorized = (
        hasattr(system.topology, "nbr_matrix")
        and hasattr(system.topology, "red_indices")
        and hasattr(system.topology, "black_indices")
    )

    if has_vectorized:
        nbr_matrix = system.topology.nbr_matrix
        red = system.topology.red_indices
        black = system.topology.black_indices
    else:
        nbrs = system.topology.unknown_neighbors
        nbr_lists = [nbrs[i] for i in range(N)]

    converged = False
    iterations_run = 0
    final_rel_res = 1.0

    for it in range(1, max_iterations + 1):
        iterations_run = it

        if has_vectorized:
            # Step 3a: Vectorized Red sweep (reads from Black neighbors)
            if len(red) > 0:
                nbr_vals_red = x_padded[nbr_matrix[red]]
                nbr_sum_red = np.sum(nbr_vals_red, axis=1)
                x_padded[red] = (b[red] + nbr_sum_red) / diag[red]

            # Step 3b: Vectorized Black sweep (reads from freshly updated Red neighbors)
            if len(black) > 0:
                nbr_vals_black = x_padded[nbr_matrix[black]]
                nbr_sum_black = np.sum(nbr_vals_black, axis=1)
                x_padded[black] = (b[black] + nbr_sum_black) / diag[black]
        else:
            # Fallback scalar in-place sweep
            for i in range(N):
                m_indices = nbr_lists[i]
                nbr_sum = float(np.sum(x_padded[m_indices])) if len(m_indices) > 0 else 0.0
                x_padded[i] = (b[i] + nbr_sum) / diag[i]

        # Step 4: Detect non-finite values
        if not np.all(np.isfinite(x_padded[:N])):
            raise InpaintingException(
                status_code=500,
                code="NUMERICAL_INSTABILITY",
                message="Non-finite values encountered during iterative update.",
            )

        # Step 5: Check convergence every 5 iterations or at final iteration
        if it % 5 == 0 or it == max_iterations:
            _, _, rel_res = compute_residual(system, x_padded[:N])
            final_rel_res = rel_res
            if rel_res < tolerance:
                converged = True
                break

    return SolverResult(
        x=np.clip(x_padded[:N], 0.0, 255.0),
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
    b = system.b
    b_norm = float(np.linalg.norm(b)) + 1e-12

    has_vectorized = hasattr(system.topology, "nbr_matrix")
    if has_vectorized:
        nbr_matrix = system.topology.nbr_matrix
        x_padded = np.zeros(N + 1, dtype=np.float64)
    else:
        x_next = np.zeros(N, dtype=np.float64)
        nbrs = system.topology.unknown_neighbors

    converged = False
    iterations_run = 0
    final_rel_res = 1.0

    for it in range(1, max_iterations + 1):
        iterations_run = it

        if has_vectorized:
            x_padded[:N] = x
            nbr_vals = x_padded[nbr_matrix]
            nbr_sum = np.sum(nbr_vals, axis=1)
            x_next = (b + nbr_sum) / diag
        else:
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

        x = x_next.copy()

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
