# Phaseo SDK installation

Install the SDK with your package manager:

```bash
npm install @phaseo/sdk
```

```bash
pnpm add @phaseo/sdk
```

```bash
yarn add @phaseo/sdk
```

The SDK does not run interactive installation hooks or install optional packages.

## Optional devtools viewer

Install the viewer explicitly when you want to inspect locally captured telemetry:

```bash
npm install --save-dev @phaseo/devtools-viewer
```

You can also run it without adding a project dependency:

```bash
npx @phaseo/devtools-viewer
```

Removing the viewer does not remove the SDK or its telemetry integration:

```bash
npm uninstall @phaseo/devtools-viewer
```

## Related documentation

- [SDK README](./README.md)
- [Getting started with Devtools](../../devtools/devtools/GETTING_STARTED.md)
- [Devtools architecture](../../devtools/DEVTOOLS_ARCHITECTURE.md)
- [Cross-language support](../../devtools/devtools/CROSS_LANGUAGE.md)
