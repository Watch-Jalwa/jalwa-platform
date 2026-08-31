#!/usr/bin/env bash
set -Eeuo pipefail

firewall_id="${1:?usage: with-digitalocean-ssh-access.sh FIREWALL_ID COMMAND [ARG ...]}"
shift
(( $# > 0 )) || { echo 'A command is required.' >&2; exit 64; }
: "${DIGITALOCEAN_TOKEN:?DIGITALOCEAN_TOKEN is required}"

runner_ip="${RUNNER_PUBLIC_IP:-}"
if [[ -z "$runner_ip" ]]; then
  runner_ip="$(curl -fsS --max-time 15 https://api.ipify.org)"
fi

valid_ipv4() {
  local ip="$1" part
  local IFS=.
  read -r -a parts <<<"$ip"
  [[ ${#parts[@]} -eq 4 ]] || return 1
  for part in "${parts[@]}"; do
    [[ "$part" =~ ^[0-9]{1,3}$ ]] || return 1
    (( 10#$part >= 0 && 10#$part <= 255 )) || return 1
  done
}

valid_ipv4 "$runner_ip" || { echo "Could not determine a valid GitHub runner public IPv4 address: $runner_ip" >&2; exit 65; }
runner_cidr="$runner_ip/32"
payload="{\"inbound_rules\":[{\"protocol\":\"tcp\",\"ports\":\"22\",\"sources\":{\"addresses\":[\"$runner_cidr\"]}}]}"
endpoint="https://api.digitalocean.com/v2/firewalls/$firewall_id/rules"
added=false

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$added" == true ]]; then
    if ! curl -fsS --max-time 20 -o /dev/null -X DELETE \
      -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
      -H 'Content-Type: application/json' \
      --data "$payload" "$endpoint"; then
      echo "Failed to remove temporary SSH access for $runner_cidr from DigitalOcean firewall $firewall_id." >&2
      (( status == 0 )) && status=70
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

curl -fsS --max-time 20 -o /dev/null -X POST \
  -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data "$payload" "$endpoint"
added=true

echo "Temporary SSH access granted to GitHub runner $runner_cidr on firewall $firewall_id." >&2
"$@"
