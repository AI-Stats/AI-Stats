import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { getMarketplacePreset, listMarketplacePresets } from "@/repositories/marketplace";

const MARKETPLACE_CACHE = { edgeTtlSeconds: 15 * 60, staleWhileRevalidateSeconds: 60 * 60 } as const;
export const publicMarketplaceRouter = new Hono<{ Bindings: Env }>();

publicMarketplaceRouter.get("/marketplace/presets", async (c) => {
	try {
		const presets = await listMarketplacePresets(c.env);
		return withPublicCache(c.json({ presets }), { ...MARKETPLACE_CACHE, cacheTags: ["web-api-marketplace", "web-api-marketplace-presets"] });
	} catch (error) { console.error("[web-api/marketplace] presets failed", error); return c.json({ error: "marketplace_unavailable" }, 503); }
});

publicMarketplaceRouter.get("/marketplace/presets/:presetId", async (c) => {
	const presetId = c.req.param("presetId").trim();
	try {
		const parsedVersion = Number(c.req.query("version"));
		const requestedVersion = Number.isInteger(parsedVersion) && parsedVersion > 0 ? parsedVersion : undefined;
		const result = await getMarketplacePreset(c.env, presetId, requestedVersion);
		if (!result) return c.json({ error: "preset_not_found" }, 404);
		if ("versionNotFound" in result) return c.json({ error: "preset_version_not_found" }, 404);
		return withPublicCache(c.json(result), { ...MARKETPLACE_CACHE, cacheTags: ["web-api-marketplace", "web-api-marketplace-presets", `web-api-marketplace-preset-${encodeURIComponent(presetId).replace(/%/g, "")}`.slice(0, 128)] });
	} catch (error) { console.error("[web-api/marketplace] preset failed", { presetId, error }); return c.json({ error: "preset_unavailable" }, 503); }
});
