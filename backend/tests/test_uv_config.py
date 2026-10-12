"""Toolchain contracts; application behavior stays covered by the service tests."""

import json
import os
from pathlib import Path
import shlex
import subprocess
import tomllib

from packaging.specifiers import SpecifierSet
import pytest

ROOT = Path(__file__).resolve().parents[2]
CPU_INDEX = "https://download.pytorch.org/whl/cpu"


def read_toml(path: str) -> dict:
    return tomllib.loads((ROOT / path).read_text(encoding="utf-8"))


def test_uv_project_matches_existing_python_runtime():
    config = read_toml("pyproject.toml")
    assert config["project"]["requires-python"] == ">=3.11,<3.12"
    assert config["tool"]["uv"]["package"] is False
    assert (ROOT / ".python-version").read_text().strip() == "3.11"
    assert "[build-system]" not in (ROOT / "pyproject.toml").read_text()


def test_python_test_dependencies_are_not_shipped_in_production():
    config = read_toml("pyproject.toml")
    runtime = config["project"]["dependencies"]
    assert "chromadb==1.5.9" in runtime
    assert "uvicorn[standard]>=0.30.0" in runtime
    assert "sentence-transformers>=3.0.0" in runtime
    assert not any(dependency.startswith("pytest") for dependency in runtime)
    assert config["dependency-groups"]["dev"] == [
        "pytest>=8.0.0", "pytest-asyncio>=0.23.0",
    ]
    assert not (ROOT / "backend/requirements.txt").exists()


def test_linux_torch_uses_an_explicit_cpu_only_index():
    uv = read_toml("pyproject.toml")["tool"]["uv"]
    assert uv["sources"]["torch"] == [
        {"index": "pytorch-cpu", "marker": "sys_platform == 'linux'"},
    ]
    index = next(index for index in uv["index"] if index["name"] == "pytorch-cpu")
    assert index["url"] == CPU_INDEX
    assert index["explicit"] is True


def test_lock_preserves_persistent_index_compatibility_without_cuda():
    lock = read_toml("uv.lock")
    supported = SpecifierSet(lock["requires-python"])
    assert all(version in supported for version in ["3.11.0", "3.11.16", "3.11.99"])
    assert all(version not in supported for version in ["3.10.16", "3.12.0", "3.14.0"])
    packages = lock["package"]
    chroma = [package for package in packages if package["name"] == "chromadb"]
    assert [package["version"] for package in chroma] == ["1.5.9"]
    assert any(
        package["name"] == "torch" and package["source"].get("registry") == CPU_INDEX
        for package in packages
    )
    assert not any(package["name"].startswith("nvidia-") for package in packages)
    assert not any(package["name"] == "triton" for package in packages)


@pytest.mark.parametrize("name,module", [
    ("dev", "uvicorn"), ("start", "uvicorn"), ("test", "pytest"), ("lint", "compileall"),
])
def test_backend_scripts_use_locked_root_environment(name, module):
    scripts = json.loads((ROOT / "backend/package.json").read_text())["scripts"]
    command = shlex.split(scripts[name])
    assert command[:7] == ["uv", "run", "--project", "..", "--locked", "python", "-m"]
    assert command[7] == module
    if module == "uvicorn":
        assert command[8] == "app.main:app"
        assert command[command.index("--host") + 1] == "127.0.0.1"
        assert command[command.index("--port") + 1] == "8000"
        assert ("--reload" in command) is (name == "dev")


def test_root_setup_installs_both_locked_toolchains():
    scripts = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]
    assert scripts["setup:back"] == "uv sync --locked"
    assert scripts["setup"] == "bun run setup:front && bun run setup:back"


def run_python(code: str) -> subprocess.CompletedProcess:
    environment = os.environ.copy()
    environment.pop("VIRTUAL_ENV", None)
    return subprocess.run(
        ["uv", "run", "--project", str(ROOT), "--locked", "--no-sync", "python", "-c", code],
        cwd=ROOT / "backend", env=environment, capture_output=True, text=True, timeout=20,
    )


def test_uv_uses_root_venv_without_manual_activation():
    result = run_python(
        "import json,sys; from pathlib import Path; "
        "print(json.dumps({'prefix': sys.prefix, 'cwd': str(Path.cwd()), "
        "'version': list(sys.version_info[:2])}))"
    )
    assert result.returncode == 0, result.stderr
    runtime = json.loads(result.stdout)
    assert Path(runtime["prefix"]).resolve() == (ROOT / ".venv").resolve()
    assert Path(runtime["cwd"]).resolve() == (ROOT / "backend").resolve()
    assert runtime["version"] == [3, 11]


def test_uv_does_not_hide_a_python_command_failure():
    assert run_python("raise SystemExit(7)").returncode == 7


def test_backend_image_installs_the_same_lock_without_dev_dependencies():
    dockerfile = (ROOT / "backend/Dockerfile").read_text()
    assert "COPY --from=ghcr.io/astral-sh/uv:0.12.5" in dockerfile
    assert "COPY pyproject.toml uv.lock .python-version ./" in dockerfile
    assert "uv sync --locked --no-dev" in dockerfile
    assert 'PATH="/app/.venv/bin:$PATH"' in dockerfile
    assert "WORKDIR /app/backend" in dockerfile
    assert "COPY --chown=app:app backend/app ./app" in dockerfile
    assert "pip install" not in dockerfile
    assert "USER app" in dockerfile


def test_ci_uses_uv_lock_instead_of_resolving_pip_requirements():
    workflow = (ROOT / ".github/workflows/ci.yml").read_text()
    assert "astral-sh/setup-uv@" in workflow
    assert "uv sync --project .. --locked" in workflow
    assert "uv run --project .. --locked python -m pytest tests -q" in workflow
    assert "requirements.txt" not in workflow
    assert "pip install" not in workflow
