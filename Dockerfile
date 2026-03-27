# Use a lightweight Python base image
FROM python:3.13-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OUROBOROS_DRIVE_ROOT=/drive \
    OUROBOROS_REPO_DIR=/app \
    UV_PROJECT_ENVIRONMENT=/venv \
    UV_CACHE_DIR=/tmp/.uv-cache

WORKDIR /app

# Enable BuildKit mount caching for apt and uv
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    git curl gosu sudo wget gnupg && \
    # Install GitHub CLI
    mkdir -p -m 755 /etc/apt/keyrings && \
    wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install gh -y

# Install uv for fast package management
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="/usr/local/bin" sh

# Cache dependencies by copying only lockfiles first
COPY ouroboros/pyproject.toml ouroboros/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

# Copy the rest of the application (Agent's Body)
COPY ouroboros/ .

# Sync again to install the project itself (fast since deps are cached)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

# Add the entrypoint script (from Runtime's World)
COPY ouroboros_runtime/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# The entrypoint launches the seed agent
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["uv", "run", "python", "seed_agent.py"]
