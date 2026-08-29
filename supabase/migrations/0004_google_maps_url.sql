set search_path = public, extensions;

alter table places add column if not exists google_maps_url text;

-- Re-create insert_place with the new field (same signature).
create or replace function public.insert_place(
  p jsonb, p_lng double precision, p_lat double precision
) returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  insert into places (
    name, slug, description, why, category, tags, address, city, country,
    external_url, google_maps_url, status, submitter_email, submitter_note,
    published_at, location
  )
  values (
    p->>'name', p->>'slug', coalesce(p->>'description',''), coalesce(p->>'why',''),
    (p->>'category')::place_category,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'tags') x), '{}'),
    coalesce(p->>'address',''), coalesce(p->>'city',''), coalesce(p->>'country',''),
    nullif(p->>'external_url',''), nullif(p->>'google_maps_url',''),
    (p->>'status')::place_status,
    nullif(p->>'submitter_email',''), nullif(p->>'submitter_note',''),
    case when (p->>'published_at') is not null then now() else null end,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.insert_place(jsonb, double precision, double precision)
  from anon, authenticated;

-- Re-create places_public with the new column.
drop view if exists places_public;
create view places_public as
select
  p.id, p.name, p.slug, p.description, p.why, p.category, p.tags,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat,
  p.address, p.city, p.country, p.external_url, p.google_maps_url, p.published_at,
  coalesce((
    select json_agg(json_build_object(
      'storage_path', ph.storage_path, 'credit', ph.credit,
      'alt', ph.alt, 'sort_order', ph.sort_order
    ) order by ph.sort_order)
    from place_photos ph where ph.place_id = p.id
  ), '[]'::json) as photos
from places p
where p.status = 'published';
grant select on places_public to anon, authenticated;
