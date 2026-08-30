export function resolveDefaultGatewayStatuses<T extends string>(
	selectedStatuses: readonly T[],
	hasInteractedWithStatuses: boolean,
): T[] {
	if (hasInteractedWithStatuses || selectedStatuses.length > 0) {
		return [...selectedStatuses];
	}

	return ["active" as T];
}
