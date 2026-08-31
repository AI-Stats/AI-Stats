# Documentation Overrides

These instructions apply to `apps/docs` and extend the repository-level `AGENTS.md`.

## Mintlify Structure

- The documentation site uses Mintlify. Pages are Markdown/MDX under `v1`; navigation, redirects, tabs, and API-reference configuration live in `docs.json`.
- Place a page in the existing information architecture before adding it to navigation. Reuse established MDX components and frontmatter conventions.
- Use concise task-oriented titles, descriptive headings, and copy-pasteable examples. Explain prerequisites and expected results before edge cases.
- Prefer links to canonical pages over repeating the same explanation in multiple sections.

## Public Contract and Generated Surfaces

- `openapi/v1/openapi.yaml` is the canonical v1 contract used for SDK generation. Mintlify reads the generated `openapi/v1/openapi.public.yaml`; run `pnpm docs:openapi` after contract changes and never edit the generated file directly.
- SDK reference pages must match the current handwritten wrappers and generated operations for their language. Do not claim convenience helpers or parity that the package does not provide.
- When an API contract changes, update the OpenAPI document, affected guides/examples, generated SDKs, and language reference pages together.
- Do not manually patch generated SDK source to make a documentation example true; fix the specification or handwritten wrapper and regenerate.

## Validation

- Link check: `pnpm docs:links`
- Mintlify validation/build: `pnpm docs:build`
- Run both for navigation changes, renamed pages, API-reference changes, or broad link edits.
- Verify code examples use current Phaseo URLs, model IDs, SDK package names, and authentication conventions. Never include real keys or production customer data.
- Preserve redirects when moving published pages and update inbound links in the same change.

## Writing and Safety

- Separate conceptual explanation, procedures, reference material, and troubleshooting rather than mixing all four into one page.
- State whether examples are production-ready, illustrative, preview-only, or require live-provider credentials.
- Treat tool-calling, redirects, uploads, webhooks, and model-generated arguments as security-sensitive topics; include safe defaults and validation guidance.
- Add changelog entries only for user-visible shipped behavior, and keep historical statements historically accurate.
