# Image Inpainting — Python Backend

A transparent, modular, and mathematically rigorous Python backend for **Linear Algebra-Based Image Inpainting** using **Tikhonov Regularization** and custom iterative linear system solvers.

Built for the **Scientific Computing Lab (SCL)** academic course demonstration and viva examination.

---

## 1. Project Overview

This backend services the interactive web frontend for image inpainting. The frontend allows users to upload an image, paint damaged pixels with a brush, erase mask strokes, and trigger reconstruction. The current UI submits a fixed regularization value, $\lambda = 0.01$; the API itself accepts lambda as a request parameter.

### Key Principles
- **No Black Boxes**: Does **not** use `cv2.inpaint`, `skimage.restoration.inpaint_biharmonic`, deep learning models, pretrained weights, or opaque direct solvers (`numpy.linalg.solve`).
- **Explainable Numerical Linear Algebra**: Builds the smoothness, boundary, and Tikhonov prior residuals and solves the resulting regularized least-squares problem with a streamlined, matrix-free Golub-Kahan LSQR implementation.
- **Authentic Metrics**: Refuses to fabricate PSNR or SSIM metrics when no pristine ground-truth image exists. Reports the least-squares optimality residual $\|C^T(d-Cx)\|_2 / (\|C^Td\|_2 + \epsilon)$, iteration counts, convergence status, and execution runtimes.
- **Zero Modification of Preserved Pixels**: All undamaged pixels ($M_{i,j} = 0$) are preserved bit-for-bit in the reconstructed image. Alpha transparency channels are preserved untouched.

---

## 2. Architecture & Modular Responsibilities

The codebase strictly decouples HTTP transport from mathematical calculations and I/O utilities:

```
backend/
├── app/
│   ├── main.py                     # FastAPI application, CORS configuration, exception handlers
│   ├── config.py                   # Pydantic Settings & environment variable thresholds
│   ├── api/
│   │   ├── routes.py               # HTTP route handlers (GET /api/health, POST /api/reconstruct)
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   └── errors.py               # Custom exception hierarchy & error codes
│   ├── services/
│   │   └── reconstruction_service.py # Orchestrator: decoding, validation, solving, encoding
│   ├── calculations/
│   │   ├── mask_validation.py      # 8-connectivity analysis, region size & boundary verification
│   │   ├── difference_operators.py # Graph topology, connected components, boundary projection
│   │   ├── tikhonov.py             # Tikhonov-regularized residual operator assembly
│   │   ├── iterative_solver.py     # Matrix-free Golub-Kahan LSQR solver
│   │   └── metrics.py              # Verifiable mathematical diagnostics
│   └── utils/
│       ├── image_io.py             # Pillow decoding/encoding, RGB/RGBA/Grayscale normalizer
│       ├── mask_io.py              # Binary mask decoding (0 = preserve, 1 = reconstruct)
│       └── timing.py               # High-precision performance timer
├── tests/
│   ├── test_api.py                 # Route contracts and HTTP error code integration tests
│   ├── test_mask_validation.py     # Dimension, coverage, and connected component tests
│   ├── test_tikhonov.py            # Diagonal dominance and operator assembly tests
│   ├── test_iterative_solver.py    # Analytical system solutions and residual verification
│   └── test_reconstruction.py      # End-to-end multi-channel & alpha preservation tests
├── requirements.txt                # Production and test dependencies
├── .env.example                    # Environment configuration template
├── .gitignore                      # Git ignore patterns
└── README.md                       # Academic documentation & viva reference
```

---

## 3. Environment Setup & Installation

### Requirements
- Python 3.9+ (Python 3.11 recommended)
- `pip` package manager

### Installation Steps

```bash
cd backend

# 1. Create a Python virtual environment
python3 -m venv .venv

# 2. Activate the virtual environment
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate        # Windows PowerShell

# 3. Install dependencies
pip install -r requirements.txt
```

---

## 4. Running the Server

Start the FastAPI application with Uvicorn:

```bash
# With active virtual environment in backend/:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at:
- **API Base**: `http://localhost:8000`
- **Health Check**: `http://localhost:8000/api/health`
- **Interactive OpenAPI Documentation (Swagger)**: `http://localhost:8000/docs`

---

## 5. Connecting with the Frontend

1. Ensure the backend is running at `http://localhost:8000`.
2. In the `frontend/` directory, set the API URL in `.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
3. Start the frontend dev server:
   ```bash
   cd frontend
   npm run dev
   ```
4. The frontend will make live HTTP multipart POST requests to the Python backend. The API URL defaults to `http://localhost:8000`; set `VITE_API_URL` when using a different backend.

