# Image Inpainting — Linear Algebra-Based Restoration

A complete, fullstack scientific computing application for image inpainting using **Tikhonov Regularization** and transparent iterative linear algebra.

## Project Architecture

```
scl-package/
├── frontend/               # React 19, TypeScript, Vite & Tailwind CSS web dashboard
│   ├── src/                # Components (DamageGrid, ImagePanel), Routes, Mask Utilities
│   └── package.json        # Frontend configuration and test scripts
├── backend/                # Python FastAPI numerical computing backend
│   ├── app/                # Main app, config, API routes, Tikhonov math, and Gauss-Seidel solver
│   ├── tests/              # 25 automated pytest tests
│   └── requirements.txt    # FastAPI, Uvicorn, NumPy, Pillow, Pytest
├── package.json            # Root convenience scripts to run frontend and backend
└── README.md
```

## Running the Project

### 1. Backend (Python + FastAPI)

Prerequisites: Python 3.9+ (Python 3.11 recommended).

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend starts at `http://localhost:8000`. API docs available at `http://localhost:8000/docs`.

### 2. Frontend (React + Vite)

Prerequisites: Node.js (v20+) and npm.

```bash
cd frontend
# (Dependencies already installed)
npm run dev
```

Connect the frontend to the backend by configuring `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```
(If `VITE_API_URL` is omitted, the frontend falls back to client-side demo mode).

### 3. Running All Tests

- **Backend tests (25 tests)**:
  ```bash
  cd backend && pytest tests/
  ```
- **Frontend tests (10 tests)**:
  ```bash
  cd frontend && npm run test
  ```


