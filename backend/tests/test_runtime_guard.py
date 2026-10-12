import pytest
from app.services.runtime_guard import (
    EnvironmentMismatchError,
    assert_safe_runtime,
    find_runtime_violations,
    is_containerized,
)


def test_development_profile_is_allowed_on_a_host():
    assert find_runtime_violations("development", containerized=False) == []
    assert_safe_runtime("development", containerized=False)


def test_production_profile_is_allowed_in_a_container():
    assert find_runtime_violations("production", containerized=True) == []
    assert_safe_runtime("production", containerized=True)


def test_production_profile_is_allowed_on_a_host_too():
    assert find_runtime_violations("production", containerized=False) == []


def test_development_profile_is_rejected_in_a_container():
    violations = find_runtime_violations("development", containerized=True)
    assert len(violations) == 1
    assert "APP_ENV=production" in violations[0]
    with pytest.raises(EnvironmentMismatchError):
        assert_safe_runtime("development", containerized=True)


def test_app_env_is_case_insensitive_and_trimmed():
    assert find_runtime_violations("  Production ", containerized=True) == []


def test_unknown_profiles_are_rejected_everywhere():
    for containerized in (False, True):
        violations = find_runtime_violations("staging", containerized=containerized)
        assert len(violations) == 1
        assert "APP_ENV='staging'" in violations[0]
        with pytest.raises(EnvironmentMismatchError):
            assert_safe_runtime("staging", containerized=containerized)


def test_empty_profile_is_rejected():
    assert find_runtime_violations("", containerized=False)
    assert find_runtime_violations(None, containerized=False)


def test_container_detection_uses_the_docker_marker():
    assert isinstance(is_containerized(), bool)
