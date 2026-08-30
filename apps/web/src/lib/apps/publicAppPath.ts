function slugifyAppName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		|| "app";
}

export function getPublicAppRouteSegment(title: string): string {
	const existingSlug = title.trim().toLowerCase();
	if (/^[a-z0-9]+(?:-{1,2}[a-z0-9]+)*$/.test(existingSlug)) {
		return existingSlug;
	}
	return slugifyAppName(title) || "app";
}

export function getPublicAppPath(slugOrTitle: string): string {
	return `/apps/${encodeURIComponent(getPublicAppRouteSegment(slugOrTitle))}`;
}
