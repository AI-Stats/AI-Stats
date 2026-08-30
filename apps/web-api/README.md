# Web API Worker

This Worker owns the server-side API used by the Phaseo web application. It is separate from the public Gateway API and keeps authenticated application data out of browser-only code.

## Responsibilities

- serve cacheable public catalogue and reference data;
- authorize workspace and account reads and mutations;
- proxy authenticated playground requests;
- keep user, workspace, billing, and credential data private and uncached;
- apply route-specific validation, authorization, and cache policy.

The route implementation is under `src/routes`. Runtime bindings are declared in `src/env.ts` and `wrangler.toml`.

## Local development

Use non-production values in `apps/web-api/.dev.vars`, then start the Worker:

```bash
pnpm --filter @phaseo/web-api dev
```

Start the web application with its local Web API origin:

```bash
WEB_API_ORIGIN=http://127.0.0.1:8788 pnpm --filter @phaseo/web dev
```

Never use production credentials for local development or commit `.dev.vars`.

## Validation

```bash
pnpm --filter @phaseo/web-api lint
pnpm --filter @phaseo/web-api test
pnpm --filter @phaseo/web-api build
```