To run the frontend without the backend, set `VITE_DEMO_MODE=true` in `frontend/.env`. Demo mode performs a visual blur simulation and returns illustrative PSNR, SSIM, and residual values. These are not solver measurements; use the backend for real reconstruction and diagnostics.

### Frontend workflow

- Upload an image, paint the damaged area, and use Erase, Undo, Redo, or Clear to adjust the mask.
- Zoom and pan change only the display. The mask is stored and exported at the image's intrinsic pixel dimensions.
- Run a reconstruction, compare the result with the original using the slider or side-by-side view, or paint another pass on the current result. Revert to Original resets the working image.
- The UI uses a fixed lambda value of `0.01`. Direct API clients can provide a different value within the configured backend range.

### Default processing limits

The default limits are 4096 pixels per image dimension, 16,777,216 total image pixels, 2,000,000 masked pixels, 85% masked coverage, 100 connected regions, and 1,000,000 pixels per connected region. Backend values can be changed with the variables in `.env.example`; server-side validation is authoritative. Frontend validation mirrors the default image and mask limits to give immediate feedback.

Configure `CORS_ORIGINS` as a comma-separated list of allowed frontend origins. The server uses this setting for CORS; credentials are not enabled.

---

## 6. API Specification

### `GET /api/health`
Checks server readiness.
- **Response** (`200 OK`):
  ```json
  {
    "status": "ok",
    "version": "1.0.0",
    "description": "Linear Algebra Image Inpainting API"
  }
  ```

### `POST /api/reconstruct`
Performs Tikhonov regularization inpainting on an uploaded image and binary mask.

- **Request Type**: `multipart/form-data`
- **Form Fields**:
  - `image`: Binary file (PNG, JPEG, WEBP)
  - `mask`: Binary PNG mask file (`mask.png`)
  - `lambda`: Float regularization parameter (e.g. `0.01`)
  - `method`: String method identifier (`"tikhonov"`)

- **Response (`200 OK`)**:
  ```json
  {
    "reconstructed_image": "data:image/png;base64,...",
    "psnr": null,
    "ssim": null,
    "reconstruction_error": 0.000084,
    "time_taken": 0.048,
    "image_width": 512,
    "image_height": 512,
    "masked_pixels": 256,
    "masked_percentage": 0.1,
    "connected_regions": 2,
    "method": "Tikhonov Regularization (Smoothness-Based)",
    "lambda_value": 0.01,
    "iterations": 45,
    "converged": true,
    "final_residual": 0.000084,
    "changed_pixels": 256
  }
  ```

- **Structured Error Responses**:
  In the event of an invalid request or computational violation, the API returns a structured JSON payload:
  ```json
  {
    "error": {
      "code": "EMPTY_MASK",
      "message": "No damaged pixels were marked for reconstruction."
    }
  }
  ```
  | HTTP Code | Error Code | Description |
  | :--- | :--- | :--- |
  | `400` | `INVALID_IMAGE` | Corrupted image or zero dimensions |
  | `413` | `IMAGE_TOO_LARGE` | Dimensions or pixel count exceed safety limits |
  | `413` | `MASK_TOO_LARGE` | Selected damage exceeds area budget |
  | `413` | `REGION_TOO_LARGE` | Single connected component exceeds size limit |
  | `415` | `UNSUPPORTED_FORMAT` | Unsupported image encoding |
  | `422` | `EMPTY_MASK` | Zero pixels marked as damaged |
  | `422` | `FULL_IMAGE_MASK` | 100% of image marked without boundary reference |
  | `422` | `MASK_DIMENSION_MISMATCH`| Mask dimensions do not match image |
  | `422` | `TOO_MANY_REGIONS` | Exceeded disconnected region count limit |
  | `422` | `INSUFFICIENT_BOUNDARY` | Region has no adjacent known pixels |
  | `422` | `INVALID_LAMBDA` | $\lambda \le 0$, non-finite, or out of range |
  | `422` | `UNSUPPORTED_METHOD` | Unknown method parameter |
  | `503` | `SOLVER_NOT_CONVERGED` | Numerical solver hit max iterations without converging |
  | `500` | `INTERNAL_ERROR` | Safe generic message concealing internal stack traces |

---

## 7. Mask Convention & Coordinate System

