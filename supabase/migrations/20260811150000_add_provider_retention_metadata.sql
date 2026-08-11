-- Track a published prompt/input-output retention period separately from the
-- coarse zero-data-retention capability flag. A null duration means that the
-- provider has not published one fixed period or that it is still unknown;
-- zero means the documented retention period is no days.

alter table if exists public.data_api_providers
  add column if not exists data_retention_days integer;

alter table if exists public.data_api_providers
  drop constraint if exists data_api_providers_data_retention_days_check,
  add constraint data_api_providers_data_retention_days_check
    check (data_retention_days is null or data_retention_days >= 0);

alter table if exists public.v2_providers
  add column if not exists data_retention_days integer;

alter table if exists public.v2_providers
  drop constraint if exists v2_providers_data_retention_days_check,
  add constraint v2_providers_data_retention_days_check
    check (data_retention_days is null or data_retention_days >= 0);

update public.v2_providers provider
set
  data_retention_days = legacy.data_retention_days
from public.data_api_providers legacy
where legacy.api_provider_id = provider.provider_slug
  and provider.data_retention_days is distinct from legacy.data_retention_days;

comment on column public.data_api_providers.data_retention_days is
  'Published prompt/input-output retention period in days; null means unknown or variable and zero means no documented retention.';
comment on column public.v2_providers.data_retention_days is
  'Published prompt/input-output retention period in days; null means unknown or variable and zero means no documented retention.';

notify pgrst, 'reload schema';
