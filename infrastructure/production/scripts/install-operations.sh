#!/usr/bin/env bash
set -Eeuo pipefail

sudo install -m 0644 /opt/jalwa/systemd/jalwa-backup.service /etc/systemd/system/jalwa-backup.service
sudo install -m 0644 /opt/jalwa/systemd/jalwa-backup.timer /etc/systemd/system/jalwa-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now jalwa-backup.timer
sudo systemctl list-timers jalwa-backup.timer --no-pager
