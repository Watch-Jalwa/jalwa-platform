\set ON_ERROR_STOP on

begin;

select set_config('jalwa.deployment_environment', :'deployment_environment', true);
select set_config('jalwa.desired_state', :'desired_state', true);
select set_config('jalwa.release_sha', :'release_sha', true);

do $$
declare
  v_environment text := current_setting('jalwa.deployment_environment');
  v_desired boolean := current_setting('jalwa.desired_state')::boolean;
  v_release_sha text := current_setting('jalwa.release_sha');
begin
  if v_environment not in ('staging', 'production') then
    raise exception 'unsupported deployment environment: %', v_environment;
  end if;
  if v_release_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'release SHA must be a 40-character lowercase commit SHA';
  end if;

  insert into public.platform_runtime_flags(key, enabled, notes, updated_at)
  values(
    'ai_enabled',
    v_desired,
    'Protected workflow state change for ' || v_environment || ' at ' || v_release_sha,
    now()
  )
  on conflict(key) do update
    set enabled = excluded.enabled,
        notes = excluded.notes,
        updated_at = excluded.updated_at;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    null,
    'ai_workflow_state_changed',
    'platform_runtime_flag',
    'ai_enabled',
    jsonb_build_object(
      'environment', v_environment,
      'enabled', v_desired,
      'release_sha', v_release_sha
    )
  );
end
$$;

commit;
