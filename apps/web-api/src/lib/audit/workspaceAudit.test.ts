import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "./workspaceAudit";

describe("sanitizeAuditMetadata", () => {
	it("removes credential-like fields at every level", () => {
		expect(sanitizeAuditMetadata({
			name: "Production",
			plaintext: "phaseo_v1_sk_secret",
			nested: { authorization: "Bearer secret", safe: true, tokenHash: "hash" },
			scopes: ["keys:write"],
		})).toEqual({ name: "Production", nested: { safe: true } });
	});

	it("bounds strings and collection sizes", () => {
		const metadata = sanitizeAuditMetadata({
			long: "x".repeat(600),
			values: Array.from({ length: 40 }, (_, index) => index),
		});
		expect(metadata.long).toHaveLength(500);
		expect(metadata.values).toHaveLength(30);
	});
});
