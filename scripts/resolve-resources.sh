#!/usr/bin/env bash
# Finds (or creates) the D1 database and KV namespace in the account the API
# token belongs to, and writes their IDs into wrangler.jsonc before deploy.
# This keeps IDs out of the repo, so the deploy never points at another account.
set -euo pipefail
api() { curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' "$@"; }
CF=https://api.cloudflare.com/client/v4

ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-}"
if [ -z "$ACCOUNT" ]; then
  ACCOUNTS=$(api "$CF/accounts?per_page=50")
  COUNT=$(echo "$ACCOUNTS" | jq '.result | length')
  if [ "$COUNT" != "1" ]; then
    echo "Token sees $COUNT accounts; set the CLOUDFLARE_ACCOUNT_ID secret." >&2
    exit 1
  fi
  ACCOUNT=$(echo "$ACCOUNTS" | jq -r '.result[0].id')
fi

DB_ID=$(api "$CF/accounts/$ACCOUNT/d1/database?name=pm" | jq -r '.result[] | select(.name=="pm") | .uuid' | head -1)
if [ -z "$DB_ID" ]; then
  echo "Creating D1 database pm"
  DB_ID=$(api -X POST "$CF/accounts/$ACCOUNT/d1/database" -d '{"name":"pm"}' | jq -r '.result.uuid')
fi

KV_ID=$(api "$CF/accounts/$ACCOUNT/storage/kv/namespaces?per_page=100" | jq -r '.result[] | select(.title=="pm-oauth") | .id' | head -1)
if [ -z "$KV_ID" ]; then
  echo "Creating KV namespace pm-oauth"
  KV_ID=$(api -X POST "$CF/accounts/$ACCOUNT/storage/kv/namespaces" -d '{"title":"pm-oauth"}' | jq -r '.result.id')
fi

for v in "$DB_ID" "$KV_ID"; do
  if [ -z "$v" ] || [ "$v" = "null" ]; then echo "Could not resolve resources" >&2; exit 1; fi
done

sed -i "s/\"database_id\": \"[^\"]*\"/\"database_id\": \"$DB_ID\"/; s/\"OAUTH_KV\", \"id\": \"[^\"]*\"/\"OAUTH_KV\", \"id\": \"$KV_ID\"/" wrangler.jsonc
grep -q "$DB_ID" wrangler.jsonc && grep -q "$KV_ID" wrangler.jsonc
echo "CLOUDFLARE_ACCOUNT_ID=$ACCOUNT" >> "${GITHUB_ENV:-/dev/null}"
echo "D1 $DB_ID, KV $KV_ID"
