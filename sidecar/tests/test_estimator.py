import json

from mlxstudio.services import estimator


def test_weight_bytes_by_quantization():
    assert estimator.weight_bytes(7.0, "4bit") == int(7.0 * 1e9 * 0.5)
    assert estimator.weight_bytes(7.0, "8bit") == int(7.0 * 1e9 * 1.0)
    assert estimator.weight_bytes(7.0, "bf16") == int(7.0 * 1e9 * 2.0)


def test_weight_bytes_defaults_to_bf16_for_unknown_quant():
    assert estimator.weight_bytes(1.0, None) == int(1e9 * 2.0)
    assert estimator.weight_bytes(1.0, "weird") == int(1e9 * 2.0)


def test_weight_bytes_none_params():
    assert estimator.weight_bytes(None, "4bit") is None


def test_kv_cache_bytes_from_config():
    config = {
        "num_hidden_layers": 32,
        "hidden_size": 4096,
        "num_attention_heads": 32,
        "num_key_value_heads": 8,
    }
    # 2 (K+V) * layers * ctx * kv_heads * head_dim * 2 bytes
    expected = 2 * 32 * 4096 * 8 * (4096 // 32) * 2
    assert estimator.kv_cache_bytes(config, 4096) == expected


def test_kv_cache_grows_with_context():
    config = {"num_hidden_layers": 16, "hidden_size": 2048, "num_attention_heads": 16}
    assert estimator.kv_cache_bytes(config, 8192) == 2 * estimator.kv_cache_bytes(config, 4096)


def test_estimate_ram_includes_overhead():
    est = estimator.estimate_ram(7.0, "4bit", None, 4096)
    weights = estimator.weight_bytes(7.0, "4bit")
    assert est is not None and weights is not None
    assert est == weights + int(0.1 * weights) + int(0.15 * weights)


def test_estimate_ram_none_without_params():
    assert estimator.estimate_ram(None, "4bit", None, 4096) is None


def test_read_config_missing_path():
    assert estimator.read_config(None) is None
    assert estimator.read_config("/nonexistent/path") is None


def test_read_config_flattens_text_config(tmp_path):
    (tmp_path / "config.json").write_text(
        json.dumps(
            {
                "model_type": "qwen3_5_moe",
                "text_config": {"num_hidden_layers": 40, "max_position_embeddings": 262144},
            }
        )
    )
    cfg = estimator.read_config(str(tmp_path))
    assert cfg is not None
    assert cfg["num_hidden_layers"] == 40
    assert cfg["max_position_embeddings"] == 262144


def test_local_weight_bytes_sums_safetensors(tmp_path):
    (tmp_path / "model-00001.safetensors").write_bytes(b"x" * 1000)
    (tmp_path / "model-00002.safetensors").write_bytes(b"x" * 500)
    (tmp_path / "config.json").write_bytes(b"{}")  # not counted
    assert estimator.local_weight_bytes(str(tmp_path)) == 1500
    assert estimator.local_weight_bytes(None) is None
    assert estimator.local_weight_bytes("/nonexistent") is None


def test_installed_breakdown_prefers_disk_weights(tmp_path):
    (tmp_path / "model.safetensors").write_bytes(b"x" * 10_000)
    (tmp_path / "config.json").write_text(
        json.dumps(
            {
                "num_hidden_layers": 2,
                "hidden_size": 64,
                "num_attention_heads": 4,
                "num_key_value_heads": 2,
            }
        )
    )
    b = estimator.installed_breakdown(str(tmp_path), params_b=7.0, quant="4bit", ctx=1024)
    assert b is not None
    assert b["weight_bytes"] == 10_000  # disk size, not 7.0 * 1e9 * 0.5
    assert b["kv_cache_bytes"] == 2 * 2 * 1024 * 2 * (64 // 4) * 2
    assert b["est_ram_bytes"] == b["weight_bytes"] + b["kv_cache_bytes"] + b["overhead_bytes"]


def test_installed_breakdown_falls_back_to_heuristic(tmp_path):
    b = estimator.installed_breakdown(str(tmp_path), params_b=1.0, quant="4bit", ctx=1024)
    assert b is not None
    assert b["weight_bytes"] == int(1e9 * 0.5)
