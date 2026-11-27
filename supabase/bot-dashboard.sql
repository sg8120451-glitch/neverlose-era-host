-- NEVERLOSE ERA bot dashboard settings
-- Run this in Supabase SQL Editor. This stores per-user server settings.
create table if not exists public.bot_guild_settings (
  guild_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
alter table public.bot_guild_settings enable row level security;
drop policy if exists "Users read own guild settings" on public.bot_guild_settings;
create policy "Users read own guild settings" on public.bot_guild_settings
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own guild settings" on public.bot_guild_settings;
create policy "Users insert own guild settings" on public.bot_guild_settings
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own guild settings" on public.bot_guild_settings;
create policy "Users update own guild settings" on public.bot_guild_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.bot_guild_settings to authenticated;
