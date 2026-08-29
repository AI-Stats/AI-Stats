import * as path from "path";

export const DEVTOOLS_LOOPBACK_HOST = "127.0.0.1";

export function resolveDevtoolsAssetPath(devtoolsDir: string, requestPath: string): string | null {
	const assetsRoot = path.resolve(devtoolsDir, "assets");
	const candidate = path.resolve(assetsRoot, requestPath);
	return candidate.startsWith(`${assetsRoot}${path.sep}`) ? candidate : null;
}
