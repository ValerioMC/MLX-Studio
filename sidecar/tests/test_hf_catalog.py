from mlxstudio.schemas import CatalogQuery
from mlxstudio.services import hf_catalog


def test_parse_repo_meta_instruct_model():
    meta = hf_catalog.parse_repo_meta("mlx-community/Qwen2.5-7B-Instruct-4bit")
    assert meta["params_b"] == 7.0
    assert meta["quantization"] == "4bit"
    assert meta["instruct"] is True
    assert meta["vision"] is False


def test_parse_repo_meta_fractional_params_and_vision():
    meta = hf_catalog.parse_repo_meta("mlx-community/Qwen2-VL-1.5B-Instruct-8bit")
    assert meta["params_b"] == 1.5
    assert meta["quantization"] == "8bit"
    assert meta["vision"] is True


def test_parse_repo_meta_unknown():
    meta = hf_catalog.parse_repo_meta("mlx-community/some-model")
    assert meta["params_b"] is None
    assert meta["quantization"] is None


def test_is_chat_model_rejects_non_llm_repos():
    for repo in [
        "mlx-community/parakeet-tdt-0.6b-v3",
        "mlx-community/whisper-large-v3-mlx",
        "mlx-community/bge-small-en-v1.5-4bit",
        "mlx-community/stable-diffusion-2-1",
        "mlx-community/Kokoro-82M-4bit",
    ]:
        assert hf_catalog.is_chat_model(repo) is False, repo


def test_is_chat_model_accepts_llms():
    for repo in [
        "mlx-community/Qwen2.5-7B-Instruct-4bit",
        "mlx-community/Llama-3.2-3B-Instruct-4bit",
        "mlx-community/Qwen3.6-35B-A3B-4bit",
    ]:
        assert hf_catalog.is_chat_model(repo) is True, repo


def test_matches_filters():
    row = {"params_b": 7.0, "quantization": "4bit", "vision": False, "instruct": True}
    assert hf_catalog._matches(row, CatalogQuery(params_min=3, params_max=8)) is True
    assert hf_catalog._matches(row, CatalogQuery(params_min=8)) is False
    assert hf_catalog._matches(row, CatalogQuery(quant="8bit")) is False
    assert hf_catalog._matches(row, CatalogQuery(vision=True)) is False
    assert hf_catalog._matches(row, CatalogQuery(instruct=True)) is True
