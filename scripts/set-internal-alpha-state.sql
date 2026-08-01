\set ON_ERROR_STOP on

begin;

select set_config('jalwa.deployment_environment', :'deployment_environment', true);
select set_config('jalwa.desired_state', :'desired_state', true);
select set_config('jalwa.invite_only', :'invite_only', true);
select set_config('jalwa.minimum_available_content', :'minimum_available_content', true);

do $$
declare
  v_environment text := current_setting('jalwa.deployment_environment');
  v_desired boolean := current_setting('jalwa.desired_state')::boolean;
  v_invite_only boolean := current_setting('jalwa.invite_only')::boolean;
  v_minimum integer := current_setting('jalwa.minimum_available_content')::integer;
  v_sources integer;
  v_items integer;
  v_grants integer;
begin
  if v_environment not in ('staging', 'production') then
    raise exception 'unsupported deployment environment: %', v_environment;
  end if;
  if v_minimum < 0 or v_minimum > 100000 then
    raise exception 'minimum available content is outside the accepted range';
  end if;

  if v_desired then
    select count(*) into v_sources
    from public.source_accounts
    where copyright_approved
      and approved_for_discovery
      and is_enabled
      and disabled_at is null
      and (next_review_at is null or next_review_at > now());

    if v_sources <> 151 then
      raise exception 'expected 151 current approved source lanes, found %', v_sources;
    end if;

    select count(*) into v_items
    from public.content_items c
    left join public.source_accounts s on s.id = c.source_account_id
    where c.status = 'published'
      and c.is_available
      and c.disabled_at is null
      and (c.publish_at is null or c.publish_at <= now())
      and (c.unpublish_at is null or c.unpublish_at > now())
      and (c.source_account_id is null or (
        s.is_enabled
        and s.copyright_approved
        and s.approved_for_discovery
        and s.disabled_at is null
      ))
      and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
      and not exists(
        select 1
        from public.rights_records r
        where r.content_id = c.id
          and r.rights_hold
      )
      and (
        c.hosting_mode = 'text_database'
        or exists(
          select 1
          from public.playback_sources p
          where p.content_id = c.id
            and p.is_primary
            and p.status = 'active'
            and p.is_available
            and p.disabled_at is null
            and (
              c.hosting_mode not in ('self_host_open', 'self_host_owned')
              or exists(
                select 1
                from public.media_assets a
                where a.id = p.media_asset_id
                  and a.status = 'ready'
                  and a.is_available
                  and a.disabled_at is null
              )
            )
        )
      );

    if v_items < v_minimum then
      raise exception 'available alpha content % is below required minimum %', v_items, v_minimum;
    end if;

    if v_invite_only then
      select count(*) into v_grants
      from public.alpha_access_grants
      where enabled
        and (expires_at is null or expires_at > now());

      if v_grants < 1 then
        raise exception 'invite-only alpha requires at least one active tester grant';
      end if;
    end if;
  end if;

  insert into public.platform_runtime_flags(key, enabled, notes, updated_at)
  values
    ('internal_alpha_enabled', v_desired, 'Protected workflow state change for ' || v_environment, now()),
    ('internal_alpha_invite_only', v_invite_only, 'Protected workflow state change for ' || v_environment, now())
  on conflict(key) do update
    set enabled = excluded.enabled,
        notes = excluded.notes,
        updated_at = excluded.updated_at;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    null,
    'internal_alpha_workflow_state_changed',
    'platform_runtime_flag',
    'internal_alpha',
    jsonb_build_object(
      'environment', v_environment,
      'enabled', v_desired,
      'invite_only', v_invite_only,
      'minimum_available_content', v_minimum
    )
  );
end
$$;

commit;
