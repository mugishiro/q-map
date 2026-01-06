#!/usr/bin/env bash
set -euo pipefail

# Danger: Delete all topics (and their nodes) via API.
# Requirements:
# - env API_BASE: API base URL (e.g., https://xxxx.execute-api.ap-northeast-1.amazonaws.com/dev or http://localhost:3000)
# - jq installed

if ! command -v jq >/dev/null; then
  echo "jq is required (apt install jq, brew install jq, etc.)" >&2
  exit 1
fi

API_BASE="${API_BASE:-${VITE_API_BASE_URL:-/api}}"
content_header=(-H "content-type: application/json")

page_cursor=""
deleted=0

while :; do
  cursor_param=""
  [[ -n "$page_cursor" ]] && cursor_param="&cursor=${page_cursor}"
  resp="$(curl -sS "${API_BASE}/v1/topics?limit=50${cursor_param}")"
  next_cursor="$(echo "$resp" | jq -r '.nextCursor // empty')"
  topic_ids=($(echo "$resp" | jq -r '.items[]?.topicId // .items[]?.id // empty'))
  if [[ ${#topic_ids[@]} -eq 0 ]]; then
    break
  fi
  for tid in "${topic_ids[@]}"; do
    echo "Deleting topic ${tid} ..."
    curl -sS -X DELETE "${API_BASE}/v1/topics/${tid}" "${content_header[@]}" >/dev/null
    ((deleted++))
  done
  page_cursor="$next_cursor"
  [[ -z "$page_cursor" ]] && break
done

echo "Done. Deleted ${deleted} topics."
