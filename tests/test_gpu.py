"""GPU probing tests - all subprocess calls mocked (no real nvidia-smi)."""

from __future__ import annotations

import pytest

from unsloth_mcp import gpu

SMI_OUTPUT = "NVIDIA GeForce RTX 4090, 620.02, 24564, 12288, 12276, 50\n"


def test_gpu_info_parses(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        gpu, "shutil", type("S", (), {"which": staticmethod(lambda _: "nvidia-smi")})()
    )
    monkeypatch.setattr(
        gpu.subprocess, "run", lambda *a, **k: type("R", (), {"stdout": SMI_OUTPUT})()
    )
    info = gpu.gpu_info()
    assert info["available"] is True
    assert info["name"] == "NVIDIA GeForce RTX 4090"
    assert info["driver"] == "620.02"
    assert info["memory_total_mib"] == 24564
    assert info["memory_used_mib"] == 12288
    assert info["memory_free_mib"] == 12276
    assert info["utilization_pct"] == 50


def test_gpu_info_missing_smi(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(gpu, "shutil", type("S", (), {"which": staticmethod(lambda _: None)})())
    info = gpu.gpu_info()
    assert info["available"] is False
    assert "reason" in info


def test_vram_free_fraction(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        gpu, "shutil", type("S", (), {"which": staticmethod(lambda _: "nvidia-smi")})()
    )
    monkeypatch.setattr(
        gpu.subprocess, "run", lambda *a, **k: type("R", (), {"stdout": SMI_OUTPUT})()
    )
    frac = gpu.vram_free_fraction()
    assert 0.49 < frac < 0.51


def test_training_procs_parse(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        gpu.subprocess,
        "run",
        lambda *a, **k: type("R", (), {"stdout": "1234|python train_job.py C:\\x.json\n"})(),
    )
    procs = gpu.training_procs()
    assert len(procs) == 1
    assert procs[0]["pid"] == 1234
