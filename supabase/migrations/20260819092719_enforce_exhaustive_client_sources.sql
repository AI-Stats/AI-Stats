-- Source is a closed, gateway-owned taxonomy for the technical request
-- surface. App attribution is independent and user supplied.
update public.v2_request_facts
set safe_metadata = jsonb_set(
  safe_metadata,
  '{client_source,name}',
  to_jsonb(
    case client_source_id
      when 'api' then 'Direct HTTP'
      when 'phaseo-agent-typescript' then 'Phaseo Agent TypeScript SDK'
    end
  ),
  true
)
where (client_source_id = 'api' and client_source_name <> 'Direct HTTP')
   or (client_source_id = 'phaseo-agent-typescript' and client_source_name <> 'Phaseo Agent TypeScript SDK');

update public.gateway_requests
set detail_metadata = jsonb_set(
  detail_metadata,
  '{client_source,name}',
  to_jsonb(
    case client_source_id
      when 'api' then 'Direct HTTP'
      when 'phaseo-agent-typescript' then 'Phaseo Agent TypeScript SDK'
    end
  ),
  true
)
where (client_source_id = 'api' and client_source_name <> 'Direct HTTP')
   or (client_source_id = 'phaseo-agent-typescript' and client_source_name <> 'Phaseo Agent TypeScript SDK');

alter table public.v2_request_facts
  drop constraint if exists v2_request_facts_client_source_kind_check,
  drop constraint if exists v2_request_facts_client_source_detection_check,
  drop constraint if exists v2_request_facts_client_source_id_not_app_check,
  drop constraint if exists v2_request_facts_client_source_contract_check,
  add constraint v2_request_facts_client_source_contract_check check (
    (
      client_source_id is null
      and client_source_name is null
      and client_source_kind is null
      and client_source_version is null
      and client_source_detection is null
    )
    or (
      client_source_id is not null
      and client_source_name is not null
      and client_source_kind is not null
      and client_source_detection is not null
      and (client_source_id, client_source_name, client_source_kind) in (
      ('api', 'Direct HTTP', 'api'),
      ('phaseo-typescript', 'Phaseo TypeScript SDK', 'sdk'),
      ('phaseo-python', 'Phaseo Python SDK', 'sdk'),
      ('phaseo-go', 'Phaseo Go SDK', 'sdk'),
      ('phaseo-java', 'Phaseo Java SDK', 'sdk'),
      ('phaseo-csharp', 'Phaseo C# SDK', 'sdk'),
      ('phaseo-cpp', 'Phaseo C++ SDK', 'sdk'),
      ('phaseo-php', 'Phaseo PHP SDK', 'sdk'),
      ('phaseo-ruby', 'Phaseo Ruby SDK', 'sdk'),
      ('phaseo-rust', 'Phaseo Rust SDK', 'sdk'),
      ('phaseo-agent-typescript', 'Phaseo Agent TypeScript SDK', 'agent_sdk'),
      ('phaseo-agent-python', 'Phaseo Agent Python SDK', 'agent_sdk'),
      ('phaseo-agent-go', 'Phaseo Agent Go SDK', 'agent_sdk'),
      ('phaseo-agent-java', 'Phaseo Agent Java SDK', 'agent_sdk'),
      ('phaseo-agent-csharp', 'Phaseo Agent C# SDK', 'agent_sdk'),
      ('phaseo-agent-php', 'Phaseo Agent PHP SDK', 'agent_sdk'),
      ('phaseo-agent-ruby', 'Phaseo Agent Ruby SDK', 'agent_sdk'),
      ('phaseo-agent-rust', 'Phaseo Agent Rust SDK', 'agent_sdk'),
      ('codex', 'Codex', 'coding_agent'),
      ('claude-code', 'Claude Code', 'coding_agent'),
      ('openai-typescript', 'OpenAI TypeScript SDK', 'sdk'),
      ('openai-python', 'OpenAI Python SDK', 'sdk'),
      ('anthropic-typescript', 'Anthropic TypeScript SDK', 'sdk'),
      ('anthropic-python', 'Anthropic Python SDK', 'sdk'),
      ('curl', 'cURL', 'http_client'),
      ('httpie', 'HTTPie', 'http_client'),
      ('postman', 'Postman', 'http_client'),
      ('insomnia', 'Insomnia', 'http_client'),
      ('axios', 'Axios', 'http_client'),
      ('python-requests', 'Python Requests', 'http_client')
      )
      and (
        (
          client_source_id = 'api'
          and client_source_detection = 'unknown'
          and client_source_version is null
        )
        or (
          client_source_id <> 'api'
          and client_source_detection in ('declared', 'user_agent')
          and (client_source_version is null or char_length(client_source_version) <= 64)
        )
      )
    )
  );

