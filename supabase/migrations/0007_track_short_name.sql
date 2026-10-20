-- Short tab labels for the agenda ("HIE Summit" instead of the full track name).
alter table tracks add column short_name text;
update tracks set short_name = 'Opening & Plenary' where name = 'Official Opening & Plenary';
update tracks set short_name = 'Health AI Summit' where name = 'Health AI Summit';
update tracks set short_name = 'HIE Summit' where name = 'Health Information Exchange Summit';
update tracks set short_name = 'Awards' where name = 'ZIMAM Digital Health Innovation Awards';
update tracks set short_name = 'Careers Workshop' where name like 'Workshop: Competency-based Framework%';
update tracks set short_name = 'Regenstrief Workshop' where name like 'Regenstrief Terminology Workshop%';
