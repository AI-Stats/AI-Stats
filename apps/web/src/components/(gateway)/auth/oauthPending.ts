export type OAuthProviderId = "google" | "github" | "gitlab";

export function beginOAuthAttempt(
	pendingProvider: OAuthProviderId | null,
	provider: OAuthProviderId,
): { accepted: boolean; pendingProvider: OAuthProviderId } {
	if (pendingProvider) {
		return { accepted: false, pendingProvider };
	}
	return { accepted: true, pendingProvider: provider };
}
