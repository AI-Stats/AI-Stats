# Trust materials evidence inventory

This register records the repository evidence used for Phaseo's public trust
materials. It is an internal maintenance document, not a public assurance
report or legal opinion.

**Review date:** 30 August 2026
**Evidence scope:** repository at `3f5e09520`, the public pages at
`phaseo.app/privacy`, `phaseo.app/terms`, `phaseo.app/trust`, and the public
status page
**Operator named in current policies:** Daniel Butler, trading as Phaseo

## Publication plan

| Page | Reader goal | Publication status |
| --- | --- | --- |
| `/trust` | Understand Phaseo's current assurance posture and find detailed material | Publish as the index; keep claim-state labels visible |
| `/trust/security` | Review architecture, data flows, current controls, limitations, and shared responsibilities | Publish as a self-attested security whitepaper |
| `/trust/subprocessors` | Identify core service providers, optional vendors, and customer-directed recipients | Publish as a dated schedule with a clear role taxonomy |
| `/trust/dpa` | Review a UK/EU-oriented processor addendum before requesting execution | Publish as a non-binding first draft with visible legal-review fields |

The public pages must link to the Privacy Policy, Terms of Service, status
page, and vulnerability reporting process. The DPA must not be presented as
incorporated into the Terms or executed until its bracketed fields have been
completed and qualified counsel has approved it.

## Claim model

- **Available:** observable product or process available today.
- **Gated:** implemented but limited by entitlement, configuration, or feature
  gate.
- **Self-attested:** supported by Phaseo's code, configuration, or policy, but
  not independently audited.
- **Planned:** intended work with no delivery commitment.
- **Independently certified:** supported by an external certification. Phaseo
  has no claims in this state as of the review date.

## Evidence inventory

