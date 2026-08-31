-- Local-only catalogue seed. Production publishing still requires approved rights records.

with category as (select id from public.categories where slug = 'kissan')
insert into public.content_items (
  slug, content_type, hosting_mode, access_level, status, title_en, title_ur,
  description_en, primary_category_id, duration_seconds, language, sensitivity
)
select
  'water-smart-farming', 'video', 'self_host_owned', 'public', 'draft',
  'Water-smart farming basics', 'پانی کی بچت والی زراعت',
  'A Jalwa draft explaining practical water-saving principles for farms.',
  category.id, 240, 'multi', 'farming_review'
from category
on conflict (slug) do nothing;

with category as (select id from public.categories where slug = 'tech')
insert into public.content_items (
  slug, content_type, hosting_mode, access_level, status, title_en, title_ur,
  description_en, primary_category_id, duration_seconds, language
)
select
  'ai-in-simple-urdu', 'video', 'self_host_owned', 'public', 'draft',
  'AI explained in simple Urdu', 'آسان اردو میں اے آئی',
  'A beginner-friendly introduction to artificial intelligence.',
  category.id, 360, 'multi'
from category
on conflict (slug) do nothing;
