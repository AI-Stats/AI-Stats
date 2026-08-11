const PROVIDER_VIEW_EVENT = "phaseo:model-provider-view";

let currentProviderView: string | null = null;

export function publishProviderView(providerView: string | null): void {
	currentProviderView = providerView;
	window.dispatchEvent(new CustomEvent<string | null>(PROVIDER_VIEW_EVENT, {
		detail: providerView,
	}));
}

export function subscribeProviderView(
	listener: (providerView: string | null) => void,
): () => void {
	listener(currentProviderView);
	const handleProviderView = (event: Event) => {
		listener((event as CustomEvent<string | null>).detail);
	};
	window.addEventListener(PROVIDER_VIEW_EVENT, handleProviderView);
	return () => window.removeEventListener(PROVIDER_VIEW_EVENT, handleProviderView);
}