- **Convention**:
  - $0$ / Black (`intensity <= 127`): **Preserve** original pixel value.
  - $1$ / White (`intensity > 127`): **Reconstruct** damaged pixel.
- **Coordinate Alignment**:
  - Pixel $(r, c)$ in the mask corresponds strictly to pixel $(r, c)$ in the input image array.
  - The mask width and height must match the decoded image dimensions exactly.
- **Connected Components**:
  - Validation groups damaged pixels using **8-connectivity**, including diagonal neighbors.
  - The numerical system uses 4-connected neighbors for its discrete Laplacian.

---

## 8. Mathematical Formulation: Regularized Least Squares

### 8.1 Continuous Energy Formulation
Image inpainting seeks to fill in a missing domain $\Omega \subset D$ by extending known Dirichlet boundary conditions $\partial\Omega$ into $\Omega$ smoothly. The standard Dirichlet energy minimization is:
$$\min_{u} \int_{\Omega} \|\nabla u(x, y)\|^2 \, dx dy \quad \text{subject to } u|_{\partial\Omega} = g$$
Its Euler-Lagrange equation is Laplace's equation (harmonic inpainting):
$$\Delta u = \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} = 0 \quad \text{in } \Omega, \quad u|_{\partial\Omega} = g$$

### 8.2 Residual-based least-squares formulation
The implemented energy can be written as a least-squares problem by stacking one residual for each pairwise smoothness constraint, known boundary neighbor, and prior value. Let $e_p$ be the coordinate vector for unknown pixel $p$. Construct a residual matrix $C$ and target vector $d$ with rows of these forms:

- Unknown-to-unknown edge $\{p,q\}$: row $(e_p-e_q)^T$ with target $0$.
- Unknown-to-known edge $(p,q)$: row $e_p^T$ with target $I_q$.
- Prior at unknown pixel $p$: row $\sqrt{\lambda}e_p^T$ with target $\sqrt{\lambda}x_{0,p}$.

Then the backend's objective is exactly the regularized least-squares problem:
$$\min_x \frac{1}{2}\|Cx-d\|_2^2.$$

The normal-equation optimality condition is:
$$C^T Cx=C^T d.$$

For this set of residuals, $C^T C$ is the unknown-pixel graph Laplacian with boundary contributions plus $\lambda I$, and $C^T d$ contains known boundary intensities plus the prior term. These normal equations are mathematically equivalent to the familiar system $Ax=b$. The reconstruction service stores edge and boundary indices and evaluates $Cv$ and $C^Tw$ on demand for LSQR; it does **not** build a dense $C$ matrix or explicitly multiply $C^TC$.

Expanding the squared residuals gives the energy:
$$E(x)=\frac{1}{2}\sum_{\{p,q\}\subset\Omega,\ p\sim q}(x_p-x_q)^2+\frac{1}{2}\sum_{p\in\Omega,\ q\in\mathcal K,\ p\sim q}(x_p-I_q)^2+\frac{\lambda}{2}\sum_{p\in\Omega}(x_p-x_{0,p})^2.$$

Here $x\in\mathbb{R}^N$ contains the unknown pixel intensities, $\mathcal K$ denotes known pixels adjacent to the unknown region, and $p\sim q$ means 4-neighbor adjacency. The regularization parameter $\lambda>0$ controls the prior penalty. The implementation uses the mean of known 4-neighbors as $x_{0,p}$ where available, and a propagated nearby boundary color for interior pixels.

This is **Tikhonov-regularized least squares**, not unregularized least squares. Removing the prior residuals would remove $\lambda I$ and $\lambda x_0$ from the system, changing its stability and solution.

---

## 9. Construction of the Discrete Difference System

For each unknown pixel $k \in \{0, \dots, N-1\}$ located at grid coordinates $(r, c)$:
1. Let $\mathcal{N}(r, c)$ be the set of 4-connected spatial neighbors within image bounds:
   $$\mathcal{N}(r, c) = \{(r \pm 1, c), (r, c \pm 1)\} \cap [0, H-1] \times [0, W-1]$$
   Let $d_k = |\mathcal{N}(r, c)|$ denote the valid degree ($2 \le d_k \le 4$, handling image corners and edges naturally).
2. Partition the neighbors into:
   - **Unknown neighbors**: $(nr, nc) \in \Omega$ (associated with unknown indices $m$).
   - **Known neighbors**: $(nr, nc) \notin \Omega$ (associated with fixed intensity values $I_{nr, nc}$).
