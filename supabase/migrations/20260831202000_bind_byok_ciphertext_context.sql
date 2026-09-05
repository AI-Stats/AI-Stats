alter table public.byok_keys
  add column if not exists enc_aad_version smallint not null default 0;

alter table public.byok_keys
  drop constraint if exists byok_keys_enc_aad_version_check,
  add constraint byok_keys_enc_aad_version_check
    check (enc_aad_version in (0, 1));

comment on column public.byok_keys.enc_aad_version is
  'AES-GCM associated-data format. Version 1 binds ciphertext to workspace, provider, and key version; 0 identifies legacy rows.';
