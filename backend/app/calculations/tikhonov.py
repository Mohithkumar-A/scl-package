"""Assemble Tikhonov-regularized least-squares models for image inpainting.

The service objective is min_x 1/2 ||C x - d||_2^2, with residual rows for
unknown-neighbor differences, known-boundary values, and prior penalties. The
matrix-free system below represents C and its target d for LSQR. A direct
normal-system representation is retained for the reference Jacobi/Gauss-Seidel
solvers and their analytical examples.
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


class LeastSquaresSystem:
    """Matrix-free residual system for min_x 1/2 ||C x - target||_2^2."""

    def __init__(
        self,
        num_unknowns: int,
        edge_i: np.ndarray,
        edge_j: np.ndarray,
        boundary_i: np.ndarray,
        boundary_values: np.ndarray,
        sqrt_lambda: float,
        prior: np.ndarray,
    ) -> None:
        self.num_unknowns = num_unknowns
        self.edge_i = edge_i
        self.edge_j = edge_j
        self.boundary_i = boundary_i
        self.boundary_values = boundary_values
        self.sqrt_lambda = sqrt_lambda
        self.prior = prior
        self.target = np.concatenate((
            np.zeros(len(edge_i), dtype=np.float64),
            boundary_values.astype(np.float64, copy=False),
            sqrt_lambda * prior,
        ))

    @property
    def num_rows(self) -> int:
        return len(self.edge_i) + len(self.boundary_i) + self.num_unknowns

    def matvec(self, x: np.ndarray) -> np.ndarray:
        """Compute Cx for edge, boundary, and prior residual rows."""
        return np.concatenate((
            x[self.edge_i] - x[self.edge_j],
            x[self.boundary_i],
            self.sqrt_lambda * x,
        ))

    def rmatvec(self, values: np.ndarray) -> np.ndarray:
        """Compute C^T values without constructing the sparse matrix C."""
        n_edges = len(self.edge_i)
        n_boundary = len(self.boundary_i)
        edge_values = values[:n_edges]
        boundary_values = values[n_edges:n_edges + n_boundary]
        prior_values = values[n_edges + n_boundary:]
        result = np.zeros(self.num_unknowns, dtype=np.float64)
        np.add.at(result, self.edge_i, edge_values)
        np.add.at(result, self.edge_j, -edge_values)
        np.add.at(result, self.boundary_i, boundary_values)
        result += self.sqrt_lambda * prior_values
        return result


def construct_least_squares_system(
    channel: np.ndarray,
    topology: GridTopology,
    lambda_val: float,
) -> LeastSquaresSystem:
    """Assemble the residual operator C and targets for regularized least squares."""
    # Reuse the established prior construction and lambda validation so the new
    # least-squares formulation preserves the existing objective exactly.
    prior_system = construct_tikhonov_system(channel, topology, lambda_val)
    edge_count = sum(int(np.count_nonzero(neighbors > i)) for i, neighbors in enumerate(topology.unknown_neighbors))
    boundary_count = sum(len(coords) for coords in topology.known_boundary_coords)
    edge_i = np.fromiter(
        (i for i, neighbors in enumerate(topology.unknown_neighbors) for j in neighbors if i < int(j)),
        dtype=np.int32,
        count=edge_count,
    )
    edge_j = np.fromiter(
        (int(j) for i, neighbors in enumerate(topology.unknown_neighbors) for j in neighbors if i < int(j)),
        dtype=np.int32,
        count=edge_count,
    )
    boundary_i = np.fromiter(
        (i for i, coords in enumerate(topology.known_boundary_coords) for _ in coords),
        dtype=np.int32,
        count=boundary_count,
    )
    boundary_values = np.fromiter(
        (float(channel[r, c]) for coords in topology.known_boundary_coords for r, c in coords),
        dtype=np.float64,
        count=boundary_count,
    )

    return LeastSquaresSystem(
        num_unknowns=topology.num_unknowns,
        edge_i=edge_i,
        edge_j=edge_j,
        boundary_i=boundary_i,
        boundary_values=boundary_values,
        sqrt_lambda=float(np.sqrt(lambda_val)),
        prior=prior_system.initial_guess,
    )


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

    # Compute boundary channel mean PER CONNECTED COMPONENT
    # This prevents cross-region contamination (e.g., sky hole being polluted by dark tree boundary)
    comp_ids = getattr(topology, "unknown_component_ids", None)
    comp_count = getattr(topology, "comp_count", 1)

    comp_means: dict[int, float] = {}
    if comp_ids is not None and comp_count > 0:
        for c in range(1, comp_count + 1):
            c_indices = np.where(comp_ids == c)[0]
            b_vals = []
            for idx in c_indices:
                for nr, nc in topology.known_boundary_coords[idx]:
                    b_vals.append(channel[nr, nc])
            if b_vals:
                comp_means[c] = float(np.mean(b_vals))
            else:
                comp_means[c] = float(np.mean(channel))
    else:
        boundary_values = []
        for kn_nbrs in topology.known_boundary_coords:
            for nr, nc in kn_nbrs:
                boundary_values.append(channel[nr, nc])
        global_mean = float(np.mean(boundary_values)) if boundary_values else float(np.mean(channel))
        comp_means[1] = global_mean

    global_fallback = float(np.mean(list(comp_means.values()))) if comp_means else float(np.mean(channel))

    has_proj = hasattr(topology, "projected_boundary_coords") and topology.projected_boundary_coords is not None

    for idx in range(N):
        kn_nbrs = topology.known_boundary_coords[idx]
        c_id = comp_ids[idx] if comp_ids is not None else 1
        c_mean = comp_means.get(c_id, global_fallback)

        # Use the propagated boundary estimate for unknowns with no known 4-neighbor.
        if has_proj and len(topology.projected_boundary_coords) > idx:
            proj_r, proj_c = topology.projected_boundary_coords[idx]
            projected_color = float(channel[proj_r, proj_c])
        else:
            projected_color = c_mean

        if kn_nbrs:
            known_sum = sum(float(channel[nr, nc]) for nr, nc in kn_nbrs)
            local_prior = known_sum / len(kn_nbrs)
        else:
            known_sum = 0.0
            local_prior = projected_color

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
