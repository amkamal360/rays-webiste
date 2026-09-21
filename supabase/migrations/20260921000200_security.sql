-- Security hardening (idempotent).
-- 1. Editing requires two-factor authentication (aal2), enforced by the database itself.
-- 2. Rate-limit counter used by the "submit" Edge Function.
-- 3. Tamper-evident activity log of every portal change.

-- 1 ── Admin rights require a listed admin who has completed two-factor sign-in ────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- 2 ── Rate limiting (called only by the Edge Function with the service role) ──────────────
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security;   -- no policies: invisible to the public API
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into public.rate_limits as t (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.hits + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning hits into v_hits;
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '2 days'; end if;
  return v_hits <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- 3 ── Activity log ──────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  table_name text not null,
  record_id text,
  action text not null
);
alter table public.audit_log enable row level security;
revoke insert, update, delete on public.audit_log from anon, authenticated;
drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log for select using (public.is_admin());

create or replace function public.audit_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, actor_email, table_name, record_id, action)
  values (auth.uid(), auth.jwt() ->> 'email', tg_table_name,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> coalesce(tg_argv[0], 'id'), tg_op);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_site on public.site;
create trigger audit_site after insert or update or delete on public.site for each row execute function public.audit_change();
drop trigger if exists audit_posts on public.posts;
create trigger audit_posts after insert or update or delete on public.posts for each row execute function public.audit_change();
drop trigger if exists audit_media on public.media;
create trigger audit_media after insert or update or delete on public.media for each row execute function public.audit_change();
drop trigger if exists audit_applications on public.applications;
create trigger audit_applications after update or delete on public.applications for each row execute function public.audit_change();
drop trigger if exists audit_inquiries on public.inquiries;
create trigger audit_inquiries after update or delete on public.inquiries for each row execute function public.audit_change();
drop trigger if exists audit_admins on public.admins;
create trigger audit_admins after insert or update or delete on public.admins for each row execute function public.audit_change('user_id');
