-- A new photo needs re-confirming, but it must not wipe an open change request:
-- the producer still needs to see "Change requested" and the speaker's note.
create or replace function set_my_photo(p_person uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_path not like p_person::text || '/%' then raise exception 'bad path'; end if;
  update people
     set photo_path = p_path,
         details_status = case when details_status = 'confirmed' then 'unconfirmed' else details_status end
   where id = p_person and auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;
