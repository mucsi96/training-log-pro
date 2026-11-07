#!/bin/sh

set -e  # Exit immediately if a command exits with a non-zero status

# Detect if running on Ubuntu
if [ "$(uname -s)" = "Linux" ] && [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" = "ubuntu" ]; then
        echo "Running on Ubuntu. Checking dependencies..."

        # Check and install azure-cli
        if ! command -v az >/dev/null 2>&1; then
            echo "Installing Azure CLI..."
            curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
        else
            echo "Azure CLI is already installed."
        fi

        # Check and install helm
        if ! command -v helm >/dev/null 2>&1; then
            echo "Installing Helm..."
            sudo snap install helm --classic
        else
            echo "Helm is already installed."
        fi

        # Check and install kubectl
        if ! command -v kubectl >/dev/null 2>&1; then
            echo "Installing kubectl..."
            sudo snap install kubectl --classic
        else
            echo "kubectl is already installed."
        fi

        # Check and install jq
        if ! command -v jq >/dev/null 2>&1; then
            echo "Installing jq..."
            sudo apt-get install -y jq
        else
            echo "jq is already installed."
        fi

        # Check and install podman
        if ! command -v podman >/dev/null 2>&1; then
            echo "Installing Podman..."
            sudo apt-get install -y podman
        else
            echo "Podman is already installed."
        fi

        # Enable lingering and Podman socket for rootless Podman
        loginctl enable-linger "$(whoami)" 2>/dev/null || true
        systemctl --user enable --now podman.socket

        sudo apt-get install -y build-essential pkg-config cmake

    fi
fi

echo "Building server..."
if ! command -v rustup >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
    . "$HOME/.cargo/env"
fi
cd server && cargo build --locked && cd ..

echo "Installing client dependencies..."
cd client && npm ci && cd ..

echo "Installing mock Strava server dependencies..."
cd mock_strava_server && npm install && cd ..

echo "Installing mock Withings server dependencies..."
cd mock_withings_server && npm install && cd ..

echo "Installing test dependencies..."
cd test && npm install && npx playwright install --with-deps chromium && cd ..
