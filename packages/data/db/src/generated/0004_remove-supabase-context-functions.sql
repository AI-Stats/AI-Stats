-- Authorization now lives in typed application services. Remove the imported
-- PostgREST RPC surface that derived identity from Supabase request settings.
drop function if exists public.get_workspace_key_usage(uuid, timestamp with time zone);
drop function if exists public.get_workspace_model_last_used(uuid, timestamp with time zone);
drop function if exists public.reorder_v2_byok_key(uuid, uuid, text);

drop function if exists public.approve_workspace_join_request(uuid);
drop function if exists public.is_admin();
drop function if exists public.is_admin_user();
drop function if exists public.is_team_owner(uuid);
drop function if exists public.is_workspace_admin(uuid);
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.monthly_spend_prev_cents(uuid);
drop function if exists public.mtd_spend_cents(uuid);
drop function if exists public.redeem_credit_code(text, uuid);
drop function if exists public.reject_workspace_join_request(uuid);
drop function if exists public.tg_system_settings_audit();

drop function if exists auth.uid();
