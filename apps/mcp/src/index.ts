import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
	authenticatePhaseoUser,
	type AuthenticatedPhaseoUser,
	type PhaseoEnv,
	getModel,
	listModels,
	listProviders,
	PhaseoApiError,
	readControlPlane,
} from "./phaseo-api";

const MAX_RESULTS = 20;
const MAX_MCP_REQUEST_BODY_BYTES = 1024 * 1024;
const MCP_CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers":
		"Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, MCP-Method, MCP-Name, Last-Event-ID, Traceparent, Tracestate, Baggage",
	"Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Session-Id, MCP-Protocol-Version",
	"Access-Control-Max-Age": "86400",
} as const;

async function boundedMcpRequest(request: Request): Promise<Request | Response> {
	const contentLength = Number(request.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > MAX_MCP_REQUEST_BODY_BYTES) {
		return new Response("MCP request body is too large.", { status: 413 });
	}
	if (!request.body) return request;
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > MAX_MCP_REQUEST_BODY_BYTES) {
				await reader.cancel();
				return new Response("MCP request body is too large.", { status: 413 });
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	const headers = new Headers(request.headers);
	headers.delete("content-length");
	return new Request(request, { headers, body });
}
const READ_ONLY_MCP_SCOPES = [
	"models:read",
	"providers:read",
	"pricing:read",
	"credits:read",
	"activity:read",
	"analytics:read",
	"generations:read",
] as const;

type QueryValue = string | number | boolean | undefined;
type ReadToolInput = Record<string, unknown>;
type McpZodRawShape = Record<string, z.ZodType>;

type ReadToolDefinition = {
	name: string;
	title: string;
	description: string;
	scopes: readonly string[];
	inputSchema: McpZodRawShape;
	path: (input: ReadToolInput) => string;
	query?: (input: ReadToolInput) => Record<string, QueryValue>;
};

const paginationInputSchema = {
	limit: z.number().int().min(1).max(250).optional(),
	offset: z.number().int().nonnegative().optional(),
};

const controlPlaneReadTools: ReadToolDefinition[] = [
	{
		name: "credits_get",
		title: "Get Phaseo credit balance",
		description: "Get current credit and usage totals for the authenticated workspace. Read-only.",
		scopes: ["credits:read"],
		inputSchema: {},
		path: () => "/v1/credits",
	},
	{
		name: "activity_list",
		title: "List Phaseo activity",
		description: "List recent billable gateway activity for the authenticated workspace. Read-only.",
		scopes: ["activity:read"],
		inputSchema: { days: z.number().int().min(1).max(90).optional(), ...paginationInputSchema },
		path: () => "/v1/activity",
		query: ({ days, limit, offset }) => ({ days: days as number | undefined, limit: limit as number | undefined, offset: offset as number | undefined }),
	},
	{
		name: "analytics_get",
		title: "Get Phaseo analytics",
		description: "Get model and provider usage analytics for a workspace and optional date. Read-only.",
		scopes: ["analytics:read"],
		inputSchema: { date: z.string().date().optional() },
		path: () => "/v1/analytics",
		query: ({ date }) => ({ date: date as string | undefined }),
	},
	{
		name: "generation_get",
		title: "Get a Phaseo generation",
		description: "Retrieve cost, routing, token, and provider metadata for one Phaseo request ID. Read-only.",
		scopes: ["generations:read"],
		inputSchema: { requestId: z.string().min(1).max(200) },
		path: () => "/v1/generations",
		query: ({ requestId }) => ({ id: requestId as string }),
	},
	{
		name: "logs_list",
		title: "List Phaseo request logs",
		description: "Search request logs by time, status, provider, model, endpoint, request, key, session, or error code. Read-only.",
		scopes: ["activity:read"],
		inputSchema: {
			since: z.string().max(50).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(),
			status: z.string().max(50).optional(), provider: z.string().max(100).optional(), model: z.string().max(200).optional(),
			endpoint: z.string().max(100).optional(), requestId: z.string().max(200).optional(),
			errorCode: z.string().max(100).optional(), ...paginationInputSchema,
		},
		path: () => "/v1/logs",
		query: (input) => ({
			since: input.since as string | undefined, from: input.from as string | undefined, to: input.to as string | undefined,
			status: input.status as string | undefined, provider: input.provider as string | undefined, model: input.model as string | undefined,
			endpoint: input.endpoint as string | undefined, request_id: input.requestId as string | undefined,
			error_code: input.errorCode as string | undefined,
			limit: input.limit as number | undefined, offset: input.offset as number | undefined,
		}),
	},
	{
		name: "log_get",
		title: "Get a Phaseo request log",
		description: "Retrieve one request log by request ID. Read-only.",
		scopes: ["activity:read"],
		inputSchema: { requestId: z.string().min(1).max(200) },
		path: ({ requestId }) => `/v1/logs/${encodeURIComponent(String(requestId))}`,
	},
];

