#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-24radiology.ru}"
SOURCE_URL="https://24radiology.ru/"

mkdir -p "$TARGET_DIR"

mirror_site() {
  local extra_flags=("$@")
  wget \
    --mirror \
    --convert-links \
    --adjust-extension \
    --page-requisites \
    --no-parent \
    --no-host-directories \
    --directory-prefix="$TARGET_DIR" \
    "${extra_flags[@]}" \
    "$SOURCE_URL"
}

if ! mirror_site; then
  echo "Primary download attempt failed, retrying without proxy..." >&2
  mirror_site --no-proxy
fi

echo "Site mirror downloaded to: $TARGET_DIR"
