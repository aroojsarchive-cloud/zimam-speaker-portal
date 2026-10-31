-- Hosts (MCs / co-chairs) check in for the programme they host, which usually starts
-- before their own sessions. Only on the day, like speakers' check-in.
alter table track_hosts add column checked_in_at timestamptz;

create function host_check_in(p_track uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  ts timestamptz;
begin
  update track_hosts h set checked_in_at = coalesce(h.checked_in_at, now())
    from people p, tracks t, days d, events e
   where h.track_id = p_track and p.id = h.person_id and p.auth_user_id = auth.uid()
     and t.id = h.track_id and d.id = t.day_id and e.id = h.event_id
     and d.date = (now() at time zone e.timezone)::date
  returning h.checked_in_at into ts;
  if ts is null then raise exception 'check-in not available'; end if;
  return ts;
end $$;
grant execute on function host_check_in(uuid) to authenticated;
