-- Founda CRM Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  github_username text,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sessions table (core CRM persistence)
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text default 'Untitled Session',
  agent_name text default 'default',
  model text default 'anthropic/claude-sonnet-4',
  system_prompt text,
  state jsonb default '{}',
  message_count int default 0,
  tags text[] default '{}',
  is_archived boolean default false,
  version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages table (chat history)
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  metadata jsonb default '{}',
  tool_calls jsonb default '[]',
  tokens_used int,
  created_at timestamptz default now()
);

-- Agents table (agent configurations)
create table if not exists public.agents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  system_prompt text default '',
  model text default 'anthropic/claude-sonnet-4',
  temperature float default 0.7,
  max_tokens int default 4096,
  tools_enabled text[] default '{}',
  mcp_servers jsonb default '[]',
  config jsonb default '{}',
  is_autonomous boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Session exports table (version history / upgrade snapshots)
create table if not exists public.session_exports (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null,
  export_data jsonb not null,
  format text default 'json',
  notes text,
  created_at timestamptz default now()
);

-- MCP server connections per user
create table if not exists public.mcp_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  transport text default 'stdio' check (transport in ('stdio', 'http', 'sse')),
  command text,
  args jsonb default '[]',
  env jsonb default '{}',
  url text,
  is_connected boolean default false,
  auth_type text,
  auth_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Project repos (GitHub sync)
create table if not exists public.repos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  github_repo text,
  github_branch text default 'main',
  local_path text,
  last_synced_at timestamptz,
  sync_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Activity log
create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  action text not null,
  details jsonb default '{}',
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.agents enable row level security;
alter table public.session_exports enable row level security;
alter table public.mcp_connections enable row level security;
alter table public.repos enable row level security;
alter table public.activity_log enable row level security;

-- Profiles policies
create policy "Users can view own profile" ON public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" ON public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" ON public.profiles
  for insert with check (auth.uid() = id);

-- Sessions policies
create policy "Users can view own sessions" ON public.sessions
  for select using (auth.uid() = user_id);
create policy "Users can create own sessions" ON public.sessions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" ON public.sessions
  for update using (auth.uid() = user_id);
create policy "Users can delete own sessions" ON public.sessions
  for delete using (auth.uid() = user_id);

-- Messages policies (via session ownership)
create policy "Users can view messages in own sessions" ON public.messages
  for select using (
    exists (
      select 1 from public.sessions
      where sessions.id = messages.session_id
      and sessions.user_id = auth.uid()
    )
  );
create policy "Users can insert messages in own sessions" ON public.messages
  for insert with check (
    exists (
      select 1 from public.sessions
      where sessions.id = messages.session_id
      and sessions.user_id = auth.uid()
    )
  );

-- Agents policies
create policy "Users can view own agents" ON public.agents
  for select using (auth.uid() = user_id);
create policy "Users can create own agents" ON public.agents
  for insert with check (auth.uid() = user_id);
create policy "Users can update own agents" ON public.agents
  for update using (auth.uid() = user_id);
create policy "Users can delete own agents" ON public.agents
  for delete using (auth.uid() = user_id);

-- Session exports policies
create policy "Users can view own exports" ON public.session_exports
  for select using (auth.uid() = user_id);
create policy "Users can create own exports" ON public.session_exports
  for insert with check (auth.uid() = user_id);

-- MCP connections policies
create policy "Users can view own MCP" ON public.mcp_connections
  for select using (auth.uid() = user_id);
create policy "Users can manage own MCP" ON public.mcp_connections
  for all using (auth.uid() = user_id);

-- Repos policies
create policy "Users can view own repos" ON public.repos
  for select using (auth.uid() = user_id);
create policy "Users can manage own repos" ON public.repos
  for all using (auth.uid() = user_id);

-- Activity log policies
create policy "Users can view own activity" ON public.activity_log
  for select using (auth.uid() = user_id);
create policy "Users can create own activity" ON public.activity_log
  for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_updated_at on public.sessions;
create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.update_updated_at();

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at before update on public.agents
  for each row execute function public.update_updated_at();

-- Indexes for performance
create index if not exists idx_sessions_user_id ON public.sessions(user_id);
create index if not exists idx_sessions_updated ON public.sessions(updated_at desc);
create index if not exists idx_messages_session ON public.messages(session_id, created_at);
create index if not exists idx_agents_user ON public.agents(user_id);
create index if not EXISTS idx_exports_session ON public.session_exports(session_id, version);
create index if not exists idx_mcp_user ON public.mcp_connections(user_id);
create index if not exists idx_activity_user ON public.activity_log(user_id, created_at desc);
-- ── Server-side storage for guest devices (keyed by random device id) ──
create table if not exists public.guest_data (
  device_id uuid primary key,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS on, no client policies: only the service-role API routes can touch this table
alter table public.guest_data enable row level security;

drop trigger if exists guest_data_updated_at on public.guest_data;
create trigger guest_data_updated_at before update on public.guest_data
  for each row execute function public.update_updated_at();
