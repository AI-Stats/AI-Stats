# SDK Overrides

These instructions apply to `packages/sdk` and extend the repository-level `AGENTS.md`.

## Package Families

- The tree contains generated gateway SDKs for TypeScript, Python, Go, C#, Java, PHP, Ruby, C++, and Rust, plus handwritten wrappers and language-specific Agent SDKs.
- Preserve behavioral parity across languages where the public contract is shared, while following each language's established naming, error, async, and packaging conventions.
- Keep high-level handwritten clients thin over generated operations. Expose raw generated clients when that is the established escape hatch rather than duplicating transport logic.

## Generated Code Boundaries

- Files under generated directories such as `src/oapi-gen`, `src/gen`, `lib/gen`, and `src/app/phaseo/gen`, plus files marked generated, must be changed through the canonical OpenAPI/generator pipeline.
- Do not manually patch a generated file. Fix `apps/docs/openapi/v1/openapi.yaml`, the relevant backend under `packages/openapi-backends`, or generator/core logic, then run the scoped `pnpm openapi:gen:<language>` command.
- A full contract change should run `pnpm openapi:gen` so every generated language remains synchronized.
- Review generated diffs for accidental breaking changes, naming drift, missing operations, invalid nullable/union handling, and version churn.

## Handwritten Clients and Compatibility

- Add convenience helpers only when their behavior can be supported consistently and tested without hiding important response fields or errors.
- Preserve authentication headers, base-URL handling, timeout/cancellation behavior, streaming, multipart uploads, pagination, and structured error information.
- Keep OpenAI/Anthropic compatibility layers behaviorally compatible with their documented surfaces; do not silently transform unsupported features.
- Public type or method changes require a changeset and a semver assessment. Do not update version literals manually; use the repository version-sync scripts.

## Validation

- TypeScript: `pnpm test:sdk-ts` and `pnpm packages:build:ts`
- Python: `pnpm test:sdk-py` and `pnpm packages:build:py`
- Lifecycle SDKs: `pnpm test:sdk-lifecycle`
- Full generation: `pnpm openapi:gen`
- Package validation: `pnpm validate:packages`
- Version literals: `pnpm sdk:check-version-literals`

- Run the scoped language test/build while iterating. For cross-language generator or OpenAPI changes, run generation and every affected language's tests.
- Smoke and live tests can contact the deployed gateway and providers. Do not run them without explicit task need, credentials, and user authorization.
- Use deterministic mock transports and fixtures for unit tests; cover sync/async parity, serialization, error mapping, and operation paths where applicable.

## Documentation and Releases

- Keep package READMEs, `SKILL.md` files, examples, and `apps/docs/v1/sdk-reference` aligned with the shipped wrapper surface.
- Follow `packages/sdk/RELEASING.md` for release preparation. Do not edit changelog history or generated release notes as a substitute for a changeset.
- Verify package contents with the established dry-pack/build commands so generated sources, types, licenses, and skills are included as intended.
