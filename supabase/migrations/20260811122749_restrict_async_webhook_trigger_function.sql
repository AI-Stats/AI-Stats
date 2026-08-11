-- Trigger execution does not require clients to call the SECURITY DEFINER
-- trigger function directly.
revoke all on function public.gateway_async_operation_video_webhook_outbox()
  from public, anon, authenticated;
