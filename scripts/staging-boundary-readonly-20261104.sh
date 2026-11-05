#!/usr/bin/env bash
# Jalwa staging boundary diagnostics. READ-ONLY; no media, DB, containers or host changes.
set -Eeuo pipefail
section() { printf '\n=== %s ===\n' "$1"; }
section "Host identity"
date -u '+UTC %Y-%m-%dT%H:%M:%SZ'
hostname -f 2>/dev/null || hostname
section "Jalwa containers and mapped ports"
docker ps --format '{{.Names}} | {{.Image}} | {{.Ports}}' | grep -Ei 'jalwa' || true
section "Jalwa compose projects, volumes, mounts"
for cname in jalwa-web-staging jalwa-worker-staging jalwa-postgres-staging jalwa-web jalwa-worker jalwa-postgres; do
  if docker inspect "$cname" >/dev/null 2>&1; then
    docker inspect -f '{{.Name}} | compose_project={{index .Config.Labels "com.docker.compose.project"}} | image={{.Config.Image}} | mounts={{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}' "$cname"
  else
    echo "$cname NOT_PRESENT"
  fi
done
section "Staging and any local production application environment identities (NO credentials)"
for cname in jalwa-web-staging jalwa-worker-staging jalwa-web jalwa-worker; do
  if ! docker inspect "$cname" >/dev/null 2>&1; then continue; fi
  docker exec "$cname" node -e '
    const {createHash}=require("node:crypto");
    const h=(v)=>v?createHash("sha256").update(String(v)).digest("hex").slice(0,14):"unset";
    const e=process.env;
    let db="unset";
    if(e.DATABASE_URL){try{const u=new URL(e.DATABASE_URL);db=h([u.hostname,u.port,u.pathname].join("|"));}catch{db="invalid";}}
    console.log(JSON.stringify({container:process.argv[1],environment:e.DEPLOYMENT_ENVIRONMENT||"unset",version:e.GIT_SHA||"unset",appUrl:e.NEXT_PUBLIC_APP_URL||"unset",databaseEndpointFingerprint:db,mediaBackend:e.MEDIA_BACKEND||"unset",r2AccountFingerprint:h(e.R2_ACCOUNT_ID),r2IncomingBucketFingerprint:h(e.R2_INCOMING_BUCKET||e.R2_BUCKET),r2ProcessedBucketFingerprint:h(e.R2_PROCESSED_BUCKET||e.R2_BUCKET),paymentProvider:e.PAYMENT_PROVIDER||"unset",mockPayments:e.ALLOW_MOCK_PAYMENTS||"unset"}));
  ' "$cname" || true
done
section "Staging container local health"
docker exec jalwa-web-staging node -e 'fetch("http://127.0.0.1:3000/api/health").then(async r=>{console.log("status="+r.status+" body="+(await r.text()).slice(0,450))}).catch(e=>{console.log("health_probe_failed="+e.message);process.exitCode=1})' || true
section "Whether local nginx configuration routes Jalwa public hostname to this staging host"
if [ -d /etc/nginx/sites-enabled ]; then
  grep -RniE 'watch-jalwa[.]com|jalwa-platform[.]codistan[.]org' /etc/nginx/sites-enabled 2>/dev/null | head -30 || true
fi
section "Rights and original-media registry, read-only PostgreSQL transaction"
if docker inspect jalwa-postgres-staging >/dev/null 2>&1; then
  docker exec -i jalwa-postgres-staging sh -lc 'exec psql -X -A -F "|" -t -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT 'SCHEMA|media_assets|' || string_agg(column_name, ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='media_assets';
