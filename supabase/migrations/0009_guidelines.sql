-- Speakers acknowledge the speaker guidelines (slides deadline, timing bells, arrival).
alter table people add column guidelines_ack_at timestamptz;

create function acknowledge_guidelines(p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update people set guidelines_ack_at = coalesce(guidelines_ack_at, now())
   where id = p_person and auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;
grant execute on function acknowledge_guidelines(uuid) to authenticated;
