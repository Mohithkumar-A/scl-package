"""Mathematical validation rules and connected-component analysis for damage masks."""

from __future__ import annotations

from collections import deque
from typing import List, Tuple
import numpy as np

from app.api.errors import (
    EmptyMaskError,
    FullImageMaskError,
    InsufficientBoundaryError,
    MaskTooLargeError,
    RegionTooLargeError,
    TooManyRegionsError,
)
from app.config import settings


class MaskValidationResult:
    def __init__(
        self,
        masked_pixels: int,
        total_pixels: int,
        masked_percentage: float,
        region_count: int,
        max_region_size: int,
    ) -> None:
        self.masked_pixels = masked_pixels
        self.total_pixels = total_pixels
        self.masked_percentage = masked_percentage
        self.region_count = region_count
        self.max_region_size = max_region_size


def analyze_connected_regions(
    mask: np.ndarray,
) -> Tuple[int, int, List[int]]:
    """Analyze 8-connected components of the binary damaged mask.

    Returns:
        region_count: Total number of disjoint connected damage regions.
        max_region_size: Pixel count of the largest connected region.
        region_sizes: List of pixel counts for all identified regions.
    """
    height, width = mask.shape
    visited = np.zeros((height, width), dtype=bool)
    region_sizes: List[int] = []

    # 8-connectivity neighbor offsets
    neighbors = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0),  (1, 1),
    ]

    for r in range(height):
        for c in range(width):
            if not mask[r, c] or visited[r, c]:
                continue

            # Start BFS for a new connected damage region
            region_size = 0
            has_known_boundary = False
            queue: deque[Tuple[int, int]] = deque([(r, c)])
            visited[r, c] = True

            while queue:
                curr_r, curr_c = queue.popleft()
                region_size += 1

                for dr, dc in neighbors:
                    nr, nc = curr_r + dr, curr_c + dc
                    if 0 <= nr < height and 0 <= nc < width:
                        if not mask[nr, nc]:
                            # Adjacent to a known, undamaged pixel
                            has_known_boundary = True
                        elif not visited[nr, nc]:
                            visited[nr, nc] = True
                            queue.append((nr, nc))

            if not has_known_boundary:
                raise InsufficientBoundaryError(
                    "A selected damage region has no neighboring known pixels to inform reconstruction."
                )

            region_sizes.append(region_size)

    max_size = max(region_sizes) if region_sizes else 0
    return len(region_sizes), max_size, region_sizes


def validate_mask(mask: np.ndarray) -> MaskValidationResult:
    """Validate mask against coverage thresholds, single-region limits, and boundary constraints."""
    height, width = mask.shape
    total_pixels = height * width
    masked_pixels = int(np.count_nonzero(mask))

    if masked_pixels == 0:
        raise EmptyMaskError()

    if masked_pixels == total_pixels:
        raise FullImageMaskError()

    masked_percentage = (masked_pixels / total_pixels) * 100.0

    if masked_pixels > settings.max_masked_pixels:
        raise MaskTooLargeError(
            f"Selected damaged pixels ({masked_pixels:,}) exceeds the maximum budget ({settings.max_masked_pixels:,})."
        )

    if masked_percentage > settings.max_masked_percentage:
        raise MaskTooLargeError(
            f"Selected damaged area ({masked_percentage:.1f}%) exceeds the limit ({settings.max_masked_percentage:.1f}%)."
        )

    region_count, max_region_size, _ = analyze_connected_regions(mask)

    if region_count > settings.max_connected_regions:
        raise TooManyRegionsError(
            f"Selection contains {region_count} regions; maximum allowed is {settings.max_connected_regions}."
        )

    if max_region_size > settings.max_connected_region_pixels:
        raise RegionTooLargeError(
            f"Largest damage region ({max_region_size:,} px) exceeds region limit ({settings.max_connected_region_pixels:,} px)."
        )

    return MaskValidationResult(
        masked_pixels=masked_pixels,
        total_pixels=total_pixels,
        masked_percentage=masked_percentage,
        region_count=region_count,
        max_region_size=max_region_size,
    )
