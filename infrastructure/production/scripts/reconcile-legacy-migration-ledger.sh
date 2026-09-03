#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${ALLOW_LEGACY_MIGRATION_BASELINE:-false}" != "true" ]]; then
  echo "Legacy migration baseline is disabled. Set ALLOW_LEGACY_MIGRATION_BASELINE=true only for a verified legacy database." >&2
  exit 1
fi

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/opt/jalwa/migrations}"
DB_CONTAINER="${DB_CONTAINER:-jalwa-postgres}"
LOCK_FILE="${MIGRATION_BASELINE_LOCK_FILE:-${MIGRATION_LOCK_FILE:-/opt/jalwa/.migration.lock}.baseline}"

DB_USER="${POSTGRES_USER:-}"
DB_NAME="${POSTGRES_DB:-}"
if [[ -z "$DB_USER" ]]; then
  DB_USER="$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "${POSTGRES_USER:-}"')"
fi
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "${POSTGRES_DB:-}"')"
fi
: "${DB_USER:?Could not determine PostgreSQL user}"
: "${DB_NAME:?Could not determine PostgreSQL database}"

[[ -d "$MIGRATIONS_DIR" ]] || { echo "Migration directory not found: $MIGRATIONS_DIR" >&2; exit 1; }

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another migration baseline operation is active." >&2; exit 1; }
docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null

expected_manifest="$(mktemp)"
actual_manifest="$(mktemp)"
seed_sql="$(mktemp)"
cleanup() { rm -f "$expected_manifest" "$actual_manifest" "$seed_sql"; }
trap cleanup EXIT

cat >"$expected_manifest" <<'MANIFEST'
aa01095fc52797fc28b55b64dc90aeb4be56c9da81806fb19680423586cb376d  202607300001_foundation.sql
c71bab40564dc944833ddab3d3cf0a53b5fd2c248855bc0dadb87e39e0c9ee34  202607300002_catalogue_rights.sql
5222a9ec823c22bef258b44e1beee7422ecfea11ee154915ef1d67021a631108  202607300003_media_pipeline.sql
23af35a042f49ae7906ff9e3532c24bc4e7d388abcd4870e36e3f79a86707888  202607300004_payments_entitlements.sql
4a785dfc9a318adc1b5fcea3d9beee5c4cc5a84fdcaf98896161bcee838d2d5f  202607300005_ai.sql
62154cc21e91ca6ef3f901570e49534d16958f1bd0b338483eb5291f29c757bb  202607300006_launch_hardening.sql
790af48c93095a1360b243354f4d06a5c45644462c3e2b9c89050cb3f5175f08  202607300007_customer_journeys.sql
2d042b64e3cc62d6a2a267120b7daa37e3a81eabc0fa2b5a21037eff2614d627  202607310001_catalogue_rights_operations.sql
4e1b5b79b0156c516e8831a352bf60e8bb3d628ae4488fa35e54aebe364e270b  202607310001_social_recommendations.sql
ba09df9038b0d6eac130875bfcd30bb677fbfffb9047a11ac6e0a978ec39b666  202607310002_social_controls.sql
e7052f71f7f2d3790ef261ad7e5ac0f93c8bd41e7b4dcd22f60cab20324db58c  202607310003_semantic_recommendations.sql
3d6d785e1b548b7f684884ffd1176d07ffc916df844b992804f7c883eeee723d  202607310004_live_drm.sql
0e579a4f2702822327fa67c0ad6675f86ab44dcbbd7a46e5f2953035506430fb  202607310005_community_reads.sql
cfe814b12ab86ca5f4aae8b434923de02f3af37ad0eb44b80bfff8fb259c551a  202607310006_social_live_hardening.sql
14e2b9e380624a4ad16c3214c8f1f11d808d5c2e44bbe24b0124ee71a1b1e6f7  202607310007_production_integrity.sql
0d2458e285b82b0c5184588a143a7c854cd84ef00d2e42fb8120710a0a573be4  202607310008_privacy_operations.sql
bd5f6eac86b3e78d03ef985ad1e1075120c69f685cabe3745d0679a2cfa093c9  202607310009_privacy_export.sql
3585d13c311de1726ca17063793c9c801561321e987a3c75d5e91b7f2a0f42af  202607310010_payment_operations.sql
56426560c2d7fe0951acb58f3c131779f05b5709eef07d71a842fa0a1e6d75b8  202607310011_payment_replay_integrity.sql
1ef80ddc41c42a0540afd9ae2d27de8e231a90af89962bd79befc6b161830fa6  202607310011_premium_reporting.sql
5ee8140c7050ea1900082fb4b98186b7b1699cbf5e2f1a12581769bda569e39f  202607310012_premium_reporting_hardening.sql
05eadc8bde47fc7f4fcaf3a968a6916d5c133f2f66a2afa5dbe209b78028c3ba  202608010001_public_domain_live_sources.sql
a085534d1ba3ab9c67a0d4d9b03d67e85904cfe181cac1f63f1072d0142d1226  202608010002_approved_public_domain_live_inventory.sql
42144df31254710bb962c4294a8eb37139f942b0ffc83942a22089d2124d30af  202608010003_institutional_public_affairs_live_sources.sql
fa58b6e7334b5a2f822eb4f90698b6e08d0f52050ac65cfed06bb9481a917386  202608010004_open_government_live_expansion.sql
eaa6d3955aa65d87ab78b923bd514b6681de5b59280ee9c1774f4a5f9c7c0f9d  202608010005_approved_live_catalogue_manifest.sql
7fb307cfe330bb8b608942572701d70bf60d9399a869ca5817d85c648e79a194  202608010006_internal_alpha_content_controls.sql
c5ba1fb16c6bb99f2087c00d023d7ab4f8bc145b2277673d6f8f0acbf4e752f6  202608010007_alpha_approved_source_register.sql
c7bfdf81394bab106df127aaa260309831357c5dc52bd9e92103fee18e9c4b97  202608190001_better_auth.sql
MANIFEST

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
for migration in "${migrations[@]}"; do
  filename="$(basename "$migration")"
  checksum="$(sha256sum "$migration" | awk '{print $1}')"
  printf '%s  %s\n' "$checksum" "$filename" >>"$actual_manifest"
