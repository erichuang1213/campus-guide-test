-- 公開只提供確認狀態與時間，不讓訪客直接讀到確認者 user_id。
-- 可安全重複執行；不刪除任何確認紀錄。

drop policy if exists "anyone reads confirmation status" on public.place_confirmations;
drop policy if exists "authors and admins read confirmations" on public.place_confirmations;
create policy "authors and admins read confirmations"
on public.place_confirmations for select to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.admins where user_id = auth.uid())
);

create or replace function public.public_place_confirmations(requested_names text[])
returns table(place_name text, status text, confirmed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.place_name, p.status, p.confirmed_at
  from public.place_confirmations as p
  where p.place_name = any(requested_names)
  order by p.confirmed_at desc
  limit 500;
$$;

revoke all on function public.public_place_confirmations(text[]) from public;
grant execute on function public.public_place_confirmations(text[]) to anon, authenticated;
