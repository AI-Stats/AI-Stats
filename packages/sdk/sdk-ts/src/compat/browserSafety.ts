export function assertServerSideApiKeyUse(dangerouslyAllowBrowser: boolean | undefined): void {
	const isBrowser = typeof globalThis === "object" &&
		"window" in globalThis &&
		typeof globalThis.window === "object";
	if (isBrowser && dangerouslyAllowBrowser !== true) {
		throw new Error(
			"API keys are disabled in browser environments by default. Set dangerouslyAllowBrowser: true only if you understand the credential exposure risk.",
		);
	}
}