3. The discrete finite-difference equation at unknown $k$ is:
   $$(d_k + \lambda) x_k - \sum_{m \in \text{unknown neighbors}} x_m = \sum_{(nr, nc) \in \text{known neighbors}} I_{nr, nc} + \lambda x_{0, k}$$

### Matrix Properties
- **Diagonal Elements**: $A_{k, k} = d_k + \lambda$.
- **Off-Diagonal Elements**: $A_{k, m} = -1$ if $k$ and $m$ are 4-neighbors, and $0$ otherwise.
- **Strict Diagonal Dominance**:
  Since $d_k = |\text{unknown neighbors}| + |\text{known neighbors}|$, the diagonal excess is:
  $$A_{k, k} - \sum_{m \ne k} |A_{k, m}| = |\text{known neighbors}| + \lambda \ge \lambda > 0$$
  Because $A$ has strictly positive diagonal entries and satisfies strict diagonal dominance with non-positive off-diagonals, $A$ is **Symmetric Positive-Definite (SPD)** and an **M-Matrix**.

---

## 10. Core Numerical Solver: Matrix-free LSQR

The service solves $\min_x \frac12\|Cx-d\|_2^2$ directly with LSQR, an iterative least-squares algorithm based on Golub-Kahan bidiagonalization. It does not explicitly form $C^TC$, which avoids squaring the condition number as happens when solving normal equations numerically.

The residual operator has three row groups: damaged-to-damaged differences, damaged-to-known boundary differences, and prior residuals weighted by $\sqrt{\lambda}$. The implementation evaluates $Cv$ and $C^Tw$ from the grid edge and boundary index arrays, without storing a dense residual matrix.

LSQR starts from the local prior estimate and iteratively refines it. Every five iterations (and on the final iteration), convergence is checked using the relative least-squares optimality residual:
$$\text{rel\_optimality} = \frac{\|C^T(d-Cx)\|_2}{\|C^Td\|_2 + 10^{-12}}.$$
The solver stops when this value is below the configured tolerance (default $10^{-4}$), reaches the configured iteration ceiling (default 500), or encounters a non-finite iterate. A nonzero data residual is expected in least squares and does not by itself mean the solver failed; the normal-equation residual measures whether the objective has been minimized.

---

## 11. Testing & Verification

The test suite currently contains **29 automated tests** covering:
- **Mask Validation**: Threshold conventions, dimension checks, 8-connectivity labeling, and boundary verification.
- **Analytical Solver Verification**: Solves small systems with exact closed-form solutions ($2 \times 2$ and $3 \times 3$), verifying residual norms and convergence.
- **Tikhonov Linear System**: Verifies Gershgorin circle diagonal dominance and parameter limits.
- **Multi-Channel & Alpha Preservation**: Proves that RGB and grayscale channels are restored while alpha channels and all unmasked pixels remain bit-for-bit identical.
- **Boundary Projection & Diagnostics**: Checks component-aware boundary priors and changed-pixel reporting.
- **CORS**: Checks that configured frontend origins are allowed and unconfigured origins are rejected.
- **FastAPI HTTP Endpoints**: Tests real HTTP requests, multipart payloads, and JSON error structures using `TestClient`.

### Running Tests

```bash
cd backend
source .venv/bin/activate
pytest tests/
```

The current suite completes with 29 passing tests. Exact per-file progress output can vary as tests are added.

---

## 12. Viva & Academic Demonstration Notes

1. **Why is the system strictly diagonally dominant?**
   Because $A_{k, k} = d_k + \lambda$ and $\sum_{m \ne k} |A_{k, m}| = |\text{unknown neighbors}|$. The difference is $|\text{known neighbors}| + \lambda \ge \lambda > 0$.
2. **Why can't we compute PSNR or SSIM for real user uploads?**
   PSNR and SSIM require an original uncorrupted ground-truth image $I_{\text{clean}}$. For user-uploaded damaged images, no clean reference exists. Computing PSNR against the damaged image would be misleading. The system truthfully reports `null` for PSNR/SSIM and outputs the relative least-squares optimality residual $\|C^T(d-Cx)\|_2/(\|C^Td\|_2+\epsilon)$.
3. **What are the limitations of smoothness-based inpainting?**
   Tikhonov regularization with a discrete Laplacian prior enforces minimal curvature ($C^2$ smoothness). It excels at smooth textures, gradients, scratches, and modest holes. However, it naturally blurs sharp high-frequency edges and complex stochastic textures that span across large damage regions.
