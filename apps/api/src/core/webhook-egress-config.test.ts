import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("webhook egress deployment configuration", () => {
	it.each(["wrangler.toml", "wrangler.staging.toml"])(
		"keeps %s on public-only fetch routing",
		(configName) => {
			const config = readFileSync(new URL(`../../${configName}`, import.meta.url), "utf8");
			const flags = config.match(
				/^\s*compatibility_flags\s*=\s*\[([^\]]*)\]/m,
			)?.[1] ?? "";
			expect(flags).toMatch(
				/(?:^|,)\s*"global_fetch_strictly_public"\s*(?:,|$)/,
			);
		},
	);
});
