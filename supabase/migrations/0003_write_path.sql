set search_path = public, extensions;

-- Public bucket for place photos. 5 MB / image, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 5242880,
        array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read place-photos" on storage.objects;
create policy "public read place-photos" on storage.objects
  for select using (bucket_id = 'place-photos');
-- inserts/updates/deletes: none for anon/authenticated; the service-role client
-- bypasses RLS.

-- Admin read model: every column + flattened coords, no status filter.
drop view if exists places_admin;
create view places_admin as
select
  p.*,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat
from places p;
revoke all on places_admin from anon, authenticated;

-- Review queue ordering.
create index if not exists places_status_created_idx
  on places (status, created_at desc);

-- Insert a place from JSON + coords (the JS client can't write a geography
-- literal). Used by /api/submit (status 'pending') and createPlaceDirectly
-- (status 'published'). SECURITY DEFINER; callers are already trusted
-- (rate-limited public route, or an admin-session server action).
create or replace function public.insert_place(
  p jsonb, p_lng double precision, p_lat double precision
) returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  insert into places (
    name, slug, description, why, category, tags, address, city, country,
    external_url, status, submitter_email, submitter_note, published_at, location
  )
  values (
    p->>'name', p->>'slug', coalesce(p->>'description',''), coalesce(p->>'why',''),
    (p->>'category')::place_category,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'tags') x), '{}'),
    coalesce(p->>'address',''), coalesce(p->>'city',''), coalesce(p->>'country',''),
    nullif(p->>'external_url',''), (p->>'status')::place_status,
    nullif(p->>'submitter_email',''), nullif(p->>'submitter_note',''),
    case when (p->>'published_at') is not null then now() else null end,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.insert_place(jsonb, double precision, double precision)
  from anon, authenticated;

-- Move an existing place's pin (used by updatePlace).
create or replace function public.set_place_point(
  p_id uuid, p_lng double precision, p_lat double precision
) returns void language sql security definer as $$
  update places set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  where id = p_id;
$$;
revoke all on function public.set_place_point(uuid, double precision, double precision)
  from anon, authenticated;
