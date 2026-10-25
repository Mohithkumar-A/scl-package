"""Unit tests for the matrix-free Golub-Kahan LSQR iterative solver."""

import numpy as np
import pytest

from app.api.errors import InpaintingException
from app.calculations.iterative_solver import solve_least_squares
from app.calculations.tikhonov import LeastSquaresSystem


def test_least_squares_analytical_system():
    """Verify LSQR converges to the exact analytical least-squares normal solution.

    Two unknowns x_0, x_1:
      - edge constraint: x_0 - x_1 = 0
      - boundary for x_0: x_0 = 10.0
      - boundary for x_1: x_1 = 20.0
      - prior terms with sqrt(lambda)
    """
    lambda_val = 0.04
    sqrt_lambda = float(np.sqrt(lambda_val))
    edge_i = np.array([0], dtype=np.int32)
    edge_j = np.array([1], dtype=np.int32)
    boundary_i = np.array([0, 1], dtype=np.int32)
    boundary_values = np.array([10.0, 20.0], dtype=np.float64)
    prior = np.array([10.0, 20.0], dtype=np.float64)

    system = LeastSquaresSystem(
        num_unknowns=2,
        edge_i=edge_i,
        edge_j=edge_j,
        boundary_i=boundary_i,
        boundary_values=boundary_values,
        sqrt_lambda=sqrt_lambda,
        prior=prior,
    )

    # Exact normal equations:
    # (1 + 1 + lambda)*x0 - x1 = 10 + lambda*10
    # -x0 + (1 + 1 + lambda)*x1 = 20 + lambda*20
    diag = 2.0 + lambda_val
    A = np.array([[diag, -1.0], [-1.0, diag]], dtype=np.float64)
    b = np.array([10.0 + lambda_val * 10.0, 20.0 + lambda_val * 20.0], dtype=np.float64)
    exact_x = np.linalg.solve(A, b)

    res = solve_least_squares(system, max_iterations=200, tolerance=1e-7)

    assert res.converged is True
    assert res.final_residual < 1e-6
    assert np.allclose(res.x, exact_x, atol=1e-4)


def test_least_squares_empty_system():
    """Empty system (0 unknowns) should return immediately."""
    system = LeastSquaresSystem(
        num_unknowns=0,
        edge_i=np.array([], dtype=np.int32),
        edge_j=np.array([], dtype=np.int32),
        boundary_i=np.array([], dtype=np.int32),
        boundary_values=np.array([], dtype=np.float64),
        sqrt_lambda=0.1,
        prior=np.array([], dtype=np.float64),
    )

    res = solve_least_squares(system)
    assert len(res.x) == 0
    assert res.iterations == 0
    assert res.converged is True
    assert res.final_residual == 0.0


def test_least_squares_max_iterations_enforced():
    """Verify solver does not falsely report convergence when iteration limit is hit."""
    system = LeastSquaresSystem(
        num_unknowns=2,
        edge_i=np.array([0], dtype=np.int32),
        edge_j=np.array([1], dtype=np.int32),
        boundary_i=np.array([0, 1], dtype=np.int32),
        boundary_values=np.array([10.0, 100.0], dtype=np.float64),
        sqrt_lambda=0.01,
        prior=np.array([0.0, 0.0], dtype=np.float64),
    )

    res = solve_least_squares(system, max_iterations=1, tolerance=1e-12)
    assert res.iterations == 1
    assert res.converged is False


def test_least_squares_numerical_instability():
    """Non-finite values during LSQR should raise a NUMERICAL_INSTABILITY InpaintingException."""
    system = LeastSquaresSystem(
        num_unknowns=2,
        edge_i=np.array([0], dtype=np.int32),
        edge_j=np.array([1], dtype=np.int32),
        boundary_i=np.array([0, 1], dtype=np.int32),
        boundary_values=np.array([np.nan, 20.0], dtype=np.float64),
        sqrt_lambda=0.1,
        prior=np.array([10.0, 20.0], dtype=np.float64),
    )

    with pytest.raises(InpaintingException) as exc_info:
        solve_least_squares(system)
    assert exc_info.value.code == "NUMERICAL_INSTABILITY"
