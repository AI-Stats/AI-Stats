import { afterEach, describe, expect, it, vi } from "vitest";

const preset = { id: "preset-1", name: "Public preset", slug: "public-preset", visibility: "public", forkCount: 7, descendantCount: 12, canonicalModel: "@author/public-preset", publisher: { handle: "author", aliases: ["old-author"], displayName: "Preset Author" } };
vi.mock("@/repositories/marketplace", () => ({
	listMarketplacePresets: vi.fn(async () => [preset]),
	getMarketplacePreset: vi.fn(async (_env, id: string) => id === "missing" ? null : ({ preset, versions: [{ id: "version-1", version_number: 1, version_label: "1.0.0", versioning_method: "semver" }], sourcePreset: { id: "source-1", name: "Source preset" } })),
}));

import app from "@/index";
import { getMarketplacePreset } from "@/repositories/marketplace";
const env = { ENV: "development" as const };
afterEach(() => vi.clearAllMocks());

describe("public marketplace routes", () => {
	it("returns only explicitly public preset list and detail data", async () => {
		const [list, detail] = await Promise.all([
			app.request("https://phaseo.app/api/_web/marketplace/presets", {}, env),
			app.request("https://phaseo.app/api/_web/marketplace/presets/preset-1", {}, env),
		]);
		for (const response of [list, detail]) { expect(response.status).toBe(200); expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=900, stale-while-revalidate=3600"); expect(response.headers.get("cache-tag")).toContain("web-api-marketplace"); }
		await expect(list.json()).resolves.toMatchObject({ presets: [{ id: "preset-1", forkCount: 7, canonicalModel: "@author/public-preset" }] });
		await expect(detail.json()).resolves.toMatchObject({ preset: { id: "preset-1", publisher: { handle: "author" } }, versions: [{ version_number: 1 }], sourcePreset: { id: "source-1" } });
	});

	it("does not cache missing presets", async () => {
		const response = await app.request("https://phaseo.app/api/_web/marketplace/presets/missing", {}, env);
		expect(response.status).toBe(404); expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
	});

	it("returns a distinct missing-version response", async () => {
		vi.mocked(getMarketplacePreset).mockResolvedValueOnce({ versionNotFound: true });
		const response = await app.request("https://phaseo.app/api/_web/marketplace/presets/preset-1?version=99", {}, env);
		expect(response.status).toBe(404); await expect(response.json()).resolves.toEqual({ error: "preset_version_not_found" });
	});
});
