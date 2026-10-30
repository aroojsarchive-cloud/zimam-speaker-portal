-- "Your programme has changed" pop-up: we keep a snapshot of what each speaker last
-- acknowledged (their sessions' times, rooms, titles, roles and co-speakers) and show
-- them the difference next time they open the portal.
alter table people_private add column seen_snapshot jsonb;

create function save_seen_snapshot(p_person uuid, p_snapshot jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update people_private pp set seen_snapshot = p_snapshot, last_seen_changes_at = now()
    from people p
   where p.id = pp.person_id and p.id = p_person and p.auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;
grant execute on function save_seen_snapshot(uuid, jsonb) to authenticated;
