#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

echo "Building FairArena sandbox images..."
docker build -t fairarena/ubuntu:22.04 "$HERE/ubuntu"
docker build -t fairarena/debian:bookworm-slim "$HERE/debian"
docker build -t fairarena/alpine:3.19 "$HERE/alpine"

echo "Done. Built: fairarena/ubuntu:22.04, fairarena/debian:bookworm-slim, fairarena/alpine:3.19"
