-- Preparation steps per engagement: "I've checked my session" and "I'm not using slides".

alter table assignments
  add column reviewed_at timestamptz,
  add column no_slides boolean not null default false;

-- Speaker confirms they've read their session and its running order.
create function mark_session_reviewed(p_assignment uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update assignments a set reviewed_at = coalesce(a.reviewed_at, now())
    from people p
   where a.id = p_assignment and p.id = a.person_id and p.auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;

-- Speaker says they won't present slides, so the slides step counts as done.
create function set_no_slides(p_assignment uuid, p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update assignments a set no_slides = p_value
    from people p
   where a.id = p_assignment and p.id = a.person_id and p.auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;

grant execute on function mark_session_reviewed(uuid), set_no_slides(uuid, boolean) to authenticated;
