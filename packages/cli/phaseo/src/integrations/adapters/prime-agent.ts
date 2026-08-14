import { join } from "node:path";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationModel, IntegrationOptions } from "../types.js";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
const PROVIDER_ID = "phaseo";
const BASE_URL = "https://api.phaseo.app/v1";
const API_KEY_COMMAND = "!phaseo integrations credential prime-agent";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function modelsPath(options: IntegrationOptions): string {
	return join(options.homeDir, ".prime", "agent", "models.json");
}

function parseConfig(path: string, input: string | null): JsonObject {
	if (input === null || input.trim() === "") return {};
	try {
		const value = JSON.parse(input);
		if (!isObject(value)) throw new Error("root must be an object");
		return value;
	} catch (error) {
		throw new Error(`Cannot update malformed Prime Agent models at ${path}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function providerObject(config: JsonObject): JsonObject {
	if (config.providers === undefined) return {};
	if (!isObject(config.providers)) throw new Error("Prime Agent providers configuration must be an object");
	return config.providers;
}

function isManagedProvider(value: unknown): value is JsonObject {
	return isObject(value) &&
		value.baseUrl === BASE_URL &&
		value.api === "openai-completions" &&
		value.apiKey === API_KEY_COMMAND &&
		Array.isArray(value.models);
}

function modelConfig(model: IntegrationModel): JsonObject {
	return {
		id: model.id,
		name: model.name,
		reasoning: model.reasoning ?? false,
		input: model.input ?? ["text"],
		contextWindow: model.contextWindow ?? 128000,
		maxTokens: model.maxOutputTokens ?? 16384,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	};
}

export function renderPrimeAgentModels(
	path: string,
	before: string | null,
	model = DEFAULT_MODEL,
	models?: IntegrationOptions["models"],
): string {
	const config = parseConfig(path, before);
	const providers = providerObject(config);
	const current = providers[PROVIDER_ID];
	if (current !== undefined && !isManagedProvider(current)) {
		throw new Error(`${path} already defines a phaseo provider that is not managed by Phaseo CLI`);
	}
	const catalog = models?.length ? [...models] : [{ id: model, name: model }];
	if (!catalog.some((entry) => entry.id === model)) catalog.unshift({ id: model, name: model });
	const selectedIndex = catalog.findIndex((entry) => entry.id === model);
	if (selectedIndex > 0) catalog.unshift(...catalog.splice(selectedIndex, 1));
	config.providers = {
		...providers,
		[PROVIDER_ID]: {
			baseUrl: BASE_URL,
			api: "openai-completions",
			apiKey: API_KEY_COMMAND,
			models: catalog.map(modelConfig),
		},
	};
	return `${JSON.stringify(config, null, 2)}\n`;
}

function renderRemovedConfig(path: string, before: string): string | null {
	const config = parseConfig(path, before);
	const providers = providerObject(config);
	if (!isManagedProvider(providers[PROVIDER_ID])) return null;
	const remaining = { ...providers };
	delete remaining[PROVIDER_ID];
	if (Object.keys(remaining).length === 0) delete config.providers;
	else config.providers = remaining;
	return `${JSON.stringify(config, null, 2)}\n`;
}

export const primeAgentAdapter: IntegrationAdapter = {
	id: "prime-agent",
	name: "Prime Agent",
	guideUrl: "https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/models.md",
	async inspect(options) {
		const path = modelsPath(options);
		const current = await readOptionalFile(path);
		const installed = await isCommandAvailable(["prime-agent", "prime-agent.exe", "prime-agent.cmd"]);
		if (current === null) {
			return { id: "prime-agent", name: "Prime Agent", status: installed ? "available" : "not-installed", configPath: path, details: [] };
		}
		const provider = providerObject(parseConfig(path, current))[PROVIDER_ID];
		const configured = isManagedProvider(provider);
		return {
			id: "prime-agent",
			name: "Prime Agent",
			status: configured ? "configured" : provider !== undefined ? "conflict" : installed ? "available" : "not-installed",
			configPath: path,
			details: configured
				? [`Models: ${(provider.models as unknown[]).length}`, "Credential source: Phaseo CLI session"]
				: provider !== undefined ? ["Resolve the existing phaseo provider before setup."] : [],
		};
	},
	async planSetup(options) {
		const path = modelsPath(options);
		const before = await readOptionalFile(path);
		const after = renderPrimeAgentModels(path, before, options.model, options.models);
		if (before === after) return [];
		return [{ path, before, after, description: "Configure the Phaseo provider and model catalog for Prime Agent" }];
	},
	async planRemove(options) {
		const path = modelsPath(options);
		const before = await readOptionalFile(path);
		if (before === null) return [];
		const after = renderRemovedConfig(path, before);
		if (after === null || after === before) return [];
		return [{ path, before, after, description: "Remove the Phaseo provider from Prime Agent" }];
	},
};