const modelSummarySchema = {
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	provider: z.string().nullable(),
	contextTokens: z.number().int().nullable(),
	inputModalities: z.array(z.string()),
	outputModalities: z.array(z.string()),
	inputPricePerToken: z.string().nullable(),
	outputPricePerToken: z.string().nullable(),
	supportsTools: z.boolean(),
	availableProviders: z.array(z.string()),
};

const providerSchema = {
	api_provider_id: z.string(),
	api_provider_name: z.string().nullable(),
	description: z.string().nullable(),
	link: z.string().nullable(),
	country_code: z.string().nullable(),
};

function oauthToolMeta(scopes: readonly string[]) {
	return { securitySchemes: [{ type: "oauth2", scopes: [...scopes] }] };
}

function normalise(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? "";
}

function tokenRate(value: string | null | undefined): number | null {
	if (value === null || value === undefined || value.trim() === "") return null;
	const rate = Number(value);
	return Number.isFinite(rate) ? rate : null;
}

function modelSummary(model: Awaited<ReturnType<typeof listModels>>[number]) {
	return {
		id: model.id,
		name: model.name,
		description: model.description,
		provider: model.organisation?.name ?? null,
		contextTokens: model.context_length ?? model.top_provider?.context_length ?? null,
		inputModalities: model.architecture.input_modalities,
		outputModalities: model.architecture.output_modalities,
		inputPricePerToken: model.pricing.prompt ?? null,
		outputPricePerToken: model.pricing.completion ?? null,
		supportsTools: model.supported_parameters.includes("tools"),
		availableProviders: model.providers.map((provider) => provider.api_provider_id),
	};
}

function providerSummary(provider: Awaited<ReturnType<typeof listProviders>>[number]) {
	return {
		api_provider_id: provider.api_provider_id,
		api_provider_name: provider.api_provider_name,
		description: provider.description,
		link: provider.link,
		country_code: provider.country_code,
	};
}

function errorResult(error: unknown) {
	const message = error instanceof PhaseoApiError ? error.message : "Phaseo could not complete this request.";
	return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

function hasScopes(authenticatedUser: AuthenticatedPhaseoUser, scopes: readonly string[]): boolean {
	return scopes.every((scope) => authenticatedUser.scopes.includes(scope));
}

const requestSummarySchema = z.object({
	requestId: z.string().nullable(),
	timestamp: z.string().nullable(),
	provider: z.string().nullable(),
	model: z.string().nullable(),
	endpoint: z.string().nullable(),
	statusCode: z.number().nullable(),
	success: z.boolean().nullable(),
	errorCode: z.string().nullable(),
	latencyMs: z.number().nullable(),
	generationMs: z.number().nullable(),
	inputTokens: z.number().nullable(),
	outputTokens: z.number().nullable(),
	cachedTokens: z.number().nullable(),
	reasoningTokens: z.number().nullable(),
	totalTokens: z.number().nullable(),
	costUsd: z.number().nullable(),
	currency: z.string().nullable(),
	stream: z.boolean().nullable(),
	byok: z.boolean().nullable(),
	throughput: z.number().nullable(),
	location: z.string().nullable(),
	finishReason: z.string().nullable(),
});

const submissionControlOutputSchemas: Record<string, McpZodRawShape> = {
	credits_get: {
		credits: z.object({
			balanceNanos: z.number(),
			reservedNanos: z.number(),
			availableNanos: z.number(),
			thirtyDayUsageNanos: z.number().nullable(),
			thirtyDayRequests: z.number(),
		}),
	},
	activity_list: {
		periodDays: z.number(),
		total: z.number(),
		limit: z.number(),
		offset: z.number(),
		totalCostUsd: z.number(),
		activity: z.array(requestSummarySchema),
	},
	analytics_get: {
		analytics: z.array(z.object({
			date: z.string(),
			model: z.string(),
			modelId: z.string(),
			endpoint: z.string(),
			provider: z.string(),
			costUsd: z.number(),
			byokCostUsd: z.number(),
			requests: z.number(),
			inputTokens: z.number(),
			outputTokens: z.number(),
			reasoningTokens: z.number(),
		})),
	},
	generation_get: { generation: requestSummarySchema },
	logs_list: {
		logs: z.array(requestSummarySchema),
		total: z.number(),
		limit: z.number(),
		offset: z.number(),
		from: z.string(),
		to: z.string().nullable(),
	},
	log_get: { log: requestSummarySchema },
};

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}

