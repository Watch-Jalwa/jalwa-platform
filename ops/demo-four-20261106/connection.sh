#!/usr/bin/env bash
set -Eeuo pipefail
test "$STAGE_USER" = codistan
[[ "$HOST" =~ ^[a-zA-Z0-9.-]+$ ]]
[[ "$HOST" != -* ]]
dir="$RUNNER_TEMP/jalwa-four-ssh"
install -d -m 700 "$dir"
umask 077
printf '%s\n' "$SSH_KEY" > "$dir/key"
printf '%s\n' "$KNOWN_HOSTS" > "$dir/hosts"
unset SSH_KEY KNOWN_HOSTS
ssh-keygen -F "$HOST" -f "$dir/hosts" >/dev/null
staging_ssh() {
  ssh -o ControlMaster=auto -o ControlPersist=120s -o ControlPath="$dir/control" -i "$dir/key" -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$dir/hosts" \
    -o ConnectTimeout=12 -o ServerAliveInterval=12 -o ServerAliveCountMax=4 "$STAGE_USER@$HOST" "$@"
}
release=f6467289bef7a25b5a39a04f4ad0674eedeaaff1
for domain in watch-jalwa.com jalwa-platform.codistan.org; do
  curl -fsS --retry 2 --max-time 20 "https://$domain/api/health" |
    jq -e --arg sha "$release" '.status == "ready" and .version == $sha' >/dev/null
done
for attempt in 1 2 3 4; do
  if staging_ssh true; then break; fi
  if [ "$attempt" = 4 ]; then exit 1; fi
  sleep 6
done
staging_ssh "docker exec jalwa-worker-staging node -e 'let e=process.env;if(e.DEPLOYMENT_ENVIRONMENT!==\"staging\"||e.MEDIA_BACKEND!==\"r2\"||e.PAYMENT_PROVIDER!==\"mock\"||e.GIT_SHA!==\"$release\")process.exit(1)'"
