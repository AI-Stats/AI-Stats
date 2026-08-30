# Phaseo AI SDK 7 Quickstart

Use this example to make one Phaseo request with Vercel AI SDK 7 and the native Phaseo ProviderV4 package.

## Run it

```bash
cd examples/ai-sdk-v7-quickstart
pnpm install
```

Set `PHASEO_API_KEY` in your environment, then run:

```bash
pnpm start
```

Set `PHASEO_MODEL` to use a different current model id. The API key stays in the server-side environment and is never bundled into client code.

To run the native AI SDK reranking example, optionally set `PHASEO_RERANK_MODEL`, then run:

```bash
pnpm rerank
```

## Validate without an API call

```bash
pnpm typecheck
```

The repository CI runs this check against the workspace provider and AI SDK 7 types.
