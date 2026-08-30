# AI SDK support policy

| Phaseo provider line | Vercel AI SDK | Provider contract | Status |
| --- | --- | --- | --- |
| `2.x` | AI SDK 7 | `ProviderV4` | Active |
| `1.0.x` (`ai-sdk-v6`) | AI SDK 6 | `ProviderV3` | Maintenance |
| `0.5.x` (`ai-sdk-v5`) | AI SDK 5 | `ProviderV2` | Legacy compatibility |

For new projects, install the active line without a Phaseo package version:

```bash
npm install @phaseo/ai-sdk-provider
```

Install the AI SDK 6 maintenance line through its compatibility tag:

```bash
npm install @phaseo/ai-sdk-provider@ai-sdk-v6
```

AI SDK 5 has a dedicated compatibility release:

```bash
npm install @phaseo/ai-sdk-provider@ai-sdk-v5
```

Each provider line declares its compatible `ai` major as a peer dependency. npm
installs that peer automatically. If peer auto-installation is disabled, install
`ai@^7`, `ai@^6`, or `ai@^5` alongside the corresponding provider line.

It covers ProviderV2 text, streaming, tool, structured-output, embedding,
image, transcription, and speech surfaces. Standardized reranking was added in
newer provider contracts and is available in the AI SDK 6 and 7 lines.

The current major line receives new features, compatibility work, and fixes. The
maintenance line receives compatibility, security, and critical bug fixes where
practical.

When AI SDK 8 reaches a stable release, Phaseo will mark the AI SDK 6-compatible
`1.x` line as deprecated on npm. Deprecation is an advisory and does not remove
published packages. Any eventual end-of-support or removal decision will be
announced separately and will not occur silently.
