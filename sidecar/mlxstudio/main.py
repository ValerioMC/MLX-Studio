"""FastAPI app factory + lifespan. Started by the Tauri core as a sidecar binary."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import catalog, chat, downloads
from .api import models as models_api
from .api import openai, settings as settings_api, system
from .config import get_settings
from .db.session import init_db
from .services.download_manager import manager

settings = get_settings()
_started_at = 0.0


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _started_at
    import time

    _started_at = time.time()
    init_db()
    manager.bind_loop(asyncio.get_running_loop())
    from .api.downloads import promote_completed_download, reconcile_models

    manager.set_complete_handler(promote_completed_download)
    reconcile_models()
    yield
    # graceful shutdown: unload models to free unified memory
    from .services.engine import engine

    for r in list(engine.loaded()):
        engine.unload_model(r["model_id"])


def create_app() -> FastAPI:
    app = FastAPI(title="MLX Studio", version=__version__, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["tauri://localhost", "http://localhost:1420"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        import time

        from .services.engine import MLX_AVAILABLE

        return {
            "status": "ok",
            "version": __version__,
            "uptime": time.time() - _started_at,
            "mlx_available": MLX_AVAILABLE,
        }

    app.include_router(catalog.router)
    app.include_router(downloads.router)
    app.include_router(models_api.router)
    app.include_router(system.router)
    app.include_router(chat.router)
    app.include_router(openai.router)
    app.include_router(settings_api.router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port, log_level="info")


if __name__ == "__main__":
    main()
