import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("package metadata", () => {
	it("does not execute install-time lifecycle scripts", async () => {
		const packageJson = JSON.parse(
			await readFile(new URL("../package.json", import.meta.url), "utf8"),
		) as { scripts?: Record<string, string> };

		expect(packageJson.scripts?.preinstall).toBeUndefined();
		expect(packageJson.scripts?.install).toBeUndefined();
		expect(packageJson.scripts?.postinstall).toBeUndefined();
	});
});
