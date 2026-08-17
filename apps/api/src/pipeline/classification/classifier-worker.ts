import * as classificationRepository from "@/repositories/classification";
import { getBindings } from "@/runtime/env";

type ContributionRow = {
	id: string;
	workspace_id: string;
	request_id: string;
	occurred_at: string;
	model_slug: string;
	provider_slug: string | null;
	object_key: string;
	input_tokens: number | null;
	output_tokens: number | null;
	attempt_count: number;
};

type ClassifierRow = {
	id: string;
	workspace_id: string;
	slug: string;
	name: string;
	instructions: string;
	categories: Record<string, unknown>;
	model: string;
	service_tier: "standard" | "flex";
	sample_rate_bps: number;
};

type Classification = {
	primary_category: string;
	labels: string[];
	confidence: number | null;
};

export const STARTER_TASK_CATEGORIES = {
	code: ["code_generation", "code_explanation", "code_review", "debugging", "tool_use"],
	data: ["analysis", "extraction", "classification", "structured_output", "math"],
	agent: ["planning", "research", "web_search", "multi_step", "automation"],
	general: ["chat", "creative_writing", "translation", "summarization", "question_answering", "other"],
} as const;

export const STARTER_CLASSIFIER_SLUG = "phaseo-task-v1";
export const ALLOWED_CLASSIFIER_MODELS = new Set(["gpt-5-mini"]);

export const STARTER_TASK_INSTRUCTIONS = [
	"Classify the user request by its primary task, not its subject matter.",
	"Choose exactly one primary category from the supplied taxonomy and zero or more labels.",
	"Use other only when no more specific label applies.",
	"Do not repeat or quote any request content in the output.",
].join(" ");

export function starterClassifierRow(workspaceId: string, createdBy?: string | null) {
	return {
		workspace_id: workspaceId,
		slug: STARTER_CLASSIFIER_SLUG,
		name: "Task categories",
		description: "Task taxonomy starter preset.",
		kind: "phaseo_task",
		instructions: STARTER_TASK_INSTRUCTIONS,
		categories: STARTER_TASK_CATEGORIES,
		model: "gpt-5-mini",
		service_tier: "flex",
		sample_rate_bps: 10000,
		enabled: true,
		created_by: createdBy ?? null,
		updated_at: new Date().toISOString(),
	};
}

export async function ensureStarterClassifier(workspaceId: string, createdBy?: string | null): Promise<void> {
	const row = starterClassifierRow(workspaceId, createdBy);
	await classificationRepository.ensureClassifier({
		workspaceId: row.workspace_id, slug: row.slug, name: row.name,
		description: row.description, kind: row.kind, instructions: row.instructions,
		categories: row.categories, model: row.model, serviceTier: row.service_tier,
		sampleRateBps: row.sample_rate_bps, enabled: row.enabled,
		createdBy: row.created_by, updatedAt: row.updated_at,
	});
}

function flattenCategories(categories: Record<string, unknown>): string[] {
	return Array.from(new Set(Object.entries(categories).flatMap(([group, values]) => [
		group,
		...(Array.isArray(values) ? values.map(String) : []),
	]))).filter(Boolean);
}

async function classifierSampleBucket(contributionId: string, classifierId: string): Promise<number> {
	const bytes = new TextEncoder().encode(`${contributionId}:${classifierId}`);
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
	return (((digest[0] << 8) | digest[1]) >>> 0) % 10_000;
}

function extractResponseText(payload: any): string {
	if (typeof payload?.output_text === "string") return payload.output_text;
	for (const item of Array.isArray(payload?.output) ? payload.output : []) {
		for (const content of Array.isArray(item?.content) ? item.content : []) {
			if (typeof content?.text === "string") return content.text;
		}
	}
	throw new Error("classifier_response_missing_output");
}

