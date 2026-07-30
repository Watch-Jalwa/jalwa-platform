begin;

create extension if not exists vector with schema extensions;

create table public.content_embeddings (
  content_id uuid primary key references public.content_items(id) on delete cascade,
  embedding extensions.vector(96) not null,
  model text not null default 'jalwa-hash-96-v1',
  source_hash text not null,
  refreshed_at timestamptz not null default now()
);

create index content_embeddings_hnsw_idx on public.content_embeddings using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.refresh_semantic_similarity(p_limit_per_item integer default 20)
returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare v_rows integer;
begin
  delete from public.content_similarity where similarity_kind='semantic';
  insert into public.content_similarity(content_id,similar_content_id,similarity_kind,score,refreshed_at)
  select source.content_id,target.content_id,'semantic',greatest(0,1-(source.embedding <=> target.embedding)),now()
  from public.content_embeddings source
  cross join lateral (
    select candidate.content_id,candidate.embedding
    from public.content_embeddings candidate
    where candidate.content_id<>source.content_id
    order by source.embedding <=> candidate.embedding
    limit greatest(1,least(coalesce(p_limit_per_item,20),50))
  ) target
  where 1-(source.embedding <=> target.embedding)>.15;
  get diagnostics v_rows=row_count;
  return jsonb_build_object('semanticPairs',v_rows,'refreshedAt',now());
end;
$$;

alter table public.content_embeddings enable row level security;
create policy "embeddings staff read" on public.content_embeddings for select to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));

commit;
