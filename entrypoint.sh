#!/bin/bash
set -e

USER_ID=${PUID:-1000}
GROUP_ID=${PGID:-1000}

# Create group and user if they do not exist
if ! getent group "$GROUP_ID" >/dev/null; then groupadd -g "$GROUP_ID" ouroboros; fi
if ! getent passwd "$USER_ID" >/dev/null; then useradd -u "$USER_ID" -g "$GROUP_ID" -m -s /bin/bash ouroboros; fi

USER_NAME=$(getent passwd "$USER_ID" | cut -d: -f1)

# Basic Git Config for the user
sudo -u "$USER_NAME" -H git config --global user.name "Ouroboros"
sudo -u "$USER_NAME" -H git config --global user.email "ouroboros@agent.local"
sudo -u "$USER_NAME" -H git config --global --add safe.directory /app

# Ensure Git hooks are active
if [ -f "/app/scripts/setup_hooks.sh" ]; then
    cd /app && sudo -u "$USER_NAME" -H bash scripts/setup_hooks.sh > /dev/null 2>&1
fi

echo "Awaking Ouroboros as $USER_NAME ($USER_ID:$GROUP_ID)..."
exec gosu "$USER_NAME" "$@"
