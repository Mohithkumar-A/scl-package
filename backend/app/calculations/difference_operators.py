"""Construction of discrete difference operators and Dirichlet boundary mappings.

This module maps 2D grid coordinates of damaged pixels to a 1D unknown vector
and constructs the discrete Laplacian graph topology with neighboring known pixels.
"""

from __future__ import annotations

from typing import List, Tuple
import numpy as np


class GridTopology:
    """Topology mapping unknown pixels to 1D system indices and boundary neighbors."""

    def __init__(
        self,
        num_unknowns: int,
        idx_to_coord: np.ndarray,  # shape (N, 2): (row, col)
        coord_to_idx: np.ndarray,  # shape (H, W): int32, -1 if known
        degree: np.ndarray,        # shape (N,): total spatial 4-neighbors inside image bounds
        unknown_neighbors: List[np.ndarray],  # list of 1D arrays of unknown neighbor indices
        known_boundary_coords: List[List[Tuple[int, int]]],  # list of (r, c) for known neighbors
    ) -> None:
        self.num_unknowns = num_unknowns
        self.idx_to_coord = idx_to_coord
        self.coord_to_idx = coord_to_idx
        self.degree = degree
        self.unknown_neighbors = unknown_neighbors
        self.known_boundary_coords = known_boundary_coords


def build_grid_topology(mask: np.ndarray) -> GridTopology:
    """Analyze the mask and construct 1D indexing and adjacency topology.

    Args:
        mask: 2D boolean array of shape (H, W) where True = damaged (unknown).

    Returns:
        GridTopology object with all mapping structures.
    """
    height, width = mask.shape
    coord_to_idx = np.full((height, width), -1, dtype=np.int32)
    unknown_coords = np.argwhere(mask)
    num_unknowns = len(unknown_coords)

    for idx, (r, c) in enumerate(unknown_coords):
        coord_to_idx[r, c] = idx

    degree = np.zeros(num_unknowns, dtype=np.float64)
    unknown_neighbors: List[np.ndarray] = []
    known_boundary_coords: List[List[Tuple[int, int]]] = []

    # 4-connected spatial neighbor offsets
    offsets = [(-1, 0), (1, 0), (0, -1), (0, 1)]

    for idx, (r, c) in enumerate(unknown_coords):
        unk_nbrs: List[int] = []
        kn_nbrs: List[Tuple[int, int]] = []
        valid_degree = 0

        for dr, dc in offsets:
            nr, nc = r + dr, c + dc
            if 0 <= nr < height and 0 <= nc < width:
                valid_degree += 1
                nbr_idx = coord_to_idx[nr, nc]
                if nbr_idx >= 0:
                    unk_nbrs.append(nbr_idx)
                else:
                    kn_nbrs.append((nr, nc))

        degree[idx] = float(valid_degree)
        unknown_neighbors.append(np.array(unk_nbrs, dtype=np.int32))
        known_boundary_coords.append(kn_nbrs)

    return GridTopology(
        num_unknowns=num_unknowns,
        idx_to_coord=unknown_coords,
        coord_to_idx=coord_to_idx,
        degree=degree,
        unknown_neighbors=unknown_neighbors,
        known_boundary_coords=known_boundary_coords,
    )
