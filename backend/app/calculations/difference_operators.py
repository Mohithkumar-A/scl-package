"""Construction of discrete difference operators and Dirichlet boundary mappings.

This module maps 2D grid coordinates of damaged pixels to a 1D unknown vector
and constructs the discrete Laplacian graph topology with neighboring known pixels.
"""

from __future__ import annotations

from typing import List, Optional, Tuple
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
        unknown_component_ids: Optional[np.ndarray] = None, # shape (N,): connected component index for each unknown
        comp_count: int = 1,
        projected_boundary_coords: Optional[np.ndarray] = None, # shape (N, 2): (kr, kc) closest known boundary pixel
    ) -> None:
        self.num_unknowns = num_unknowns
        self.idx_to_coord = idx_to_coord
        self.coord_to_idx = coord_to_idx
        self.degree = degree
        self.unknown_neighbors = unknown_neighbors
        self.known_boundary_coords = known_boundary_coords
        self.projected_boundary_coords = (
            projected_boundary_coords
            if projected_boundary_coords is not None
            else np.zeros((num_unknowns, 2), dtype=np.int32)
        )
        self.unknown_component_ids = (
            unknown_component_ids
            if unknown_component_ids is not None
            else np.ones(num_unknowns, dtype=np.int32)
        )
        self.comp_count = max(1, comp_count)


def build_grid_topology(mask: np.ndarray) -> GridTopology:
    """Analyze the mask and construct 1D indexing, adjacency topology, and component labels.

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

    # Label 8-connected components so each isolated hole uses its own local boundary values
    from collections import deque
    comp_offsets = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0),  (1, 1),
    ]
    labeled_mask = np.zeros((height, width), dtype=np.int32)
    comp_count = 0
    for r in range(height):
        for c in range(width):
            if mask[r, c] and labeled_mask[r, c] == 0:
                comp_count += 1
                q = deque([(r, c)])
                labeled_mask[r, c] = comp_count
                while q:
                    cr, cc = q.popleft()
                    for dr, dc in comp_offsets:
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < height and 0 <= nc < width and mask[nr, nc] and labeled_mask[nr, nc] == 0:
                            labeled_mask[nr, nc] = comp_count
                            q.append((nr, nc))

    unknown_component_ids = np.zeros(num_unknowns, dtype=np.int32)
    for idx, (r, c) in enumerate(unknown_coords):
        unknown_component_ids[idx] = labeled_mask[r, c]

    # Propagate adjacent known boundary colors into the mask interior.
    projected_boundary_coords = compute_nearest_boundary_projection(mask, unknown_coords)

    return GridTopology(
        num_unknowns=num_unknowns,
        idx_to_coord=unknown_coords,
        coord_to_idx=coord_to_idx,
        degree=degree,
        unknown_neighbors=unknown_neighbors,
        known_boundary_coords=known_boundary_coords,
        unknown_component_ids=unknown_component_ids,
        comp_count=comp_count,
        projected_boundary_coords=projected_boundary_coords,
    )


def compute_nearest_boundary_projection(
    mask: np.ndarray,
    unknown_coords: np.ndarray,
) -> np.ndarray:
    """Propagate a nearby known boundary pixel into each unknown mask location.

    Uses multi-source breadth-first propagation over 8-connected mask pixels. Boundary
    seeds choose an adjacent known pixel, and interior ties follow deterministic queue order.
    """
    height, width = mask.shape
    num_unknowns = len(unknown_coords)
    if num_unknowns == 0:
        return np.empty((0, 2), dtype=np.int32)

    nearest_r = np.full((height, width), -1, dtype=np.int32)
    nearest_c = np.full((height, width), -1, dtype=np.int32)
    dist = np.full((height, width), -1, dtype=np.int32)

    offsets_8 = [
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1)
    ]
    from collections import deque
    queue = deque()

    # Step 1: Seed queue with unknown pixels, assigning the closest known neighbor
    for r, c in unknown_coords:
        best_d_sq = 999
        best_nr, best_nc = -1, -1
        for dr, dc in offsets_8:
            nr, nc = r + dr, c + dc
            if 0 <= nr < height and 0 <= nc < width and not mask[nr, nc]:
                d_sq = dr * dr + dc * dc
                if d_sq < best_d_sq:
                    best_d_sq = d_sq
                    best_nr, best_nc = nr, nc
        if best_nr != -1:
            nearest_r[r, c] = best_nr
            nearest_c[r, c] = best_nc
            dist[r, c] = 1
            queue.append((r, c))

    # Step 2: Multi-source 8-connected propagation into interior unknown pixels
    while queue:
        cr, cc = queue.popleft()
        tr, tc = nearest_r[cr, cc], nearest_c[cr, cc]
        d = dist[cr, cc]

        for dr, dc in offsets_8:
            nr, nc = cr + dr, cc + dc
            if 0 <= nr < height and 0 <= nc < width and mask[nr, nc]:
                if dist[nr, nc] == -1:
                    dist[nr, nc] = d + 1
                    nearest_r[nr, nc] = tr
                    nearest_c[nr, nc] = tc
                    queue.append((nr, nc))

    # Step 3: Extract (kr, kc) for each unknown index
    result = np.zeros((num_unknowns, 2), dtype=np.int32)
    for idx, (r, c) in enumerate(unknown_coords):
        if nearest_r[r, c] != -1:
            result[idx, 0] = nearest_r[r, c]
            result[idx, 1] = nearest_c[r, c]
        else:
            result[idx, 0] = r
            result[idx, 1] = c

    return result
