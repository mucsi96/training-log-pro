#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping test database pod..."
podman kube down "$PROJECT_DIR/server/test-db-pod.yaml" 2>/dev/null || true

echo "Test database stopped."
