export const GOOGLE_OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token";

export function resolveGoogleOAuthTokenUri(value: string | undefined): string {
	if (value === undefined || value === GOOGLE_OAUTH_TOKEN_URI) return GOOGLE_OAUTH_TOKEN_URI;
	throw new Error("google-vertex_invalid_oauth_token_uri");
}
