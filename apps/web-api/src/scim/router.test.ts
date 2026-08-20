import { describe, expect, it } from "vitest";
import { SCIM_BULK_LIMITS, SCIM_CONTENT_TYPE, SCIM_URNS } from "./constants";
import { createScimRouter } from "./router";

const env = { ENV: "development" as const };
const authorized = createScimRouter(async () => ({ workspaceId: "workspace-1", endpointId: "endpoint-1", tokenId: "token-1" }));

describe("SCIM discovery", () => {
	it("requires bearer authentication", async () => {
		const app = createScimRouter(async () => null);
		const response = await app.request("https://phaseo.ai/ServiceProviderConfig", {}, env);
		expect(response.status).toBe(401);
		expect(response.headers.get("content-type")).toBe(SCIM_CONTENT_TYPE);
		expect(await response.json()).toMatchObject({ schemas: [SCIM_URNS.error], status: "401" });
	});

	it("fails closed without the production rate-limit binding", async () => {
		const response = await authorized.request("https://phaseo.ai/ServiceProviderConfig", {}, { ENV: "production" });
		expect(response.status).toBe(503);
	});

	it("returns a SCIM rate-limit error with retry guidance", async () => {
		const response = await authorized.request("https://phaseo.ai/ServiceProviderConfig", {}, { ENV: "production", SCIM_RATE_LIMITER: { limit: async () => ({ success: false }) } });
		expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("1");
		expect(await response.json()).toMatchObject({ schemas: [SCIM_URNS.error], status: "429", scimType: "tooMany" });
	});

	it("advertises PATCH, filtering, and RFC bulk support", async () => {
		const response = await authorized.request("https://phaseo.ai/ServiceProviderConfig", {}, env);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ patch: { supported: true }, filter: { supported: true, maxResults: 100 }, bulk: { supported: true, ...SCIM_BULK_LIMITS } });
	});

	it("publishes User and Group resource types", async () => {
		const response = await authorized.request("https://phaseo.ai/ResourceTypes", {}, env);
		const body = await response.json() as { Resources: Array<{ id: string }> };
		expect(body.Resources.map((resource) => resource.id)).toEqual(["User", "Group"]);
	});

	it("returns an individual schema by its URN", async () => {
		const response = await authorized.request(`https://phaseo.ai/Schemas/${SCIM_URNS.enterpriseUser}`, {}, env);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ id: SCIM_URNS.enterpriseUser, name: "EnterpriseUser" });
	});

	it("discovers all accepted core attributes and the enterprise manager", async () => {
		const response = await authorized.request("https://phaseo.ai/Schemas", {}, env);
		const body = await response.json() as { Resources: Array<{ id: string; attributes: Array<{ name: string }> }> };
		const user = body.Resources.find((schema) => schema.id === SCIM_URNS.user);
		const enterprise = body.Resources.find((schema) => schema.id === SCIM_URNS.enterpriseUser);
		expect(user?.attributes.map((attribute) => attribute.name)).toEqual(expect.arrayContaining(["emails", "phoneNumbers", "addresses", "title", "locale", "timezone"]));
		expect(enterprise?.attributes.map((attribute) => attribute.name)).toContain("manager");
	});
});
