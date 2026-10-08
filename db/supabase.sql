-- Run once in the Supabase SQL editor. The server uses the service-role key;
-- row level security is on with no policies, so the public anon key reads nothing.

create extension if not exists pgcrypto;

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chats_user_updated on chats (user_id, updated_at desc);

create table if not exists messages (
  id bigserial primary key,
  chat_id uuid not null references chats(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat on messages (chat_id, id);

create table if not exists usage_daily (
  user_id text not null,
  day date not null,
  tokens bigint not null default 0,
  primary key (user_id, day)
);

alter table chats enable row level security;
alter table messages enable row level security;
alter table usage_daily enable row level security;

create or replace function add_usage(p_user text, p_day date, p_tokens bigint) returns void
language sql security definer set search_path = public as $$
  insert into usage_daily (user_id, day, tokens) values (p_user, p_day, p_tokens)
  on conflict (user_id, day) do update set tokens = usage_daily.tokens + excluded.tokens;
$$;

create or replace function global_usage(p_day date) returns bigint
language sql security definer set search_path = public as $$
  select coalesce(sum(tokens), 0)::bigint from usage_daily where day = p_day;
$$;

revoke all on function add_usage(text, date, bigint) from public, anon, authenticated;
revoke all on function global_usage(date) from public, anon, authenticated;
