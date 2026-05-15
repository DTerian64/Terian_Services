# syntax=docker/dockerfile:1.7

# ── Build-time settings ─────────────────────────────────────────────────────
ARG PYTHON_VERSION=3.12

# ── Runtime image ───────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim

# Don't write .pyc files; flush stdout/stderr immediately (better ACA logs)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create an unprivileged user — ACA runs containers as root by default, but
# we don't need to and shouldn't.
RUN groupadd --system app && useradd --system --gid app --home /app app

WORKDIR /app

# Install Python deps first so they cache independently of source changes
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the application source.  .dockerignore keeps .env, venv, etc. out.
COPY . .

# Drop privileges
RUN chown -R app:app /app
USER app

EXPOSE 8000

# Use uvicorn directly — single worker is fine for ACA (the platform handles
# horizontal scale via replicas).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
