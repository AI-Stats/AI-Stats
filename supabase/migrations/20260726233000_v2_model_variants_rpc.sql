-- Keep base/free model identities discoverable without expanding them into
-- separate cards on the main catalogue page.

create or replace function public.get_v2_model_variants(p_model_slug text)
returns table (
  model_id text,
  name text,
  variant_kind text
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select coalesce(model.base_model_slug, model.model_slug) as base_model_slug
    from public.v2_models model
    where model.model_slug = lower(trim(p_model_slug))
      and model.hidden = false
      and model.status <> 'disabled'
  )
  select
    model.model_slug as model_id,
    model.name,
    model.variant_kind
  from public.v2_models model
  cross join requested
  where (
      model.model_slug = requested.base_model_slug
      or model.base_model_slug = requested.base_model_slug
    )
    and model.hidden = false
    and model.status <> 'disabled'
  order by
    case when model.variant_kind = 'standard' then 0 else 1 end,
    model.name,
    model.model_slug;
$$;

grant execute on function public.get_v2_model_variants(text)
  to anon, authenticated, service_role;

comment on function public.get_v2_model_variants(text)
  is 'Returns the visible base/free sibling identities for a canonical V2 model slug.';
