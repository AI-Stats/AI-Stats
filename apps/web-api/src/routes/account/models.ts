import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { fetchModelPricingSources } from "@/models/pricing";
import { getAdminCatalogueCounts, getAdminCatalogueRecord, getAdminModelFormOptions, getModelSubscriptionPlans, isAdminUser, listAdminCatalogue, loadAdminModelAuditSource, loadAdminModelSource, loadAdminPricingEditor, loadAdminProviderAuditSource, mutateAdminCatalogue, mutateAdminModelGraph, mutateAdminPricingSku, mutateAdminProviderRoute } from "@/repositories/admin-models";
import { z } from "zod";

const CANONICAL_SERVICE_TIERS = ["standard", "priority", "batch", "flex"] as const;

const catalogMutationSchemas = {
	organisations: z.object({ organisation_id: z.string().trim().min(1).optional(), name: z.string().trim().min(1), description: z.string().nullable().optional(), country_code: z.string().trim().min(2).max(3).nullable().optional(), colour: z.string().nullable().optional(), social_links: z.array(z.object({ platform: z.string().trim().min(1), url: z.url() })).default([]) }),
	providers: z.object({ api_provider_id: z.string().trim().min(1).optional(), api_provider_name: z.string().trim().min(1), description: z.string().nullable().optional(), link: z.string().nullable().optional(), country_code: z.string().trim().min(2).max(3).nullable().optional(), prompt_training_policy: z.string().nullable().optional(), prompt_training_notes: z.string().nullable().optional(), prompt_training_source_url: z.string().nullable().optional(), data_policy_tier: z.string().nullable().optional(), data_policy_confidence: z.string().nullable().optional(), data_policy_contract_mode: z.string().nullable().optional(), data_policy_contract_notes: z.string().nullable().optional(), status: z.string().nullable().optional() }),
	benchmarks: z.object({ id: z.string().trim().min(1).optional(), name: z.string().trim().min(1), category: z.string().nullable().optional(), link: z.string().nullable().optional(), ascending_order: z.boolean().nullable().optional() }),
	"subscription-plans": z.object({ plan_uuid: z.uuid().optional(), plan_id: z.string().trim().min(1), name: z.string().trim().min(1), organisation_id: z.string().nullable().optional(), description: z.string().nullable().optional(), frequency: z.string().nullable().optional(), price: z.number().finite().nullable().optional(), currency: z.string().nullable().optional(), link: z.string().nullable().optional(), other_info: z.record(z.string(), z.unknown()).default({}) }),
	models: z.object({ modelId: z.string().trim().min(1).optional(), name: z.string().trim().min(1), organisationId: z.string().trim().min(1).optional(), familyId: z.string().nullable().optional(), status: z.string().nullable().optional(), hidden: z.boolean().optional(), inputTypes: z.union([z.string(), z.array(z.string())]).nullable().optional(), outputTypes: z.union([z.string(), z.array(z.string())]).nullable().optional(), announcementDate: z.string().nullable().optional(), releaseDate: z.string().nullable().optional(), deprecationDate: z.string().nullable().optional(), retirementDate: z.string().nullable().optional(), license: z.string().nullable().optional(), previousModelId: z.string().nullable().optional() }),
} as const;

export const accountModelsRouter = new Hono<{ Bindings: Env }>();

const pricingMeterSchema = z.object({
	meter_key: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9._:-]*$/),
	modality: z.string().trim().min(1).max(40),
	direction: z.enum(["input", "output"]).nullable().optional(),
	unit: z.string().trim().min(1).max(80),
	unit_quantity: z.number().finite().positive(),
	price_nanos: z.number().int().nonnegative(),
	display_label: z.string().trim().min(1).max(120),
	display_unit: z.string().trim().min(1).max(120),
	billable: z.boolean().default(true),
	meter_order: z.number().int().min(0).max(10000).default(100),
	metadata: z.record(z.string(), z.unknown()).default({}),
});

