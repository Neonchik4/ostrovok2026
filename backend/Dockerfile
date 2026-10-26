FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.5 /uv /uvx /usr/local/bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH" \
    HF_HOME=/home/app/.cache/huggingface

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
# The lock selects CPU-only PyTorch on Linux and excludes development tools.
RUN uv sync --locked --no-dev --no-cache \
    && rm -rf /app/.venv/lib/python3.11/site-packages/torch/test \
    && rm -rf /app/.venv/lib/python3.11/site-packages/torch/include \
    && find /app/.venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home app \
    && mkdir -p /app/outputs /home/app/.cache/huggingface \
    && chown -R app:app /app /home/app/.cache

WORKDIR /app/backend
COPY --chown=app:app backend/app ./app
USER app
EXPOSE 8000

# Only trusted containers share this network; no backend host port is published.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*", "--timeout-graceful-shutdown", "25"]
