-- Phase 1 — places / place_photos schema, RLS, and the public read view.

-- PostGIS lives in the `extensions` schema on Supabase; the migration runner
-- does not put it on the search_path by default.
set search_path = public, extensions;

create extension if not exists postgis with schema extensions;

do $$ begin
  create type place_category as enum (
    'architecture','interiors','graphic_signage','product_furniture',
    'public_art','museum_gallery','shop','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type place_status as enum ('pending','published','rejected');
exception when duplicate_object then null; end $$;

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  why text not null default '',
  category place_category not null default 'other',
  tags text[] not null default '{}',
  location geography(Point, 4326) not null,
  address text not null default '',
  city text not null default '',
  country text not null default '',
  external_url text,
  status place_status not null default 'pending',
  submitter_email text,
  submitter_note text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists places_location_gix on places using gist (location);
create index if not exists places_status_idx on places (status);
create index if not exists places_category_idx on places (category);

create table if not exists place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  storage_path text not null,
  credit text,
  alt text not null default '',
  sort_order int not null default 0
);
create index if not exists place_photos_place_idx on place_photos (place_id, sort_order);

alter table places enable row level security;
alter table place_photos enable row level security;

drop policy if exists "published places are public" on places;
create policy "published places are public" on places
  for select using (status = 'published');

drop policy if exists "photos of published places are public" on place_photos;
create policy "photos of published places are public" on place_photos
  for select using (exists (
    select 1 from places p
    where p.id = place_photos.place_id and p.status = 'published'
  ));

-- The public roles must never touch the base tables directly (a column-level
-- REVOKE is ineffective while Supabase's default privileges grant table-level
-- SELECT). Cut them off entirely; all public reads go through places_public.
-- The Phase 2 admin dashboard uses the service-role client, which bypasses this.
revoke all on places from anon, authenticated;
revoke all on place_photos from anon, authenticated;

-- Flattened, photo-joined public read model. A security-definer view (the
-- default) runs with the owner's privileges, so it works without base-table
-- grants; its own `where status = 'published'` is the load-bearing filter.
drop view if exists places_public;
create view places_public as
select
  p.id, p.name, p.slug, p.description, p.why, p.category, p.tags,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat,
  p.address, p.city, p.country, p.external_url, p.published_at,
  coalesce((
    select json_agg(json_build_object(
      'storage_path', ph.storage_path,
      'credit', ph.credit,
      'alt', ph.alt,
      'sort_order', ph.sort_order
    ) order by ph.sort_order)
    from place_photos ph where ph.place_id = p.id
  ), '[]'::json) as photos
from places p
where p.status = 'published';

grant select on places_public to anon, authenticated;
