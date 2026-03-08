Param()
Set-StrictMode -Version Latest
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Output "Building FairArena sandbox images (PowerShell)..."
docker build -t fairarena/ubuntu:22.04 (Join-Path $here 'ubuntu')
docker build -t fairarena/debian:bookworm-slim (Join-Path $here 'debian')
docker build -t fairarena/alpine:3.19 (Join-Path $here 'alpine')
Write-Output "Built fairarena/ubuntu:22.04, fairarena/debian:bookworm-slim, fairarena/alpine:3.19"
