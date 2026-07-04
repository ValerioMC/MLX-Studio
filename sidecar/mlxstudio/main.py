"""FastAPI app factory + lifespan. Started by the Tauri core as a sidecar binary."""

from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import catalog, conversations, downloads
from .api import models as models_api
from .api import openai, settings as settings_api, system
from .config import get_settings
from .db.session import init_db
from .services.download_manager import manager

settings = get_settings()
_started_at = 0.0

logger = logging.getLogger(__name__)


def _start_parent_watchdog() -> None:
    """Exit when the Tauri process that spawned us dies.

    The Rust core kills the sidecar on clean exit, but a crash or force-quit
    skips that path, and with a PyInstaller onefile binary killing the
    bootloader does not reach this inner process. Watching the parent PID from
    inside guarantees the sidecar never outlives the app."""
    parent_pid_env = os.environ.get("MLXSTUDIO_PARENT_PID")
    if not parent_pid_env:
        return  # standalone dev run: no parent to watch
    parent_pid = int(parent_pid_env)

    def _watch() -> None:
        import psutil

        while psutil.pid_exists(parent_pid):
            time.sleep(2.0)
        logger.info("Parent process %s exited; shutting down sidecar", parent_pid)
        os._exit(0)

    threading.Thread(target=_watch, daemon=True, name="parent-watchdog").start()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _started_at

    _started_at = time.time()
    _start_parent_watchdog()
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
        from .services.engine import MLX_AVAILABLE

        return {
            "status": "ok",
            "version": __version__,
            "uptime": time.time() - _started_at,
            "mlx_available": MLX_AVAILABLE,
        }

    app.include_router(catalog.router)
    app.include_router(conversations.router)
    app.include_router(downloads.router)
    app.include_router(models_api.router)
    app.include_router(system.router)
    app.include_router(openai.router)
    app.include_router(settings_api.router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port, log_level="info")


if __name__ == "__main__":
    main()
