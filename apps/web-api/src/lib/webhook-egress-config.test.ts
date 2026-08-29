import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("webhook egress configuration", () => {
	it("keeps Cloudflare's connection-time public-network enforcement enabled", () => {
		const config = readFileSync(new URL("../../wrangler.toml", import.meta.url), "utf8");
		expect(config).toMatch(/compatibility_flags\s*=\s*\[[^\]]*"global_fetch_strictly_public"[^\]]*\]/s);
	});
});
