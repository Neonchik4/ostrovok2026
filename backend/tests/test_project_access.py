import os
import sys

import pytest

_repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_repo_root, "scripts"))

from sync_project_access import (  # noqa: E402
    desired_roles,
    repository_permission,
    select_collaborators,
)


def _user(login, node_id, **permissions):
    return {"login": login, "node_id": node_id, "permissions": permissions}


def test_repository_permission_reads_the_permissions_object():
    assert repository_permission(_user("a", "U1", admin=True)) == 5
    assert repository_permission(_user("b", "U2", push=True, pull=True)) == 3
    assert repository_permission(_user("c", "U3", pull=True)) == 1
    assert repository_permission(_user("d", "U4")) == 0


def test_repository_permission_falls_back_to_role_name():
    assert repository_permission({"login": "a", "node_id": "U1", "role_name": "write"}) == 3
    assert repository_permission({"login": "b", "node_id": "U2", "role_name": "read"}) == 1


def test_selection_excludes_the_project_owner_by_default():
    people = [_user("owner", "U1", admin=True), _user("dev", "U2", push=True)]
    selected = select_collaborators(people, {}, owner="owner")
    assert [p["login"] for p in selected] == ["dev"]


def test_selection_can_include_the_project_owner():
    people = [_user("owner", "U1", admin=True)]
    selected = select_collaborators(people, {"include_project_owner": True}, owner="owner")
    assert [p["login"] for p in selected] == ["owner"]


def test_selection_drops_bots_and_explicit_excludes():
    people = [
        _user("dependabot[bot]", "U1", push=True),
        _user("real", "U2", push=True),
        _user("ignored", "U3", push=True),
    ]
    selected = select_collaborators(people, {"exclude": ["Ignored"]})
    assert [p["login"] for p in selected] == ["real"]


def test_selection_respects_the_minimum_permission():
    people = [_user("reader", "U1", pull=True), _user("pusher", "U2", push=True)]
    selected = select_collaborators(people, {"min_permission": "write"})
    assert [p["login"] for p in selected] == ["pusher"]


def test_selection_is_sorted_case_insensitively():
    people = [_user("Zed", "U1", push=True), _user("alpha", "U2", push=True)]
    selected = select_collaborators(people, {})
    assert [p["login"] for p in selected] == ["alpha", "Zed"]


def test_desired_roles_applies_default_and_overrides():
    people = [_user("dev", "U1", push=True), _user("lead", "U2", push=True)]
    roles = desired_roles(people, {"default": "reader", "overrides": {"lead": "writer"}})
    assert roles == [("dev", "U1", "READER"), ("lead", "U2", "WRITER")]


def test_desired_roles_rejects_unknown_roles():
    people = [_user("dev", "U1", push=True)]
    with pytest.raises(ValueError):
        desired_roles(people, {"default": "superuser"})
    with pytest.raises(ValueError):
        desired_roles(people, {"default": "READER", "overrides": {"dev": "banana"}})


def test_committed_config_is_valid():
    import json
    from pathlib import Path

    config = json.loads((Path(_repo_root) / ".github" / "project-access.json").read_text(encoding="utf-8"))
    assert config["project"]["owner"]
    assert isinstance(config["project"]["number"], int)
    assert config["role"]["default"] in {"READER", "WRITER", "ADMIN"}
