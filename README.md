# Image Inpainting — Linear Algebra Restoration

A full-stack image restoration demo. The frontend lets you paint damaged regions on an uploaded image; the FastAPI backend reconstructs the marked pixels by minimizing a Tikhonov-regularized least-squares smoothness model with matrix-free LSQR.

## Project layout

- `frontend/` — React, TypeScript, Vite, brush-mask utilities, and UI tests.
- `backend/` — FastAPI API, image and mask validation, numerical solver, and pytest suite.
- `assets/` — Sample original and reconstructed images. The pair is `Aged Alpine Lake Mountain Vista.png` and `Aged Alpine Lake Mountain Vista_reconstructed.png`.
- [`MATH_WALKTHROUGH.html`](MATH_WALKTHROUGH.html) — Interactive explanation of the reconstruction equations, including its regularized least-squares formulation.

## Run locally

Requirements: Node.js 20+, npm, and Python 3.9+ (Python 3.11 recommended).

To start both local servers with one command from the repository root:

```bash
./dev.sh
```

The script prepares missing dependencies, activates the backend virtual environment, and starts both local servers. It prefers backend port `8000` and frontend port `5173`, choosing the next available port if either is already in use. It prints the actual URLs and configures the frontend to use the selected backend port. Open the printed frontend URL and press `Ctrl+C` in the terminal to stop both servers. The manual setup steps below are available if you prefer to start each service separately.

Start the backend in one terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate        # Windows PowerShell
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

By default, the frontend calls `http://localhost:8000`. Set `VITE_API_URL` in `frontend/.env` to use a different backend URL. The Vite dev server also proxies `/api` to `http://127.0.0.1:8000`.

To run the UI without a backend, set `VITE_DEMO_MODE=true` in `frontend/.env`. Demo mode applies a visual blur simulation and returns illustrative metrics; it does not run the reconstruction solver and its metrics are not scientific results. Restart the dev server after changing environment variables.

## Use the inpainting workspace

1. Upload an image and paint over damaged pixels. Use Erase to correct the mask; undo, redo, clear, zoom, and pan controls are available in the workspace.
2. Run reconstruction. The interface currently uses a fixed lambda value of `0.01`; the API accepts lambda as a request parameter.
3. Review the output with the comparison slider or side-by-side view. Further passes can be painted on the current result; “Revert to Original” resets the working image.

Brush masks are stored at the uploaded image's intrinsic pixel dimensions. Zoom and display sizing only affect rendering and pointer-coordinate mapping, not mask export dimensions.

## Default backend limits

The backend defaults to images no larger than 4096 × 4096 pixels (16,777,216 total pixels), at most 2,000,000 masked pixels, 85% masked coverage, 100 connected regions, and 1,000,000 pixels per connected region. Limits can be changed with the backend environment variables documented in [`backend/.env.example`](backend/.env.example). Frontend checks mirror the default image and mask pixel limits; the backend remains authoritative if deployed settings differ.

The API defaults to `CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173`. Configure this comma-separated allowlist for the origins that host your frontend.

## API and verification

- Health: `GET http://localhost:8000/api/health`
- Reconstruction: `POST http://localhost:8000/api/reconstruct` using multipart fields `image`, `mask`, `lambda`, and `method`.
- Interactive API docs: `http://localhost:8000/docs`

Run frontend checks from the repository root. For backend tests, activate the backend virtual environment first:

```bash
npm test
npm run build
npm run lint
```

```bash
source backend/.venv/bin/activate
npm run test:backend
```

The current suites contain 22 frontend tests and 29 backend tests. Backend responses report PSNR and SSIM as `null` because a clean reference image is not available; they include solver residuals, iteration/convergence information, and changed-pixel diagnostics instead.

See [`backend/README.md`](backend/README.md) for the API contract, numerical formulation, backend configuration, and detailed test coverage.
