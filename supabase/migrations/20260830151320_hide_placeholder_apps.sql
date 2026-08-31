-- Placeholder rows were created by legacy attribution requests that carried no
-- meaningful app identity. Keep their history, but remove them from public use.
update public.api_apps
set is_public = false,
    is_active = false,
    updated_at = now()
where lower(btrim(title)) in ('app', 'unknown app', 'untitled')
  and lower(btrim(app_key)) = 'about:blank'
  and lower(btrim(url)) = 'about:blank';
