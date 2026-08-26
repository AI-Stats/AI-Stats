export const PROVIDER_INSPECTOR_OPEN_EVENT = "ai-stats-provider-inspector-open";
const PROVIDER_INSPECTOR_STATE_EVENT = "phaseo:provider-inspector-state";

let activeProviderInspectorId: string | null = null;

export type ProviderInspectorOpenDetail = {
	providerId: string;
	disableAnimation: boolean;
	navigationProviderIds?: string[];
};

export function dispatchProviderInspectorOpen(
	providerId: string,
	disableAnimation = false,
	navigationProviderIds?: string[],
): void {
	activeProviderInspectorId = providerId;
	window.dispatchEvent(
		new CustomEvent<ProviderInspectorOpenDetail>(PROVIDER_INSPECTOR_OPEN_EVENT, {
			detail: { providerId, disableAnimation, navigationProviderIds },
		}),
	);
	window.dispatchEvent(new CustomEvent(PROVIDER_INSPECTOR_STATE_EVENT));
}

export function clearProviderInspector(providerId?: string): void {
	if (providerId && activeProviderInspectorId !== providerId) return;
	activeProviderInspectorId = null;
	window.dispatchEvent(new CustomEvent(PROVIDER_INSPECTOR_STATE_EVENT));
}

export function subscribeProviderInspector(
	listener: (providerId: string | null) => void,
): () => void {
	const handleState = () => listener(activeProviderInspectorId);
	handleState();
	window.addEventListener(PROVIDER_INSPECTOR_STATE_EVENT, handleState);
	return () => window.removeEventListener(PROVIDER_INSPECTOR_STATE_EVENT, handleState);
}
