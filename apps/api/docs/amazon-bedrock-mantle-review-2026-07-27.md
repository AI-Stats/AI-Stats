# Amazon Bedrock Mantle review — 2026-07-27

## Outcome

The `amazon-bedrock` gateway provider now targets the regional Amazon Bedrock
Mantle endpoint exclusively. It does not construct or call the Bedrock Runtime
`Converse` or `ConverseStream` APIs.

AWS recommends Mantle for new applications. Mantle exposes OpenAI-compatible
Responses and Chat Completions at `/v1`, plus Anthropic-native Messages at
`/anthropic/v1/messages`.

## Runtime policy

| Request/model | Mantle route |
| --- | --- |
| Anthropic Claude without JSON Schema output | `POST /anthropic/v1/messages` |
| Anthropic Claude with JSON Schema output | Rejected as unsupported |
| OpenAI GPT-5.4, GPT-5.5, and GPT-5.6 families | `POST /v1/responses` |
| Other text models from Chat Completions clients | `POST /v1/chat/completions` |
| Other text models from Responses clients | `POST /v1/responses` |

AWS states that `output_config.format` is unsupported on Mantle Messages and
documents Claude structured output through Converse or InvokeModel on Bedrock
Runtime. Because this integration is intentionally Mantle-only, Claude JSON
Schema requests are rejected explicitly rather than silently leaving Mantle or
assuming undocumented parity through another Mantle protocol.

## Configuration

- Default endpoint: `https://bedrock-mantle.us-east-1.api.aws`
- Region override: `AMAZON_BEDROCK_REGION`
- Endpoint override: `AMAZON_BEDROCK_MANTLE_BASE_URL`
- Bedrock API key: `AMAZON_BEDROCK_API_KEY`
- Optional SigV4 credentials: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and
  `AWS_SESSION_TOKEN`
- SigV4 service: `bedrock-mantle`

A configured `bedrock-runtime.*.amazonaws.com` URL is rejected with
`amazon_bedrock_mantle_endpoint_required` so a stale Converse-era setup cannot
silently use the wrong service.

### Cloudflare deployment

The non-secret region and endpoint are declared in both `wrangler.toml` and
`wrangler.staging.toml`. Configure the API key as a Worker secret; do not add it
to either TOML file:

For local development, copy `apps/api/.dev.vars.example` to
`apps/api/.dev.vars` and replace the placeholder key.

```bash
# Production Worker
pnpm exec wrangler secret put AMAZON_BEDROCK_API_KEY --config apps/api/wrangler.toml

# Staging Worker
pnpm exec wrangler secret put AMAZON_BEDROCK_API_KEY --config apps/api/wrangler.staging.toml
```

For SigV4 instead of a Bedrock API key, store `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, and optionally `AWS_SESSION_TOKEN` as Worker secrets.
The configured base URL must use the official
`bedrock-mantle.<region>.api.aws` hostname; arbitrary production overrides are
rejected.

## Catalog and contract state

The provider metadata now identifies the Mantle base URL, supported auth
environment, routing status, and official API/model compatibility sources. The
active gateway offer currently contains Claude Sonnet 5; the remaining Amazon
Bedrock catalog rows are retained as inactive inventory until explicitly
enabled.

The single public `amazon-bedrock` provider reference documents Mantle Chat
Completions, Responses, and Messages. Mantle is a transport implementation, not
a second provider identity.

## Official references

- https://docs.aws.amazon.com/bedrock/latest/userguide/apis.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/inference-chat-completions-mantle.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/inference-messages-api.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/models-endpoint-availability.html

## Validation

- Amazon executor: 10/10 tests passed.
- OpenAI-compatible route registry: 67/67 tests passed.
- Provider-reference package: 125/125 tests passed.
- API TypeScript typecheck passed.
- Gateway catalog/pricing validation passed.
- OpenAPI lint passed with no findings.
- OpenAPI IR generation and all generator package builds passed.

No credentialed live Mantle request was run as part of this review.
