#!/usr/bin/env bash
set -Eeuo pipefail

root="${JALWA_ROOT:-/opt/jalwa}"
env_file="${JALWA_ENV_FILE:-$root/.env.production}"
[[ "$root" == /opt/jalwa ]] || { echo "Operational units require /opt/jalwa as the managed root." >&2; exit 1; }
[[ "$env_file" == /opt/jalwa/.env.* && -s "$env_file" ]] || { echo "Invalid or missing Jalwa runtime environment: $env_file" >&2; exit 1; }

units=(
  jalwa-backup.service jalwa-backup.timer
  jalwa-source-health.service jalwa-source-health.timer
  jalwa-account-requests.service jalwa-account-requests.timer
  jalwa-restore-drill.service jalwa-restore-drill.timer
  jalwa-maintenance.service jalwa-maintenance.timer
)
for unit in "${units[@]}"; do
  source="$root/systemd/$unit"
  [[ -s "$source" ]] || { echo "Missing systemd unit $source" >&2; exit 1; }
  if [[ "$unit" == *.service ]]; then
    temporary="$(mktemp)"
    sed "s|^EnvironmentFile=/opt/jalwa/.env.production$|EnvironmentFile=$env_file|" "$source" > "$temporary"
    sudo install -m 0644 "$temporary" "/etc/systemd/system/$unit"
    rm -f "$temporary"
  else
    sudo install -m 0644 "$source" "/etc/systemd/system/$unit"
  fi
done

sudo systemctl daemon-reload
sudo systemctl enable --now \
  jalwa-backup.timer jalwa-source-health.timer jalwa-account-requests.timer \
  jalwa-restore-drill.timer jalwa-maintenance.timer
sudo systemctl list-timers 'jalwa-*' --no-pager
