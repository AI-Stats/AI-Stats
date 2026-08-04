# Database-driven provider adapters

## Decision

Phaseo will move provider identity, capability assignment, endpoints, model
restrictions, routing policy, parameter support and compatibility rules into a
versioned database control plane. Application code remains a finite, versioned
library of safe protocol mechanics. Arbitrary code is never stored or executed
from the database.

The gateway data plane executes immutable compiled plans. It does not join or
interpret draft control-plane tables on the request path.

## Ownership boundary

The database owns:

- provider, offer and model-route identity;
- provider-by-capability adapter selection;
- endpoints, API versions and logical auth-profile references;
- native, emulated, ignored, unsupported and unknown parameter support;
- declarative parameter-combination constraints;
- regional and service-tier variants;
- evidence provenance and review timestamps;
- immutable release and rollback state.

Code owns:

- request and response codecs;
- stream parsers;
- authentication signers;
- bounded HTTP transport and retry mechanics;
- usage and error normalisation;
- asynchronous job mechanics;
- validation and compilation of control-plane data.

The target invariant is:

> No provider identity, capability assignment, endpoint, model restriction,
> routing decision or compatibility policy is hard-coded in application code.

## Primitive catalogue

Every executable mechanism has a stable, versioned key such as
`openai.chat.request.v1`, `anthropic.messages.request.v1`, `bearer.v1` or
`aws.sigv4.v1`. `v2_adapter_primitives` is an allowlist of keys implemented in
the deployed gateway. A release cannot publish if it references a missing,
disabled or schema-incompatible primitive.

Provider-capability rows assemble these primitives with declarative config.
Adding an API-compatible provider should only require control-plane data. A code
deployment is required only for a genuinely new protocol, authentication method,
wire format or asynchronous execution mechanism.

## Precedence

Configuration is compiled from lowest to highest precedence:

1. capability defaults;
2. capability-adapter defaults;
3. provider family;
4. provider offer or data-policy variant;
5. provider-model route;
6. provider-capability route;
7. region and service-tier variant.

Objects merge recursively; arrays and scalar values replace lower-precedence
values. Equal precedence is a validation error so compilation stays deterministic.

## Constraint language

Compatibility rules use a small fail-closed expression language. The only
operators are `all`, `any`, `not`, `exists`, `equals` and `in`. Outcomes are
`reject`, `warn` or an allowlisted transform. The database cannot contain
JavaScript, SQL fragments, template expressions or arbitrary function names.

Transforms are likewise a finite code-owned set: rename, move, set a constant,
map an enum, clamp, scale, omit, conditionally include, wrap, unwrap and map an
array. Each transform is schema-validated before release publication.

## Release lifecycle

1. An editor creates a draft release and changes control-plane rows.
2. Static validation checks foreign keys, schemas, primitive availability,
   endpoint/auth consistency, evidence freshness and conflicting precedence.
3. Contract tests compile every affected plan and compare generated requests
   and normalised responses with fixtures.
4. Live synthetic tests exercise representative provider-model routes.
5. A reviewer other than the author validates the release.
6. Publication compiles canonical JSON plans, records their hashes and advances
   the single active release pointer atomically.
7. Rollback republishes the last-known-good release pointer; plans are immutable.

An emergency provider, route or capability kill switch remains separate from
ordinary release publication.

## Runtime and caching

The plan key contains release sequence, provider-model route, capability and
route variant. Runtime lookup uses:

- L1: Worker-isolate memory;
- L2: Cloudflare configuration cache;
- L3: the compiled plan in Supabase.

The gateway retains a last-known-good plan and fails closed when a requested
capability has no valid published plan. Draft rows are never read by request
execution.

## Migration sequence

1. Land the additive schema, typed plan contract and compiler boundary.
2. Register existing code mechanics in the primitive catalogue.
3. Import current executor registrations, endpoints and quirks as draft data.
4. Compile plans and run them in shadow mode beside current executors.
5. Migrate representative protocol families: OpenAI-compatible, Anthropic,
   Cohere, Venice, Cloudflare, MiniMax and Bedrock.
6. Cut over gradually by provider, capability, model, workspace and percentage.
7. Add the administrative diff, evidence, test, publish and rollback workflow.
8. Remove hard-coded executor registration, provider aliases, global quirks and
   duplicated endpoint/capability fixtures after full parity is demonstrated.

The first migration is additive and grants no access to `anon` or
`authenticated`. RLS is enabled as defence in depth; gateway/admin access uses
explicit service-role grants.
