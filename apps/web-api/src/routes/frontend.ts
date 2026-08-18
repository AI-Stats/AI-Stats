import { Hono, type Context } from "hono";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { getCacheGeneration } from "@/cache/generations";

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

async function fetchAllRows<T>(
	fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
	pageSize = 1_000,
): Promise<T[]> {
	const rows: T[] = [];
	for (let from = 0; ; from += pageSize) {
		const result = await fetchPage(from, from + pageSize - 1);
		if (result.error) throw result.error;
		const page = result.data ?? [];
		rows.push(...page);
		if (page.length < pageSize) return rows;
	}
}

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

async function v2SearchIndex(c: Context<{ Bindings: Env }>): Promise<CompactSearchData> {
	const db = getDataClient(c.env);
	const [models, organisationsResult, benchmarksResult, providersResult, generation] = await Promise.all([
		fetchAllRows((from, to) => db.from("v2_models")
			.select("model_slug,name,lab_slug,released_at,announced_at,lab:v2_labs!v2_models_lab_slug_fkey(name)")
			.eq("hidden", false)
			.order("released_at", { ascending: false })
			.range(from, to)),
		db.from("v2_labs").select("lab_slug,name").order("name", { ascending: true }),
		db.from("v2_benchmarks").select("benchmark_id,name,total_models").order("name", { ascending: true }),
		db.from("v2_providers").select("provider_slug,name").order("name", { ascending: true }),
		getCacheGeneration(db, "search"),
	]);
	for (const result of [organisationsResult, benchmarksResult, providersResult]) {
		if (result.error) throw result.error;
	}
	const orderedModels = [...models].sort((left, right) => {
		const leftTime = Date.parse(left.released_at ?? left.announced_at ?? "");
		const rightTime = Date.parse(right.released_at ?? right.announced_at ?? "");
		const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
		const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
		return safeRightTime - safeLeftTime || String(left.name).localeCompare(String(right.name));
	});
	return {
		m: orderedModels.map((model) => [model.model_slug, model.name, (Array.isArray(model.lab) ? model.lab[0] : model.lab)?.name ?? null, `/models/${model.model_slug}`, model.lab_slug, releaseGroupLabel(model.released_at ?? model.announced_at)]),
		o: (organisationsResult.data ?? []).map((organisation) => [organisation.lab_slug, organisation.name || organisation.lab_slug, null, `/organisations/${organisation.lab_slug}`, organisation.lab_slug]),
		b: (benchmarksResult.data ?? []).map((benchmark) => [benchmark.benchmark_id, benchmark.name, `${benchmark.total_models ?? 0} models`, `/benchmarks/${benchmark.benchmark_id}`]),
		p: (providersResult.data ?? []).map((provider) => [provider.provider_slug, provider.name, null, `/api-providers/${provider.provider_slug}`, provider.provider_slug]),
		s: [],
		c: [],
		v: generation.generation,
	};
}

frontendRouter.get("/cache-generation/search", async (c) => {
	try {
		const generation = await getCacheGeneration(getDataClient(c.env), "search");
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
		const payload = await v2SearchIndex(c);
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
