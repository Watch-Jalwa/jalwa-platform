begin;
create extension if not exists pg_trgm;

create type public.content_type as enum ('video','short','live','audio','article','image_story','quran','quiz');
create type public.hosting_mode as enum ('embed_only','self_host_open','self_host_owned','partner_hosted','external_link','text_database');
create type public.access_level as enum ('public','registered','premium','internal_preview');
create type public.content_status as enum ('draft','rights_review','editorial_review','scheduled','published','unavailable','removed');
create type public.rights_status as enum ('pending','approved','rejected','expired');
create type public.source_provider as enum ('youtube','wikimedia','openverse','tanzil','nasa','pexels','pixabay','blender','original','partner','other');

create table public.categories (
  id uuid primary key default gen_random_uuid(), parent_id uuid references public.categories(id) on delete set null,
  slug text not null unique, name_en text not null, name_ur text, name_roman_ur text, icon text,
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  content_type public.content_type not null, hosting_mode public.hosting_mode not null,
  access_level public.access_level not null default 'public', status public.content_status not null default 'draft',
  title_en text not null, title_ur text, title_roman_ur text,
  description_en text, description_ur text, description_roman_ur text,
  primary_category_id uuid references public.categories(id) on delete set null,
  language text not null default 'en' check (language in ('en','ur','roman_ur','multi')),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  audience text not null default 'general' check (audience in ('general','family','kids','teens','adults')),
  sensitivity text not null default 'standard' check (sensitivity in ('standard','religious_review','farming_review','health_review','children_review','current_affairs_review')),
  thumbnail_url text, publish_at timestamptz, unpublish_at timestamptz, is_featured boolean not null default false,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.playback_sources (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.content_items(id) on delete cascade,
  provider public.source_provider not null, provider_content_id text, embed_url text, media_url text, external_url text,
  is_primary boolean not null default true, status text not null default 'active' check (status in ('active','unavailable','removed')),
  created_at timestamptz not null default now(), unique(provider,provider_content_id)
);

create table public.rights_records (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.content_items(id) on delete cascade,
  source_url text not null, creator text, licence_code text, attribution_text text, jurisdiction_note text,
  commercial_use_confirmed boolean not null default false, modification_confirmed boolean not null default false,
  self_hosting_confirmed boolean not null default false, embedding_confirmed boolean not null default false,
  status public.rights_status not null default 'pending', verified_by uuid references auth.users(id), verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title_en text not null, title_ur text,
  description_en text, access_level public.access_level not null default 'public', status public.content_status not null default 'draft',
  hero_content_id uuid references public.content_items(id) on delete set null, publish_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  sort_order integer not null default 0, primary key(collection_id,content_id)
);

create index content_items_category_idx on public.content_items(primary_category_id);
create index content_items_status_idx on public.content_items(status,publish_at desc);
create index content_items_title_trgm_idx on public.content_items using gin(title_en gin_trgm_ops);
create index content_items_search_idx on public.content_items using gin(to_tsvector('simple',
  coalesce(title_en,'')||' '||coalesce(title_ur,'')||' '||coalesce(title_roman_ur,'')||' '||
  coalesce(description_en,'')||' '||coalesce(description_ur,'')||' '||coalesce(description_roman_ur,'')));
create index rights_records_content_idx on public.rights_records(content_id,status);

insert into public.categories(slug,name_en,name_ur,name_roman_ur,icon,sort_order) values
('originals','Jalwa Originals','جلوہ اوریجنلز','Jalwa Originals','✦',10),('shorts','Shorts','شارٹس','Shorts','▯',20),
('entertainment','Entertainment','تفریح','Tafreeh','▶',30),('deen','Deen','دین','Deen','☾',40),
('kissan','Kissan & Farming','کسان اور زراعت','Kissan aur Zaraat','🌾',50),('learn','Learn','سیکھیں','Seekhein','◫',60),
('tech','Tech & AI','ٹیکنالوجی','Technology','⌁',70),('rozgar','Rozgar & Business','روزگار اور کاروبار','Rozgar aur Karobar','↗',80),
('pakistan','Pakistan','پاکستان','Pakistan','◆',90),('kids','Kids & Family','بچے اور خاندان','Bachay aur Khandan','✿',100),
('life','Health & Life','صحت اور زندگی','Sehat aur Zindagi','♡',110),('live','Live','براہ راست','Live','●',120)
on conflict(slug) do update set name_en=excluded.name_en,name_ur=excluded.name_ur,name_roman_ur=excluded.name_roman_ur,icon=excluded.icon,sort_order=excluded.sort_order;

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','rights_reviewer','support','finance','admin'));
$$;
create or replace function public.is_rights_reviewer() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('rights_reviewer','admin'));
$$;
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create trigger categories_touch before update on public.categories for each row execute procedure public.touch_updated_at();
create trigger content_touch before update on public.content_items for each row execute procedure public.touch_updated_at();
create trigger rights_touch before update on public.rights_records for each row execute procedure public.touch_updated_at();
create trigger collections_touch before update on public.collections for each row execute procedure public.touch_updated_at();

