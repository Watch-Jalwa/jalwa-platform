#!/usr/bin/env bash
set -Eeuo pipefail

version="${TRIVY_VERSION:-0.70.0}"
checksums_sha256="${TRIVY_CHECKSUMS_SHA256:-c45281240bb9211ea9e830fc0bf5cf8acf7c0ca830feb64ac8a0aa932c5c92d9}"
install_dir="${TRIVY_INSTALL_DIR:-$HOME/.local/bin}"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT

case "$(uname -m)" in
  x86_64|amd64) archive="trivy_${version}_Linux-64bit.tar.gz" ;;
  aarch64|arm64) archive="trivy_${version}_Linux-ARM64.tar.gz" ;;
  *) echo "Unsupported architecture for Trivy: $(uname -m)" >&2; exit 1 ;;
esac

base_url="https://github.com/aquasecurity/trivy/releases/download/v${version}"
checksums="trivy_${version}_checksums.txt"

curl --fail --location --retry 4 --retry-all-errors --proto '=https' --tlsv1.2 \
  --output "$temporary_directory/$checksums" "$base_url/$checksums"
printf '%s  %s\n' "$checksums_sha256" "$temporary_directory/$checksums" | sha256sum --check --strict

curl --fail --location --retry 4 --retry-all-errors --proto '=https' --tlsv1.2 \
  --output "$temporary_directory/$archive" "$base_url/$archive"
(
  cd "$temporary_directory"
  grep -E "^[0-9a-f]{64}[[:space:]]+${archive//./\.}$" "$checksums" > "$archive.sha256"
  test -s "$archive.sha256"
  sha256sum --check --strict "$archive.sha256"
  tar --extract --gzip --file "$archive" trivy
)

install -D -m 0755 "$temporary_directory/trivy" "$install_dir/trivy"
"$install_dir/trivy" --version | grep -F "Version: $version" >/dev/null
printf 'Installed verified Trivy %s at %s\n' "$version" "$install_dir/trivy"
