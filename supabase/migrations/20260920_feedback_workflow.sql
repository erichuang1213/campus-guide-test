-- 回饋閉環：安全記錄回報者、關聯店家與管理處理狀態。
-- 可安全重複執行；不會刪除既有回饋。

alter table public.feedback add column if not exists reporter_user_id uuid references auth.users(id) on delete set null;
alter table public.feedback add column if not exists place_name text;
alter table public.feedback add column if not exists status text not null default '待處理' check (status in ('待處理', '處理中', '已完成'));
alter table public.feedback add column if not exists resolved_at timestamptz;

create or replace function public.capture_feedback_reporter()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.reporter_user_id := auth.uid();
  if auth.uid() is not null then
    select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'), email
      into new.reporter_name, new.reporter_email
      from auth.users where id = auth.uid();
  else
    new.reporter_name := null;
    new.reporter_email := null;
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_capture_reporter on public.feedback;
create trigger feedback_capture_reporter
before insert on public.feedback
for each row execute procedure public.capture_feedback_reporter();

drop policy if exists "admins update feedback" on public.feedback;
create policy "admins update feedback"
on public.feedback for update to authenticated
using (exists (select 1 from public.admins where user_id = auth.uid()))
with check (exists (select 1 from public.admins where user_id = auth.uid()));

