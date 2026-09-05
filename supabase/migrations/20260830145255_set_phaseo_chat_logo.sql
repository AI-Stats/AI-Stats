-- Historical rows may use either the Phaseo or AI Stats name.
update public.api_apps
set image_url = 'https://phaseo.app/png_logo_light.png',
    updated_at = now()
where lower(btrim(coalesce(title, ''))) in (
    'phaseo chat',
    'ai stats chat',
    'phaseo production validation'
  )
  or lower(rtrim(btrim(coalesce(app_key, '')), '/')) in (
    'phaseo-chat',
    'ai-stats-chat',
    'aistats-chat',
    'https://phaseo.app/chat'
  )
  or lower(rtrim(btrim(coalesce(url, '')), '/')) in (
    'https://phaseo.app/chat',
    'https://phaseo.app/validation'
  );
