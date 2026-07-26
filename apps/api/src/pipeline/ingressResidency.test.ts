import { describe, expect, it } from "vitest";
import {
	DEFAULT_EU_CONTENT_PATH_HOSTNAME,
	resolveIngressResidencyPolicy,
} from "./ingressResidency";

describe("resolveIngressResidencyPolicy", () => {
	it("does not apply a regional policy to the global hostname", () => {
		expect(
			resolveIngressResidencyPolicy(
				new Request("https://api.phaseo.app/v1/responses"),
				{},
			),
		).toBeNull();
	});

	it("fails closed until the EU content path is explicitly enabled", () => {
		expect(
			resolveIngressResidencyPolicy(
				new Request(`https://${DEFAULT_EU_CONTENT_PATH_HOSTNAME}/v1/responses`),
				{},
			),
		).toMatchObject({
			name: "eu_content_path",
			region: "eu",
			enabled: false,
		});
	});

	it("supports an operator-configured hostname and activation flag", () => {
		expect(
			resolveIngressResidencyPolicy(
				new Request("https://eu.gateway.example/v1/responses"),
				{
					EU_CONTENT_PATH_HOSTNAME: "EU.GATEWAY.EXAMPLE",
					EU_CONTENT_PATH_ENABLED: "true",
				},
			),
		).toEqual({
			name: "eu_content_path",
			region: "eu",
			hostname: "eu.gateway.example",
			enabled: true,
		});
	});
});
