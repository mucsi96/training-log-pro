#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping dev pod..."
podman kube down "$PROJECT_DIR/server/dev-pod.yaml" 2>/dev/null || true

echo "Dev pod stopped."