function asRecords(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.map(asRecord) : [];
}

function firstString(record: Record<string, unknown>, ...keys: string[]): string | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

function firstNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim()) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	return null;
}

function firstBoolean(record: Record<string, unknown>, ...keys: string[]): boolean | null {
	for (const key of keys) {
		if (typeof record[key] === "boolean") return record[key] as boolean;
	}
	return null;
}

function normaliseRequestSummary(value: unknown) {
	const record = asRecord(value);
	const usage = asRecord(record.usage);
	const inputDetails = asRecord(usage.input_tokens_details ?? usage.prompt_tokens_details);
	const outputDetails = asRecord(usage.output_tokens_details ?? usage.completion_tokens_details);
	const inputTokens = firstNumber(usage, "input_tokens", "prompt_tokens");
	const outputTokens = firstNumber(usage, "output_tokens", "completion_tokens");
	const cachedTokens = firstNumber(usage, "cached_tokens", "cached_input_tokens")
		?? firstNumber(inputDetails, "cached_tokens");
	const reasoningTokens = firstNumber(usage, "reasoning_tokens")
		?? firstNumber(outputDetails, "reasoning_tokens");
	const totalTokens = firstNumber(usage, "total_tokens") ?? (
		inputTokens !== null || outputTokens !== null || reasoningTokens !== null
			? (inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0)
			: null
	);
	const costNanos = firstNumber(record, "cost_nanos");
	const costCents = firstNumber(record, "cost_cents");
	return {
		requestId: firstString(record, "request_id"),
		timestamp: firstString(record, "created_at", "timestamp"),
		provider: firstString(record, "provider"),
		model: firstString(record, "routed_model_id", "canonical_model_id", "model_id", "model"),
		endpoint: firstString(record, "endpoint"),
		statusCode: firstNumber(record, "status_code"),
		success: firstBoolean(record, "success"),
		errorCode: firstString(record, "error_code"),
		latencyMs: firstNumber(record, "latency_ms"),
		generationMs: firstNumber(record, "generation_ms"),
		inputTokens,
		outputTokens,
		cachedTokens,
		reasoningTokens,
		totalTokens,
		costUsd: costNanos !== null ? costNanos / 1_000_000_000 : costCents !== null ? costCents / 100 : null,
		currency: firstString(record, "currency") ?? (costNanos !== null || costCents !== null ? "USD" : null),
		stream: firstBoolean(record, "stream"),
		byok: firstBoolean(record, "byok"),
		throughput: firstNumber(record, "throughput"),
		location: firstString(record, "location"),
		finishReason: firstString(record, "finish_reason"),
	};
}

