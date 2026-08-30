# AI SDK support policy

| Phaseo provider line | Vercel AI SDK | Provider contract | Status |
| --- | --- | --- | --- |
| `2.x` | AI SDK 7 | `ProviderV4` | Active |
| `1.x` | AI SDK 6 | `ProviderV3` | Maintenance |

For new projects, install the active line without a Phaseo package version:

```bash
npm install @phaseo/ai-sdk-provider ai@^7
```

Until the `ai-sdk-v6` npm dist-tag is configured, install the maintenance line
with its explicit package major:

```bash
npm install @phaseo/ai-sdk-provider@^1 ai@ai-v6
```

The intended convenience selector is `@phaseo/ai-sdk-provider@ai-sdk-v6`.
`@v6` is not used because npm dist-tags share a namespace with semantic
versions and rejects tags that can be interpreted as version ranges.

The current major line receives new features, compatibility work, and fixes. The
maintenance line receives compatibility, security, and critical bug fixes where
practical.

When AI SDK 8 reaches a stable release, Phaseo will mark the AI SDK 6-compatible
`1.x` line as deprecated on npm. Deprecation is an advisory and does not remove
published packages. Any eventual end-of-support or removal decision will be
announced separately and will not occur silently.