done
sort -k2,2 "$actual_manifest" -o "$actual_manifest"
sort -k2,2 "$expected_manifest" -o "$expected_manifest"
if ! cmp -s "$expected_manifest" "$actual_manifest"; then
  echo "Legacy baseline migration set does not match the single approved 29-migration set; refusing to mark history." >&2
  diff -u "$expected_manifest" "$actual_manifest" >&2 || true
  exit 1
fi

docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
create table if not exists public.jalwa_schema_migrations (
  filename text primary key,
  checksum text not null,
  status text not null default 'applied' check (status in ('applying','applied','failed')),
  started_at timestamptz not null default now(),
  applied_at timestamptz,
  error_message text
);
alter table public.jalwa_schema_migrations add column if not exists status text not null default 'applied';
alter table public.jalwa_schema_migrations add column if not exists started_at timestamptz not null default now();
alter table public.jalwa_schema_migrations add column if not exists error_message text;
alter table public.jalwa_schema_migrations alter column applied_at drop not null;
SQL

ledger_summary="$(docker exec "$DB_CONTAINER" psql -X -At -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -c "select count(*),count(*) filter(where status='applied'),count(*) filter(where status<>'applied') from public.jalwa_schema_migrations;")"
IFS='|' read -r ledger_total ledger_applied ledger_non_applied <<<"$ledger_summary"

if (( ledger_applied > 0 )); then
  if (( ledger_non_applied > 0 )); then
    echo "Migration ledger is already established but contains non-applied rows; refusing automatic reconciliation." >&2
    exit 1
  fi
  echo "Migration ledger is already established; leaving it to the normal migration runner."
  exit 0
fi

if (( ledger_total > 0 )); then
  while IFS='|' read -r filename status; do
    grep -Fq "  $filename" "$expected_manifest" || { echo "Unexpected legacy ledger filename: $filename" >&2; exit 1; }
    [[ "$status" == "failed" || "$status" == "applying" ]] || { echo "Unexpected legacy ledger status for $filename: $status" >&2; exit 1; }
  done < <(docker exec "$DB_CONTAINER" psql -X -At -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -c "select filename,status from public.jalwa_schema_migrations order by filename;")
fi

# Fail closed unless the legacy database contains the terminal schema/data/security
# sentinels produced by the complete approved migration set. This is deliberately
# stronger than merely checking for the first migration's objects.
docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
DO $$
DECLARE
  v_count integer;
