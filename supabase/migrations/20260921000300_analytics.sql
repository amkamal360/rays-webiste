-- Cookieless analytics and Ask Rays question log, plus the Insights report for the portal.

create table if not exists public.events (
  id bigserial primary key,
  at timestamptz not null default now(),
  type text not null check (char_length(type) <= 20),
  path text check (char_length(path) <= 200),
  label text check (char_length(label) <= 200),
  ref text check (char_length(ref) <= 200),
  device text check (char_length(device) <= 20),
  visitor text check (char_length(visitor) <= 32)          -- one-way code that changes daily; not an IP
);
create index if not exists events_at_idx on public.events (at);
create index if not exists events_type_at_idx on public.events (type, at);
alter table public.events enable row level security;          -- no policies: written by the track function only
revoke all on public.events from anon, authenticated;

create table if not exists public.ask_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  question text not null check (char_length(question) <= 300),  -- long numbers and emails removed before storing
  answered boolean not null,
  sources text[] not null default '{}',
  ms int,
  visitor text
);
create index if not exists ask_log_at_idx on public.ask_log (at);
alter table public.ask_log enable row level security;
revoke all on public.ask_log from anon, authenticated;

-- Retention: events 13 months, questions 90 days
create or replace function public.prune_analytics() returns void
language sql security definer set search_path = public as $$
  delete from public.events where at < now() - interval '400 days';
  delete from public.ask_log where at < now() - interval '90 days';
$$;
revoke all on function public.prune_analytics() from public, anon, authenticated;
grant execute on function public.prune_analytics() to service_role;

-- Report for Portal → Insights (admins with two-factor only)
create or replace function public.insights(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(coalesce(p_days,30), 400)) - 1);
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'visitors',  (select count(distinct visitor) from events where at >= since and type = 'pv'),
    'pageviews', (select count(*) from events where at >= since and type = 'pv'),
    'questions', (select count(*) from events where at >= since and type = 'ask'),
    'forms',     (select count(*) from events where at >= since and type = 'form'),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'pv', coalesce(c.n,0)) order by d), '[]')
               from generate_series(since, date_trunc('day', now()), interval '1 day') d
               left join (select date_trunc('day', at) as dday, count(*) as n from events where at >= since and type = 'pv' group by 1) c on c.dday = d),
    'top_pages', (select coalesce(jsonb_agg(x), '[]') from (select path as label, count(*) as n from events where at >= since and type = 'pv' group by 1 order by 2 desc limit 12) x),
    'top_clicks', (select coalesce(jsonb_agg(x), '[]') from (select label, count(*) n from events where at >= since and type in ('click','outbound') group by 1 order by 2 desc limit 12) x),
    'top_questions', (select coalesce(jsonb_agg(x), '[]') from (select lower(label) as label, count(*) as n from events where at >= since and type in ('ask','search') and label <> '' group by 1 order by 2 desc limit 15) x),
    'unanswered', (select coalesce(jsonb_agg(x), '[]') from (
        select lower(label) as label, count(*) as n from (
          select question label from ask_log where at >= since and not answered
          union all select label from events where at >= since and type = 'ask_unanswered') u
        group by 1 order by 2 desc limit 15) x),
    'feedback', (select coalesce(jsonb_agg(x), '[]') from (select label, count(*) n from events where at >= since and type = 'ask_feedback' group by 1 order by 2 desc limit 10) x),
    'referrers', (select coalesce(jsonb_agg(x), '[]') from (select coalesce(nullif(ref,''),'Direct or unknown') as label, count(*) as n from events where at >= since and type = 'pv' group by 1 order by 2 desc limit 10) x),
    'devices', (select coalesce(jsonb_agg(x), '[]') from (select device as label, count(distinct visitor) as n from events where at >= since and type = 'pv' group by 1 order by 2 desc) x),
    'not_found', (select coalesce(jsonb_agg(x), '[]') from (select label, count(*) n from events where at >= since and type = '404' group by 1 order by 2 desc limit 10) x)
  );
end $$;
revoke all on function public.insights(int) from public, anon;
grant execute on function public.insights(int) to authenticated;
