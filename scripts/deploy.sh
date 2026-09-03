#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

: "${AZURE_KEYVAULT_NAME:?Environment variable AZURE_KEYVAULT_NAME is required}"
: "${DOCKERHUB_USERNAME:?Environment variable DOCKERHUB_USERNAME is required}"

AZURE_KEYVAULT_ENDPOINT="https://${AZURE_KEYVAULT_NAME}.vault.azure.net/"
SERVER_RELEASE_NAME=training-log-server
CLIENT_RELEASE_NAME=training-log-client

# Create a temporary file in /dev/shm (RAM) to avoid writing to disk
KUBECONFIG=$(mktemp /dev/shm/kubeconfig.XXXXXX)
export KUBECONFIG

# Ensure the temporary file is deleted when the script exits
trap 'rm -f "$KUBECONFIG"' EXIT

"$(dirname "$0")/pull_kubeconfig.sh"

HOSTNAME=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name hostname --query value -o tsv)
API_CLIENT_ID=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name api-client-id --query value -o tsv)

# Get latest tags for both server and client
serverLatestTag=$(curl -s "https://registry.hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/training-log-pro-server/tags" | jq -r '.results | map(select(.name != "latest")) | sort_by(.last_updated) | reverse | .[0].name')
clientLatestTag=$(curl -s "https://registry.hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/training-log-pro-client/tags" | jq -r '.results | map(select(.name != "latest")) | sort_by(.last_updated) | reverse | .[0].name')

echo "Updating Helm repositories..."
# The mucsi96 charts no longer bundle Prometheus exporter sidecars or
# ServiceMonitors (client-app >= 22.0.0, spring-app >= 30.0.0, node-app >= 20.0.0).
# This deploy rolls out the updated charts and drops those containers.
helm repo add mucsi96 https://mucsi96.github.io/k8s-helm-charts --force-update

springAppChartVersion=$(helm search repo mucsi96/spring-app --output json | jq -r '.[0].version')
clientAppChartVersion=$(helm search repo mucsi96/client-app --output json | jq -r '.[0].version')

echo "Deploying server: $DOCKERHUB_USERNAME/training-log-pro-server:$serverLatestTag using spring-app chart $springAppChartVersion"

# The server is a GraalVM native executable, so there is no JVM metaspace, no
# code cache and no JIT-compiled code to hold, and it idles below what the
# 512Mi request assumed for the JRE image. Not nearly as far below as the
# absence of a JVM suggests, though: idle resident size measured on the native
# executable is ~275MB, and only ~124MB of that is anonymous. The rest is the
# executable's own text and rodata paged in - the binary is ~240MB, and a
# native image has no separate class metadata because that is what those pages
# are. So the request has to clear the heap cap rather than sit under it: a
# request below the ceiling the image is allowed to reach is not a request for
# what the pod uses, which is the one thing it is for.
#
# 320Mi is that measurement plus margin. It was taken outside Kubernetes on a
# glibc build of the same source, so treat it as a floor and replace it with
# the resident figure metrics-server reports once this image has run in
# production for a while.
#
# The limit is the opposite question and stays where it is: it has to cover the
# idle footprint plus the 256Mi heap the image is capped at (see the ENTRYPOINT
# in server/Dockerfile - keep the two in step).

helm upgrade $SERVER_RELEASE_NAME mucsi96/spring-app \
    --install \
    --version $springAppChartVersion \
    --set image=$DOCKERHUB_USERNAME/training-log-pro-server:$serverLatestTag \
    --set entryPoint=web \
    --set host=$HOSTNAME \
    --set basePath=/api \
    --set clientId=$API_CLIENT_ID \
    --set serviceAccountName=training-log-api-workload-identity \
    --set env.AZURE_KEYVAULT_ENDPOINT=$AZURE_KEYVAULT_ENDPOINT \
    --set env.CLIENT_APP_NAME=$CLIENT_RELEASE_NAME \
    --set resources.requests.memory=128Mi \
    --set resources.requests.cpu=100m \
    --set resources.limits.memory=512Mi \
    --set resources.limits.cpu=500m \
    --wait \
    --timeout 10m

echo "Deploying client: $DOCKERHUB_USERNAME/training-log-pro-client:$clientLatestTag using client-app chart $clientAppChartVersion"

helm upgrade $CLIENT_RELEASE_NAME mucsi96/client-app \
    --install \
    --version $clientAppChartVersion \
    --set image=$DOCKERHUB_USERNAME/training-log-pro-client:$clientLatestTag \
    --set host=$HOSTNAME \
    --set entryPoint=web \
    --wait \
    --timeout 10m
