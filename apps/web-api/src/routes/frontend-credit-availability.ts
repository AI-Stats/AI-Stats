import { Hono } from "hono";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS, withPublicCache } from "@/http/cache";
import { buildRestrictedModelPreview } from "@/lib/credits/routeAvailability";
import { loadModelAvailabilitySources } from "@/repositories/model-availability";

export const frontendCreditAvailabilityRouter = new Hono<{ Bindings: Env }>();

frontendCreditAvailabilityRouter.get("/credits/model-availability", async (c) => {
	const countryCode = c.req.query("country")?.trim().toUpperCase() ?? "";
	if (!/^[A-Z]{2}$/.test(countryCode) || countryCode === "XX") {
		return c.json({ error: "invalid_country" }, 400, PRIVATE_NO_STORE_HEADERS);
	}

	try {
		const { routes: routeRows, providers: providerRows, models: modelRows } = await loadModelAvailabilitySources(c.env);

		const providerAvailability = new Map(providerRows.map((provider) => {
			const metadata = provider.metadata && typeof provider.metadata === "object" && !Array.isArray(provider.metadata)
				? provider.metadata as Record<string, unknown>
				: {};
			return [String(provider.provider_slug), metadata.availability] as const;
		}));
		const nowMs = Date.now();
		const routes = routeRows.flatMap((route) => {
			const effectiveFrom = route.effective_from ? Date.parse(String(route.effective_from)) : Number.NaN;
			const effectiveTo = route.effective_to ? Date.parse(String(route.effective_to)) : Number.NaN;
			if ((Number.isFinite(effectiveFrom) && nowMs < effectiveFrom) || (Number.isFinite(effectiveTo) && nowMs >= effectiveTo)) return [];
			const metadata = route.metadata && typeof route.metadata === "object" && !Array.isArray(route.metadata)
				? route.metadata as Record<string, unknown>
				: {};
			return [{
				modelSlug: String(route.model_slug ?? ""),
				availability: metadata.availability ?? providerAvailability.get(String(route.provider_slug ?? "")),
			}];
		});
		const preview = buildRestrictedModelPreview({
			countryCode,
			routes,
			models: modelRows.map((model) => {
				return {
					modelSlug: String(model.model_slug ?? ""),
					name: model.name == null ? null : String(model.name),
					logoId: model.lab_slug == null ? null : String(model.lab_slug),
					organisationName: model.lab_name == null ? null : String(model.lab_name),
				};
			}),
			nowMs,
		});

		return withPublicCache(c.json({ countryCode, ...preview }), {
			browserTtlSeconds: 15 * 60,
			cacheTags: ["web-api-credit-model-availability"],
			edgeTtlSeconds: 15 * 60,
			staleWhileRevalidateSeconds: 15 * 60,
		});
	} catch (error) {
		console.error("[web-api/credit-model-availability] failed", error);
		return c.json({ error: "model_availability_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});
