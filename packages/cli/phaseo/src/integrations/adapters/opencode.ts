import { isAbsolute, join, resolve } from "node:path";
import { applyEdits, modify, parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationOptions } from "../types.js";

const DEFAULT_MODEL = "openai/gpt-5.6-terra";
const PROVIDER_ID = "phaseo";
const PROVIDER_PACKAGE = "@ai-sdk/openai-compatible";
const BASE_URL = "https://api.phaseo.app/v1";
const API_KEY_REFERENCE = "{env:PHASEO_API_KEY}";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseConfig(path: string, input: string | null): JsonObject {
	if (input === null || input.trim() === "") return {};
	const errors: ParseError[] = [];
	const value = parse(input, errors, { allowTrailingComma: true, disallowComments: false });
	if (errors.length > 0) {
		const first = errors[0];
		throw new Error(`Cannot update malformed OpenCode configuration at ${path}: ${printParseErrorCode(first.error)} at offset ${first.offset}`);
	}
	if (!isObject(value)) throw new Error(`Cannot update OpenCode configuration at ${path}: root must be an object`);
	return value;
}

function phaseoProvider(config: JsonObject): JsonObject | null {
	if (config.provider === undefined) return null;
	if (!isObject(config.provider)) throw new Error("OpenCode provider configuration must be an object");
	const provider = config.provider[PROVIDER_ID];
	if (provider === undefined) return null;
	if (!isObject(provider)) return {};
	return provider;
}

function isManagedProvider(provider: JsonObject): boolean {
	const options = provider.options;
	return provider.npm === PROVIDER_PACKAGE &&
		provider.name === "Phaseo" &&
		isObject(options) &&
		options.baseURL === BASE_URL &&
		options.apiKey === API_KEY_REFERENCE &&
		isObject(provider.models);
}

function assertProviderEnabled(config: JsonObject): void {
	if (Array.isArray(config.disabled_providers) && config.disabled_providers.includes(PROVIDER_ID)) {
		throw new Error("OpenCode disables the phaseo provider; remove it from disabled_providers before setup");
	}
	if (Array.isArray(config.enabled_providers) && !config.enabled_providers.includes(PROVIDER_ID)) {
		throw new Error("OpenCode uses enabled_providers; add phaseo to that list before setup");
	}
}

function formattingOptions(input: string) {
	return {
		insertSpaces: !/^\t/m.test(input),
		tabSize: 2,
		eol: input.includes("\r\n") ? "\r\n" : "\n",
	};
}

function setJsoncValue(input: string, path: (string | number)[], value: unknown): string {
	return applyEdits(input, modify(input, path, value, { formattingOptions: formattingOptions(input) }));
}

function withTrailingNewline(input: string): string {
	return input.endsWith("\n") ? input : `${input}\n`;
}

export function renderOpenCodeConfig(path: string, before: string | null, model = DEFAULT_MODEL): string {
	const config = parseConfig(path, before);
	assertProviderEnabled(config);
	const current = phaseoProvider(config);
	if (current && !isManagedProvider(current)) {
		throw new Error(`${path} already defines a phaseo provider that is not managed by Phaseo CLI`);
	}

	const currentOptions = current && isObject(current.options) ? current.options : {};
	const currentModels = current && isObject(current.models) ? current.models : {};
	const provider = {
		...(current ?? {}),
		npm: PROVIDER_PACKAGE,
		name: "Phaseo",
		options: {
			...currentOptions,
			baseURL: BASE_URL,
			apiKey: API_KEY_REFERENCE,
		},
		models: {
			...currentModels,
			[model]: isObject(currentModels[model]) ? currentModels[model] : { name: model },
		},
	};

	let output = before ?? "{}\n";
	if (config.$schema === undefined) output = setJsoncValue(output, ["$schema"], "https://opencode.ai/config.json");
	output = setJsoncValue(output, ["provider", PROVIDER_ID], provider);
	return withTrailingNewline(output);
}

function renderRemovedConfig(path: string, before: string): string | null {
	const config = parseConfig(path, before);
	const current = phaseoProvider(config);
	if (!current || !isManagedProvider(current)) return null;
	const providers = config.provider as JsonObject;
	const removalPath = Object.keys(providers).length === 1 ? ["provider"] : ["provider", PROVIDER_ID];
	return withTrailingNewline(setJsoncValue(before, removalPath, undefined));
}

async function configPath(options: IntegrationOptions): Promise<string> {
	const custom = process.env.OPENCODE_CONFIG;
	if (custom) return isAbsolute(custom) ? custom : resolve(custom);
	const configHome = process.env.XDG_CONFIG_HOME;
	const directory = configHome
		? join(isAbsolute(configHome) ? configHome : resolve(configHome), "opencode")
		: join(options.homeDir, ".config", "opencode");
	const jsonc = join(directory, "opencode.jsonc");
	if (await readOptionalFile(jsonc) !== null) return jsonc;
	const json = join(directory, "opencode.json");
	if (await readOptionalFile(json) !== null) return json;
	return json;
}

export const openCodeAdapter: IntegrationAdapter = {
	id: "opencode",
	name: "OpenCode",
	async inspect(options) {
		const path = await configPath(options);
		const current = await readOptionalFile(path);
		const installed = await isCommandAvailable(["opencode", "opencode.exe", "opencode.cmd", "opencode.ps1"]);
		if (current === null) {
			return { id: "opencode", name: "OpenCode", status: installed ? "available" : "not-installed", configPath: path, details: [] };
		}
		const config = parseConfig(path, current);
		const provider = phaseoProvider(config);
		const disabled = Array.isArray(config.disabled_providers) && config.disabled_providers.includes(PROVIDER_ID);
		const excluded = Array.isArray(config.enabled_providers) && !config.enabled_providers.includes(PROVIDER_ID);
		const configured = provider !== null && isManagedProvider(provider) && !disabled && !excluded;
		const conflict = provider !== null || disabled || excluded;
		const models = provider && isObject(provider.models) ? Object.keys(provider.models) : [];
		return {
			id: "opencode",
			name: "OpenCode",
			status: configured ? "configured" : conflict ? "conflict" : installed ? "available" : "not-installed",
			configPath: path,
			details: configured
				? [`Models: ${models.join(", ")}`, "Credential source: PHASEO_API_KEY"]
				: conflict
					? ["Resolve the existing provider or provider allowlist before setup."]
					: [],
		};
	},
	async planSetup(options) {
		const path = await configPath(options);
		const before = await readOptionalFile(path);
		const after = renderOpenCodeConfig(path, before, options.model);
		if (before === after) return [];
		return [{ path, before, after, description: "Configure the Phaseo OpenCode provider" }];
	},
	async planRemove(options) {
		const path = await configPath(options);
		const before = await readOptionalFile(path);
		if (before === null) return [];
		const after = renderRemovedConfig(path, before);
		if (after === null || after === before) return [];
		return [{ path, before, after, description: "Remove the Phaseo OpenCode provider" }];
	},
};
