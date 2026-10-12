"""Fail-fast checks that keep a development profile off production hosts.

Production always runs inside the Docker stack, where APP_ENV must be
``production``. If the container is started with the Doppler ``dev`` config,
the backend refuses to boot instead of serving real traffic with dev settings.
"""

from __future__ import annotations

from pathlib import Path

APP_ENVS = ("development", "production")

DOCKER_MARKER = Path("/.dockerenv")


class EnvironmentMismatchError(RuntimeError):
    """Raised when APP_ENV contradicts the actual runtime."""


def is_containerized() -> bool:
    """True when the process runs inside a container (production layout only)."""
    return DOCKER_MARKER.exists()


def find_runtime_violations(app_env: str, containerized: bool) -> list[str]:
    normalized = (app_env or "").strip().lower()
    violations: list[str] = []
    if normalized not in APP_ENVS:
        violations.append(f"APP_ENV={app_env!r} must be one of {APP_ENVS}.")
        return violations
    if containerized and normalized != "production":
        violations.append(
            "Containers must run with APP_ENV=production; "
            "the development profile is host-only."
        )
    return violations


def assert_safe_runtime(app_env: str, containerized: bool) -> None:
    violations = find_runtime_violations(app_env, containerized)
    if violations:
        raise EnvironmentMismatchError(" ".join(violations))
