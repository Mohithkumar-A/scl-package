"""Main FastAPI application entrypoint with CORS and centralized exception handling."""

from __future__ import annotations

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.errors import InpaintingException
from app.api.routes import router
from app.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("inpainting-backend")

app = FastAPI(
    title="Linear Algebra Image Inpainting API",
    description="Backend for mathematical reconstruction using Tikhonov regularization and iterative linear solvers.",
    version="1.0.0",
)

# Allow only the origins configured through CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(InpaintingException)
async def inpainting_exception_handler(request: Request, exc: InpaintingException) -> JSONResponse:
    """Format known inpainting errors into standard structured JSON responses."""
    logger.warning("Application error [%s]: %s", exc.code, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unhandled errors, log the traceback securely, and return safe error payload."""
    logger.exception("Unexpected server error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred during image reconstruction.",
            }
        },
    )


# Register API routers
app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
