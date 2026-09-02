#!/usr/bin/env bash
set -Eeuo pipefail

root="${JALWA_ROOT:-/opt/jalwa}"
env_file="${JALWA_ENV_FILE:-$root/.env.production}"
service_user="${JALWA_SERVICE_USER:-jalwa}"
service_group="${JALWA_SERVICE_GROUP:-$service_user}"

case "$root" in
  /opt/jalwa|/opt/codistan/jalwa-platform) ;;
  *) echo "Unsupported managed Jalwa root: $root" >&2; exit 1 ;;
esac
[[ "$env_file" == "$root"/.env.* && -s "$env_file" ]] || { echo "Invalid or missing Jalwa runtime environment: $env_file" >&2; exit 1; }
[[ "$service_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo "Invalid Jalwa service user." >&2; exit 1; }
[[ "$service_group" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo "Invalid Jalwa service group." >&2; exit 1; }
id "$service_user" >/dev/null 2>&1 || { echo "Jalwa service user does not exist: $service_user" >&2; exit 1; }
getent group "$service_group" >/dev/null 2>&1 || { echo "Jalwa service group does not exist: $service_group" >&2; exit 1; }

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
    sed \
      -e "s|/opt/jalwa|$root|g" \
      -e "s|^EnvironmentFile=.*$|EnvironmentFile=$env_file|" \
      -e "s|^User=jalwa$|User=$service_user|" \
      -e "s|^Group=jalwa$|Group=$service_group|" \
      "$source" > "$temporary"
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
for timer in jalwa-backup.timer jalwa-source-health.timer jalwa-account-requests.timer jalwa-restore-drill.timer jalwa-maintenance.timer; do
  sudo systemctl is-enabled --quiet "$timer"
  sudo systemctl is-active --quiet "$timer"
done
sudo systemctl list-timers 'jalwa-*' --no-pager