| Topic | Evidence | Supported public statement | State | Maintenance note |
| --- | --- | --- | --- | --- |
| Service operator and governing law | `apps/web/src/app/(legal)/privacy/page.tsx`; `apps/web/src/app/(legal)/terms/page.tsx` | Daniel Butler trades as Phaseo; the Terms select England and Wales law | Published policy | Legal review is still required for the DPA party name, service address, and execution block |
| Public hosting and transport | `apps/api/wrangler.toml`; `apps/web/next.config.mjs`; HTTPS-only upstream URLs throughout `apps/api/src/providers` and executors | Public web and API traffic is delivered over HTTPS; Cloudflare fronts the public service and hosts the Gateway Worker | Self-attested | Do not claim a particular TLS version without production configuration evidence |
| Web hosting | Live response headers include Vercel deployment headers behind Cloudflare | Vercel hosts the Next.js application; Cloudflare provides the public edge/DNS layer | Self-attested | Re-check after hosting changes |
| Database and authentication | Supabase clients in both applications; RLS migrations under `supabase/migrations` | Supabase provides authentication and the primary relational data service; workspace data uses database access policies and service boundaries | Self-attested | Do not imply every table has an identical policy; cite scoped examples only |
| Gateway metadata | `docs/architecture/v2-data-model.md`; request and usage migrations | Phaseo stores request, routing, usage, billing, latency, and error metadata | Self-attested | Retention periods for general metadata are not yet codified; disclose that absence |
| Default request content | `apps/api/src/core/response-cache.ts`; `apps/api/src/pipeline/surfaces/text-generate.ts`; `apps/api/src/pipeline/after/index.ts` | Eligible non-streaming text responses may be cached in Upstash Redis for 300 seconds by default; configured preset TTLs are clamped to 30 seconds–24 hours | Self-attested | This contradicts the older blanket statement that full outputs are never persistently stored. Public copy must include the cache exception |
| Request fingerprints | `apps/api/src/core/response-cache.ts` | The cache key is derived from a SHA-256 digest of the request context; the cached record contains the response body, not the raw request body | Self-attested | Upstash still processes the cache key, workspace identifier, output, and response metadata |
| Private I/O logging | `apps/api/src/pipeline/audit/io-logging.ts`; `apps/web/src/components/(gateway)/settings/privacy/PrivacySettingsClient.tsx`; `supabase/migrations/20260705102040_io_log_retention_billing.sql` | Feature-gated, workspace-controlled logging can store request, response, and optional provider payloads in private Cloudflare R2 for 90, 180, or 365 days | Gated | The default workspace setting is off. Retention deletion code should remain covered by operational monitoring |
| Optional data contribution | `apps/api/src/pipeline/classification/data-contribution.ts`; `apps/api/src/pipeline/classification/classifier-worker.ts`; data-contribution migrations and settings UI | Opted-in successful, non-BYOK request content is redacted, stored in private R2 for up to 30 days, and a configured sample is sent to OpenAI with `store: false` for classification | Available/gated | Redaction is best-effort and must not be described as a guarantee that all personal or secret data is removed |
| Customer-selected model providers | Provider executors and the routable catalogue under `packages/data/catalog/src/data/api_providers` | Request content and necessary metadata are sent to the provider selected directly or by the customer's routing configuration | Available | Provider identity and role vary by route. The live catalogue is the maintainable source; legal counsel must confirm controller/processor classification |
| Response and routing cache | `apps/api/src/runtime/env.ts`; `apps/api/src/core/response-cache.ts` | Upstash supplies short-lived response caching when configured | Self-attested | It is a core subprocessor whenever the production Redis binding is enabled |
| Credentials | `apps/web/src/lib/byok/crypto.ts`; `apps/api/src/lib/oauth/service.ts`; key helpers and webhook-secret encryption | BYOK credentials use AES-256-GCM encryption before database storage; API and management keys are stored as one-way HMAC/PBKDF2-derived values; OAuth secrets use one-way derived values | Self-attested | Avoid the older oversimplification that every OAuth client secret is a plain peppered SHA-256 hash |
| Identity and authorisation | OAuth scopes/consent routes; workspace membership and RLS migrations; SAML and SCIM code/migrations | Scoped API/OAuth permissions, revocation, workspace roles, and consent screens are implemented; SAML and SCIM are gated enterprise features | Available/gated | No claim of universal MFA enforcement or universal SSO coverage |
| Feature flags | Statsig server/client integration and Gateway gate checks | Statsig receives stable/user/workspace identifiers and, for authenticated web users, email for feature evaluation | Self-attested | List Statsig as a core product-operations subprocessor while enabled |
| Website analytics | `apps/web/src/app/layout.tsx`; analytics components; `apps/web/next.config.mjs` | Google Analytics and Vercel Web Analytics run only after the site's analytics-consent state permits them; PostHog endpoints are configured for product telemetry where a key is enabled | Self-attested | Confirm the production PostHog key and exact capture configuration before listing it as always active |
| Email | Resend integrations in both applications | Resend processes recipient contact data and message content for transactional and operational email | Self-attested | Confirm retention and selected region with the vendor account |
| Support | Tawk widget on the contact page; Notion support integration | Tawk.to and Notion process support contact details and message/ticket content when those channels are used | Optional | Keep separate from always-on core infrastructure |
| Billing | Stripe integrations and current Terms/Privacy Policy | Stripe processes billing identity, transaction, and payment-method data; Phaseo does not store full card numbers | Published policy/self-attested | Do not claim Phaseo is PCI DSS certified |
| Documentation | Mintlify rewrite/proxy configuration | Mintlify hosts Phaseo documentation and receives documentation request telemetry | Self-attested | Confirm account region and analytics settings |
| Status and incidents | DNS CNAME to `statuspage.incident.io`; public status page; incident outreach code | incident.io hosts the public status page; Phaseo publishes current incidents there when the process is used | Available | No contractual uptime SLA and no independently tested incident-response claim |
| Internal notifications | Discord webhook integrations for account, billing, and operational events | Discord may receive masked contact data and operational/billing event summaries | Self-attested | Confirm which production webhooks remain enabled and minimise event payloads |
| Vulnerability disclosure | `SECURITY.md`; GitHub private advisory link; `security@phaseo.app` | Private reports are accepted and Phaseo targets acknowledgement within three business days | Available | A target is not a contractual response SLA |
| Independent assurance | Existing `/trust` page and repository audit reports | No SOC 2 or ISO 27001 certification, independent penetration test, or independent audit is claimed | Self-attested limitation | Re-review before any assurance claim changes |

## Gaps and required review

### Factual review before treating the DPA as executable

- Phaseo's service address and any registration or tax identifiers.
- Production regions and transfer mechanisms for Cloudflare, Vercel,
  Supabase, Upstash, Resend, Statsig, PostHog, Google, Notion, Tawk.to,
  incident.io, Discord, and Mintlify.
- Which optional vendors and production analytics keys are currently enabled.
- General account, request-metadata, billing, support, backup, and log retention
  schedules. The repository does not establish one complete retention policy.
- Backup, restore, business-continuity, employee/contractor access-review, and
  security-training practices. No public claim should be made until evidence is
  recorded.
- A maintained notification mechanism for future subprocessor changes.

### Legal review

- Whether each model provider acts as Phaseo's subprocessor, an independent
  controller, or another role for each route and contract.
- The UK/EU controller-processor allocation, international-transfer mechanism,
  audit language, liability, governing-law interaction, and deletion/return
  obligations in the DPA.
- Whether the existing Privacy Policy's blanket statement that model providers
  “usually act as independent controllers” is accurate for Phaseo's contracted
  API accounts.
- Whether the DPA should be incorporated into online Terms, executed on
  request, or both.

## Review cadence

Review this register and the public trust pages at least quarterly and whenever
Phaseo changes a hosting, storage, analytics, support, payment, identity, email,
status, or model-processing provider. Update the dated review field and tests in
the same pull request.
