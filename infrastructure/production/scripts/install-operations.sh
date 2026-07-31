#!/usr/bin/env bash
set -Eeuo pipefail

units=(
  jalwa-backup.service jalwa-backup.timer
  jalwa-source-health.service jalwa-source-health.timer
  jalwa-restore-drill.service jalwa-restore-drill.timer
  jalwa-maintenance.service jalwa-maintenance.timer
)
for unit in "${units[@]}"; do
  sudo install -m 0644 "/opt/jalwa/systemd/${unit}" "/etc/systemd/system/${unit}"
done

sudo systemctl daemon-reload
sudo systemctl enable --now jalwa-backup.timer jalwa-source-health.timer jalwa-restore-drill.timer jalwa-maintenance.timer
sudo systemctl list-timers 'jalwa-*' --no-pager
