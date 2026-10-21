# Image Inpainting — Python Backend

A transparent, modular, and mathematically rigorous Python backend for **Linear Algebra-Based Image Inpainting** using **Tikhonov Regularization** and custom iterative linear system solvers.

Built for the **Scientific Computing Lab (SCL)** academic course demonstration and viva examination.

---

## 1. Project Overview

This backend services the interactive web frontend for image inpainting. The frontend allows users to upload an image, paint damaged pixels with a brush, erase mask strokes, and trigger reconstruction. The current UI submits a fixed regularization value, $\lambda = 0.01$; the API itself accepts lambda as a request parameter.

### Key Principles
- **No Black Boxes**: Does **not** use `cv2.inpaint`, `skimage.restoration.inpaint_biharmonic`, deep learning models, pretrained weights, or opaque direct solvers (`numpy.linalg.solve`).
- **Explainable Numerical Linear Algebra**: Forms a regularized Dirichlet-Laplacian system and implements **Red-Black Gauss-Seidel** and **Jacobi** relaxation. The reconstruction service currently uses Gauss-Seidel.
- **Authentic Metrics**: Refuses to fabricate PSNR or SSIM metrics when no pristine ground-truth image exists. Reports verified linear system residuals $\|b - Ax\|_2 / (\|b\|_2 + \epsilon)$, iteration counts, convergence status, and exact execution runtimes.
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
│   │   ├── tikhonov.py             # Euler-Lagrange Tikhonov linear system assembly (A x = b)
│   │   ├── iterative_solver.py     # Custom transparent Gauss-Seidel & Jacobi solvers
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

## 8. Mathematical Formulation: Tikhonov Regularization

### 8.1 Continuous Energy Formulation
Image inpainting seeks to fill in a missing domain $\Omega \subset D$ by extending known Dirichlet boundary conditions $\partial\Omega$ into $\Omega$ smoothly. The standard Dirichlet energy minimization is:
$$\min_{u} \int_{\Omega} \|\nabla u(x, y)\|^2 \, dx dy \quad \text{subject to } u|_{\partial\Omega} = g$$
Its Euler-Lagrange equation is Laplace's equation (harmonic inpainting):
$$\Delta u = \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} = 0 \quad \text{in } \Omega, \quad u|_{\partial\Omega} = g$$

### 8.2 Tikhonov Regularization Formulation
Pure harmonic inpainting can be underdetermined or ill-conditioned if boundary data is sparse or when spatial derivatives lack regularization. We formulate the problem under the classic **Tikhonov Regularization** framework:
$$\min_x \frac{1}{2} x^T L x - c^T x + \frac{\lambda}{2} \|x - x_0\|_2^2$$
where:
- $x \in \mathbb{R}^N$ is the vector of $N$ unknown pixel intensities in the damaged domain $\Omega$.
- $L$ is the discrete Laplacian operator representing the **smoothness penalty**.
- $c \in \mathbb{R}^N$ encapsulates the boundary constraints contributed by known neighbor pixels.
- $\lambda > 0$ is the Tikhonov regularization parameter.
- $x_0 \in \mathbb{R}^N$ is the local prior. The implementation uses the mean of known 4-neighbors where available and a propagated nearby boundary color for interior pixels.

Taking the gradient with respect to $x$ and setting to zero yields the regularized linear system:
$$(L + \lambda I) x = c + \lambda x_0$$
Let $A = L + \lambda I$ and $b = c + \lambda x_0$:
$$A x = b$$

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

## 10. Core Numerical Solver (Gauss-Seidel & Jacobi)

Because $A$ is an M-matrix, classical iterative splitting methods converge **unconditionally** from any initial iterate $x^{(0)}$.

### 10.1 Red-Black Gauss-Seidel Update
Unknowns are partitioned by checkerboard parity on the image grid. The red group is updated from the current black values, followed by the black group using the newly updated red values. The two vectorized group updates implement a Gauss-Seidel ordering for the 4-connected grid:
$$x_i^{(k+1)} = \frac{b_i + \sum_{m \in \text{unknown neighbors}} x_m}{\text{diag}_i}$$
where the most recently updated values of $x_m$ are used immediately.

### 10.2 Jacobi Update
In Jacobi iteration, all updates are computed simultaneously from the previous iterate $x^{(k)}$:
$$x_i^{(k+1)} = \frac{b_i + \sum_{m \in \text{unknown neighbors}} x_m^{(k)}}{\text{diag}_i}$$

### 10.3 Residual & Convergence Criteria
At each iteration, we monitor the explicit residual vector:
$$r = b - A x$$
where $(Ax)_i = \text{diag}_i x_i - \sum_{m \in \text{unknown neighbors}} x_m$.
The relative residual norm is:
$$\text{rel\_res} = \frac{\|r\|_2}{\|b\|_2 + 10^{-12}}$$
The solver terminates when:
1. **Convergence**: $\text{rel\_res} < \text{tolerance}$ (default $10^{-4}$).
2. **Safety Ceiling**: Iteration reaches `max_iterations` (default $500$).
3. **Instability Detection**: If any element of $x$ becomes `NaN` or `Inf`, an immediate exception is raised.

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
   PSNR and SSIM require an original uncorrupted ground-truth image $I_{\text{clean}}$. For user-uploaded damaged images, no clean reference exists. Computing PSNR against the damaged image would be misleading. The system truthfully reports `null` for PSNR/SSIM and outputs the actual linear system residual norm.
3. **What are the limitations of smoothness-based inpainting?**
   Tikhonov regularization with a discrete Laplacian prior enforces minimal curvature ($C^2$ smoothness). It excels at smooth textures, gradients, scratches, and modest holes. However, it naturally blurs sharp high-frequency edges and complex stochastic textures that span across large damage regions.
