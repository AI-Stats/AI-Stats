import { getServerAccountContext } from "@/lib/fetchers/internal/serverAccountContext";
import { fetchInternalWebApi } from "@/lib/web-api/client";

export type InternalProviderCatalogReview = {
	id: string;
	provider_slug: string;
	trigger: string;
	status: string;
	review_status: string;
	review_summary: Record<string, number> | null;
	catalog_url: string | null;
	catalog_sha256: string | null;
	model_count: number | null;
	error_message: string | null;
	started_at: string;
	completed_at: string | null;
	created_at: string;
	provider: { provider_slug: string; name: string; status: string } | null;
	models: Array<{
		run_id: string;
		provider_slug: string;
		model_slug: string;
		provider_model_slug: string;
		name: string;
		description: string | null;
		input_modalities: string[];
		output_modalities: string[];
		context_length: number | null;
		max_output_tokens: number | null;
		decision: "pending" | "approved" | "rejected" | "needs_changes";
		decision_reason: string | null;
		reviewed_at: string | null;
		created_at: string;
		capabilities: Array<{ id: string; parameters: string[] }>;
		candidate: null | { status: "pending_probe" | "probe_failed" | "probe_passed" | "promoted" | "rejected"; probe_summary: Record<string, unknown>; probed_at: string | null; promoted_at: string | null };
	}>;
};

export async function fetchInternalProviderCatalogReviews(): Promise<InternalProviderCatalogReview[]> {
	const context = await getServerAccountContext();
	const payload = await fetchInternalWebApi<{ reviews: InternalProviderCatalogReview[] }>(
		"/api/internal/provider-catalog/reviews",
		context.accessToken,
	);
	return payload.reviews;
}
