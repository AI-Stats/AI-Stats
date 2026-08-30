# Auto-router architecture

## Scope

The first auto-router release is an opt-in model-selection layer for the three
text-generation endpoints. A request uses `model: phaseo/auto` and supplies two
to eight exact model IDs in `routing.auto.allowed_models`. It does not discover
or add models, route non-text endpoints, or persist workspace configuration.

This boundary makes rollout reversible and keeps model selection separate from
the existing provider selector. The auto-router chooses a model. The provider
router then chooses an offer for that model using its existing health, price,
latency, throughput, residency, privacy, and rollout controls.

## Request flow

1. Parse and bound the explicit allow-list.
2. Classify the workload locally from request shape and bounded text signals.
3. Resolve every allow-listed model against the requested endpoint.
4. Apply workspace model restrictions, guardrails, provider restrictions,
   privacy policy, and request provider constraints.
5. Exclude models whose remaining providers all have open circuit breakers.
6. Load relevant non-self-reported benchmark results for eligible models.
7. Normalize quality, combined input/output token price, recent latency, and
   reliability within the eligible set.
8. Apply the requested objective weights and use allow-list order as the stable
   tie-breaker.
9. Run the selected model through the normal provider selector.
10. On a retryable response, rerun the complete pipeline with each ranked
    fallback model.

The algorithm version is recorded as `auto-router-v1`. Changes to workload
classes, benchmark sets, factor definitions, or weights require a new version
and an offline comparison against the previous version.

## Classification and privacy

Classification is deterministic and runs inside the Gateway worker. It uses
request structure (tools and structured-output configuration), a maximum of
16,384 characters of request text, task cues, and prompt length. It emits only
the workload label and named signals. Prompt fragments, hashes, embeddings, and
classifier inputs are not written to routing diagnostics.

Structural signals are language-independent, but lexical task cues are
English-first in `auto-router-v1`. Unmatched non-English requests deliberately
fall back to the general workload. Evaluation must segment by language before
adding multilingual cues or a learned classifier.

No classifier model or external classification service is called. Catalogue
queries contain model IDs and benchmark IDs only.

## Eligibility and availability

The allow-list is authoritative. There is no default pool and no wildcard in
the first release. A candidate is excluded when:

- the model or endpoint cannot be resolved;
- workspace or account model policy blocks it;
- provider and privacy policy leave no compliant offer; or
- every compliant provider has an open circuit breaker.

The request fails closed when no candidate remains. Missing benchmark, price,
or latency data is a neutral score rather than an eligibility failure. This
keeps telemetry degradation from causing an outage while preventing it from
expanding the pool.

## Quality, cost, latency, and reliability

Each workload maps to a small set of relevant Phaseo catalogue benchmarks.
Only non-self-reported results are read. Scores are normalized per benchmark
within the eligible set and averaged for the quality factor. This avoids
combining unrelated raw scales.

Cost is the lowest available provider's combined listed price for one million
input and one million output text tokens. Latency is the lowest recent 60-second
EWMA among eligible providers. Reliability is the best recent provider success
estimate. The existing provider router remains responsible for the final
offer-level tradeoff and attempt order.

The objective weights are:

| Objective | Quality | Reliability | Latency | Cost |
| --- | ---: | ---: | ---: | ---: |
| balanced | 0.45 | 0.25 | 0.15 | 0.15 |
| quality | 0.70 | 0.15 | 0.05 | 0.10 |
| cost | 0.25 | 0.20 | 0.10 | 0.45 |
| latency | 0.25 | 0.25 | 0.40 | 0.10 |

## Artificial Analysis decision

Artificial Analysis has useful model-level quality, price, latency, and
throughput data, and Phaseo already has a separate catalogue sync. It is not a
permitted auto-router input under the published terms reviewed on 30 August
2026.

The [Data Platform Terms, version 1.1](https://artificialanalysiscdn.com/legal/ProDataPlatformTerms.pdf)
define a model-selection product as a competitive product, prohibit using the
data to operate or improve such a third-party product without prior written
consent, and restrict using data to improve an algorithm or system. The
[Data API documentation](https://artificialanalysis.ai/data-api/docs) also says
commercial access and additional rights are negotiated per organization.

Therefore the auto-router benchmark map excludes Artificial Analysis indices
and measurements. Phaseo should not enable them without a signed order form or
written permission that explicitly covers production model selection,
derived scoring, customer-facing diagnostics, retention, and attribution. Any
future integration must also define deletion behavior when the license ends.

## Explainability and failure modes

The bounded routing diagnostic records:

- workload and classification signal names;
- objective and algorithm version;
- selected and fallback model IDs;
- eligible and excluded candidates with reason codes;
- normalized factor scores and final score;
- benchmark IDs used and whether data was available, unmatched, unavailable,
  or skipped during a fallback; and
- eligible provider count.

Expected failure modes include stale benchmark coverage, cold health state,
missing price cards, catalogue lookup failures, all providers opening their
breakers, and a fallback becoming ineligible between attempts. Benchmark lookup
failure degrades to neutral quality. Eligibility and policy failures remain
fail-closed. Fallbacks run only after `429`, `500`, `502`, `503`, or `504` and
are independently authorized on every attempt.

## Evaluation and rollout

Before widening access:

1. Build a versioned, content-safe evaluation set covering every workload and
   important application distribution.
2. Compare `auto-router-v1` with fixed-model and cheapest-model baselines on
   task success, judge preference, policy compliance, cost, time to first
   token, total latency, and fallback rate.
3. Report selection regret against the best allow-listed model, segmented by
   workload, language, tool use, context length, and objective.
4. Shadow the router without changing the selected model, then canary it on
   dedicated API keys or a small deterministic traffic split.
5. Alert on no-eligible-model rate, policy exclusions, benchmark coverage,
   selection distribution drift, cost drift, and fallback rate.
6. Roll back by stopping requests from using `phaseo/auto`; fixed model IDs and
   existing provider routing are unchanged.

Promotion requires better cost-adjusted task success than the fixed-model
baseline without a material regression in policy compliance, tail latency, or
error rate. Persisted preset and dashboard controls should follow only after
the request-scoped contract meets that bar.
