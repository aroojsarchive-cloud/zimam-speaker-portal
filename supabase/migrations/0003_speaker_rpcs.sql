-- Speaker-side helpers that write to producer-only tables in a controlled way.

-- "What's changed" banner: the speaker has now seen everything up to now.
create function mark_changes_seen(p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update people_private pp set last_seen_changes_at = now()
    from people p
   where p.id = pp.person_id and p.id = p_person and p.auth_user_id = auth.uid();
end $$;
grant execute on function mark_changes_seen(uuid) to authenticated;
