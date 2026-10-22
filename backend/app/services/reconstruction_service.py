"""Service layer coordinating image decoding, mask validation, Tikhonov solving, and response construction."""

from __future__ import annotations

import numpy as np

from app.api.errors import InpaintingException
from app.api.schemas import ReconstructionResponse
from app.calculations.difference_operators import build_grid_topology
from app.calculations.iterative_solver import solve_least_squares
from app.calculations.mask_validation import validate_mask
from app.calculations.metrics import compute_metrics
from app.calculations.tikhonov import construct_least_squares_system
from app.config import settings
from app.utils.image_io import decode_image, encode_image_to_base64_png
from app.utils.mask_io import decode_binary_mask
from app.utils.timing import measure_time


SUPPORTED_METHODS = {
    "tikhonov": "Tikhonov Regularization (Smoothness-Based)",
    "smoothness": "Tikhonov Regularization (Smoothness-Based)",
    "tikhonov_smoothness": "Tikhonov Regularization (Smoothness-Based)",
}


def reconstruct_image_service(
    image_bytes: bytes,
    mask_bytes: bytes,
    lambda_value: float,
    method: str = "tikhonov",
) -> ReconstructionResponse:
    """Coordinate the end-to-end mathematical inpainting pipeline."""
    method_key = method.lower().strip()
    if method_key not in SUPPORTED_METHODS:
        raise InpaintingException(
            status_code=422,
            code="UNSUPPORTED_METHOD",
            message=f"Reconstruction method '{method}' is not supported. Use 'tikhonov'.",
        )
    method_display_name = SUPPORTED_METHODS[method_key]

    with measure_time() as timer:
        # Step 1 & 2: Decode image and validate dimensions
        decoded = decode_image(image_bytes)

        # Step 3: Decode mask and ensure exact dimension alignment
        mask = decode_binary_mask(mask_bytes, decoded.width, decoded.height)

        # Step 4: Validate mask limits, connected components, and boundary conditions
        val_result = validate_mask(mask)

        # Step 5: Construct discrete difference grid topology
        topology = build_grid_topology(mask)

        # Step 6: Solve for each color channel independently
        # Start with an exact copy of original image so unselected pixels are untouched
        reconstructed_channels = decoded.channels.copy()
        num_channels = decoded.channels.shape[2]

        total_iterations = 0
        max_residual = 0.0
        all_converged = True

        rows = topology.idx_to_coord[:, 0]
        cols = topology.idx_to_coord[:, 1]

        for c in range(num_channels):
            channel_data = decoded.channels[:, :, c]
            system = construct_least_squares_system(channel_data, topology, lambda_value)

            solver_res = solve_least_squares(
                system=system,
                max_iterations=settings.solver_max_iterations,
                tolerance=settings.solver_tolerance,
            )

            # Insert solved unknowns into the damaged pixel locations only
            reconstructed_channels[rows, cols, c] = solver_res.x

            total_iterations = max(total_iterations, solver_res.iterations)
            max_residual = max(max_residual, solver_res.final_residual)
            if not solver_res.converged:
                all_converged = False

        # Step 7: Calculate changed pixels diagnostic (masked pixels with > 0.5 intensity diff)
        diff = np.abs(decoded.channels[rows, cols, :] - reconstructed_channels[rows, cols, :])
        changed_pixels_count = int(np.count_nonzero(np.any(diff > 0.5, axis=1)))

        # Step 8: Encode reconstructed image back to Base64 PNG
        reconstructed_data_url = encode_image_to_base64_png(
            channels=reconstructed_channels,
            alpha=decoded.alpha,
            original_mode=decoded.original_mode,
        )

    # Step 9: Compile genuine mathematical metrics (strictly avoiding fabricated PSNR/SSIM)
    metrics = compute_metrics(
        masked_pixels=val_result.masked_pixels,
        total_pixels=val_result.total_pixels,
        iterations=total_iterations,
        converged=all_converged,
        final_residual=max_residual,
        time_taken=timer.elapsed,
        changed_pixels=changed_pixels_count,
    )

    return ReconstructionResponse(
        reconstructed_image=reconstructed_data_url,
        psnr=metrics["psnr"],
        ssim=metrics["ssim"],
        reconstruction_error=metrics["reconstruction_error"],
        time_taken=metrics["time_taken"],
        image_width=decoded.width,
        image_height=decoded.height,
        masked_pixels=metrics["masked_pixels"],
        masked_percentage=metrics["masked_percentage"],
        connected_regions=val_result.region_count,
        method=method_display_name,
        lambda_value=lambda_value,
        iterations=metrics["iterations"],
        converged=metrics["converged"],
        final_residual=metrics["final_residual"],
        changed_pixels=metrics["changed_pixels"],
    )
