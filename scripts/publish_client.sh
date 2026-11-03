#!/bin/bash
set -euo pipefail
: "${AZURE_KEYVAULT_NAME:?Set the application vault name}"
config=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name client-storage-config --query value -o tsv)
account=$(jq -er '.account_name | select(test("^[a-z0-9]{3,24}$"))' <<< "$config")
assets_url=$(jq -er '.assets_base_url | select(test("^https://[a-z0-9]+\\.blob\\.core\\.windows\\.net/assets/$"))' <<< "$config")
hostname=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name hostname --query value -o tsv)
node scripts/prepare-client.mjs client-static client-publish "$assets_url" "https://$hostname"
# Replace the whole static site; downtime during publication is intentional.
az storage blob delete-batch --auth-mode login --account-name "$account" \
  --source '$web' --only-show-errors --output none
az storage blob delete-batch --auth-mode login --account-name "$account" \
  --source assets --only-show-errors --output none
az storage blob upload-batch --auth-mode login --account-name "$account" \
  --destination assets --source client-publish/assets --overwrite true \
  --content-cache-control 'public, max-age=31536000, immutable' --only-show-errors --output none
az storage blob upload --auth-mode login --account-name "$account" \
  --container-name assets --name manifest.webmanifest --file client-publish/assets/manifest.webmanifest \
  --overwrite true --content-type application/manifest+json --content-cache-control 'public, max-age=31536000, immutable' \
  --only-show-errors --output none
# Commit the document only after every asset upload has succeeded.
az storage blob upload --auth-mode login --account-name "$account" \
  --container-name '$web' --name index.html --file client-publish/documents/index.html \
  --overwrite true --content-type text/html --content-cache-control no-store \
  --only-show-errors --output none