export function normaliseControlPlaneResult(name: string, value: unknown): Record<string, unknown> {
	const record = asRecord(value);
	switch (name) {
		case "credits_get": {
			const credits = asRecord(record.credits);
			return { credits: {
				balanceNanos: firstNumber(credits, "balance_nanos") ?? 0,
				reservedNanos: firstNumber(credits, "reserved_nanos") ?? 0,
				availableNanos: firstNumber(credits, "available_nanos", "remaining") ?? 0,
				thirtyDayUsageNanos: firstNumber(credits, "thirty_day_usage"),
				thirtyDayRequests: firstNumber(credits, "thirty_day_requests") ?? 0,
			} };
		}
		case "activity_list":
			return {
				periodDays: firstNumber(record, "period_days") ?? 0,
				total: firstNumber(record, "total") ?? 0,
				limit: firstNumber(record, "limit") ?? 0,
				offset: firstNumber(record, "offset") ?? 0,
				totalCostUsd: (firstNumber(record, "total_cost_cents") ?? 0) / 100,
				activity: asRecords(record.activity).map(normaliseRequestSummary),
			};
		case "analytics_get":
			return { analytics: asRecords(record.data).map((item) => ({
				date: firstString(item, "date") ?? "unknown",
				model: firstString(item, "model") ?? "unknown",
				modelId: firstString(item, "model_permaslug") ?? "unknown/unknown",
				endpoint: firstString(item, "endpoint_id") ?? "unknown",
				provider: firstString(item, "provider_name") ?? "unknown",
				costUsd: firstNumber(item, "usage") ?? 0,
				byokCostUsd: firstNumber(item, "byok_usage_inference") ?? 0,
				requests: firstNumber(item, "requests") ?? 0,
				inputTokens: firstNumber(item, "prompt_tokens") ?? 0,
				outputTokens: firstNumber(item, "completion_tokens") ?? 0,
				reasoningTokens: firstNumber(item, "reasoning_tokens") ?? 0,
			})) };
		case "generation_get":
			return { generation: normaliseRequestSummary(record) };
		case "logs_list":
			return {
				logs: asRecords(record.data).map(normaliseRequestSummary),
				total: firstNumber(record, "total") ?? 0,
				limit: firstNumber(record, "limit") ?? 0,
				offset: firstNumber(record, "offset") ?? 0,
				from: firstString(record, "from") ?? "unknown",
				to: firstString(record, "to"),
			};
		case "log_get":
			return { log: normaliseRequestSummary(record.data) };
		default:
			throw new PhaseoApiError("This Phaseo MCP tool is not available in the public plugin.");
	}
}

function registerControlPlaneReadTools(
	server: McpServer,
	env: PhaseoEnv,
	authenticatedUser: AuthenticatedPhaseoUser,
): void {
	for (const definition of controlPlaneReadTools) {
		if (!hasScopes(authenticatedUser, definition.scopes)) continue;
		const outputSchema = submissionControlOutputSchemas[definition.name];
		if (!outputSchema) continue;
		server.registerTool(
			definition.name,
			{
				title: definition.title,
				description: definition.description,
				inputSchema: definition.inputSchema,
				outputSchema,
				annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
				_meta: oauthToolMeta(definition.scopes),
			},
			async (input) => {
				try {
					const result = await readControlPlane(
						env,
						definition.path(input),
						{ accessToken: authenticatedUser.accessToken },
						definition.query?.(input) ?? {},
					);
					return {
						content: [{ type: "text" as const, text: `${definition.title} completed.` }],
						structuredContent: normaliseControlPlaneResult(definition.name, result),
					};
				} catch (error) {
					return errorResult(error);
				}
			},
		);
	}
}

