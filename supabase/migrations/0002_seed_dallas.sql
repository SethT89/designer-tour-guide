-- Phase 1 — five Dallas design landmarks. Idempotent on slug.

set search_path = public, extensions;

insert into places (name, slug, description, why, category, tags, location, address, city, country, status, published_at)
values
  (
    'Nasher Sculpture Center',
    'nasher-sculpture-center',
    'A single-storey museum and garden dedicated to modern and contemporary sculpture, opened in 2003.',
    'Renzo Piano''s travertine-and-glass pavilions with their cast-glass sunshade roof, opening onto a Peter Walker garden — a masterclass in daylighting and indoor/outdoor flow.',
    'museum_gallery',
    array['renzo piano','daylighting','garden','travertine'],
    st_setsrid(st_makepoint(-96.7986, 32.7880), 4326)::geography,
    '2001 Flora St, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Morton H. Meyerson Symphony Center',
    'meyerson-symphony-center',
    'The Dallas Symphony Orchestra''s concert hall, completed in 1989.',
    'I.M. Pei / Pei Cobb Freed — a curved limestone lobby wrapped in glass, with a shoebox hall by acoustician Russell Johnson. The geometry of the conoid lobby vault is worth the visit alone.',
    'architecture',
    array['i m pei','acoustics','limestone','civic'],
    st_setsrid(st_makepoint(-96.7972, 32.7897), 4326)::geography,
    '2301 Flora St, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Perot Museum of Nature and Science',
    'perot-museum',
    'A natural-science museum in Victory Park, opened in 2012.',
    'Thom Mayne / Morphosis — a striated concrete cube with a glass-enclosed escalator cantilevered off the facade and a native-landscape roof. Bold massing, hard edges.',
    'architecture',
    array['morphosis','thom mayne','concrete','brutalist-adjacent'],
    st_setsrid(st_makepoint(-96.8064, 32.7868), 4326)::geography,
    '2201 N Field St, Dallas, TX 75202', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Klyde Warren Park',
    'klyde-warren-park',
    'A 5.2-acre deck park built over the recessed Woodall Rodgers Freeway, opened in 2012.',
    'The Office of James Burnett turned a sunken highway into a connective public room — a case study in landscape as infrastructure, with a clear kit of parts (allees, lawn, pavilions).',
    'other',
    array['landscape','deck park','ojb','public space'],
    st_setsrid(st_makepoint(-96.8017, 32.7893), 4326)::geography,
    '2012 Woodall Rodgers Fwy, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Pegasus (Magnolia Hotel)',
    'pegasus-magnolia-hotel',
    'The restored 1934 rotating neon Pegasus sign atop the Magnolia Hotel downtown.',
    'A perfect piece of pre-war commercial signage — the flying red horse as civic mascot. The 1999 restoration and the 2015 ground-level original are both instructive on neon craft.',
    'graphic_signage',
    array['neon','signage','1930s','landmark'],
    st_setsrid(st_makepoint(-96.7969, 32.7802), 4326)::geography,
    '1401 Commerce St, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  )
on conflict (slug) do nothing;
