-- 在 Supabase Dashboard 的 SQL Editor 貼上並執行本檔。
-- 此規則只允許指定管理員帳號寫入，所有訪客僅能讀取店家、送出回饋。

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  custom_tags jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  message text not null check (char_length(message) between 1 and 2000),
  menu_image text,
  menu_file_name text,
  reporter_name text,
  reporter_email text,
  created_at timestamptz not null default now()
);

alter table public.feedback add column if not exists reporter_name text;
alter table public.feedback add column if not exists reporter_email text;

-- 前台登入使用者的店家確認紀錄：公開只看得到確認時間與狀況，不公開確認者身分。
create table if not exists public.place_confirmations (
  id uuid primary key default gen_random_uuid(),
  place_name text not null,
  status text not null check (status in ('資訊正確', '資訊有誤', '暫停營業')),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists places_updated_at on public.places;
create trigger places_updated_at before update on public.places for each row execute procedure public.set_updated_at();
drop trigger if exists settings_updated_at on public.site_settings;
create trigger settings_updated_at before update on public.site_settings for each row execute procedure public.set_updated_at();

alter table public.admins enable row level security;
alter table public.places enable row level security;
alter table public.site_settings enable row level security;
alter table public.feedback enable row level security;
alter table public.place_confirmations enable row level security;

drop policy if exists "admins can see themselves" on public.admins;
create policy "admins can see themselves" on public.admins for select to authenticated using (auth.uid() = user_id);
drop policy if exists "designated account can claim admin" on public.admins;
create policy "designated account can claim admin" on public.admins for insert to authenticated with check (
  auth.uid() = user_id and lower(coalesce(auth.jwt() ->> 'email', '')) = 'b42468473@gmail.com'
);

drop policy if exists "anyone reads places" on public.places;
create policy "anyone reads places" on public.places for select to anon, authenticated using (true);
drop policy if exists "admins manage places" on public.places;
create policy "admins manage places" on public.places for all to authenticated using (
  exists (select 1 from public.admins where user_id = auth.uid())
) with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "anyone reads settings" on public.site_settings;
create policy "anyone reads settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "admins manage settings" on public.site_settings;
create policy "admins manage settings" on public.site_settings for all to authenticated using (
  exists (select 1 from public.admins where user_id = auth.uid())
) with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "anyone can submit feedback" on public.feedback;
create policy "anyone can submit feedback" on public.feedback for insert to anon, authenticated with check (char_length(message) between 1 and 2000);
drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback" on public.feedback for select to authenticated using (
  exists (select 1 from public.admins where user_id = auth.uid())
);
drop policy if exists "admins delete feedback" on public.feedback;
create policy "admins delete feedback" on public.feedback for delete to authenticated using (
  exists (select 1 from public.admins where user_id = auth.uid())
);

drop policy if exists "anyone reads confirmation status" on public.place_confirmations;
create policy "anyone reads confirmation status" on public.place_confirmations
for select to anon, authenticated using (true);
drop policy if exists "signed in users confirm places" on public.place_confirmations;
create policy "signed in users confirm places" on public.place_confirmations
for insert to authenticated with check (auth.uid() = user_id);
+

-- 待審核店家與菜單檔案空間：完整定義請見 migrations/20260920_p0_cloud_contract.sql。
create table if not exists public.pending_candidates (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists pending_candidates_updated_at on public.pending_candidates;
create trigger pending_candidates_updated_at before update on public.pending_candidates for each row execute procedure public.set_updated_at();
alter table public.pending_candidates enable row level security;
drop policy if exists "admins manage pending candidates" on public.pending_candidates;
create policy "admins manage pending candidates" on public.pending_candidates for all to authenticated using (
  exists (select 1 from public.admins where user_id = auth.uid())
) with check (exists (select 1 from public.admins where user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "public reads menu images" on storage.objects;
create policy "public reads menu images" on storage.objects for select to public using (bucket_id = 'menu-images');
drop policy if exists "admins upload menu images" on storage.objects;
create policy "admins upload menu images" on storage.objects for insert to authenticated with check (bucket_id = 'menu-images' and exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "admins update menu images" on storage.objects;
create policy "admins update menu images" on storage.objects for update to authenticated using (bucket_id = 'menu-images' and exists (select 1 from public.admins where user_id = auth.uid())) with check (bucket_id = 'menu-images' and exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "admins delete menu images" on storage.objects;
create policy "admins delete menu images" on storage.objects for delete to authenticated using (bucket_id = 'menu-images' and exists (select 1 from public.admins where user_id = auth.uid()));
