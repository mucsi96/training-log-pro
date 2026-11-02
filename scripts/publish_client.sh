#!/bin/bash
set -euo pipefail
: "${AZURE_KEYVAULT_NAME:?Set the application vault name}"
config=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name client-storage-config --query value -o tsv)
account=$(jq -er '.account_name | select(test("^[a-z0-9]{3,24}$"))' <<< "$config")
assets_url=$(jq -er '.assets_base_url | select(test("^https://[a-z0-9]+\\.blob\\.core\\.windows\\.net/assets/$"))' <<< "$config")
hostname=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name hostname --query value -o tsv)
asset_prefix="releases/${GITHUB_RUN_ID:?Set the workflow run ID}-${GITHUB_RUN_ATTEMPT:?Set the workflow run attempt}"
node scripts/prepare-client.mjs client-static client-publish "${assets_url}${asset_prefix}/" "https://$hostname"
# Retain old releases so already-open clients keep working.
az storage blob upload-batch --auth-mode login --account-name "$account" \
  --destination assets --destination-path "$asset_prefix" --source client-publish/assets --overwrite true \
  --content-cache-control 'public, max-age=31536000, immutable' --only-show-errors --output none
az storage blob upload --auth-mode login --account-name "$account" \
  --container-name assets --name "$asset_prefix/manifest.webmanifest" --file client-publish/assets/manifest.webmanifest \
  --overwrite true --content-type application/manifest+json --content-cache-control 'public, max-age=31536000, immutable' \
  --only-show-errors --output none
# Commit the document only after every asset upload has succeeded.
az storage blob upload --auth-mode login --account-name "$account" \
  --container-name '$web' --name index.html --file client-publish/documents/index.html \
  --overwrite true --content-type text/html --content-cache-control no-store \
  --only-show-errors --output none
