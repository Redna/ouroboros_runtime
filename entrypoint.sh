#!/bin/bash
set -e

USER_ID=${PUID:-1000}
GROUP_ID=${PGID:-1000}

# Create group and user if they do not exist
if ! getent group "$GROUP_ID" >/dev/null; then groupadd -g "$GROUP_ID" ouroboros; fi
if ! getent passwd "$USER_ID" >/dev/null; then useradd -u "$USER_ID" -g "$GROUP_ID" -m -s /bin/bash ouroboros; fi

USER_NAME=$(getent passwd "$USER_ID" | cut -d: -f1)

# Ensure the agent has write access to the workspace volume
chown -R "$USER_NAME":"$GROUP_ID" /app

# Basic Git Config for the user
sudo -u "$USER_NAME" -H git config --global user.name "Ouroboros"
sudo -u "$USER_NAME" -H git config --global user.email "ouroboros@agent.local"
sudo -u "$USER_NAME" -H git config --global --add safe.directory /app

# Ensure Git hooks are active
if [ -f "/runtime_scripts/setup_hooks.sh" ]; then
    cd /app && /bin/bash /runtime_scripts/setup_hooks.sh
fi

echo "Locking down semantic firewall and git hooks..."

# Transfer ownership of critical infrastructure to root
# The agent will run as PUID (e.g., 1000) and will have read/execute access, but ZERO write access.
chown -R root:root /runtime_scripts
chown -R root:root /app/.git/hooks

# Enforce strict permissions (755: Owner can rwx, others can only r-x)
chmod -R 755 /runtime_scripts
chmod -R 755 /app/.git/hooks

echo "Containment established."

echo "Awaking Ouroboros as $USER_NAME ($USER_ID:$GROUP_ID)..."
exec gosu "$USER_NAME" "$@"
