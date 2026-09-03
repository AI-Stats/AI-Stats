# OpenAI GPT-6 readiness

## Evidence

On 3 September 2026, OpenAI's public `openai-cua-sample-app` repository added
container directories named `gpt6-js-image` and `gpt6-py-image` in commit
[`4e4a6ae`](https://github.com/openai/openai-cua-sample-app/commit/4e4a6ae43e572e115ca4f7c5a5c1239f9f3aa969).
The container README also names `gpt-6-astra` as the model selected by the API
client "for projects with access." This verifies the exact model ID and
restricted availability. It does not establish pricing, limits, general public
availability, a release date, regions, or the model's full capability set.

OpenAI's [Path to Astra](https://openai.com/index/path-to-astra/) update describes
Astra as a significant increase over GPT-5.6 Sol in cybersecurity capability and
token efficiency, its most aligned model to date, and its first model to reach
the Critical cybersecurity capability threshold. OpenAI says availability is
coming soon but does not give a launch date. A September 3 release remains an
expectation, not a confirmed catalog fact.

## What is ready

- The authenticated OpenAI `/v1/models` watcher accepts model IDs without a
  GPT-version allowlist.
- A partially verified, non-routable `openai/gpt-6-astra` catalog entry records
  only facts supported by OpenAI's documentation.
- Provider validation includes a future-major-version fixture so a later
  refactor cannot silently filter GPT-6 IDs.
- Unknown upstream IDs are included in private GitHub triage issues even though
  routine Discord alerts are restricted to known catalog models.

## Launch gates

Do not add a price card, enable a provider route, or publish unsupported model
claims until OpenAI publishes the corresponding fact. At launch:

1. Confirm `gpt-6-astra` through an authenticated OpenAI `/v1/models` response
   and retain the official repository reference as the initial source.
2. Verify supported endpoints, input/output modalities, context and output
   limits, tool and structured-output support, reasoning controls, regions, and
   service tiers against official documentation and a live API probe.
3. Add the canonical model, OpenAI and OpenAI EU provider routes only where
   documented, and exact price cards. Keep routing disabled until contract and
   billing tests pass.
4. Run `pnpm data:prep-pr` to sync the manifest and generated SDK surfaces and
   validate catalog, pricing, gateway, and documentation data.
5. Enable routing only after an authenticated smoke test confirms request,
   streaming, usage accounting, tool calls, and error handling.

Guesses must remain in this readiness note, not in production catalog data.
