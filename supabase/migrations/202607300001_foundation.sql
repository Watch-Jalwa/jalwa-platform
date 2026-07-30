begin;

create type public.app_role as enum ('viewer', 'subscriber', 'editor', 'rights_reviewer', 'support', 'finance', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ur', 'roman_ur')),
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles are readable by owner"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles are editable by owner"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and (select auth.role()) <> 'service_role' then
    raise exception 'profile role cannot be changed by the user';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_profile_role_before_update
before update on public.profiles
for each row execute procedure public.protect_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

commit;