SELECT 'SCHEMA|rights_records|' || string_agg(column_name, ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='rights_records';
WITH wanted(slug) AS (
  VALUES ('mossy-tree-cc0'),('baking-cookies-cc0'),('ocean-surface-waves-cc0'),
  ('tiny-waterfall-cc0'),('tree-trimmer-cc0'),('counting-chisenbop-cc0'),
  ('vanellus-vanellus-cc0'),('how-fossils-form-cc-by'),('eso-cast-254-light'),
  ('eso-cast-265-light'),('proxima-centauri-flythrough-cc-by'),
  ('invitation-to-pakistan-nara'),('promise-of-pakistan-geography'),
  ('wikipedia-science-comms-cc-by'),('big-buck-bunny'),('elephants-dream')
),
rights AS (
  SELECT content_id,
    count(*) AS rights_count,
    count(*) FILTER (WHERE status='approved') AS approved_rights,
    count(*) FILTER (WHERE status='approved' AND self_hosting_confirmed IS TRUE AND modification_confirmed IS TRUE) AS approved_modification_and_hosting
  FROM public.rights_records GROUP BY content_id
),
assets AS (
  SELECT content_id,
    count(*) AS assets_registered,
    count(*) FILTER (WHERE storage_key IS NOT NULL AND storage_key <> '') AS incoming_storage_key_registered,
    count(*) FILTER (WHERE status='ready') AS ready_assets
  FROM public.media_assets GROUP BY content_id
)
SELECT 'CONTENT|' || w.slug || '|' || coalesce(c.status::text,'missing') || '|' ||
  coalesce(c.hosting_mode::text,'none') || '|approved=' || coalesce(r.approved_rights,0) ||
  '|approved_host_modify=' || coalesce(r.approved_modification_and_hosting,0) ||
  '|rights_records=' || coalesce(r.rights_count,0) ||
  '|source_assets=' || coalesce(a.incoming_storage_key_registered,0) ||
  '|ready_assets=' || coalesce(a.ready_assets,0)
FROM wanted w LEFT JOIN public.content_items c ON c.slug=w.slug
 LEFT JOIN rights r ON r.content_id=c.id LEFT JOIN assets a ON a.content_id=c.id
ORDER BY w.slug;
ROLLBACK;
SQL
else
  echo "STAGING_DB_NOT_PRESENT"
fi
section "Audit completed without writes"

section "Precise Jalwa Nginx vhost route comparison (read-only, no TLS keys)"
for vhost in /etc/nginx/sites-enabled/watch-jalwa.com /etc/nginx/sites-enabled/jalwa-platform.codistan.org; do
  if [ ! -r "$vhost" ]; then
    echo "$vhost NOT_READABLE"
    continue
  fi
  echo "VHOST: $vhost"
  grep -nE '^[[:space:]]*(server_name|location|proxy_pass|root|try_files|rewrite|return|include|listen|upstream)[[:space:]]|127[.]0[.]0[.]1:3001|localhost:3001' "$vhost" | head -50 || true
done
section "Per-title rights flag counts (read-only, no object keys)"
docker exec -i jalwa-postgres-staging sh -lc 'exec psql -X -A -F "|" -t -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' <<'SQL' || true
BEGIN TRANSACTION READ ONLY;
WITH wanted(slug) AS (
  VALUES ('mossy-tree-cc0'),('baking-cookies-cc0'),('ocean-surface-waves-cc0'),
  ('tiny-waterfall-cc0'),('tree-trimmer-cc0'),('counting-chisenbop-cc0'),
  ('vanellus-vanellus-cc0'),('how-fossils-form-cc-by'),('eso-cast-254-light'),
  ('eso-cast-265-light'),('proxima-centauri-flythrough-cc-by'),
  ('invitation-to-pakistan-nara'),('promise-of-pakistan-geography'),
  ('wikipedia-science-comms-cc-by'),('big-buck-bunny'),('elephants-dream')
)
SELECT 'RIGHTS|'||w.slug||'|status='||coalesce(r.status::text,'missing')||
 '|hold='||coalesce(r.rights_hold::text,'null')||
 '|self_hosting='||coalesce(r.self_hosting_confirmed::text,'null')||
 '|modification='||coalesce(r.modification_confirmed::text,'null')||
 '|commercial='||coalesce(r.commercial_use_confirmed::text,'null')||
 '|expires='||coalesce(to_char(r.expires_at at time zone 'UTC','YYYY-MM-DD'),'none')
FROM wanted w
LEFT JOIN public.content_items c ON c.slug=w.slug
LEFT JOIN public.rights_records r ON r.content_id=c.id
ORDER BY w.slug;
ROLLBACK;
SQL
section "Routing and rights read-only check complete"
