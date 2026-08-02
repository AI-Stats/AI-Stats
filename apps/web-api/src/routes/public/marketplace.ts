import { Hono } from "hono";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";

const MARKETPLACE_CACHE = {
	edgeTtlSeconds: 15 * 60,
	staleWhileRevalidateSeconds: 60 * 60,
} as const;

export const publicMarketplaceRouter = new Hono<{ Bindings: Env }>();

async function forkCounts(client: ReturnType<typeof getDataClient>, presetIds: string[]) {
	if (!presetIds.length) return new Map<string, { direct: number; descendants: number }>();
	const result = await client.rpc("marketplace_preset_fork_counts", { preset_ids: presetIds });
	if (result.error) throw result.error;
	return new Map((result.data ?? []).map((row: { preset_id: string; direct_fork_count: number | string; descendant_count: number | string }) => [String(row.preset_id), { direct: Number(row.direct_fork_count) || 0, descendants: Number(row.descendant_count) || 0 }]));
}

publicMarketplaceRouter.get("/marketplace/presets", async (c) => {
	try {
		const client = getDataClient(c.env);
		const { data, error } = await client
			.from("presets")
			.select("id,name,slug,description,created_at,source_preset_id,created_by")
			.eq("visibility", "public")
			.is("archived_at", null)
			.order("created_at", { ascending: false });
		if (error) throw error;
		const userIds = [...new Set((data ?? []).map((preset) => String(preset.created_by ?? "")).filter(Boolean))];
		const [profiles, counts] = await Promise.all([
			userIds.length ? client.from("users").select("user_id,display_name,public_profile_slug").eq("public_profile_enabled", true).in("user_id", userIds) : Promise.resolve({ data: [], error: null }),
			forkCounts(client, (data ?? []).map((preset) => String(preset.id))),
		]);
		if (profiles.error) throw profiles.error;
		const byUser = new Map((profiles.data ?? []).map((profile) => [String(profile.user_id), profile]));
		const presets = (data ?? []).flatMap((preset) => {
			const publisher = byUser.get(String(preset.created_by));
			const handle = String(publisher?.public_profile_slug ?? "").trim();
			const count = counts.get(String(preset.id)) ?? { direct: 0, descendants: 0 };
			return handle ? [{ ...preset, forkCount: count.direct, descendantCount: count.descendants, canonicalModel: `@${handle}/${preset.slug}`, publisher: { handle, displayName: publisher?.display_name ?? handle } }] : [];
		});
		return withPublicCache(c.json({ presets }), {
			...MARKETPLACE_CACHE,
			cacheTags: ["web-api-marketplace", "web-api-marketplace-presets"],
		});
	} catch (error) {
		console.error("[web-api/marketplace] presets failed", error);
		return c.json({ error: "marketplace_unavailable" }, 503);
	}
});

publicMarketplaceRouter.get("/marketplace/presets/:presetId", async (c) => {
	const presetId = c.req.param("presetId").trim();
	try {
		const client = getDataClient(c.env);
		const { data: preset, error } = await client
			.from("presets")
			.select("id,name,slug,description,config,visibility,created_at,source_preset_id,created_by")
			.eq("id", presetId)
			.eq("visibility", "public")
			.is("archived_at", null)
			.maybeSingle();
		if (error) throw error;
		if (!preset) return c.json({ error: "preset_not_found" }, 404);
		const { data: profile, error: profileError } = await client.from("users").select("display_name,public_profile_slug").eq("user_id", preset.created_by).eq("public_profile_enabled", true).maybeSingle();
		if (profileError) throw profileError;
		const handle = String(profile?.public_profile_slug ?? "").trim();
		if (!handle) return c.json({ error: "preset_not_found" }, 404);
		const counts = await forkCounts(client, [preset.id]);
		const count = counts.get(String(preset.id)) ?? { direct: 0, descendants: 0 };
		const versionsResult = await client.from("preset_versions").select("id,version_number,release_notes,created_at").eq("preset_id", preset.id).order("version_number", { ascending: false });
		if (versionsResult.error) throw versionsResult.error;
		const requestedVersion = Number(c.req.query("version"));
		let displayedPreset = preset;
		if (Number.isInteger(requestedVersion) && requestedVersion > 0) {
			const versionResult = await client.from("preset_versions").select("name,slug,description,config,visibility").eq("preset_id", preset.id).eq("version_number", requestedVersion).maybeSingle();
			if (versionResult.error) throw versionResult.error;
			if (!versionResult.data || versionResult.data.visibility !== "public") return c.json({ error: "preset_version_not_found" }, 404);
			displayedPreset = { ...preset, ...versionResult.data };
		}
		let sourcePreset: { id: string; name: string } | null = null;
		if (preset.source_preset_id) {
			const { data: source, error: sourceError } = await client
				.from("presets")
				.select("id,name")
				.eq("id", preset.source_preset_id)
				.eq("visibility", "public")
				.maybeSingle();
			if (sourceError) throw sourceError;
			if (source) sourcePreset = source;
		}
		return withPublicCache(c.json({ preset: { ...displayedPreset, forkCount: count.direct, descendantCount: count.descendants, canonicalModel: `@${handle}/${preset.slug}`, publisher: { handle, displayName: profile?.display_name ?? handle } }, versions: versionsResult.data ?? [], sourcePreset }), {
			...MARKETPLACE_CACHE,
			cacheTags: [
				"web-api-marketplace",
				"web-api-marketplace-presets",
				`web-api-marketplace-preset-${encodeURIComponent(presetId).replace(/%/g, "")}`.slice(0, 128),
			],
		});
	} catch (error) {
		console.error("[web-api/marketplace] preset failed", { presetId, error });
		return c.json({ error: "preset_unavailable" }, 503);
	}
});
