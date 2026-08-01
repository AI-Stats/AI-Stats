create unique index if not exists presets_public_slug_key
  on public.presets (slug)
  where visibility = 'public';

comment on index public.presets_public_slug_key is
  'Public marketplace preset slugs are globally unique; all preset slugs remain unique inside each workspace.';
