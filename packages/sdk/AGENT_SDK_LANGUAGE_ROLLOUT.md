# Agent SDK language rollout

The base SDK is the generated API coverage layer. An Agent SDK is a hand-authored
local runtime that uses the base SDK for gateway model turns. It must not become a
second generated client or a hosted orchestration service.

## Current support

| Language | Base SDK | Agent SDK | Runtime scope |
| --- | --- | --- | --- |
| TypeScript | Published | Conformant | Reference contract with async generators and replayable async streams. |
| Python | Published | Conformant | Python iterators, callback progress, replayable streams, and callable schemas. |
| Go | Published | Conformant | Contexts, goroutine tools, channels, validators, and explicit state interfaces. |
| C# | Published | Conformant | Tasks, cancellation tokens, async enumerables, delegates, and state interfaces. |
| Java | Published | Conformant | Executors, iterable streams, functional interfaces, and application state accessors. |
| PHP | Published | Conformant | Synchronous iteration, callback tools, exact-ID continuation, and application state accessors. |
| Ruby | Published | Conformant | Enumerators, thread-based tools, callback validation, and duck-typed state accessors. |
| Rust | Supported | Supported (synchronous) | Native tool loops, retries, approval/manual-tool pauses, human review, lifecycle events, usage, and serializable run state; async streaming remains additive. |
| C++ | Transport-only preview | Not started | Do not add until the base SDK has a supported CMake package and distribution strategy. |

## Shared Agent SDK contract

Every conformant language must implement these behaviors, using native naming and
iteration primitives where appropriate:

1. Executable tools, deterministic bounded concurrency, timeouts, runtime input/output validation, and selectable fail-run or return-to-model error handling.
2. Per-tool and conditional approvals, exact tool-call-ID approval/rejection on resume, human-in-the-loop callbacks, and manual tools completed with external outputs.
3. Progress-producing tools with preliminary-result events and a final tool result.
4. Real model streaming plus independently consumable text, reasoning, item, tool, and full-event streams.
5. Composable stop predicates for steps, duration, tokens, cost, tool calls, finish reasons, and application-defined conditions.
6. Dynamic model, instructions, sampling parameters and tool sets; mutable application context; and tool-driven next-turn overrides.
7. Serializable run state plus an optional application-owned load/save accessor, with no hosted runtime dependency.
8. Normalized input/output/cached/total token and cost summaries, finish reasons, warnings, tool results, lifecycle events, cancellation, retries, and shared Devtools capture.

The conformance test for each language must combine multiple behaviors in one loop
and verify the messages sent back to the model, not merely check that public types
or helper names exist.

TypeScript is the reference implementation. A new runtime behavior is not considered
cross-language until the equivalent conformance scenario passes in Python, Go, C#,
Java, PHP, and Ruby, or the language package documents a runtime limitation.
Rust 0.1 is supported with an explicitly synchronous contract and will move to
Conformant after real model streaming and independently replayable streams land.

## Recommended order

### Keep the supported seven healthy

The root `test:agent-sdk` commands and CI matrix run the local Agent SDK suites
for TypeScript, Python, Go, C#, Java, PHP, and Ruby. New shared behavior starts in
TypeScript with focused contract tests, then moves to the other languages when the
contract is stable.

### Rust

The `phaseo-agent` crate depends on `phaseo` and follows the base SDK's synchronous
transport model. It defines `ModelClient`, `Tool`, `Agent`, `RunResult`, and a
gateway adapter over `/responses`. Async streaming remains an additive feature;
the synchronous runtime and its serialized continuation contract remain stable.
Before publishing, validate crate metadata, package the base crate, and run the
Rust lifecycle and Agent SDK conformance suites.

### Deferred: C++

Do not publish a C++ Agent SDK from the current transport-only preview. First add
a supported CMake target, `install(TARGETS ...)`, `install(EXPORT ...)`, and a
consumer package configuration; choose and document one registry strategy such as
Conan or vcpkg. Then build a header-first Agent SDK over the existing `Transport`
abstraction and adopt one explicit JSON dependency rather than embedding a parser.

## Keeping API coverage current

OpenAPI changes regenerate base SDKs. Agent SDK source is not regenerated. When
the Responses API or a gateway capability changes, update the relevant gateway
adapter and its contract fixtures, then run the matching Agent SDK suite. Keep the
runtime application-owned: storage, authorization, UI, queues, and deployment are
the integrating application's responsibility.

The CI dependency is deliberate: `sdk-gen` completes before `agent-sdk-tests`, and
the Java Agent SDK test installs the regenerated base Java artifact locally before
compiling. This catches adapter drift while keeping orchestration code hand-authored.
