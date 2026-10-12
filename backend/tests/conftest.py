"""Shared test configuration.

The production catalogue lives in a private Yandex Object Storage bucket; a fresh
CI checkout gets HTTP 403 from it and would otherwise run every search test against
an empty dataset. Point the application at the committed fixture catalogue instead,
so filtering, relaxation and multi-turn tests keep exercising real hotel records.

A local `outputs/hotels.json` still wins on a developer machine, because the vector
store probes it before this override.
"""

import os
from pathlib import Path

FIXTURE_DATASET = Path(__file__).resolve().parent / "fixtures" / "hotels.json"

if FIXTURE_DATASET.exists() and not os.getenv("DATASET_PATH"):
    os.environ["DATASET_PATH"] = str(FIXTURE_DATASET)
