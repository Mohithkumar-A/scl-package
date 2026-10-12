"""Unit tests for the discrete difference operators and Tikhonov system formulation."""

import numpy as np
import pytest

from app.api.errors import InvalidLambdaError
from app.calculations.difference_operators import build_grid_topology
from app.calculations.tikhonov import construct_tikhonov_system


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
    """Verify system is strictly diagonally dominant for lambda > 0."""
    mask = np.zeros((5, 5), dtype=bool)
    mask[2, 2] = True  # Single center unknown
    mask[2, 3] = True  # Adjacent unknown

    channel = np.full((5, 5), 100.0, dtype=np.float32)
    topo = build_grid_topology(mask)
    lambda_val = 0.05
    system = construct_tikhonov_system(channel, topo, lambda_val)

    for i in range(system.num_unknowns):
        diag_val = system.diag[i]
        off_diag_sum = len(topo.unknown_neighbors[i])  # each off-diagonal is -1
        assert diag_val - off_diag_sum >= lambda_val


def test_lambda_validation():
    """Verify rejection of invalid lambda parameters."""
    mask = np.zeros((3, 3), dtype=bool)
    mask[1, 1] = True
    topo = build_grid_topology(mask)
    channel = np.ones((3, 3), dtype=np.float32)

    with pytest.raises(InvalidLambdaError):
        construct_tikhonov_system(channel, topo, 0.0)

    with pytest.raises(InvalidLambdaError):
        construct_tikhonov_system(channel, topo, -0.5)

    with pytest.raises(InvalidLambdaError):
        construct_tikhonov_system(channel, topo, float("nan"))
