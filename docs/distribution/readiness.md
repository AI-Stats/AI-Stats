# Distribution readiness

Last verified: 2026-08-30

This document tracks the work required to turn Phaseo's existing integrations into reliable acquisition and activation channels. It separates code that is ready to distribute from programs that still require product, commercial, or platform work.

## Current distribution inventory

| Channel | Current state | Evidence | Next release gate |
| --- | --- | --- | --- |
| Phaseo CLI | Published as `@phaseo/cli@0.2.3`; supports dedicated credentials and configuration for major coding harnesses | `packages/cli/phaseo`, CLI integration tests, npm registry | Keep setup copy aligned with configuration-only behavior; validate package build, tests, and pack |
| TypeScript SDK | Published as `@phaseo/sdk@2.2.0` | `packages/sdk/sdk-ts`, local compatibility suite | Preserve generated API parity and package lifecycle tests |
| Python SDK | Published as `phaseo@2.0.7` | `packages/sdk/sdk-py`, pytest suite | Preserve generated API parity and wheel/sdist checks |
| Vercel AI SDK | ProviderV4 implementation and major changeset are in the repository; v2.0.0 is queued but npm `latest` remains v1.0.1 for AI SDK 6 | `packages/integrations/ai-sdk-phaseo`, release PR #1280, npm registry | Unit tests, AI SDK 7 compatibility harness, example typecheck, dry-run pack, and green release PR |
| Runnable examples | REST, OAuth, Next.js chat, and AI SDK 7 starters exist | `examples/` | Keep each starter referenced from docs and covered by a deterministic check |
| GitHub Actions | Phaseo's own CI and publishing workflows are mature; no customer-facing Action exists | `.github/workflows` | Validate a standalone action use case before extracting it to a dedicated public repository |
| Provider partnerships | Broad provider catalogue and compatibility tests exist; no standard external submission packet exists | `packages/data/catalog`, `packages/testing/provider-mock`, `apps/api/tests/providers` | Package repeatable compatibility, support, legal, and attribution evidence for each partner |
| Cloud marketplaces | No marketplace entitlement, procurement, or metering adapters exist | Repository search plus platform requirements below | Choose one marketplace and listing model before implementation |

## Priority 1: ship the AI SDK 7 provider

Release only when all of these are true:

- `@phaseo/ai-sdk-provider@2.x` declares `ai@^7` and ProviderV4 dependencies.
- Unit tests and the AI SDK 7 end-to-end compatibility harness pass in CI.
- `npm pack --dry-run` includes compiled JavaScript, declarations, README, and support policy.
- The minimal example typechecks against the workspace provider and AI SDK 7.
- Product docs show the unversioned provider as the default AI SDK 7 install.
- npm `latest` resolves to 2.x after the release PR is merged and published.
- Publish the corrected ProviderV3 artifact as `@phaseo/ai-sdk-provider@1.0.2` with the `ai-sdk-v6` tag. This replaces the old re-export wrapper with Phaseo exports, environment variables, branding, current structured-output handling, and reranking.
- Publish the tested ProviderV2 artifact as `@phaseo/ai-sdk-provider@0.5.0` with the `ai-sdk-v5` tag. Because it is a new version, the OIDC workflow can publish it with a non-default tag without moving `latest`.

After publication, submit a small upstream PR to the [AI SDK community providers directory](https://ai-sdk.dev/providers/community-providers/custom-providers). Include:

- npm package and source links
- supported ProviderV4 model types
- compatibility-test command and latest green run
- support policy and issue tracker
- one minimal `generateText` example

## Priority 2: reduce coding-agent setup failures

Phaseo CLI configures installed coding harnesses. It must not claim that it installs third-party tools unless installation is deliberately reintroduced with verified package sources and platform-specific tests.

Release checks:

- Help, README, and product docs describe the same setup behavior.
- `--dry-run` shows every Phaseo-owned file change.
- Setup creates a per-integration credential without writing it into ordinary config when the harness supports a credential helper.
- Removal restores or deletes only Phaseo-owned values and revokes the dedicated key.
- Model-catalog integrations fall back to the chosen model when discovery is unavailable.

## Priority 3: package provider-partnership evidence

Use one reusable packet for upstream model providers and developer-tool partners:

1. Company and support contacts, security policy, privacy policy, and service terms.
2. Gateway endpoints, authentication, attribution headers, rate-limit behavior, and request-id support.
3. Provider/model discovery evidence from `/v1/models`.
4. Contract coverage for non-streaming, streaming, tools, structured output, errors, and usage accounting.
5. Data handling and retention claims linked to reviewed first-party sources.
6. Launch assets: listing copy, logo, quickstart, status page, and escalation path.

Do not claim a partnership until both organizations have approved public wording. Catalogue support and technical compatibility are not the same as a commercial partnership.

## GitHub Marketplace decision gate

GitHub Marketplace can distribute a Phaseo Action, but the action must first solve a repeatable CI job. The strongest initial candidate is a request smoke check that validates gateway health, authentication, model availability, and one optional low-cost generation without printing credentials.

Before building it:

- confirm at least three customer workflows need the same job
- define secret handling and forked-PR behavior
- make paid generation opt-in
- return structured outputs and request ids
- create the action in a dedicated public repository with one root `action.yml`
- tag immutable releases and maintain a moving major tag

GitHub's current publishing requirements are documented in [Publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace). A monorepo subdirectory is not automatically listed, so Phaseo should extract the action only after the interface is stable.

## Cloud marketplace decision gate

Cloud marketplaces are commercial integrations, not documentation listings. Pick one based on customer demand and Phaseo's hosting strategy.

| Marketplace | Minimum missing product work | Readiness implication |
| --- | --- | --- |
| AWS Marketplace SaaS | Buyer registration, subscription entitlement checks, marketplace billing/metering, account lifecycle, listing assets and EULA | Feasible without moving all infrastructure to AWS, but AWS-hosted designation has stricter architecture rules. See [AWS SaaS product creation](https://docs.aws.amazon.com/marketplace/latest/userguide/saas-create-product.html). |
| Microsoft Marketplace SaaS | Microsoft account and Entra ID sign-in, marketplace landing page, SaaS Fulfillment APIs, subscription lifecycle and webhook handling | A transactable Azure-portal SaaS offer must satisfy Microsoft's Azure-platform requirements. Start with [Plan a SaaS offer](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer). |
| Google Cloud Marketplace SaaS | Vendor onboarding, Google-linked buyer accounts, Partner Procurement API, Pub/Sub lifecycle events, optional usage reporting through Service Control | Requires meaningful Google Cloud consumption and partner approval. See [Offering SaaS products](https://docs.cloud.google.com/marketplace/docs/partners/integrated-saas). |

For the first marketplace, write a separate technical spec covering tenant identity mapping, entitlement state, plan mapping, usage meters, cancellation, refunds, webhook replay, reconciliation, and support ownership. Do not reuse normal Phaseo wallet credit as marketplace entitlement without an explicit accounting design.

## Validation record

Record the exact commands and results in each distribution PR. The minimum relevant set is:

```bash
pnpm --filter @phaseo/ai-sdk-provider test:release
pnpm --filter phaseo-ai-sdk-v7-quickstart typecheck
pnpm --filter @phaseo/cli test
pnpm --filter @phaseo/sdk test
python -m pytest packages/sdk/sdk-py/tests
pnpm docs:links
```

Use live generation only when credentials and provider spend are explicitly authorized. Health, package-registry, and documentation checks should remain safe and read-only.
