"""Per-model diagnostic logs, one rotating file per model under the logs directory.

They record what a user needs to understand a model's behaviour (loads, timings,
throughput, failures) and never the conversation: no prompt or reply text is
written, so the log can be shared when asking for help."""

from __future__ import annotations

import logging
import re
import threading
from logging.handlers import RotatingFileHandler
from pathlib import Path

from ..config import get_settings

MAX_LOG_BYTES = 1_000_000
BACKUP_COUNT = 2

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
_loggers: dict[str, logging.Logger] = {}
_lock = threading.Lock()


def log_path(model_id: str) -> Path:
    """The model's current log file; ids are reduced to filename-safe characters."""
    return get_settings().logs_path / f"{_SAFE_NAME.sub('_', model_id)}.log"


def model_logger(model_id: str) -> logging.Logger:
    """The logger writing to this model's file, created on first use."""
    with _lock:
        existing = _loggers.get(model_id)
        if existing is not None:
            return existing
        path = log_path(model_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(path, maxBytes=MAX_LOG_BYTES, backupCount=BACKUP_COUNT, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S"))
        logger = logging.getLogger(f"mlxstudio.model.{model_id}")
        logger.setLevel(logging.INFO)
        logger.propagate = False  # model activity stays in the model's file
        logger.addHandler(handler)
        _loggers[model_id] = logger
        return logger


def tail(model_id: str, lines: int) -> list[str]:
    """The last `lines` lines of the model's current log, oldest first."""
    path = log_path(model_id)
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:]
