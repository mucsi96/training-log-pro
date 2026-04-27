#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
POD_NAME="training-log-pro-dev"
DB_CONTAINER="training-log-pro-dev-db"
MAX_WAIT=60

if podman inspect --format='{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -q "true"; then
  echo "Dev pod is already running"
  exit 0
fi

echo "Cleaning up existing pod..."
podman kube down "$PROJECT_DIR/server/dev-pod.yaml" 2>/dev/null || true

echo "Starting dev pod..."
podman kube play "$PROJECT_DIR/server/dev-pod.yaml"

for container in "$DB_CONTAINER"; do
  echo "Waiting for $container to become healthy..."
  ELAPSED=0
  while true; do
    if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
      echo "Timeout waiting for $container to become healthy"
      exit 1
    fi
    STATUS=$(podman inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "missing")
    if [ "$STATUS" = "healthy" ]; then
      echo "  $container is healthy"
      break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done
done

echo "Dev pod is ready (database on port 5482)"
