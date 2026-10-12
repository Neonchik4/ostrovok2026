#!/usr/bin/env python3
"""Grant every repository collaborator access to a GitHub Projects v2 board.

The list of people is never hardcoded: it is discovered from
``GET /repos/{owner}/{repo}/collaborators`` and filtered by the rules in
``.github/project-access.json``. The desired set is sent to GitHub in a single
``updateProjectV2Collaborators`` call, because the API replaces the whole
collaborator set and only the mutation response can be read back.

Usage:
    python scripts/sync_project_access.py --dry-run
    python scripts/sync_project_access.py
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / ".github" / "project-access.json"

PROJECT_ROLES = ("READER", "WRITER", "ADMIN", "NONE")

# Maps the two shapes the REST API returns: role_name on some endpoints,
# a permissions object on others.
PERMISSION_RANK = {"read": 1, "triage": 2, "write": 3, "maintain": 4, "admin": 5}
PERMISSION_FLAGS = (("admin", 5), ("maintain", 4), ("push", 3), ("triage", 2), ("pull", 1))


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8")


def run_checked(args: list[str]) -> str:
    result = run(args)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"gh {' '.join(args)} failed")
    return result.stdout


def graphql(query: str, **variables: object) -> dict:
    args = ["api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        flag = "-F" if isinstance(value, int) else "-f"
        args += [flag, f"{key}={value}"]
    result = run(args)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout)


def repository_permission(collaborator: dict) -> int:
    permissions = collaborator.get("permissions") or {}
    for flag, rank in PERMISSION_FLAGS:
        if permissions.get(flag):
            return rank
    return PERMISSION_RANK.get(collaborator.get("role_name", ""), 0)


def select_collaborators(collaborators: list[dict], rules: dict, owner: str | None = None) -> list[dict]:
    """Apply the configured filters. Returns them sorted by login."""
    exclude = {login.lower() for login in rules.get("exclude", [])}
    if owner and not rules.get("include_project_owner", False):
        # The project owner already has full access; granting a lower role could
        # downgrade them, so they are skipped unless explicitly requested.
        exclude.add(owner.lower())
    minimum = PERMISSION_RANK.get(rules.get("min_permission", "read"), 1)
    selected = []
    for collaborator in collaborators:
        login = collaborator["login"]
        if rules.get("exclude_bots", True) and login.endswith("[bot]"):
            continue
        if login.lower() in exclude:
            continue
        if repository_permission(collaborator) < minimum:
            continue
        selected.append(collaborator)
    return sorted(selected, key=lambda c: c["login"].lower())


def desired_roles(collaborators: list[dict], role_rules: dict) -> list[tuple[str, str, str]]:
    """Return (login, node_id, role) triples using default plus overrides."""
    default = str(role_rules.get("default", "READER")).upper()
    overrides = {k.lower(): str(v).upper() for k, v in (role_rules.get("overrides") or {}).items()}
    if default not in PROJECT_ROLES:
        raise ValueError(f"Unknown role {default!r}; expected one of {PROJECT_ROLES}")
    result = []
    for collaborator in collaborators:
        login = collaborator["login"]
        role = overrides.get(login.lower(), default)
        if role not in PROJECT_ROLES:
            raise ValueError(f"Unknown role {role!r} for {login}; expected one of {PROJECT_ROLES}")
        result.append((login, collaborator["node_id"], role))
    return result


def resolve_project_id(owner: str, number: int) -> str:
    for owner_type in ("user", "organization"):
        data = graphql(
            f"query($login: String!, $number: Int!) {{ {owner_type}(login: $login) "
            "{ projectV2(number: $number) { id } } }",
            login=owner,
            number=number,
        )
        project = (data.get("data") or {}).get(owner_type)
        if project and project.get("projectV2"):
            return project["projectV2"]["id"]
    raise RuntimeError(f"Project #{number} not found for {owner}")


def apply_access(project_id: str, entries: list[tuple[str, str, str]]) -> list[dict]:
    payload = ", ".join(
        f'{{ userId: "{node_id}", role: {role} }}' for _login, node_id, role in entries
    )
    data = graphql(
        "mutation { updateProjectV2Collaborators(input: { "
        f'projectId: "{project_id}", collaborators: [{payload}] '
        "}) { collaborators(first: 50) { totalCount nodes { ... on User { login } "
        "... on Team { name } } } } }"
    )
    return data["data"]["updateProjectV2Collaborators"]["collaborators"]["nodes"]


def fetch_collaborators(repository: str, affiliation: str) -> list[dict]:
    raw = run_checked(["api", f"repos/{repository}/collaborators?affiliation={affiliation}&per_page=100"])
    return json.loads(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to the JSON config.")
    parser.add_argument("--dry-run", action="store_true", help="Print the plan without writing.")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    project = config["project"]
    source = config["source"]

    collaborators = fetch_collaborators(source["repository"], source.get("affiliation", "all"))
    selected = select_collaborators(collaborators, source, owner=project["owner"])
    entries = desired_roles(selected, config.get("role", {}))

    print(f"Repository collaborators: {len(collaborators)}")
    print(f"Selected for the project: {len(entries)}")
    for login, _node, role in entries:
        print(f"  {login:<32} {role}")

    if not entries:
        print("Nothing to grant.")
        return 0
    if args.dry_run:
        print("\nDry run: no changes written.")
        return 0

    project_id = resolve_project_id(project["owner"], project["number"])
    applied = apply_access(project_id, entries)
    names = [node.get("login") or node.get("name") for node in applied]
    print(f"\nApplied. Project collaborators now: {len(names)} -> {', '.join(filter(None, names))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
