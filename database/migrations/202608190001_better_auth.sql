begin;
create table if not exists public."user" (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null unique,
  "emailVerified" boolean not null default false, image text,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(),
  role text default 'user', banned boolean default false, "banReason" text, "banExpires" timestamptz
);
create table if not exists public."session" (
  id uuid primary key default gen_random_uuid(), "expiresAt" timestamptz not null, token text not null unique,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(),
  "ipAddress" text, "userAgent" text, "userId" uuid not null references public."user"(id) on delete cascade,
  "impersonatedBy" text
);
create index if not exists better_auth_session_user_idx on public."session"("userId");
create table if not exists public."account" (
  id uuid primary key default gen_random_uuid(), "accountId" text not null, "providerId" text not null,
  "userId" uuid not null references public."user"(id) on delete cascade,
  "accessToken" text, "refreshToken" text, "idToken" text,
  "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, scope text, password text,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create index if not exists better_auth_account_user_idx on public."account"("userId");
create unique index if not exists better_auth_account_provider_idx on public."account"("providerId","accountId");
create table if not exists public."verification" (
  id uuid primary key default gen_random_uuid(), identifier text not null, value text not null, "expiresAt" timestamptz not null,
  "createdAt" timestamptz default now(), "updatedAt" timestamptz default now()
);
create index if not exists better_auth_verification_identifier_idx on public."verification"(identifier);
create table if not exists public.qa_magic_links (
  email text not null, qa_run_id text not null, url text not null, expires_at timestamptz not null,
  created_at timestamptz not null default now(), primary key (email, qa_run_id)
);
revoke all on public.qa_magic_links from anon, authenticated;
grant select, insert, update, delete on public.qa_magic_links to service_role;
create or replace function public.sync_better_auth_user()
returns trigger language plpgsql security definer set search_path=public,auth as $$
begin
  if tg_op = 'DELETE' then delete from auth.users where id=old.id; return old; end if;
  insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at,last_sign_in_at)
  values(new.id,new.email,jsonb_build_object('display_name',new.name,'image',new.image),new."createdAt",new."updatedAt",case when tg_op='INSERT' then now() else null end)
  on conflict(id) do update set email=excluded.email,raw_user_meta_data=excluded.raw_user_meta_data,updated_at=excluded.updated_at;
  return new;
end $$;
drop trigger if exists better_auth_user_mirror on public."user";
create trigger better_auth_user_mirror after insert or update or delete on public."user" for each row execute function public.sync_better_auth_user();
insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at)
select id,email,jsonb_build_object('display_name',name,'image',image),"createdAt","updatedAt" from public."user" on conflict(id) do nothing;
commit;
