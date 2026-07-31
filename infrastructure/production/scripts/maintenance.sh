#!/usr/bin/env bash
set -Eeuo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
exec 9>/var/lock/jalwa-maintenance.lock
flock -n 9 || { echo "Jalwa maintenance is already running." >&2; exit 1; }

docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
delete from public.rate_limit_buckets where updated_at < now() - interval '2 days';
delete from public.analytics_events where created_at < now() - interval '180 days';
delete from public.recommendation_events where created_at < now() - interval '180 days';
delete from public.live_health_checks where checked_at < now() - interval '30 days';
delete from public.live_viewer_sessions where last_seen_at < now() - interval '90 days';
delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
delete from public.offline_items where expires_at is not null and expires_at < now();
delete from public.media_jobs where status in ('completed','failed') and coalesce(completed_at,updated_at) < now() - interval '90 days';
delete from public.drm_packaging_jobs where status in ('completed','failed') and coalesce(completed_at,created_at) < now() - interval '90 days';
delete from public.drm_license_events where created_at < now() - interval '365 days';
delete from public.webhook_events where status in ('processed','rejected','failed') and received_at < now() - interval '365 days';
delete from public.content_reports where status in ('resolved','dismissed') and coalesce(resolved_at,created_at) < now() - interval '365 days';
delete from public.ai_conversations where created_at < now() - interval '365 days';
SQL

docker exec "$DB_CONTAINER" vacuumdb -U postgres -d postgres --analyze-in-stages >/dev/null
docker image prune -af --filter "until=168h" >/dev/null
docker builder prune -af --filter "until=168h" >/dev/null 2>&1 || true
mkdir -p /opt/jalwa/operations
printf '%s\n' "$(date -u +%FT%TZ)" > /opt/jalwa/operations/LAST_MAINTENANCE
echo "Jalwa lifecycle maintenance completed."
