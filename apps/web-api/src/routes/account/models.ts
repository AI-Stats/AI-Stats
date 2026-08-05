import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { fetchModelPricingSources } from "@/models/pricing";

export const accountModelsRouter = new Hono<{ Bindings: Env }>();

async function requireAdmin(request: Request, env: Env) {
	const user = await requireUser(request, env);
	if (!user) return null;
	const client = getDataClient(env);
	const role = await client.from("users").select("role").eq("user_id", user.id).maybeSingle();
	return !role.error && String(role.data?.role ?? "").toLowerCase() === "admin" ? client : null;
}

async function fetchAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 1000): Promise<T[]> {
	const rows: T[] = [];
	for (let from = 0; ; from += pageSize) {
		const result = await fetchPage(from, from + pageSize - 1);
		if (result.error) throw result.error;
		const page = result.data ?? [];
		rows.push(...page);
		if (page.length < pageSize) return rows;
	}
}

accountModelsRouter.get("/audit/source", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const includeHidden = c.req.query("includeHidden") === "true";
		const [models, providerRows, benchmarkRows, pricingRows] = await Promise.all([
			fetchAllRows<any>((from, to) => {
				let query = client.from("v2_models").select("model_id:model_slug,name,release_date:released_at,retirement_date:retired_at,status,hidden,input_types:input_modalities,output_types:output_modalities,organisation:v2_labs(lab_slug,name)").order("released_at", { ascending: false });
				if (!includeHidden) query = query.eq("hidden", false);
				return query.range(from, to);
			}),
			fetchAllRows<any>((from, to) => client.from("v2_rpc_routes_legacy_shape").select("provider_api_model_id,model_id,provider_id,api_model_id,is_active_gateway,effective_from,effective_to").range(from, to)),
			fetchAllRows<any>((from, to) => client.from("v2_rpc_benchmark_results_legacy_shape").select("model_id,id").range(from, to)),
			fetchAllRows<any>((from, to) => client.from("v2_rpc_pricing_legacy_shape").select("model_key,meter,price_per_unit,unit_size,effective_from,effective_to").range(from, to)),
		]);
		return c.json({ models, providerRows, benchmarkRows, pricingRows }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] audit source failed", { error });
		return c.json({ error: "admin_model_audit_source_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.get("/provider-audit/source", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		const [providerModels, pricingRules] = await Promise.all([
			fetchAllRows<any>((from, to) => client.from("v2_rpc_routes_legacy_shape").select("provider_api_model_id,provider_id,api_model_id,provider_model_slug,internal_model_id,is_active_gateway,routing_status,provider_availability_status,phaseo_status,access_scope,effective_from,effective_to").range(from, to)),
			fetchAllRows<any>((from, to) => client.from("v2_rpc_pricing_legacy_shape").select("model_key,effective_from,effective_to").range(from, to)),
		]);
		return c.json({ providerModels, pricingRules }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] provider audit source failed", { error });
		return c.json({ error: "admin_provider_audit_source_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.get("/catalog/counts", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const [models, organisations, providers, benchmarks] = await Promise.all([
		client.from("v2_models").select("*", { count: "exact", head: true }),
		client.from("v2_labs").select("*", { count: "exact", head: true }),
		client.from("v2_providers").select("*", { count: "exact", head: true }),
		client.from("v2_benchmarks").select("*", { count: "exact", head: true }),
	]);
	if ([models, organisations, providers, benchmarks].some((result) => result.error)) return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	return c.json({ models: models.count ?? 0, organisations: organisations.count ?? 0, providers: providers.count ?? 0, benchmarks: benchmarks.count ?? 0 }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountModelsRouter.get("/catalog/list", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const configs: Record<string, { table: string; select: string; search: string[] }> = {
		models: { table: "v2_rpc_models_legacy_shape", select: "model_id,name,created_at", search: ["model_id", "name"] },
		organisations: { table: "v2_rpc_labs_legacy_shape", select: "organisation_id,name,created_at", search: ["organisation_id", "name"] },
		providers: { table: "v2_rpc_providers_legacy_shape", select: "api_provider_id,api_provider_name,created_at", search: ["api_provider_id", "api_provider_name"] },
		benchmarks: { table: "v2_rpc_benchmarks_legacy_shape", select: "id,name,category,created_at", search: ["id", "name", "category"] },
	};
	const config = configs[c.req.query("resource") ?? ""];
	if (!config) return c.json({ error: "invalid_resource" }, 400, PRIVATE_NO_STORE_HEADERS);
	const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
	const pageSize = Math.min(100, Math.max(1, Number.parseInt(c.req.query("pageSize") ?? "100", 10) || 100));
	const search = (c.req.query("q") ?? "").trim().replace(/[(),]/g, " ");
	let query = client.from(config.table).select(config.select, { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
	if (search) query = query.or(config.search.map((column) => `${column}.ilike.%${search}%`).join(","));
	const result = await query;
	if (result.error) return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	return c.json({ rows: result.data ?? [], count: result.count ?? 0, page, pageSize }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountModelsRouter.get("/catalog/model-form-options", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const [organisations, providers, families, benchmarks, previousModels, subscriptionPlans] = await Promise.all([
		client.from("v2_rpc_labs_legacy_shape").select("organisation_id,name").order("name", { ascending: true }),
		client.from("v2_rpc_providers_legacy_shape").select("api_provider_id,api_provider_name").order("api_provider_name", { ascending: true }),
		client.from("v2_model_families").select("family_id:family_slug,family_name:name").order("name", { ascending: true }),
		client.from("v2_rpc_benchmarks_legacy_shape").select("id,name").order("name", { ascending: true }),
		client.from("v2_rpc_models_legacy_shape").select("model_id,name").order("name", { ascending: true }).limit(500),
		client.from("v2_subscription_plans").select("plan_uuid,plan_id,name,frequency,price,currency").order("name", { ascending: true }).order("frequency", { ascending: true }).limit(1200),
	]);
	if ([organisations, providers, families, benchmarks, previousModels, subscriptionPlans].some((result) => result.error)) return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	return c.json({ organisations: organisations.data ?? [], providers: providers.data ?? [], families: families.data ?? [], benchmarks: benchmarks.data ?? [], previousModels: previousModels.data ?? [], subscriptionPlans: subscriptionPlans.data ?? [] }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountModelsRouter.get("/catalog/record", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const resource = c.req.query("resource");
	const id = (c.req.query("id") ?? "").trim();
	if (!id) return c.json({ error: "invalid_id" }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		if (resource === "organisation") {
			const [row, links] = await Promise.all([
				client.from("v2_rpc_labs_legacy_shape").select("organisation_id,name,description,country_code,colour").eq("organisation_id", id).maybeSingle(),
				client.from("v2_lab_links").select("platform,url").eq("lab_slug", id),
			]);
			if (row.error) throw row.error;
			if (links.error) throw links.error;
			return c.json({ row: row.data ?? null, links: links.data ?? [] }, 200, PRIVATE_NO_STORE_HEADERS);
		}
		const configs: Record<string, { table: string; select: string; column: string }> = {
			provider: { table: "v2_rpc_providers_legacy_shape", select: "api_provider_id,api_provider_name,description,link,country_code,prompt_training_policy", column: "api_provider_id" },
			benchmark: { table: "v2_rpc_benchmarks_legacy_shape", select: "id,name,category,link,ascending_order", column: "id" },
			model: { table: "v2_rpc_models_legacy_shape", select: "model_id,name", column: "model_id" },
		};
		const config = configs[resource ?? ""];
		if (!config) return c.json({ error: "invalid_resource" }, 400, PRIVATE_NO_STORE_HEADERS);
		const result = await client.from(config.table).select(config.select).eq(config.column, id).maybeSingle();
		if (result.error) throw result.error;
		return c.json({ row: result.data ?? null }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] catalog record failed", { resource, id, error });
		return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.get("/:modelId/source", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const requestedModelId = c.req.param("modelId");
	try {
		const alias = await client.from("v2_model_aliases").select("model_slug").eq("alias_slug", requestedModelId).eq("enabled", true).maybeSingle();
		if (alias.error) throw alias.error;
		const modelId = alias.data?.model_slug ?? requestedModelId;
		const [model, links, details, pricingSource, plans] = await Promise.all([
			client.from("v2_models").select("*,lab:v2_labs(*)").eq("model_slug", modelId).maybeSingle(),
			client.from("v2_model_links").select("link_kind,title,url,metadata").eq("model_slug", modelId),
			client.from("v2_model_details").select("detail_name,detail_value,detail_order").eq("model_slug", modelId).order("detail_order"),
			fetchModelPricingSources(c.env, [modelId], true),
			client.rpc("get_v2_model_subscription_plans", { p_model_slug: modelId }),
		]);
		if (model.error) throw model.error;
		if (links.error) throw links.error;
		if (details.error) throw details.error;
		if (plans.error) throw plans.error;
		return c.json({ source: { requestedModelId, canonicalApiId: modelId, internalModelId: modelId, model: model.data, links: links.data ?? [], details: details.data ?? [], providerRows: pricingSource.providerRows, pricingRules: pricingSource.pricingRows, subscriptionPlans: plans.data ?? [] } }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] source failed", { requestedModelId, error });
		return c.json({ error: "admin_model_source_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.all("*", async (c) => {
	if (c.req.method === "GET") return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const client = await requireAdmin(c.req.raw, c.env);
	if (!client) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	return c.json({
		error: "catalogue_is_repository_managed",
		message: "Submit catalogue changes through repository JSON; direct database mutations are disabled.",
	}, 409, PRIVATE_NO_STORE_HEADERS);
});
