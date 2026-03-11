# Use a lightweight Python base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OUROBOROS_DRIVE_ROOT=/drive \
    OUROBOROS_REPO_DIR=/app

WORKDIR /app

# Install git, GitHub CLI (gh), and basic utilities required for the agent to evolve
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl gosu sudo wget gnupg && \
    # Install GitHub CLI
    mkdir -p -m 755 /etc/apt/keyrings && \
    wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install gh -y && \
    rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="/usr/local/bin" sh

# Copy dependency files first for caching
COPY ouroboros_agent/pyproject.toml ./

# Install dependencies using uv system-wide
RUN uv pip install --system .

# Copy the rest of the application (Agent's Body)
COPY ouroboros_agent/ .

# Add the entrypoint script (from Runtime's World)
COPY ouroboros_runtime/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# The entrypoint launches the seed agent
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["python", "seed_agent.py"]
