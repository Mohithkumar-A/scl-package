"""Unit tests for discrete difference operators and Tikhonov least-squares formulation."""

import numpy as np
import pytest

from app.api.errors import InvalidLambdaError
from app.calculations.difference_operators import build_grid_topology
from app.calculations.tikhonov import construct_least_squares_system, validate_lambda


def test_topology_construction():
    """Verify coordinate mapping and adjacency for a small 4x4 image."""
    mask = np.zeros((4, 4), dtype=bool)
    # Mask a 2x2 hole in the middle: (1,1), (1,2), (2,1), (2,2)
    mask[1:3, 1:3] = True

    topo = build_grid_topology(mask)
    assert topo.num_unknowns == 4
    assert len(topo.unknown_neighbors) == 4

    # Each unknown in 2x2 hole has 2 unknown neighbors and 2 known neighbors
    for idx in range(4):
        assert len(topo.unknown_neighbors[idx]) == 2
        assert len(topo.known_boundary_coords[idx]) == 2
        assert topo.degree[idx] == 4.0


def test_strict_diagonal_dominance():
    """Verify the normal operator C^T C is strictly diagonally dominant for lambda > 0."""
    mask = np.zeros((5, 5), dtype=bool)
    mask[2, 2] = True  # Single center unknown
    mask[2, 3] = True  # Adjacent unknown

    channel = np.full((5, 5), 100.0, dtype=np.float32)
    topo = build_grid_topology(mask)
    lambda_val = 0.05
    system = construct_least_squares_system(channel, topo, lambda_val)

    # For each unknown index i, form the i-th column of C^T C via matvec and rmatvec
    for i in range(system.num_unknowns):
        e_i = np.zeros(system.num_unknowns, dtype=np.float64)
        e_i[i] = 1.0
        ctc_col = system.rmatvec(system.matvec(e_i))
        diag_val = ctc_col[i]
        off_diag_sum = float(np.sum(np.abs(ctc_col))) - diag_val
        # Diagonal dominance guarantee: A_ii - sum_{j!=i} |A_ji| >= lambda
        assert diag_val - off_diag_sum >= lambda_val - 1e-12


def test_lambda_validation():
    """Verify rejection of invalid lambda parameters."""
    mask = np.zeros((3, 3), dtype=bool)
    mask[1, 1] = True
    topo = build_grid_topology(mask)
    channel = np.ones((3, 3), dtype=np.float32)

    with pytest.raises(InvalidLambdaError):
        construct_least_squares_system(channel, topo, 0.0)

    with pytest.raises(InvalidLambdaError):
        construct_least_squares_system(channel, topo, -0.5)

    with pytest.raises(InvalidLambdaError):
        construct_least_squares_system(channel, topo, float("nan"))
