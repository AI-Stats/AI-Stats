export function assertServerSideApiKeyUse(dangerouslyAllowBrowser: boolean | undefined): void {
	const isBrowser = typeof globalThis === "object" &&
		"window" in globalThis &&
		typeof globalThis.window === "object";
	const workerGlobalScope = (globalThis as Record<string, unknown>).WorkerGlobalScope;
	const workerSelf = (globalThis as Record<string, unknown>).self;
	const isBrowserWorker = typeof workerGlobalScope === "function" &&
		typeof workerSelf === "object" &&
		workerSelf !== null &&
		workerSelf instanceof workerGlobalScope;
	if ((isBrowser || isBrowserWorker) && dangerouslyAllowBrowser !== true) {
		throw new Error(
			"API keys are disabled in browser environments by default. Set dangerouslyAllowBrowser: true only if you understand the credential exposure risk.",
		);
	}
}
