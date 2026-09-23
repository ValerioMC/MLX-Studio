"""System metrics. Unified memory means RAM is the relevant budget on Apple Silicon."""

from __future__ import annotations

import shutil

import psutil

from ..config import get_settings

settings = get_settings()

# Share of installed RAM kept free for macOS and other apps; model budgets and
# fit classification never plan into it.
RESERVE_FRACTION = 0.15


def reserve_bytes(total: int) -> int:
    return int(RESERVE_FRACTION * total)


def system_stats(loaded_models: list[dict]) -> dict:
    vm = psutil.virtual_memory()
    sw = psutil.swap_memory()
    disk = shutil.disk_usage(settings.models_path)
    return {
        "ram_total": vm.total,
        "ram_used": vm.used,
        "ram_available": vm.available,
        "swap_used": sw.used,
        "reserve_bytes": reserve_bytes(vm.total),
        "cpu_percent": psutil.cpu_percent(interval=None),
        "disk_free": disk.free,
        "loaded_models": loaded_models,
    }


def available_for_models(loaded_models: list[dict]) -> int:
    """Memory we can give a new model right now: free RAM minus an OS safety reserve."""
    vm = psutil.virtual_memory()
    return max(vm.available - reserve_bytes(vm.total), 0)


def usable_total() -> int:
    """Upper bound a model could use if other apps/models were freed first:
    total installed RAM minus the OS safety reserve."""
    vm = psutil.virtual_memory()
    return max(vm.total - reserve_bytes(vm.total), 0)


def classify_fit(est_bytes: int | None, available_budget: int, total_usable: int) -> str:
    """Classify how a model's estimated footprint fits this machine.

    fits    -> within free RAM right now
    tight   -> exceeds free RAM but within the machine's usable capacity
              (would load after freeing memory or unloading other models)
    too_big -> exceeds the machine's usable capacity outright
    unknown -> no RAM estimate available (size could not be inferred)
    """
    if est_bytes is None:
        return "unknown"
    if est_bytes <= available_budget:
        return "fits"
    if est_bytes <= total_usable:
        return "tight"
    return "too_big"
