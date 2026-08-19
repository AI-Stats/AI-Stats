import { platform } from "node:os";
import { join } from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationOptions } from "../types.js";

const BASE_URL = "https://api.phaseo.app/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

function pathFor(options: IntegrationOptions): string {
	if (platform() === "darwin") return join(options.homeDir, "Library", "Application Support", "Zed", "settings.json");
	if (platform() === "win32") return join(process.env.APPDATA || join(options.homeDir, "AppData", "Roaming"), "Zed", "settings.json");
	return join(process.env.XDG_CONFIG_HOME || join(options.homeDir, ".config"), "zed", "settings.json");
}

function object(input: string | null): Record<string, unknown> {
	if (!input?.trim()) return {};
	const errors: ParseError[] = [];
	const value = parse(input, errors, { allowTrailingComma: true, disallowComments: false });
	if (errors.length || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Cannot update malformed Zed settings.json");
	return value as Record<string, unknown>;
}

function edit(input: string, path: string[], value: unknown): string {
	return applyEdits(input, modify(input, path, value, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: input.includes("\r\n") ? "\r\n" : "\n" } }));
}

function provider(model: string) {
	return { api_url: BASE_URL, available_models: [{ name: model, display_name: `${model} via Phaseo`, max_tokens: 200000 }] };
}

export const zedAdapter: IntegrationAdapter = {
	id: "zed",
	name: "Zed",
	guideUrl: "https://phaseo.app/docs/v1/guides/integrations/zed",
	async inspect(options) {
		const path = pathFor(options);
		const before = await readOptionalFile(path);
		const root = object(before);
		const current = (root.language_models as any)?.openai_compatible?.phaseo;
		const installed = await isCommandAvailable(["zed", "zed.exe"]);
		return { id: "zed", name: "Zed", status: current ? "configured" : installed ? "available" : "not-installed", configPath: path, details: current ? ["Phaseo provider configured", "API key must be saved in Zed's system-keychain prompt"] : [] };
	},
	async planSetup(options) {
		const path = pathFor(options);
		const before = await readOptionalFile(path);
		const root = object(before);
		const current = (root.language_models as any)?.openai_compatible?.phaseo;
		if (current) throw new Error("Zed already defines an openai_compatible provider named phaseo");
		const source = before ?? "{}\n";
		const after = edit(source, ["language_models", "openai_compatible", "phaseo"], provider(options.model ?? DEFAULT_MODEL));
		return [{ path, before, after: after.endsWith("\n") ? after : `${after}\n`, description: "Configure the Phaseo provider in Zed" }];
	},
	async planRemove(options) {
		const path = pathFor(options);
		const before = await readOptionalFile(path);
		if (!before) return [];
		const root = object(before);
		if (!(root.language_models as any)?.openai_compatible?.phaseo) return [];
		const after = edit(before, ["language_models", "openai_compatible", "phaseo"], undefined);
		return [{ path, before, after, description: "Remove the Phaseo provider from Zed" }];
	},
	setupInstructions() { return ["Open Agent Settings → LLM Providers → Phaseo and paste the dedicated API key into Zed's keychain-backed prompt."]; },
	removeInstructions() { return ["Remove the saved Phaseo key from Zed's provider settings if it remains in the system keychain."]; },
};
