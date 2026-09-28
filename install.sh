#!/bin/sh
set -eu

version="${BAIBAI_VERSION:-latest}"
os=$(uname -s)
arch=$(uname -m)

case "$os" in
  Darwin) target_os=darwin ;;
  Linux) target_os=linux ;;
  *)
    echo "unsupported OS: $os" >&2
    exit 1
    ;;
esac

case "$arch" in
  arm64 | aarch64) target_arch=arm64 ;;
  x86_64 | amd64) target_arch=x64 ;;
  *)
    echo "unsupported architecture: $arch" >&2
    exit 1
    ;;
esac

asset="baibai-${target_os}-${target_arch}"
if [ "$version" = "latest" ]; then
  url="https://github.com/spire-labs/baibai-cli/releases/latest/download/${asset}"
else
  url="https://github.com/spire-labs/baibai-cli/releases/download/${version}/${asset}"
fi

dest="${HOME}/.local/bin"
mkdir -p "$dest"
tmp=$(mktemp)
curl -fsSL "$url" -o "$tmp"
chmod 755 "$tmp"
mv "$tmp" "${dest}/baibai"
echo "installed ${dest}/baibai"
