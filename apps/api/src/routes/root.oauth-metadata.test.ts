import { describe, expect, it } from "vitest";
import { rootRouter } from "./root";

const bindings = {
	GATEWAY_PUBLIC_BASE_URL: "https://api.phaseo.app",
	PLANETSCALE_DATABASE_URL: "postgresql://phaseo:test@aws.connect.psdb.cloud/phaseo?sslmode=verify-full",
	GATEWAY_CACHE: {} as KVNamespace,
	PHASEO_THIRD_PARTY_OAUTH_ENABLED: "true",
} as any;

const executionContext = {
	waitUntil: () => undefined,
	passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

describe("OAuth server metadata", () => {
	it.each([
		"/.well-known/oauth-authorization-server/oauth",
		"/.well-known/openid-configuration/oauth",
		"/.well-known/openid-configuration",
	])("publishes issuer-consistent metadata at %s", async (path) => {
		const response = await rootRouter.fetch(
			new Request(`https://api.phaseo.app${path}`),
			bindings,
			executionContext,
		);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				issuer: "https://api.phaseo.app/oauth",
				authorization_endpoint: "https://api.phaseo.app/oauth/authorize",
				token_endpoint: "https://api.phaseo.app/oauth/token",
				code_challenge_methods_supported: ["S256"],
				client_id_metadata_document_supported: true,
			}),
		);
	});
});
