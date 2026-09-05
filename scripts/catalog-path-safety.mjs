import path from "node:path";

const CATALOG_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._@+-]*$/;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function assertCatalogSegment(value, label = "catalog path segment") {
	if (
		typeof value !== "string" ||
		!CATALOG_SEGMENT.test(value) ||
		WINDOWS_DEVICE_NAME.test(value)
	) {
		throw new Error(`Invalid ${label}: ${JSON.stringify(value)}`);
	}
	return value;
}

export function parseCanonicalModelId(value) {
	if (typeof value !== "string") {
		throw new Error(`Invalid canonical model id: ${JSON.stringify(value)}`);
	}
	const segments = value.split("/");
	if (segments.length !== 2) {
		throw new Error(`Invalid canonical model id: ${JSON.stringify(value)}`);
	}
	return [
		assertCatalogSegment(segments[0], "organisation id"),
		assertCatalogSegment(segments[1], "model id"),
	];
}

export function resolveCatalogPath(root, ...segments) {
	for (const segment of segments) assertCatalogSegment(segment);
	const resolvedRoot = path.resolve(root);
	const resolved = path.resolve(resolvedRoot, ...segments);
	const relative = path.relative(resolvedRoot, resolved);
	if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
		throw new Error(`Catalog path escapes root: ${resolved}`);
	}
	return resolved;
}
