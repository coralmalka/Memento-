-- MEMENTO SECURITY: queue notifications when Supabase detects a successful
-- authenticated login session from a previously unseen IP address.
-- This migration does NOT send email by itself; deploy the Edge Function and cron.
-- No client can read, insert or modify these sensitive login records.
create table if not exists public.memento_login_security_events (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address text,
  created_at timestamptz not null,
  unfamiliar_ip boolean not null default false,
  alert_sent_at timestamptz,
  logged_at timestamptz not null default now()
);
create index if not exists memento_login_security_user_idx
  on public.memento_login_security_events(user_id,created_at desc);
alter table public.memento_login_security_events enable row level security;
revoke all on public.memento_login_security_events from anon, authenticated;

-- SERVICE_ROLE-only RPC. SECURITY DEFINER reads the protected auth.sessions
-- source on the server, not user-supplied IP addresses.
create or replace function public.memento_pending_security_alerts()
returns table(session_id uuid, user_id uuid, destination_email text,
  ip_address text, event_time timestamptz)
language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare
  sess record;
  has_previous boolean;
  ip_seen boolean;
begin
  -- Read only recent sessions to avoid mailing users about old historical logins.
  for sess in
    select s.id, s.user_id, s.ip::text as ip_text, s.created_at
    from auth.sessions s
    where s.created_at > now() - interval '24 hours'
    order by s.created_at asc, s.id
  loop
    if not exists (
      select 1 from public.memento_login_security_events x
      where x.session_id=sess.id
    ) then
      select exists (
        select 1 from public.memento_login_security_events x
        where x.user_id=sess.user_id and x.ip_address is not null
      ) into has_previous;
      select exists (
        select 1 from public.memento_login_security_events x
        where x.user_id=sess.user_id and x.ip_address=sess.ip_text
      ) into ip_seen;
      insert into public.memento_login_security_events
        (session_id,user_id,ip_address,created_at,unfamiliar_ip)
      values (
        sess.id,sess.user_id,sess.ip_text,sess.created_at,
        coalesce(has_previous,false)
          and not coalesce(ip_seen,false)
          and sess.ip_text is not null and sess.ip_text <> ''
      ) on conflict (session_id) do nothing;
    end if;
  end loop;

  return query
    select x.session_id, x.user_id, u.email::text,
      x.ip_address, x.created_at
    from public.memento_login_security_events x
    join auth.users u on u.id=x.user_id
    where x.unfamiliar_ip
      and x.alert_sent_at is null
      and u.email is not null
      and x.created_at > now() - interval '24 hours'
    order by x.created_at asc
    limit 50;
end;
$$;
revoke all on function public.memento_pending_security_alerts() from public,anon,authenticated;
grant execute on function public.memento_pending_security_alerts() to service_role;

create or replace function public.memento_security_mark_sent(p_session_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.memento_login_security_events
    set alert_sent_at=now()
    where session_id=p_session_id and unfamiliar_ip;
end;
$$;
revoke all on function public.memento_security_mark_sent(uuid) from public,anon,authenticated;
grant execute on function public.memento_security_mark_sent(uuid) to service_role;

-- Note: this migration must be run from SQL Editor with owner permissions.
-- Require MFA (auth.jwt()->>'aal' = 'aal2') in sensitive RLS policies after
-- all existing users are enrolled, otherwise an AAL1 session could still
-- use direct data APIs outside Memento's client UI.
