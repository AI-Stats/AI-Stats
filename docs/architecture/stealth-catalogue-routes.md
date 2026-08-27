# Stealth catalogue routes

Stealth routes keep their public catalogue identity in repository JSON while storing the real provider route only in Supabase. Public provider identity is always `stealth`.

## Workflow

1. Add the model and provider route to repository JSON using the public `stealth` provider identity.
2. Run the normal catalogue importer.
3. In Supabase, update the imported route to its real internal provider target and set `is_stealth = true`.
4. Register the route as a `stealth` source override so future imports cannot overwrite or delete it.

Perform the private update and ownership marker in one transaction:

```sql
begin;

do $$
declare
  updated_routes integer;
begin
  update public.v2_model_provider_routes
  set
    provider_slug = 'real-provider',
    provider_model_slug = 'real-upstream-model',
    is_stealth = true,
    updated_at = now()
  where provider_model_id = 'stealth:public-model';

  get diagnostics updated_routes = row_count;
  if updated_routes <> 1 then
    raise exception 'Expected one stealth route, updated %', updated_routes;
  end if;
end
$$;

insert into public.v2_catalogue_source_overrides (
  source_type,
  source_key,
  disposition,
  actor_user_id,
  resource_id,
  updated_at
)
values (
  'provider_route',
  'stealth:public-model',
  'stealth',
  'ADMIN_USER_UUID',
  'stealth:public-model',
  now()
)
on conflict (source_type, source_key) do update
set
  disposition = excluded.disposition,
  actor_user_id = excluded.actor_user_id,
  resource_id = excluded.resource_id,
  updated_at = excluded.updated_at;

commit;
```

Do not put the real provider slug, provider model slug, source URL, or provider metadata in repository JSON.
Keep `provider_model_id` unchanged and `stealth:`-prefixed. Other catalogue tables reference this synthetic ID, so changing it would create additional disclosure surfaces and break referential integrity.

## Guarantees

- Anonymous and authenticated direct table reads exclude `is_stealth` routes.
- Public model-page and pricing RPCs replace provider identity with exactly `stealth`.
- The web data API and gateway model catalogue replace real route identifiers before serialization.
- The importer preserves the route, its pricing SKUs, benchmark results, and route variants.
- Internal service-role routing still reads the real provider and upstream model.

## Verification

After applying the migration and creating a route, verify all three boundaries:

```sql
-- Service-role/internal inspection: should show the real target and true.
select provider_slug, provider_model_slug, is_stealth
from public.v2_model_provider_routes
where provider_model_id = 'stealth:public-model';

-- Public projection: provider identity must be exactly stealth.
select public.get_v2_model_pricing('stealth/public-model', null, null);

-- Raw anonymous Data API access must return no row for this route.
begin;
set local role anon;
select provider_model_id
from public.v2_model_provider_routes
where provider_model_id = 'stealth:public-model';
rollback;
```

Run `supabase/tests/stealth_catalogue_security_smoke.sql` against the linked database to verify the policy and RPC permission boundary.
