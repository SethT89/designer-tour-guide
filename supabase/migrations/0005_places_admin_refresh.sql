set search_path = public, extensions;

-- `places_admin` is `select p.*` — Postgres freezes the `*` expansion to the
-- columns that existed when the view was created, so migration 0004's
-- `alter table places add column google_maps_url` did NOT reach this view.
-- Drop + recreate so `p.*` re-expands to the current column set.
--
-- NOTE: any future `alter table places add/drop column` must also refresh this
-- view (and `places_public`, which lists its columns explicitly).
drop view if exists places_admin;
create view places_admin as
select
  p.*,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat
from places p;
revoke all on places_admin from anon, authenticated;
