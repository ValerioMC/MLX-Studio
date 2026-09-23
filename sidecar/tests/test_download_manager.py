"""Download job lifecycle: what cancel deletes, and deduplication of active jobs."""

from __future__ import annotations

from pathlib import Path

import pytest

from mlxstudio.services import download_manager as dm
from mlxstudio.services.download_manager import DownloadManager, Job

REPO = "mlx-community/Tiny-Model-4bit"


@pytest.fixture()
def manager(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> DownloadManager:
    monkeypatch.setattr(dm.settings, "models_dir", tmp_path)
    return DownloadManager()


def _weights_dir(manager: DownloadManager) -> Path:
    target = manager._target_dir(REPO)
    target.mkdir(parents=True)
    (target / "model.safetensors").write_bytes(b"weights")
    return target


def test_cancel_unfinished_download_deletes_partial_files(manager: DownloadManager) -> None:
    target = _weights_dir(manager)
    manager.jobs["j1"] = Job(id="j1", repo_id=REPO, status="downloading")

    manager.cancel("j1")

    assert "j1" not in manager.jobs
    assert not target.exists()


def test_dismissing_completed_download_keeps_installed_model(manager: DownloadManager) -> None:
    target = _weights_dir(manager)
    manager.jobs["j1"] = Job(id="j1", repo_id=REPO, status="completed")

    manager.cancel("j1")

    assert "j1" not in manager.jobs
    assert (target / "model.safetensors").exists()


def test_canceling_update_keeps_installed_weights(manager: DownloadManager) -> None:
    target = _weights_dir(manager)
    manager.jobs["u1"] = Job(
        id="u1", repo_id=REPO, status="downloading", keep_files_on_cancel=True
    )

    manager.cancel("u1")

    assert (target / "model.safetensors").exists()


def test_start_returns_active_job_for_same_repo(manager: DownloadManager) -> None:
    active = Job(id="j1", repo_id=REPO, status="paused")
    manager.jobs["j1"] = active

    job = manager.start("j2", REPO)

    assert job is active
    assert set(manager.jobs) == {"j1"}


def test_active_job_ignores_finished_jobs(manager: DownloadManager) -> None:
    manager.jobs["j1"] = Job(id="j1", repo_id=REPO, status="completed")
    manager.jobs["j2"] = Job(id="j2", repo_id=REPO, status="failed")

    assert manager.active_job_for(REPO) is None