BEGIN
  IF to_regtype('public.app_role') IS NULL THEN RAISE EXCEPTION 'foundation sentinel missing'; END IF;
  IF to_regclass('public.content_items') IS NULL OR to_regclass('public.rights_records') IS NULL THEN RAISE EXCEPTION 'catalogue/rights sentinels missing'; END IF;
  IF to_regclass('public.media_assets') IS NULL THEN RAISE EXCEPTION 'media sentinel missing'; END IF;
  IF to_regclass('public.checkout_orders') IS NULL OR to_regclass('public.subscriptions') IS NULL THEN RAISE EXCEPTION 'payments sentinels missing'; END IF;
  IF to_regclass('public.ai_messages') IS NULL THEN RAISE EXCEPTION 'AI sentinel missing'; END IF;
  IF to_regclass('public.user_devices') IS NULL OR to_regclass('public.account_requests') IS NULL THEN RAISE EXCEPTION 'operations/privacy sentinels missing'; END IF;
  IF to_regprocedure('public.process_payment_lifecycle_event(uuid,public.payment_provider,text,text,text,integer,text,text,text)') IS NULL THEN RAISE EXCEPTION 'payment lifecycle sentinel missing'; END IF;

  IF to_regclass('public.payment_refunds') IS NULL OR to_regclass('public.subscription_status_events') IS NULL THEN RAISE EXCEPTION 'premium reporting sentinels missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_orders' AND column_name='payment_purpose') THEN RAISE EXCEPTION 'premium checkout column missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name='activation_source') THEN RAISE EXCEPTION 'premium subscription column missing'; END IF;
  IF to_regprocedure('public.capture_payment_refund()') IS NULL THEN RAISE EXCEPTION 'premium refund function missing'; END IF;
  IF has_function_privilege('authenticated','public.capture_payment_refund()','EXECUTE') OR has_function_privilege('anon','public.capture_payment_refund()','EXECUTE') THEN RAISE EXCEPTION 'premium reporting hardening missing'; END IF;

  IF to_regclass('public.live_source_configs') IS NULL OR to_regclass('public.playback_source_health') IS NULL THEN RAISE EXCEPTION 'live-source sentinels missing'; END IF;
  SELECT count(*) INTO v_count FROM public.content_items WHERE slug IN ('nasa-space-station-views','noaa-ocean-exploration-camera-1','usgs-kilauea-v1');
  IF v_count <> 3 THEN RAISE EXCEPTION 'initial approved live inventory is incomplete'; END IF;
  SELECT count(*) INTO v_count FROM public.content_items WHERE slug IN ('european-parliament-plenary','un-web-tv','un-general-assembly');
  IF v_count <> 3 THEN RAISE EXCEPTION 'institutional live inventory is incomplete'; END IF;
  SELECT count(*) INTO v_count FROM public.content_items WHERE slug IN ('dvids-live-webcasts','nasa-plus-live-events','nih-videocast','us-house-floorcast');
  IF v_count <> 4 THEN RAISE EXCEPTION 'open-government live inventory is incomplete'; END IF;
  IF to_regclass('public.approved_live_catalogue_manifest') IS NULL THEN RAISE EXCEPTION 'approved live manifest missing'; END IF;
  SELECT count(*) INTO v_count FROM public.approved_live_catalogue_manifest;
  IF v_count <> 52 THEN RAISE EXCEPTION 'approved live manifest does not contain 52 entries'; END IF;

  IF to_regclass('public.source_accounts') IS NULL OR to_regclass('public.source_items') IS NULL OR to_regclass('public.source_download_jobs') IS NULL THEN RAISE EXCEPTION 'alpha content-control sentinels missing'; END IF;
  SELECT count(*) INTO v_count FROM public.source_accounts;
  IF v_count < 151 OR NOT EXISTS (SELECT 1 FROM public.source_accounts WHERE source_key='WM-001') THEN RAISE EXCEPTION 'approved source register is incomplete'; END IF;

  IF to_regclass('public."user"') IS NULL OR to_regclass('public."session"') IS NULL OR to_regclass('public."account"') IS NULL OR to_regclass('public."verification"') IS NULL OR to_regclass('public.qa_magic_links') IS NULL THEN RAISE EXCEPTION 'Better Auth sentinels missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='better_auth_user_mirror' AND NOT tgisinternal) THEN RAISE EXCEPTION 'Better Auth mirror trigger missing'; END IF;

  IF has_table_privilege('authenticated','public.checkout_orders','INSERT') THEN RAISE EXCEPTION 'production payment hardening missing'; END IF;
  IF has_table_privilege('authenticated','public.payment_operations','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'payment operations hardening missing'; END IF;
  IF has_table_privilege('authenticated','public.user_devices','UPDATE') THEN RAISE EXCEPTION 'device hardening missing'; END IF;
  IF has_table_privilege('authenticated','public.ai_messages','INSERT') THEN RAISE EXCEPTION 'AI hardening missing'; END IF;
END
$$;
SQL

{
  echo 'BEGIN;'
  echo 'DELETE FROM public.jalwa_schema_migrations;'
  echo 'INSERT INTO public.jalwa_schema_migrations(filename,checksum,status,started_at,applied_at,error_message) VALUES'
  first=true
  while read -r checksum filename; do
    [[ "$filename" =~ ^[0-9]{12,}_[a-z0-9_]+\.sql$ ]] || { echo "Invalid baseline filename: $filename" >&2; exit 1; }
    [[ "$checksum" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid baseline checksum for $filename" >&2; exit 1; }
    if [[ "$first" == true ]]; then first=false; else printf ',\n'; fi
    printf "('%s','%s','applied',now(),now(),null)" "$filename" "$checksum"
  done <"$expected_manifest"
  echo ';'
  echo 'COMMIT;'
} >"$seed_sql"

docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <"$seed_sql" >/dev/null

expected_count="$(wc -l <"$expected_manifest" | tr -d ' ')"
final_summary="$(docker exec "$DB_CONTAINER" psql -X -At -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -c "select count(*),count(*) filter(where status='applied') from public.jalwa_schema_migrations;")"
IFS='|' read -r final_total final_applied <<<"$final_summary"
[[ "$final_total" == "$expected_count" && "$final_applied" == "$expected_count" ]] || { echo "Legacy migration ledger baseline verification failed." >&2; exit 1; }

echo "Verified terminal legacy schema and recorded $expected_count migration checksums as applied."
