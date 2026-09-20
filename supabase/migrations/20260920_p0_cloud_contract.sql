-- P0-3：讓待審核店家與菜單檔案空間可由版本控制重建。
-- 可安全重複執行；不會刪除既有店家、待審核資料或菜單檔案。

create table if not exists public.pending_candidates (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists pending_candidates_updated_at on public.pending_candidates;
create trigger pending_candidates_updated_at
before update on public.pending_candidates
for each row execute procedure public.set_updated_at();

alter table public.pending_candidates enable row level security;

drop policy if exists "admins manage pending candidates" on public.pending_candidates;
create policy "admins manage pending candidates"
on public.pending_candidates
for all to authenticated
using (exists (select 1 from public.admins where user_id = auth.uid()))
with check (exists (select 1 from public.admins where user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads menu images" on storage.objects;
create policy "public reads menu images"
on storage.objects for select to public
using (bucket_id = 'menu-images');

drop policy if exists "admins upload menu images" on storage.objects;
create policy "admins upload menu images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'menu-images'
  and exists (select 1 from public.admins where user_id = auth.uid())
);

drop policy if exists "admins update menu images" on storage.objects;
create policy "admins update menu images"
on storage.objects for update to authenticated
using (
  bucket_id = 'menu-images'
  and exists (select 1 from public.admins where user_id = auth.uid())
)
with check (
  bucket_id = 'menu-images'
  and exists (select 1 from public.admins where user_id = auth.uid())
);

drop policy if exists "admins delete menu images" on storage.objects;
create policy "admins delete menu images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'menu-images'
  and exists (select 1 from public.admins where user_id = auth.uid())
);

