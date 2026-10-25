"""Transparent iterative solvers for the image-inpainting objectives.

The reconstruction service uses a matrix-free Golub-Kahan LSQR least-squares solver.
It solves min_x 1/2 ||C x - d||_2^2 without forming C^T C or storing large matrices,
avoiding squaring of the condition number.
"""

from __future__ import annotations

import numpy as np

from app.api.errors import InpaintingException
from app.calculations.tikhonov import LeastSquaresSystem


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


def solve_least_squares(
    system: LeastSquaresSystem,
    max_iterations: int = 500,
    tolerance: float = 1e-4,
) -> SolverResult:
    """Solve min_x ||C x - d||_2 with matrix-free Golub-Kahan LSQR.

    Convergence is checked using the relative normal-equation residual
    ||C^T(d-Cx)|| / (||C^T d|| + eps), which measures least-squares optimality
    even when the residual Cx-d cannot be zero.
    """
    n = system.num_unknowns
    if n == 0:
        return SolverResult(np.array([]), 0, True, 0.0, "LSQR")

    x0 = system.prior.astype(np.float64, copy=True)
    if not np.all(np.isfinite(x0)):
        x0 = np.zeros(n, dtype=np.float64)

    target = system.target
    if not np.all(np.isfinite(target)):
        raise InpaintingException(
            status_code=500,
            code="NUMERICAL_INSTABILITY",
            message="Non-finite values in least-squares target.",
        )

    rhs = target - system.matvec(x0)
    rhs_norm = float(np.linalg.norm(rhs))
    normal_rhs = system.rmatvec(target)
    normal_scale = float(np.linalg.norm(normal_rhs)) + 1e-12
    if rhs_norm == 0.0:
        return SolverResult(np.clip(x0, 0.0, 255.0), 0, True, 0.0, "LSQR")

    # Golub-Kahan bidiagonalization, applied through C and C^T products.
    u = rhs / rhs_norm
    v = system.rmatvec(u)
    alpha = float(np.linalg.norm(v))
    if alpha == 0.0:
        return SolverResult(np.clip(x0, 0.0, 255.0), 0, True, 0.0, "LSQR")
    v /= alpha
    w = v.copy()
    delta = np.zeros(n, dtype=np.float64)
    phibar = rhs_norm
    rhobar = alpha
    converged = False
    iterations_run = 0
    final_relative_normal_residual = float("inf")

    for iteration in range(1, max_iterations + 1):
        iterations_run = iteration
        u_next = system.matvec(v) - alpha * u
        beta = float(np.linalg.norm(u_next))
        if beta > 0.0:
            u = u_next / beta
        else:
            u = np.zeros_like(u_next)

        v_next = system.rmatvec(u) - beta * v
        alpha = float(np.linalg.norm(v_next))
        if alpha > 0.0:
            v = v_next / alpha
        else:
            v = np.zeros_like(v_next)

        rho = float(np.hypot(rhobar, beta))
        if rho == 0.0 or not np.isfinite(rho):
            break
        cosine = rhobar / rho
        sine = beta / rho
        theta = sine * alpha
        rhobar = -cosine * alpha
        phi = cosine * phibar
        phibar = sine * phibar
        delta += (phi / rho) * w
        w = v - (theta / rho) * w

        if not np.all(np.isfinite(delta)):
            raise InpaintingException(
                status_code=500,
                code="NUMERICAL_INSTABILITY",
                message="Non-finite values encountered during LSQR iteration.",
            )

        if iteration % 5 == 0 or iteration == max_iterations:
            estimate = x0 + delta
            ls_residual = target - system.matvec(estimate)
            normal_residual = system.rmatvec(ls_residual)
            final_relative_normal_residual = float(np.linalg.norm(normal_residual)) / normal_scale
            if final_relative_normal_residual < tolerance:
                converged = True
                break

    solution = np.clip(x0 + delta, 0.0, 255.0)
    # Report optimality for the actual returned (clipped) pixel values.
    returned_residual = target - system.matvec(solution)
    returned_normal_residual = system.rmatvec(returned_residual)
    final_relative_normal_residual = float(np.linalg.norm(returned_normal_residual)) / normal_scale
    converged = final_relative_normal_residual < tolerance

    return SolverResult(
        x=solution,
        iterations=iterations_run,
        converged=converged,
        final_residual=final_relative_normal_residual,
        method_name="LSQR (regularized least squares)",
    )
