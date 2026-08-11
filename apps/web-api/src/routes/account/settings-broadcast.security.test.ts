import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fetchBroadcastEndpoint } from "./settings-broadcast";

describe("broadcast destination egress", () => {
	it("rejects redirects without following them", async () => {
		const fetchMock = vi.fn(async () => new Response(null, {
			status: 302,
			headers: { location: "http://169.254.169.254/latest/meta-data" },
		}));
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchBroadcastEndpoint(new URL("https://hooks.example.com"), {
			method: "POST",
		})).rejects.toThrow("redirects are not allowed");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			new URL("https://hooks.example.com"),
			expect.objectContaining({ method: "POST", redirect: "manual" }),
		);
		vi.unstubAllGlobals();
	});

	it("keeps production and staging fetches on public Internet routing", () => {
		const config = readFileSync(new URL("../../../wrangler.toml", import.meta.url), "utf8");
		expect(config).toMatch(
			/^compatibility_flags\s*=\s*\[[^\]]*"global_fetch_strictly_public"[^\]]*\]/m,
		);
	});
});
