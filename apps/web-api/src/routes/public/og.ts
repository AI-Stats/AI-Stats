import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { findOgPayload, type OgDatabaseKind } from "@/repositories/og";

export const publicOgRouter = new Hono<{ Bindings: Env }>();
const CACHE = { edgeTtlSeconds: 60 * 60, staleWhileRevalidateSeconds: 24 * 60 * 60, cacheTags: ["web-api-og"] } as const;

publicOgRouter.get("/og", async (c) => {
	const kind = c.req.query("kind")?.trim(); const id = c.req.query("id")?.trim();
	if (!kind || !id) return c.json({ error: "invalid_og_reference" }, 400);
	try {
		let payload: Record<string, unknown> | null = null;
		if (kind === "countries") { const iso = id.toUpperCase(); if (/^[A-Z]{2}$/.test(iso)) { const [a, b] = iso; const base = 0x1f1e6; payload = { id: iso, name: new Intl.DisplayNames(["en"], { type: "region" }).of(iso) ?? iso, flagEmoji: String.fromCodePoint(base + a.charCodeAt(0) - 65, base + b.charCodeAt(0) - 65) }; } }
		else if (["organisations", "models", "benchmarks", "api-providers", "subscription-plans"].includes(kind)) payload = await findOgPayload(c.env, kind as OgDatabaseKind, id);
		else return c.json({ error: "invalid_og_kind" }, 400);
		if (!payload) return c.json({ error: "og_not_found" }, 404);
		return withPublicCache(c.json({ payload }), CACHE);
	} catch (error) { console.error("[web-api/og] payload failed", { kind, id, error }); return c.json({ error: "og_unavailable" }, 503); }
});
