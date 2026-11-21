-- Cloud backup for Calorie Tracker: one JSON snapshot of the whole diary per user per day.
-- Run this once in the Supabase dashboard (SQL Editor -> New query -> paste -> Run).
-- It is safe to run again.

create table if not exists public.backups (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  day            date        not null,           -- the user's local date of the snapshot
  data           jsonb       not null,           -- the whole AppData, as in a JSON backup file
  data_version   int         not null,
  entry_count    int         not null default 0,
  weigh_in_count int         not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, day)
);

-- Each person can only ever see and change their own snapshots.
alter table public.backups enable row level security;

drop policy if exists "own backups" on public.backups;
create policy "own backups" on public.backups
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Signed-out visitors (the public anon key) get no access at all.
revoke all on public.backups from anon;
grant select, insert, update, delete on public.backups to authenticated;
