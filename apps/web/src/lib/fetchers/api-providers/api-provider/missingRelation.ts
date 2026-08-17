export function isMissingRelationError(error: unknown): boolean {
	const candidate = error as { code?: unknown; message?: unknown } | null;
	const code = typeof candidate?.code === "string" ? candidate.code : "";
	const message =
		typeof candidate?.message === "string"
			? candidate.message.toLowerCase()
			: "";

	return code === "42P01" || message.includes("relation") && message.includes("does not exist");
}