async function classify(payload: unknown, classifier: ClassifierRow): Promise<{ value: Classification; latencyMs: number }> {
	const bindings = getBindings();
	const apiKey = bindings.OPENAI_API_KEY?.trim();
	if (!apiKey) throw new Error("classifier_openai_key_missing");
	const allowed = flattenCategories(classifier.categories);
	if (!allowed.length) throw new Error("classifier_categories_empty");
	const startedAt = Date.now();
	const response = await fetch(`${(bindings.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/responses`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: classifier.model || bindings.DATA_CONTRIBUTION_CLASSIFIER_MODEL || "gpt-5-mini",
			service_tier: classifier.service_tier || bindings.DATA_CONTRIBUTION_CLASSIFIER_SERVICE_TIER || "flex",
			store: false,
			instructions: classifier.instructions,
			input: JSON.stringify(payload).slice(0, 200_000),
			max_output_tokens: 300,
			text: {
				format: {
					type: "json_schema",
					name: "request_classification",
					strict: true,
					schema: {
						type: "object",
						additionalProperties: false,
						required: ["primary_category", "labels", "confidence"],
						properties: {
							primary_category: { type: "string", enum: allowed },
							labels: { type: "array", items: { type: "string", enum: allowed }, maxItems: 8 },
							confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
						},
					},
				},
			},
		}),
	});
	if (!response.ok) {
		const detail = (await response.text()).slice(0, 500);
		throw new Error(`classifier_http_${response.status}:${detail}`);
	}
	const parsed = JSON.parse(extractResponseText(await response.json())) as Classification;
	if (!allowed.includes(parsed.primary_category)) throw new Error("classifier_category_invalid");
	return {
		value: {
			primary_category: parsed.primary_category,
			labels: Array.from(new Set((parsed.labels ?? []).filter((label) => allowed.includes(label)))).slice(0, 8),
			confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
		},
		latencyMs: Date.now() - startedAt,
	};
}

async function completeContribution(contribution: ContributionRow, classifiers: ClassifierRow[], payload: unknown): Promise<void> {
	const completedClassifierIds = new Set(await classificationRepository.listCompletedClassifierIds(contribution.id));
	for (const classifier of classifiers) {
		if (await classifierSampleBucket(contribution.id, classifier.id) >= classifier.sample_rate_bps) continue;
		if (!completedClassifierIds.has(classifier.id)) {
			const result = await classify(payload, classifier);
			await classificationRepository.upsertClassification({
				contributionId: contribution.id,
				workspaceId: contribution.workspace_id,
				classifierId: classifier.id,
				primaryCategory: result.value.primary_category,
				labels: result.value.labels,
				confidence: result.value.confidence == null ? null : String(result.value.confidence),
				model: classifier.model,
				serviceTier: classifier.service_tier,
				latencyMs: result.latencyMs,
			});
		}

		await classificationRepository.refreshClassificationRollup(contribution.id, classifier.id);
	}
	const now = new Date().toISOString();
	await classificationRepository.completeContribution(contribution.id, now);
}

async function failContribution(contribution: ContributionRow, error: unknown): Promise<void> {
	const terminal = contribution.attempt_count >= 8;
	const backoffSeconds = Math.min(3600, 30 * (2 ** Math.min(contribution.attempt_count, 7)));
	await classificationRepository.failContribution(
		contribution.id,
		new Date(Date.now() + (terminal ? 86_400 : backoffSeconds) * 1000).toISOString(),
		(error instanceof Error ? error.message : String(error)).slice(0, 1000),
		new Date().toISOString(),
	);
}

export async function runDataContributionClassifierJob(args?: { limit?: number; concurrency?: number }) {
	const bindings = getBindings();
	const limit = Math.max(1, Math.min(250, Math.trunc(args?.limit ?? 25)));
	const concurrency = Math.max(1, Math.min(16, Math.trunc(args?.concurrency ?? 4)));
	const rows = await classificationRepository.claimContributions(limit, 600) as ContributionRow[];
	let completed = 0;
	let failed = 0;
	let cursor = 0;
	const workers = Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
		while (cursor < rows.length) {
			const contribution = rows[cursor++];
			try {
				const [object, classifiersResult] = await Promise.all([
					bindings.DATA_CONTRIBUTIONS_BUCKET?.get(contribution.object_key),
					classificationRepository.listEnabledClassifiers(contribution.workspace_id),
				]);
				if (!object) throw new Error("contribution_object_missing");
				const storedPayload = JSON.parse(await object.text()) as Record<string, unknown>;
				await completeContribution(
					contribution,
					classifiersResult as ClassifierRow[],
					{ request: storedPayload.request ?? null, response: storedPayload.response ?? null },
				);
				completed += 1;
			} catch (error) {
				failed += 1;
				await failContribution(contribution, error);
			}
		}
	});
	await Promise.all(workers);
	await classificationRepository.refreshPublicModelTaskDaily(
		new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
	);
	return { claimed: rows.length, completed, failed };
}
