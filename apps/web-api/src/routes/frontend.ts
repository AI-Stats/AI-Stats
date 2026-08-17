import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { getCacheGeneration } from "@/cache/generations";
import { loadSearchCatalogue } from "@/repositories/search";

export const frontendRouter = new Hono<{ Bindings: Env }>();

const SEARCH_CACHE_SECONDS = 24 * 60 * 60;
const SEARCH_STALE_SECONDS = 7 * SEARCH_CACHE_SECONDS;

type CompactSearchData = {
	m: unknown[];
	o: unknown[];
	b: unknown[];
	p: unknown[];
	s: unknown[];
	c: unknown[];
	v: number;
};

function releaseGroupLabel(value: string | null | undefined): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat("en", {
		month: "long",
		timeZone: "UTC",
		year: "numeric",
	}).format(date);
}

async function v2SearchIndex(env: Env): Promise<CompactSearchData> {
	const [catalogue, generation] = await Promise.all([loadSearchCatalogue(env), getCacheGeneration(env, "search")]);
	const orderedModels = [...catalogue.models].sort((left, right) => {
		const leftTime = Date.parse(left.released_at ?? left.announced_at ?? "");
		const rightTime = Date.parse(right.released_at ?? right.announced_at ?? "");
		const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
		const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
		return safeRightTime - safeLeftTime || String(left.name).localeCompare(String(right.name));
	});
	return {
		m: orderedModels.map((model) => [model.model_slug, model.name, model.lab_name ?? null, `/models/${model.model_slug}`, model.lab_slug, releaseGroupLabel(model.released_at ?? model.announced_at)]),
		o: catalogue.organisations.map((organisation) => [organisation.lab_slug, organisation.name || organisation.lab_slug, null, `/organisations/${organisation.lab_slug}`, organisation.lab_slug]),
		b: catalogue.benchmarks.map((benchmark) => [benchmark.benchmark_id, benchmark.name, `${benchmark.total_models ?? 0} models`, `/benchmarks/${benchmark.benchmark_id}`]),
		p: catalogue.providers.map((provider) => [provider.provider_slug, provider.name, null, `/api-providers/${provider.provider_slug}`, provider.provider_slug]),
		s: [],
		c: [],
		v: generation.generation,
	};
}

frontendRouter.get("/cache-generation/search", async (c) => {
	try {
		const generation = await getCacheGeneration(c.env, "search");
		return withPublicCache(c.json(generation), {
			browserTtlSeconds: 0,
			cacheTags: ["web-api-cache-generation"],
			edgeTtlSeconds: 5 * 60,
			staleWhileRevalidateSeconds: 5 * 60,
		});
	} catch (error) {
		console.error("[web-api/cache-generation] failed", error);
		return c.json({ error: "cache_generation_unavailable" }, 503);
	}
});

frontendRouter.get("/search", async (c) => {
	try {
		const payload = await v2SearchIndex(c.env);
		return withPublicCache(c.json(payload), {
			browserTtlSeconds: SEARCH_CACHE_SECONDS,
			cacheTags: ["web-api-search"],
			edgeTtlSeconds: SEARCH_CACHE_SECONDS,
			staleWhileRevalidateSeconds: SEARCH_STALE_SECONDS,
		});
	} catch (error) {
		console.error("[web-api/search] failed", error);
		return c.json({ error: "search_unavailable" }, 503);
	}
});
