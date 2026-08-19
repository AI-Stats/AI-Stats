revoke all on function public.refresh_public_model_user_usage_daily(timestamptz, timestamptz)
from public, anon, authenticated;

grant execute on function public.refresh_public_model_user_usage_daily(timestamptz, timestamptz)
to service_role;
