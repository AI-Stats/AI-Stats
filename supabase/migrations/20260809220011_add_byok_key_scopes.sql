alter table public.byok_keys
  add column if not exists allowed_model_slugs text[],
  add column if not exists allowed_api_key_ids uuid[];

alter table public.byok_keys
  drop constraint if exists byok_keys_allowed_model_slugs_limit,
  add constraint byok_keys_allowed_model_slugs_limit
    check (allowed_model_slugs is null or cardinality(allowed_model_slugs) <= 256),
  drop constraint if exists byok_keys_allowed_api_key_ids_limit,
  add constraint byok_keys_allowed_api_key_ids_limit
    check (allowed_api_key_ids is null or cardinality(allowed_api_key_ids) <= 256);

comment on column public.byok_keys.allowed_model_slugs is
  'Null or empty allows every model routed through this provider; otherwise only listed canonical model slugs may use this credential.';
comment on column public.byok_keys.allowed_api_key_ids is
  'Null or empty allows every workspace API key; otherwise only requests authenticated by a listed API key may use this credential.';
