begin;

alter function public.handle_new_user() set search_path = public, auth;
alter function public.update_updated_at() set search_path = public;

create index if not exists idx_activity_log_session on public.activity_log(session_id);
create index if not exists idx_repos_user on public.repos(user_id);
create index if not exists idx_session_exports_user on public.session_exports(user_id);

commit;
