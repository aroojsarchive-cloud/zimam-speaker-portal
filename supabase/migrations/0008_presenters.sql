-- Who presents slides is decided per engagement from the programme, not by role,
-- so panelists and moderators are never asked for slides.
alter table assignments add column presents boolean not null default false;

-- Starting point: keynotes and lectures present; panels, firesides, openings and closings don't.
update assignments a set presents = true
  from sessions s
 where s.id = a.session_id
   and s.session_type = 'speaking'
   and a.role in ('keynote', 'speaker')
   and s.format in ('keynote', 'lecture', 'workshop');
