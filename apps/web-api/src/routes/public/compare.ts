import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { composeCompareUsage } from "@/models/compare-usage";
import { composeComparisonModels } from "@/models/compare";
import { fetchModelPricingSources } from "@/models/pricing";
import { getCompareUsageAnalytics, listCompareCatalogueModels, loadCompareSelection } from "@/repositories/compare";
import { getModelTokenTrajectory } from "@/repositories/model-usage";

const COMPARE_CACHE = { edgeTtlSeconds: 3600, staleWhileRevalidateSeconds: 86400, cacheTags: ["web-api-compare", "web-api-models"] } as const;
const COMPARE_SELECTION_CACHE = { ...COMPARE_CACHE, cacheTags: ["web-api-compare", "web-api-model-details", "web-api-model-benchmarks", "web-api-model-pricing", "web-api-model-subscriptions"] } as const;
const COMPARE_USAGE_CACHE = { edgeTtlSeconds: 300, staleWhileRevalidateSeconds: 300, cacheTags: ["web-api-compare", "web-api-model-performance", "web-api-model-token-trajectories", "web-api-model-realtime"] } as const;
export const publicCompareRouter = new Hono<{ Bindings: Env }>();

function parseSelection(value: string | undefined): string[] | null { if (!value) return []; const values = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; return values.length > 4 || values.some((item) => item.length > 200) ? null : values; }

publicCompareRouter.get("/compare/usage", async (c) => {
	const modelIds = parseSelection(c.req.query("ids")); if (!modelIds) return c.json({ error: "invalid_compare_selection" }, 400); if (!modelIds.length) return withPublicCache(c.json({ usage: {} }), COMPARE_USAGE_CACHE);
	try {
		const analytics = await getCompareUsageAnalytics(c.env, modelIds);
		const sourceRows = await Promise.all(analytics.map(async (row) => ({ ...row, trajectory: await getModelTokenTrajectory(c.env, String(row.model_id ?? "")) })));
		return withPublicCache(c.json({ usage: composeCompareUsage(sourceRows) }), COMPARE_USAGE_CACHE);
	} catch (error) { console.error("[web-api/compare] usage failed", { modelIds, error }); return c.json({ error: "compare_usage_unavailable" }, 503); }
});

publicCompareRouter.get("/compare/selection", async (c) => {
	const modelIds = parseSelection(c.req.query("ids")); if (!modelIds) return c.json({ error: "invalid_compare_selection" }, 400); if (!modelIds.length) return withPublicCache(c.json({ models: [] }), COMPARE_SELECTION_CACHE);
	try {
		const [selection, pricing] = await Promise.all([loadCompareSelection(c.env, modelIds), fetchModelPricingSources(c.env, modelIds)]);
		const models = composeComparisonModels(modelIds, { models: selection.models, providerRows: pricing.providerRows, pricingRows: pricing.pricingRows, modelPlans: selection.modelPlans, plans: selection.plans });
		return withPublicCache(c.json({ models }), COMPARE_SELECTION_CACHE);
	} catch (error) { console.error("[web-api/compare] selection failed", { modelIds, error }); return c.json({ error: "compare_selection_unavailable" }, 503); }
});

publicCompareRouter.get("/compare/models", async (c) => {
	try {
		const rows = await listCompareCatalogueModels(c.env);
		const models = rows.map(({ model: row, lab }) => ({ id: row.modelSlug, name: row.name, status: row.status, previous_model_id: row.previousModelSlug, description: null, announced_date: row.announcedAt, release_date: row.releasedAt, deprecation_date: row.deprecatedAt, retirement_date: row.retiredAt, open_router_model_id: null, input_context_length: null, output_context_length: null, license: row.license, multimodal: null, input_types: row.inputModalities, output_types: row.outputModalities, web_access: null, reasoning: null, fine_tunable: null, knowledge_cutoff: null, api_reference_link: null, paper_link: null, announcement_link: null, repository_link: null, weights_link: null, parameter_count: null, training_tokens: null, benchmark_results: null, prices: null, provider: { provider_id: lab.labSlug, name: lab.name, website: null, country_code: null, description: null, colour: null, socials: [] }, model_details: null }));
		return withPublicCache(c.json({ models }), COMPARE_CACHE);
	} catch (error) { console.error("[web-api/compare] models failed", error); return c.json({ error: "compare_models_unavailable" }, 503); }
});
