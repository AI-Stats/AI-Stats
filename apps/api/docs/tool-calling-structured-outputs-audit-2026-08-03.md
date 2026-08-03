# Tool calling and structured outputs audit

Date: 2026-08-03

## Scope

This review covers the public Chat Completions, Responses, and Anthropic Messages request surfaces; the canonical intermediate representation; capability-aware provider selection; every registered production `text.generate` executor; streaming and buffered response encoding; the retained legacy adapter registry; and the public model-page capability presentation.

The production path is the executor-based IR pipeline. The adapter registry under `apps/api/src/providers` is retained for compatibility and is not used for production text execution.

## Request and routing findings

- All three public text protocols decode tools, tool choices, tool calls, tool results, and response formats into the same IR.
- Tool use inferred from message or Responses input history is treated as a `tools` requirement even when a new tools array is omitted.
- JSON Schema response formats require both `response_format` and `structured_outputs` support.
- Provider selection is driven by the active route's parameter metadata. Required-parameter routing rejects incompatible routes; ordinary routing prefers compatible routes and the dedicated response-format stages remove incompatible routes before execution.
- Unsupported structured-output requests fail before an upstream call when no active route advertises support.

## Executor findings

Every provider registered with a `text.generate` executor is exercised by the shared executor matrix. The matrix covers tool requests, tool responses, JSON Schema requests, streaming, and buffered operation across the public protocols.

The provider implementations fall into these transport families:

- OpenAI-compatible chat and Responses transports share canonical request, response, and stream transforms. Provider-specific sanitisation and quirks operate after IR conversion.
- OpenAI and Azure use the same canonical tool and response-format mapping with provider route selection.
- Anthropic maps function tools and tool results to native content blocks. JSON-object and JSON-Schema requests use the executor's documented instruction-based compatibility path.
- Google AI Studio maps functions, function responses, tool configuration, and response schemas to Gemini request and response parts.
- Google Vertex uses its OpenAI-compatible endpoint mapping for text generation.
- Amazon Bedrock uses its registered OpenAI-compatible text transport.

No production provider bypasses capability validation. The legacy adapters remain isolated from the production path.

## Response findings

- Chat completion tool-call deltas are assembled into canonical tool calls before buffered responses are encoded.
- Responses function-call items and function-call-output history round-trip through the IR.
- Anthropic tool-use blocks and tool-result blocks round-trip through the IR.
- Streaming transforms preserve tool-call identifiers, names, argument fragments, finish reasons, and usage.
- Structured-output content remains ordinary assistant text at the response boundary; schema enforcement is an upstream capability rather than a separate response type.

## Change made from this review

The API and executor paths already have cross-provider regression coverage and no transport defect was found that justified changing provider behaviour in this pull request.

The missing surface was model-page discoverability. Model FAQs now resolve tool-calling and structured-output support from the existing active-route gateway metadata. They report supported, unsupported, inactive, and unknown states without inferring capabilities from marketing copy or static model descriptions. Because the answer uses route parameter metadata, it updates with provider availability and can truthfully reflect support when only some routes are compatible.

## Follow-up guardrails

- New text providers must be added to `EXECUTORS_BY_PROVIDER`; the executor matrix discovers them from that registry.
- Route capability metadata must advertise `tools`, `tool_choice`, `response_format`, and `structured_outputs` independently.
- A model-level capability must not be presented as available unless an active route advertises the corresponding request parameter.