const pricingSkuSchema = z.object({
	sku_id: z.uuid().optional(),
	provider_model_id: z.string().trim().min(1).max(240),
	sku_code: z.string().trim().min(1).max(160).regex(/^[a-z0-9][a-z0-9._:-]*$/),
	version: z.number().int().positive().default(1),
	operation: z.string().trim().min(1).max(120).default("inference"),
	status: z.enum(["draft", "active", "deprecated", "disabled"]).default("active"),
	region: z.string().trim().max(80).nullable().optional(),
	service_tier_slug: z.string().trim().min(1).max(120).default("standard"),
	display_name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2000).nullable().optional(),
	currency: z.string().trim().length(3).default("USD"),
	effective_from: z.iso.datetime({ offset: true }),
	effective_to: z.iso.datetime({ offset: true }).nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	meters: z.array(pricingMeterSchema).min(1).max(100),
}).superRefine((sku, context) => {
	if (sku.effective_to && new Date(sku.effective_to) <= new Date(sku.effective_from)) {
		context.addIssue({ code: "custom", path: ["effective_to"], message: "Effective end must be after effective start" });
	}
	const meterKeys = new Set<string>();
	for (const [index, meter] of sku.meters.entries()) {
		if (meterKeys.has(meter.meter_key)) context.addIssue({ code: "custom", path: ["meters", index, "meter_key"], message: "Meter keys must be unique within a SKU" });
		meterKeys.add(meter.meter_key);
	}
});