alter table public.gateway_requests
  drop constraint if exists gateway_requests_client_source_kind_check,
  drop constraint if exists gateway_requests_client_source_detection_check,
  drop constraint if exists gateway_requests_client_source_id_not_app_check,
  drop constraint if exists gateway_requests_client_source_contract_check,
  add constraint gateway_requests_client_source_contract_check check (
    (
      client_source_id is null
      and client_source_name is null
      and client_source_kind is null
      and client_source_version is null
      and client_source_detection is null
    )
    or (
      client_source_id is not null
      and client_source_name is not null
      and client_source_kind is not null
      and client_source_detection is not null
      and (client_source_id, client_source_name, client_source_kind) in (
      ('api', 'Direct HTTP', 'api'),
      ('phaseo-typescript', 'Phaseo TypeScript SDK', 'sdk'),
      ('phaseo-python', 'Phaseo Python SDK', 'sdk'),
      ('phaseo-go', 'Phaseo Go SDK', 'sdk'),
      ('phaseo-java', 'Phaseo Java SDK', 'sdk'),
      ('phaseo-csharp', 'Phaseo C# SDK', 'sdk'),
      ('phaseo-cpp', 'Phaseo C++ SDK', 'sdk'),
      ('phaseo-php', 'Phaseo PHP SDK', 'sdk'),
      ('phaseo-ruby', 'Phaseo Ruby SDK', 'sdk'),
      ('phaseo-rust', 'Phaseo Rust SDK', 'sdk'),
      ('phaseo-agent-typescript', 'Phaseo Agent TypeScript SDK', 'agent_sdk'),
      ('phaseo-agent-python', 'Phaseo Agent Python SDK', 'agent_sdk'),
      ('phaseo-agent-go', 'Phaseo Agent Go SDK', 'agent_sdk'),
      ('phaseo-agent-java', 'Phaseo Agent Java SDK', 'agent_sdk'),
      ('phaseo-agent-csharp', 'Phaseo Agent C# SDK', 'agent_sdk'),
      ('phaseo-agent-php', 'Phaseo Agent PHP SDK', 'agent_sdk'),
      ('phaseo-agent-ruby', 'Phaseo Agent Ruby SDK', 'agent_sdk'),
      ('phaseo-agent-rust', 'Phaseo Agent Rust SDK', 'agent_sdk'),
      ('codex', 'Codex', 'coding_agent'),
      ('claude-code', 'Claude Code', 'coding_agent'),
      ('openai-typescript', 'OpenAI TypeScript SDK', 'sdk'),
      ('openai-python', 'OpenAI Python SDK', 'sdk'),
      ('anthropic-typescript', 'Anthropic TypeScript SDK', 'sdk'),
      ('anthropic-python', 'Anthropic Python SDK', 'sdk'),
      ('curl', 'cURL', 'http_client'),
      ('httpie', 'HTTPie', 'http_client'),
      ('postman', 'Postman', 'http_client'),
      ('insomnia', 'Insomnia', 'http_client'),
      ('axios', 'Axios', 'http_client'),
      ('python-requests', 'Python Requests', 'http_client')
      )
      and (
        (
          client_source_id = 'api'
          and client_source_detection = 'unknown'
          and client_source_version is null
        )
        or (
          client_source_id <> 'api'
          and client_source_detection in ('declared', 'user_agent')
          and (client_source_version is null or char_length(client_source_version) <= 64)
        )
      )
    )
  );
