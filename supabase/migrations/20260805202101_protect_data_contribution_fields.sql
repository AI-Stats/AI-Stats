-- Data-contribution consent and billing terms are controlled by the platform.
-- Workspace administrators may still manage the rest of workspace_settings,
-- but only trusted database roles may alter these fields.

create or replace function public.protect_data_contribution_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.data_contribution_enabled is distinct from false
        or new.data_contribution_policy_version is not null
        or new.data_contribution_consented_at is not null
        or new.data_contribution_consented_by is not null
        or new.data_contribution_sample_rate_bps is distinct from 10000
        or new.data_contribution_classifier_sample_rate_bps is distinct from 1000
        or new.data_contribution_discount_bps is distinct from 100 then
        raise exception 'data contribution settings are platform controlled'
          using errcode = '42501';
      end if;
    elsif new.data_contribution_enabled is distinct from old.data_contribution_enabled
      or new.data_contribution_policy_version is distinct from old.data_contribution_policy_version
      or new.data_contribution_consented_at is distinct from old.data_contribution_consented_at
      or new.data_contribution_consented_by is distinct from old.data_contribution_consented_by
      or new.data_contribution_sample_rate_bps is distinct from old.data_contribution_sample_rate_bps
      or new.data_contribution_classifier_sample_rate_bps is distinct from old.data_contribution_classifier_sample_rate_bps
      or new.data_contribution_discount_bps is distinct from old.data_contribution_discount_bps then
      raise exception 'data contribution settings are platform controlled'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_data_contribution_settings() from public, anon, authenticated;

drop trigger if exists protect_data_contribution_settings on public.workspace_settings;
create trigger protect_data_contribution_settings
before insert or update on public.workspace_settings
for each row execute function public.protect_data_contribution_settings();

comment on function public.protect_data_contribution_settings() is
  'Prevents authenticated workspace administrators from forging platform-controlled contribution consent and billing terms.';
