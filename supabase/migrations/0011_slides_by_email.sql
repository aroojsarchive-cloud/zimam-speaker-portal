-- Slides are now emailed to the producer instead of uploaded. The speaker tells us
-- they've sent them; that's what the checklist and tracker follow.
alter table assignments add column slides_sent_at timestamptz;

create function mark_slides_sent(p_assignment uuid, p_sent boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update assignments a set slides_sent_at = case when p_sent then coalesce(a.slides_sent_at, now()) end
    from people p
   where a.id = p_assignment and p.id = a.person_id and p.auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;
grant execute on function mark_slides_sent(uuid, boolean) to authenticated;
