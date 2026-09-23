"""Catalog ordering is passed to the Hub and re-applied after merging queries."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import pytest

from mlxstudio.schemas import CatalogQuery
from mlxstudio.services import hf_catalog


@dataclass
class _HubModel:
    id: str
    downloads: int
    likes: int
    last_modified: datetime


class _FakeHub:
    def __init__(self, models: list[_HubModel]) -> None:
        self.models = models
        self.sorts: list[str] = []

    def list_models(self, *, sort: str, **_: object) -> list[_HubModel]:
        self.sorts.append(sort)
        return self.models


@pytest.fixture()
def hub(monkeypatch: pytest.MonkeyPatch) -> _FakeHub:
    fake = _FakeHub(
        [
            _HubModel("mlx-community/Old-Popular-7B-4bit", 900, 5, datetime(2024, 1, 1, tzinfo=timezone.utc)),
            _HubModel("mlx-community/New-Liked-3B-4bit", 10, 80, datetime(2026, 5, 1, tzinfo=timezone.utc)),
        ]
    )
    monkeypatch.setattr(hf_catalog, "_api", fake)
    monkeypatch.setattr("mlxstudio.services.settings_store.get_hf_token", lambda: None)
    return fake


@pytest.mark.parametrize(
    ("sort", "hub_sort", "first"),
    [
        ("downloads", "downloads", "mlx-community/Old-Popular-7B-4bit"),
        ("likes", "likes", "mlx-community/New-Liked-3B-4bit"),
        ("recent", "lastModified", "mlx-community/New-Liked-3B-4bit"),
    ],
)
def test_search_orders_by_requested_sort(hub: _FakeHub, sort: str, hub_sort: str, first: str) -> None:
    results = hf_catalog.search(CatalogQuery(sort=sort))

    assert hub.sorts == [hub_sort]
    assert results[0]["hf_repo_id"] == first


def test_search_reports_likes_and_last_modified(hub: _FakeHub) -> None:
    result = hf_catalog.search(CatalogQuery())[0]

    assert result["likes"] == 5
    assert result["last_modified"].startswith("2024-01-01")
