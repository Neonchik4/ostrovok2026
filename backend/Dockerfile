FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/home/app/.cache/huggingface

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY requirements.txt ./
# CPU-only PyTorch avoids shipping the CUDA runtime on a CPU VPS.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home app \
    && mkdir -p /app/outputs /home/app/.cache/huggingface \
    && chown -R app:app /app /home/app/.cache

COPY --chown=app:app app ./app
USER app
EXPOSE 8000

# Only trusted containers share this network; no backend host port is published.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*", "--timeout-graceful-shutdown", "25"]
