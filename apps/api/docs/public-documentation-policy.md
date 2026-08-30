# Public documentation policy

Everything tracked in this repository is public. Documentation committed here must be safe for customers, contributors, and external reviewers to read.

## Appropriate content

- shipped product behavior and public API contracts;
- customer setup, usage, migration, and troubleshooting guidance;
- stable contributor architecture that can be derived from the public source;
- public benchmark methodology and cited provider information.

## Keep elsewhere

- unit economics, margins, internal pricing decisions, and commercial assumptions;
- security audits, unresolved findings, incident reviews, and hardening checklists;
- production identifiers, deployment topology, secret inventories, and operator runbooks;
- rollout ledgers, unannounced roadmaps, internal feature documentation, and implementation gap analyses;
- private provider agreements, contract research, and support or revenue data.

Use the team's private workspace for these records. Do not add them to a tracked `docs` directory, even temporarily.

Run `pnpm docs:public-safety` before publishing documentation changes. The normal `pnpm validate:docs` check also runs this validation.