const modelGraphSchema = z.object({
	modelId: z.string().trim().min(1),
	name: z.string().trim().min(1).optional(),
	organisation_id: z.string().trim().min(1).optional(),
	status: z.string().nullable().optional(), hidden: z.boolean().optional(), license: z.string().nullable().optional(),
	announcement_date: z.string().nullable().optional(), release_date: z.string().nullable().optional(), deprecation_date: z.string().nullable().optional(), retirement_date: z.string().nullable().optional(),
	input_types: z.string().nullable().optional(), output_types: z.string().nullable().optional(), previous_model_id: z.string().nullable().optional(), family_id: z.string().nullable().optional(),
	model_details: z.array(z.object({ detail_name: z.string().trim().min(1), detail_value: z.unknown() })).optional(),
	links: z.array(z.object({ platform: z.string().optional(), kind: z.string().optional(), title: z.string().optional(), url: z.url() })).optional(),
	benchmark_results: z.array(z.record(z.string(), z.unknown())).optional(), subscription_plan_models: z.array(z.record(z.string(), z.unknown())).optional(),
	provider_models: z.array(z.record(z.string(), z.unknown())).optional(), provider_capabilities: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

const providerRouteSchema = z.object({
	provider_model_id: z.string().trim().min(1).optional(),
	provider_slug: z.string().trim().min(1),
	provider_model_slug: z.string().trim().min(1),
	status: z.enum(["active", "degraded", "disabled", "retired"]).default("active"),
	routing_enabled: z.boolean().default(false),
	input_modalities: z.array(z.string()).default([]), output_modalities: z.array(z.string()).default([]), regions: z.array(z.string()).default([]),
	context_length: z.number().int().positive().nullable().optional(), max_output_tokens: z.number().int().positive().nullable().optional(),
	effective_from: z.iso.datetime({ offset: true }).nullable().optional(), effective_to: z.iso.datetime({ offset: true }).nullable().optional(),
});

async function requireAdmin(request: Request, env: Env) {
	const user = await requireUser(request, env);
	if (!user) return null;
	return await isAdminUser(env, user.id);
}

async function requireAdminContext(request: Request, env: Env) {
	const user = await requireUser(request, env);
	if (!user) return { status: 401 as const, context: null };
	if (!await isAdminUser(env, user.id)) {
		return { status: 403 as const, context: null };
	}
	return { status: 200 as const, context: { user } };
}

accountModelsRouter.get("/audit/source", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!await requireAdmin(c.req.raw, c.env)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		return c.json(await loadAdminModelAuditSource(c.env, c.req.query("includeHidden") === "true"), 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] audit source failed", { error });
		return c.json({ error: "admin_model_audit_source_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.get("/provider-audit/source", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!await requireAdmin(c.req.raw, c.env)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try {
		return c.json(await loadAdminProviderAuditSource(c.env), 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] provider audit source failed", { error });
		return c.json({ error: "admin_provider_audit_source_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.get("/catalog/counts", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!await requireAdmin(c.req.raw, c.env)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { return c.json(await getAdminCatalogueCounts(c.env), 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountModelsRouter.get("/catalog/list", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!await requireAdmin(c.req.raw, c.env)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const resource = c.req.query("resource");
	if (!resource || !["models", "organisations", "providers", "benchmarks"].includes(resource)) return c.json({ error: "invalid_resource" }, 400, PRIVATE_NO_STORE_HEADERS);
	const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
	const pageSize = Math.min(100, Math.max(1, Number.parseInt(c.req.query("pageSize") ?? "100", 10) || 100));
	const search = (c.req.query("q") ?? "").trim().replace(/[(),]/g, " ");
	try { const result = await listAdminCatalogue(c.env, { resource: resource as "models" | "organisations" | "providers" | "benchmarks", search, page, pageSize }); return c.json({ ...result, page, pageSize }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountModelsRouter.get("/catalog/model-form-options", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!await requireAdmin(c.req.raw, c.env)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { return c.json(await getAdminModelFormOptions(c.env), 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountModelsRouter.get("/catalog/record", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!await requireAdmin(c.req.raw, c.env)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const resource = c.req.query("resource");
	const id = (c.req.query("id") ?? "").trim();
	if (!id) return c.json({ error: "invalid_id" }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		if (!resource || !["organisation", "provider", "benchmark", "model"].includes(resource)) return c.json({ error: "invalid_resource" }, 400, PRIVATE_NO_STORE_HEADERS);
		return c.json(await getAdminCatalogueRecord(c.env, resource, id), 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] catalog record failed", { resource, id, error });
		return c.json({ error: "admin_catalog_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.get("/:modelId/source", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	if (!await requireAdmin(c.req.raw, c.env)) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const requestedModelId = c.req.param("modelId");
	try {
		const source = await loadAdminModelSource(c.env, requestedModelId);
		const [pricingSource, plans] = await Promise.all([fetchModelPricingSources(c.env, [source.modelId], true), getModelSubscriptionPlans(c.env, source.modelId)]);
		return c.json({ source: { requestedModelId, canonicalApiId: source.modelId, internalModelId: source.modelId, model: source.model, links: source.links, details: source.details, providerRows: pricingSource.providerRows, pricingRules: pricingSource.pricingRows, subscriptionPlans: plans } }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] source failed", { requestedModelId, error });
		return c.json({ error: "admin_model_source_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

async function runCatalogMutation(c: any, resource: keyof typeof catalogMutationSchemas, action: "create" | "update" | "delete", id: string | null, rawPayload: unknown) {
	const admin = await requireAdminContext(c.req.raw, c.env);
	if (!admin.context) return c.json({ error: admin.status === 401 ? "unauthorized" : "forbidden" }, admin.status, PRIVATE_NO_STORE_HEADERS);
	let payload: Record<string, unknown> = {};
	if (action !== "delete") {
		const parsed = catalogMutationSchemas[resource].safeParse(rawPayload);
		if (!parsed.success) return c.json({ error: "invalid_catalogue_record", issues: parsed.error.issues }, 400, PRIVATE_NO_STORE_HEADERS);
		payload = parsed.data as Record<string, unknown>;
	}
	const resourceId = id ?? String(payload.organisation_id ?? payload.api_provider_id ?? payload.id ?? payload.plan_uuid ?? payload.modelId ?? "");
	if (!resourceId) return c.json({ error: "invalid_catalogue_id" }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		const result = await mutateAdminCatalogue(c.env, { actorUserId: admin.context.user.id, resource, action, resourceId, payload });
		return c.json({ success: true, record: result }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		return c.json({ error: "admin_catalogue_mutation_failed", message: error instanceof Error ? error.message : "Catalogue mutation failed" }, 409, PRIVATE_NO_STORE_HEADERS);
	}
}

for (const resource of ["organisations", "providers", "benchmarks", "subscription-plans"] as const) {
	accountModelsRouter.post(`/catalog/${resource}`, async (c) => runCatalogMutation(c, resource, "create", null, await c.req.json().catch(() => null)));
	accountModelsRouter.put(`/catalog/${resource}/:id`, async (c) => runCatalogMutation(c, resource, "update", c.req.param("id"), await c.req.json().catch(() => null)));
	accountModelsRouter.delete(`/catalog/${resource}/:id`, async (c) => runCatalogMutation(c, resource, "delete", c.req.param("id"), {}));
}

accountModelsRouter.post("/", async (c) => runCatalogMutation(c, "models", "create", null, await c.req.json().catch(() => null)));
accountModelsRouter.delete("/catalog/models/:id", async (c) => runCatalogMutation(c, "models", "delete", c.req.param("id"), {}));

accountModelsRouter.put("/:modelId/graph", async (c) => {
	const admin = await requireAdminContext(c.req.raw, c.env);
	if (!admin.context) return c.json({ error: admin.status === 401 ? "unauthorized" : "forbidden" }, admin.status, PRIVATE_NO_STORE_HEADERS);
	const parsed = modelGraphSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success || parsed.data.modelId !== c.req.param("modelId")) return c.json({ error: "invalid_model_graph", issues: parsed.success ? [] : parsed.error.issues }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		const result = await mutateAdminModelGraph(c.env, { actorUserId: admin.context.user.id, modelSlug: parsed.data.modelId, payload: parsed.data });
		return c.json({ ok: true, graph: result }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		return c.json({ ok: false, error: error instanceof Error ? error.message : "Model graph mutation failed" }, 409, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.get("/:modelId/pricing-editor", async (c) => {
	const admin = await requireAdminContext(c.req.raw, c.env);
	if (!admin.context) return c.json({ error: admin.status === 401 ? "unauthorized" : "forbidden" }, admin.status, PRIVATE_NO_STORE_HEADERS);
	const modelId = c.req.param("modelId");
	try {
		const source = await loadAdminPricingEditor(c.env, modelId, CANONICAL_SERVICE_TIERS);
		if (!source) return c.json({ error: "model_not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
		const returnedTiers = new Map(source.serviceTiers.map((tier) => [tier.service_tier_slug, tier]));
		const canonicalServiceTiers = CANONICAL_SERVICE_TIERS.map((slug) => returnedTiers.get(slug) ?? { service_tier_slug: slug, display_name: slug[0].toUpperCase() + slug.slice(1), status: "active" });
		return c.json({ ...source, serviceTiers: canonicalServiceTiers }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] pricing editor source failed", { modelId, error });
		return c.json({ error: "admin_pricing_source_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.put("/:modelId/provider-routes", async (c) => {
	const admin = await requireAdminContext(c.req.raw, c.env);
	if (!admin.context) return c.json({ error: admin.status === 401 ? "unauthorized" : "forbidden" }, admin.status, PRIVATE_NO_STORE_HEADERS);
	const parsed = providerRouteSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "invalid_provider_route", issues: parsed.error.issues }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		const result = await mutateAdminProviderRoute(c.env, { actorUserId: admin.context.user.id, modelSlug: c.req.param("modelId"), route: parsed.data });
		return c.json({ route: result }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		return c.json({ error: "admin_provider_route_failed", message: error instanceof Error ? error.message : "Provider route mutation failed" }, 409, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.put("/:modelId/pricing-editor", async (c) => {
	const admin = await requireAdminContext(c.req.raw, c.env);
	if (!admin.context) return c.json({ error: admin.status === 401 ? "unauthorized" : "forbidden" }, admin.status, PRIVATE_NO_STORE_HEADERS);
	const parsed = pricingSkuSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "invalid_pricing_sku", issues: parsed.error.issues }, 400, PRIVATE_NO_STORE_HEADERS);
	const modelId = c.req.param("modelId");
	try {
		const result = await mutateAdminPricingSku(c.env, { actorUserId: admin.context.user.id, modelSlug: modelId, action: "save", sku: parsed.data });
		return c.json({ pricing: result }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] pricing save failed", { modelId, error });
		return c.json({ error: "admin_pricing_save_failed", message: error instanceof Error ? error.message : "Pricing save failed" }, 409, PRIVATE_NO_STORE_HEADERS);
	}
});

accountModelsRouter.delete("/:modelId/pricing-editor/:skuId", async (c) => {
	const admin = await requireAdminContext(c.req.raw, c.env);
	if (!admin.context) return c.json({ error: admin.status === 401 ? "unauthorized" : "forbidden" }, admin.status, PRIVATE_NO_STORE_HEADERS);
	const skuId = z.uuid().safeParse(c.req.param("skuId"));
	if (!skuId.success) return c.json({ error: "invalid_sku_id" }, 400, PRIVATE_NO_STORE_HEADERS);
	const modelId = c.req.param("modelId");
	try {
		const result = await mutateAdminPricingSku(c.env, { actorUserId: admin.context.user.id, modelSlug: modelId, action: "delete", sku: { sku_id: skuId.data } });
		return c.json({ pricing: result }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/models] pricing delete failed", { modelId, skuId: skuId.data, error });
		return c.json({ error: "admin_pricing_delete_failed", message: error instanceof Error ? error.message : "Pricing delete failed" }, 409, PRIVATE_NO_STORE_HEADERS);
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
