#!/bin/bash

set -e

PROJECT="fairarena-tools"           # Doppler project slug
CONFIG="prd"   # doppler config: dev/stg/prod etc.
ENV_FILE=".env"               # target env file
DOPPLER_TOKEN_FILE=".doppler_token"

# Load Doppler token from file
if [ ! -f "$DOPPLER_TOKEN_FILE" ]; then
  echo "Error: Doppler token file '$DOPPLER_TOKEN_FILE' not found"
  echo "Create it and put your Doppler service token inside:"
  echo "  echo \"dp.st.your_token_here\" > $DOPPLER_TOKEN_FILE"
  exit 1
fi

DOPPLER_TOKEN=$(cat "$DOPPLER_TOKEN_FILE" | tr -d '[:space:]')

if [ -z "$DOPPLER_TOKEN" ]; then
  echo "Error: Doppler token in $DOPPLER_TOKEN_FILE is empty"
  exit 1
fi

echo "Fetching Doppler secrets for project=$PROJECT config=$CONFIG -> $ENV_FILE"

doppler secrets download \
  --project "$PROJECT" \
  --config "$CONFIG" \
  --token "$DOPPLER_TOKEN" \
  --format env \
  --no-file > "$ENV_FILE"

echo "Secrets written to $ENV_FILE"

# Also copy the generated env file to the repository root so other tools/scripts
# can read a top-level .env. Back up any existing root .env to avoid accidental
# loss.
ROOT_ENV="../$ENV_FILE"
if [ -f "$ROOT_ENV" ]; then
  BACKUP="${ROOT_ENV}.bak.$(date +%s)"
  echo "Root .env exists — creating backup at $BACKUP"
  cp "$ROOT_ENV" "$BACKUP"
fi

cp "$ENV_FILE" "$ROOT_ENV"
echo "Also copied env to repository root: $ROOT_ENV"