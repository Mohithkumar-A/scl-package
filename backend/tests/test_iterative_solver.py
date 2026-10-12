"""Unit tests for the custom iterative linear system solver (Gauss-Seidel and Jacobi)."""

import numpy as np
import pytest

from app.api.errors import InpaintingException
from app.calculations.difference_operators import GridTopology
from app.calculations.iterative_solver import (
    compute_residual,
    solve_gauss_seidel,
    solve_jacobi,
)
from app.calculations.tikhonov import TikhonovSystem


def create_mock_system(
    N: int,
    diag: np.ndarray,
    b: np.ndarray,
    unknown_neighbors: list,
    initial_guess: np.ndarray = None,
) -> TikhonovSystem:
    """Construct a mock TikhonovSystem for analytical testing."""
    if initial_guess is None:
        initial_guess = np.zeros(N, dtype=np.float64)

    topology = GridTopology(
        num_unknowns=N,
        idx_to_coord=np.zeros((N, 2), dtype=np.int32),
        coord_to_idx=np.zeros((N, N), dtype=np.int32),
        degree=diag - 1.0,
        unknown_neighbors=[np.array(nbrs, dtype=np.int32) for nbrs in unknown_neighbors],
        known_boundary_coords=[[] for _ in range(N)],
    )

    return TikhonovSystem(
        num_unknowns=N,
        diag=diag,
        b=b,
        initial_guess=initial_guess,
        topology=topology,
    )


def test_analytical_2x2_system():
    """Verify Gauss-Seidel and Jacobi against exact analytical solution.

    System:
        5*x0 - 1*x1 = 10
       -1*x0 + 5*x1 = 10
    Exact solution:
        x0 = x1 = 10 / 4 = 2.5
    """
    N = 2
    diag = np.array([5.0, 5.0], dtype=np.float64)
    b = np.array([10.0, 10.0], dtype=np.float64)
    neighbors = [[1], [0]]

    system = create_mock_system(N, diag, b, neighbors)

    res_gs = solve_gauss_seidel(system, max_iterations=200, tolerance=1e-6)
    assert res_gs.converged is True
    assert np.allclose(res_gs.x, [2.5, 2.5], atol=1e-5)
    assert res_gs.final_residual < 1e-6

    res_jacobi = solve_jacobi(system, max_iterations=200, tolerance=1e-6)
    assert res_jacobi.converged is True
    assert np.allclose(res_jacobi.x, [2.5, 2.5], atol=1e-5)


def test_residual_calculation():
    """Verify explicit residual vector r = b - A x."""
    N = 2
    diag = np.array([5.0, 5.0], dtype=np.float64)
    b = np.array([10.0, 10.0], dtype=np.float64)
    neighbors = [[1], [0]]

    system = create_mock_system(N, diag, b, neighbors)

    # For x = [0, 0], r = b = [10, 10]
    r, res_norm, rel_res = compute_residual(system, np.array([0.0, 0.0]))
    assert np.allclose(r, [10.0, 10.0])
    assert np.isclose(res_norm, np.sqrt(200.0))

    # For exact solution x = [2.5, 2.5], r = [0, 0]
    r_exact, res_norm_exact, _ = compute_residual(system, np.array([2.5, 2.5]))
    assert np.allclose(r_exact, [0.0, 0.0])
    assert res_norm_exact < 1e-12


def test_max_iterations_enforced():
    """Verify solver does not falsely report convergence when iteration limit is reached."""
    N = 2
    diag = np.array([5.0, 5.0], dtype=np.float64)
    b = np.array([10.0, 10.0], dtype=np.float64)
    neighbors = [[1], [0]]

    system = create_mock_system(N, diag, b, neighbors)

    # Run only 1 iteration with very tight tolerance
    res = solve_gauss_seidel(system, max_iterations=1, tolerance=1e-12)
    assert res.iterations == 1
    assert res.converged is False


def test_invalid_diagonal_detected():
    """Non-positive diagonal elements must be rejected immediately."""
    N = 2
    diag = np.array([0.0, 5.0], dtype=np.float64)  # invalid zero diagonal
    b = np.array([10.0, 10.0], dtype=np.float64)
    neighbors = [[1], [0]]

    system = create_mock_system(N, diag, b, neighbors)

    with pytest.raises(InpaintingException) as exc_info:
        solve_gauss_seidel(system)
    assert exc_info.value.code == "INVALID_DIAGONAL"
