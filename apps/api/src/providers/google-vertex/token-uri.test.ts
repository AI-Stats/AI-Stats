import { describe, expect, it } from "vitest";
import { GOOGLE_OAUTH_TOKEN_URI, resolveGoogleOAuthTokenUri } from "./token-uri";

describe("resolveGoogleOAuthTokenUri", () => {
	it("uses Google's fixed OAuth token endpoint", () => {
		expect(resolveGoogleOAuthTokenUri(undefined)).toBe(GOOGLE_OAUTH_TOKEN_URI);
		expect(resolveGoogleOAuthTokenUri(GOOGLE_OAUTH_TOKEN_URI)).toBe(GOOGLE_OAUTH_TOKEN_URI);
	});

	it.each([
		"http://127.0.0.1/token",
		"https://oauth2.googleapis.com.evil.example/token",
		"https://oauth2.googleapis.com/token?redirect=evil",
	])("rejects untrusted token URI %s", (value) => {
		expect(() => resolveGoogleOAuthTokenUri(value)).toThrow("google-vertex_invalid_oauth_token_uri");
	});
});