create or replace function public.enforce_content_publish_rights() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and old.status is distinct from 'published' then
  if not exists(select 1 from public.rights_records where content_id=new.id and status='approved') then
   raise exception 'approved rights record required before publishing';
  end if;
  new.publish_at=coalesce(new.publish_at,now());
 end if;
 return new;
end $$;
create trigger enforce_publish_rights before update on public.content_items for each row execute procedure public.enforce_content_publish_rights();

create or replace function public.search_catalogue(p_query text default null,p_category text default null,p_limit integer default 40)
returns table(id uuid,slug text,title text,title_ur text,description text,category_slug text,category_name text,
 content_type public.content_type,hosting_mode public.hosting_mode,access_level public.access_level,duration_seconds integer,thumbnail_url text,published_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select c.id,c.slug,c.title_en,c.title_ur,c.description_en,cat.slug,cat.name_en,c.content_type,c.hosting_mode,c.access_level,c.duration_seconds,c.thumbnail_url,c.publish_at
 from public.content_items c left join public.categories cat on cat.id=c.primary_category_id
 where c.status='published' and (c.publish_at is null or c.publish_at<=now()) and (c.unpublish_at is null or c.unpublish_at>now())
 and (p_category is null or p_category='' or cat.slug=p_category)
 and (p_query is null or p_query='' or to_tsvector('simple',coalesce(c.title_en,'')||' '||coalesce(c.title_ur,'')||' '||coalesce(c.title_roman_ur,'')||' '||coalesce(c.description_en,'')) @@ websearch_to_tsquery('simple',p_query) or similarity(c.title_en,p_query)>.2)
 order by c.is_featured desc,c.publish_at desc nulls last,c.created_at desc limit least(greatest(p_limit,1),100)
$$;

create or replace function public.import_youtube_draft(p_video_id text,p_source_url text,p_title text,p_thumbnail_url text default null,p_category_slug text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_category uuid; v_slug text;
begin
 if not public.is_staff() then raise exception 'staff role required'; end if;
 if p_video_id !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'invalid YouTube video id'; end if;
 select id into v_category from public.categories where slug=p_category_slug and is_active;
 v_slug:=trim(both '-' from regexp_replace(lower(p_title),'[^a-z0-9]+','-','g'))||'-'||lower(substr(p_video_id,1,6));
 insert into public.content_items(slug,content_type,hosting_mode,access_level,status,title_en,primary_category_id,thumbnail_url,created_by,updated_by)
 values(v_slug,'video','embed_only','public','draft',p_title,v_category,p_thumbnail_url,(select auth.uid()),(select auth.uid())) returning id into v_id;
 insert into public.playback_sources(content_id,provider,provider_content_id,embed_url,external_url)
 values(v_id,'youtube',p_video_id,'https://www.youtube-nocookie.com/embed/'||p_video_id,p_source_url);
 insert into public.rights_records(content_id,source_url,creator,embedding_confirmed,attribution_text,status)
 values(v_id,p_source_url,'YouTube source channel',true,'Embedded from YouTube using the official player.','pending');
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values((select auth.uid()),'youtube_draft_imported','content_item',v_id::text,jsonb_build_object('video_id',p_video_id));
 return v_id;
end $$;

grant execute on function public.search_catalogue(text,text,integer) to anon,authenticated;
grant execute on function public.import_youtube_draft(text,text,text,text,text) to authenticated;
grant execute on function public.is_staff() to anon,authenticated;
grant execute on function public.is_rights_reviewer() to authenticated;

alter table public.categories enable row level security; alter table public.content_items enable row level security;
alter table public.playback_sources enable row level security; alter table public.rights_records enable row level security;
alter table public.collections enable row level security; alter table public.collection_items enable row level security;
create policy "categories public" on public.categories for select using(is_active or public.is_staff());
create policy "staff categories" on public.categories for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "catalogue public" on public.content_items for select using(status='published' or public.is_staff());
create policy "staff content" on public.content_items for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "playback public" on public.playback_sources for select using(public.is_staff() or exists(select 1 from public.content_items c where c.id=content_id and c.status='published'));
create policy "staff playback" on public.playback_sources for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff rights read" on public.rights_records for select to authenticated using(public.is_staff());
create policy "staff rights create" on public.rights_records for insert to authenticated with check(public.is_staff());
create policy "reviewers rights update" on public.rights_records for update to authenticated using(public.is_rights_reviewer()) with check(public.is_rights_reviewer());
create policy "collections public" on public.collections for select using(status='published' or public.is_staff());
create policy "staff collections" on public.collections for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "collection items public" on public.collection_items for select using(public.is_staff() or exists(select 1 from public.collections c where c.id=collection_id and c.status='published'));
create policy "staff collection items" on public.collection_items for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff audit insert" on public.audit_logs for insert to authenticated with check(public.is_staff());
create policy "admin audit read" on public.audit_logs for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('support','finance','admin')));
commit;
