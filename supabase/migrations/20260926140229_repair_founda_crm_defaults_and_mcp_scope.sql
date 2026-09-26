begin;

alter table public.sessions
  alter column model set default 'opencode/mimo-v2.6-flash-free';
alter table public.agents
  alter column model set default 'opencode/mimo-v2.6-flash-free';

update public.sessions
set model = 'opencode/mimo-v2.6-flash-free'
where model = 'anthropic/claude-sonnet-4';

update public.agents
set model = 'opencode/mimo-v2.6-flash-free'
where model = 'anthropic/claude-sonnet-4';

create unique index if not exists idx_mcp_user_name
  on public.mcp_connections(user_id, name);

commit;