export function createServer(env: PhaseoEnv, authenticatedUser: AuthenticatedPhaseoUser): McpServer {
	const server = new McpServer(
		{ name: "Phaseo", version: "0.3.0" },
		{
			instructions:
				"Phaseo provides live model, provider, pricing, and authenticated workspace data. For current availability or pricing questions, use Phaseo tools instead of relying on model memory. Treat cost results as estimates. All Phaseo MCP tools are read-only; use the Phaseo dashboard, CLI, or Management API for administrative changes.",
		},
	);

	if (
		authenticatedUser.scopes.includes("models:read") &&
		authenticatedUser.scopes.includes("pricing:read")
	) server.registerTool(
		"models_list",
		{
			title: "Search Phaseo models",
			description: "Search the live Phaseo model catalogue by name, provider, modality, minimum context length, or maximum input price. Read-only.",
			inputSchema: {
				query: z.string().max(200).optional(),
				provider: z.string().max(100).optional(),
				modality: z.enum(["text", "image", "audio", "video"]).optional(),
				minimumContextTokens: z.number().int().positive().optional(),
				maximumInputPricePerMillion: z.number().nonnegative().optional(),
				limit: z.number().int().min(1).max(MAX_RESULTS).default(10),
			},
			outputSchema: { models: z.array(z.object(modelSummarySchema)) },
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
			_meta: oauthToolMeta(["models:read", "pricing:read"]),
		},
		async ({ query, provider, modality, minimumContextTokens, maximumInputPricePerMillion, limit }) => {
			try {
				const queryTerms = normalise(query).split(/\s+/).filter(Boolean);
				const models = (await listModels(env, 250, { accessToken: authenticatedUser.accessToken })).filter((model) => {
					const searchable = normalise([model.id, model.name, model.description, model.organisation?.name].filter(Boolean).join(" "));
					const inputPrice = Number(model.pricing.prompt);
					return (
						queryTerms.every((term) => searchable.includes(term)) &&
						(!provider || normalise(model.organisation?.name).includes(normalise(provider))) &&
						(!modality || model.architecture.input_modalities.map(normalise).includes(modality)) &&
						(!minimumContextTokens || (model.context_length ?? model.top_provider?.context_length ?? 0) >= minimumContextTokens) &&
						(maximumInputPricePerMillion === undefined || (Number.isFinite(inputPrice) && inputPrice * 1_000_000 <= maximumInputPricePerMillion))
					);
				}).slice(0, limit);
				const result = models.map(modelSummary);
				return {
					content: [{ type: "text" as const, text: `Found ${result.length} matching Phaseo model${result.length === 1 ? "" : "s"}.` }],
					structuredContent: { models: result },
				};
			} catch (error) { return errorResult(error); }
		},
	);

	if (
		authenticatedUser.scopes.includes("models:read") &&
		authenticatedUser.scopes.includes("pricing:read")
	) server.registerTool(
		"model_get",
		{
			title: "Get a Phaseo model",
			description: "Get live pricing, capabilities, and provider availability for one Phaseo model ID. Read-only.",
			inputSchema: { modelId: z.string().min(1).max(200) },
			outputSchema: { model: z.object(modelSummarySchema) },
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
			_meta: oauthToolMeta(["models:read", "pricing:read"]),
		},
		async ({ modelId }) => {
			try {
				const model = await getModel(env, modelId, { accessToken: authenticatedUser.accessToken });
				if (!model) return { isError: true as const, content: [{ type: "text" as const, text: `No Phaseo model exists with ID "${modelId}".` }] };
				return { content: [{ type: "text" as const, text: `Retrieved ${model.name} from Phaseo.` }], structuredContent: { model: modelSummary(model) } };
			} catch (error) { return errorResult(error); }
		},
	);

	if (authenticatedUser.scopes.includes("providers:read")) server.registerTool(
		"providers_list",
		{
			title: "List Phaseo providers",
			description: "List AI providers currently available through Phaseo. Read-only.",
			inputSchema: {},
			outputSchema: { providers: z.array(z.object(providerSchema)) },
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
			_meta: oauthToolMeta(["providers:read"]),
		},
		async () => {
			try {
				const providers = (await listProviders(env, { accessToken: authenticatedUser.accessToken })).map(providerSummary);
				return { content: [{ type: "text" as const, text: `Phaseo currently lists ${providers.length} providers.` }], structuredContent: { providers } };
			} catch (error) { return errorResult(error); }
		},
	);

	if (
		authenticatedUser.scopes.includes("models:read") &&
		authenticatedUser.scopes.includes("pricing:read")
	) server.registerTool(
		"cost_estimate",
		{
			title: "Estimate a Phaseo model cost",
			description: "Estimate input, cached-input, and output token cost from Phaseo's current listed model pricing. This is an estimate, not a bill. Read-only.",
			inputSchema: {
				modelId: z.string().min(1).max(200),
				inputTokens: z.number().int().nonnegative(),
				cachedInputTokens: z.number().int().nonnegative().default(0),
				outputTokens: z.number().int().nonnegative(),
			},
			outputSchema: {
				estimate: z.object({
					modelId: z.string(),
					inputTokens: z.number().int(),
					cachedInputTokens: z.number().int(),
					outputTokens: z.number().int(),
					inputCostUSD: z.number(),
					cachedInputCostUSD: z.number(),
					outputCostUSD: z.number(),
					totalCostUSD: z.number(),
					currency: z.literal("USD"),
				}),
			},
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
			_meta: oauthToolMeta(["models:read", "pricing:read"]),
		},
		async ({ modelId, inputTokens, cachedInputTokens, outputTokens }) => {
			try {
				const model = await getModel(env, modelId, { accessToken: authenticatedUser.accessToken });
				if (!model) return { isError: true as const, content: [{ type: "text" as const, text: `No Phaseo model exists with ID "${modelId}".` }] };
				const inputRate = tokenRate(model.pricing.prompt);
				const cachedRate = tokenRate(model.pricing.input_cache_read);
				const outputRate = tokenRate(model.pricing.completion);
				if (inputRate === null || outputRate === null || (cachedInputTokens > 0 && cachedRate === null)) {
					return { isError: true as const, content: [{ type: "text" as const, text: `Phaseo does not currently expose enough token pricing to estimate ${modelId}.` }] };
				}
				const inputCostUSD = inputTokens * inputRate;
				const cachedInputCostUSD = cachedInputTokens * (cachedRate ?? 0);
				const outputCostUSD = outputTokens * outputRate;
				const totalCostUSD = inputCostUSD + cachedInputCostUSD + outputCostUSD;
				const estimate = { modelId, inputTokens, cachedInputTokens, outputTokens, inputCostUSD, cachedInputCostUSD, outputCostUSD, totalCostUSD, currency: "USD" as const };
				return { content: [{ type: "text" as const, text: `Estimated cost for ${model.name}: $${totalCostUSD.toFixed(6)} USD.` }], structuredContent: { estimate } };
			} catch (error) { return errorResult(error); }
		},
	);

	registerControlPlaneReadTools(server, env, authenticatedUser);

	return server;
}

function removeTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
	return value.slice(0, end);
}

function resourceMetadata(request: Request, env: PhaseoEnv): Response {
	const origin = new URL(request.url).origin;
	return Response.json({
		resource: `${origin}/mcp`,
		authorization_servers: [`${removeTrailingSlashes(env.PHASEO_API_BASE_URL)}/oauth`],
		scopes_supported: READ_ONLY_MCP_SCOPES,
		bearer_methods_supported: ["header"],
	}, { headers: { "Cache-Control": "public, max-age=300" } });
}

function unauthorised(request: Request, env: PhaseoEnv): Response {
	const origin = new URL(request.url).origin;
	// The first connection requests only scopes used by the reviewed public
	// tool surface. Administrative access remains in the dashboard and CLI.
	const scopes = READ_ONLY_MCP_SCOPES;
	return new Response("Phaseo login is required.", {
		status: 401,
		headers: {
			"WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${scopes.join(" ")}"`,
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

function secureResponse(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Referrer-Policy", "no-referrer");
	for (const [name, value] of Object.entries(MCP_CORS_HEADERS)) headers.set(name, value);
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function secureMcpResponse(response: Response): Response {
	const secured = secureResponse(response);
	const headers = new Headers(secured.headers);
	headers.set("Cache-Control", "no-store");
	return new Response(secured.body, {
		status: secured.status,
		statusText: secured.statusText,
		headers,
	});
}

function openAiAppsChallenge(env: PhaseoEnv): Response {
	const token = env.OPENAI_APPS_CHALLENGE_TOKEN?.trim() ?? "";
	if (!token) return new Response("Not found", { status: 404 });
	if (token.length > 2_048) return new Response("Challenge token is invalid.", { status: 503 });
	return new Response(token, {
		status: 200,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

export default {
	async fetch(request: Request, env: PhaseoEnv, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		if (request.method === "OPTIONS") return secureResponse(new Response(null, { status: 204 }));
		if (url.pathname === "/.well-known/openai-apps-challenge") {
			if (request.method !== "GET" && request.method !== "HEAD") {
				return secureResponse(new Response("Method not allowed", {
					status: 405,
					headers: { Allow: "GET, HEAD" },
				}));
			}
			const challenge = secureResponse(openAiAppsChallenge(env));
			return request.method === "HEAD"
				? new Response(null, { status: challenge.status, headers: challenge.headers })
				: challenge;
		}
		if (url.pathname === "/health") return secureResponse(Response.json({ status: "ok", service: "phaseo-mcp" }));
		if (
			url.pathname === "/.well-known/oauth-protected-resource/mcp" ||
			url.pathname === "/.well-known/oauth-protected-resource"
		) return secureResponse(resourceMetadata(request, env));
		if (url.pathname !== "/mcp") return secureResponse(new Response("Not found", { status: 404 }));
		if (url.searchParams.has("access_token")) return secureResponse(new Response("Bearer tokens must use the Authorization header.", { status: 400 }));
		const boundedRequest = await boundedMcpRequest(request);
		if (boundedRequest instanceof Response) return secureResponse(boundedRequest);
		const authenticatedUser = await authenticatePhaseoUser(boundedRequest, env);
		if (!authenticatedUser) return secureResponse(unauthorised(request, env));
		const response = await createMcpHandler(() => createServer(env, authenticatedUser), {
			route: "/mcp",
			legacy: "stateless",
			allowedHostnames: ["mcp.phaseo.app"],
			allowedOriginHostnames: "*",
			corsOptions: false,
			authContext: { props: { workspaceId: authenticatedUser.workspaceId } },
		})(boundedRequest, env, ctx);
		return secureMcpResponse(response);
	},
} satisfies ExportedHandler<PhaseoEnv>;
