-- Signed-out requests should see nothing, not a permission error. The helper
-- functions used inside policies must be callable by anon; they all return
-- false/null when there is no signed-in user. Action RPCs stay signed-in only.
grant execute on function
  my_person_id(uuid), is_member(uuid), is_producer(uuid), is_moderator(uuid), session_published(uuid),
  storage_person_event(text), storage_session_event(text)
to anon;
