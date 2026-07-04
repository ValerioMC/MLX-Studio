"""Runtime configuration, sourced from env vars injected by the Tauri core."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_app_dir() -> Path:
    # macOS app-support location; falls back to a local dir for dev on other OSes.
    if os.name == "posix" and Path.home().joinpath("Library").exists():
        return Path.home() / "Library" / "Application Support" / "MLX Studio"
    return Path.home() / ".mlxstudio"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MLXSTUDIO_", extra="ignore")

    port: int = 11535
    host: str = "127.0.0.1"

    # Per-launch bearer token for the internal API (set by the Rust core).
    token: str = "dev-token"
    # Separate user-facing key for the OpenAI-compatible /v1 surface.
    api_key: str = "mlx-studio-local"

    app_dir: Path = _default_app_dir()
    models_dir: Path | None = None

    # Allow the engine to lazy-load an installed-but-stopped model on first request.
    autoload_on_request: bool = True
    max_parallel_downloads: int = 4

    @property
    def db_path(self) -> Path:
        return self.app_dir / "mlxstudio.db"

    @property
    def models_path(self) -> Path:
        return self.models_dir or (self.app_dir / "models")

    @property
    def logs_path(self) -> Path:
        return self.app_dir / "logs"

    def ensure_dirs(self) -> None:
        for p in (self.app_dir, self.models_path, self.logs_path):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
