# SCL Package

Sparse Computed Tomography Reconstruction Web Platform.

This project was built with [Lovable](https://lovable.dev).

## Project Layout

- `frontend/`: TanStack Start, React 19, Vite, and Tailwind CSS web application.
  - `frontend/src/`: Application components, routes, hooks, services, and utilities.
  - `frontend/public/`: Static assets.
  - `frontend/.env.example`: Template for environment variables (e.g. `VITE_API_URL`).
- `roadmap.md`: Project milestones and tasks.
- `package.json`: Root runner scripts to manage the frontend.

## Local Development

Prerequisites: Node.js (v20+) and npm.

### Quick Start (from root)

```sh
# Dependencies are pre-installed in frontend/
npm run dev
```

### Or run directly inside frontend directory

```sh
cd frontend
npm run dev
```

The application runs on Vite dev server (typically http://localhost:3000 or http://localhost:5173).

### Environment Configuration

By default, if `VITE_API_URL` is omitted, the frontend runs in **Demo Mode** using simulated reconstruction responses.
To connect to a custom backend, configure `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

### Available Scripts

- `npm run dev`: Start the local development server (ready to run when you want).
- `npm run build`: Build for production.
- `npm run test`: Run the test suite (Vitest).
- `npm run lint`: Run ESLint checks.

