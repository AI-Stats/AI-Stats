import { join } from "node:path";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationOptions } from "../types.js";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
const BASE_URL = "https://api.phaseo.app/v1";
const API_KEY_COMMAND = "!phaseo integrations credential pi";

function extensionPath(options: IntegrationOptions): string {
	return join(options.homeDir, ".pi", "agent", "extensions", "phaseo.ts");
}

function renderModels(model: string, models?: IntegrationOptions["models"]): string {
	const catalog = models?.length ? [...models] : [{ id: model, name: model, reasoning: true, input: ["text", "image"] as Array<"text" | "image"> }];
	if (!catalog.some((entry) => entry.id === model)) catalog.unshift({ id: model, name: model, reasoning: true, input: ["text"] });
	const selectedIndex = catalog.findIndex((entry) => entry.id === model);
	if (selectedIndex > 0) catalog.unshift(...catalog.splice(selectedIndex, 1));
	return JSON.stringify(catalog.map((entry) => ({
		id: entry.id,
		name: `${entry.name} via Phaseo`,
		reasoning: entry.reasoning ?? false,
		input: entry.input ?? ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: entry.contextWindow ?? 128000,
		maxTokens: entry.maxOutputTokens ?? 16384,
	})), null, 2).replace(/^/gm, "\t\t");
}

export function renderPiExtension(model = DEFAULT_MODEL, models?: IntegrationOptions["models"]): string {
	const renderedModels = renderModels(model, models);
	return `// Managed by Phaseo CLI. Run \`phaseo integrations remove pi\` to remove.\n` +
		`import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\n\n` +
		`export default function (pi: ExtensionAPI) {\n` +
		`\tpi.registerProvider("phaseo", {\n` +
		`\t\tname: "Phaseo",\n` +
		`\t\tbaseUrl: "${BASE_URL}",\n` +
		`\t\tapiKey: "${API_KEY_COMMAND}",\n` +
		`\t\tapi: "openai-completions",\n` +
		`\t\tmodels: ${renderedModels.trimStart()},\n` +
		`\t});\n` +
		`}\n`;
}

export const piAdapter: IntegrationAdapter = {
	id: "pi",
	name: "Pi",
	async inspect(options) {
		const path = extensionPath(options);
		const current = await readOptionalFile(path);
		const managed = current?.startsWith("// Managed by Phaseo CLI.") ?? false;
		const installed = await isCommandAvailable(["pi", "pi.exe", "pi.cmd"]);
		return {
			id: "pi",
			name: "Pi",
			status: managed ? "configured" : current !== null ? "conflict" : installed ? "available" : "not-installed",
			configPath: path,
			details: managed ? ["Phaseo provider extension installed", "Credential source: Phaseo CLI session"] : [],
		};
	},
	async planSetup(options) {
		const path = extensionPath(options);
		const before = await readOptionalFile(path);
		const after = renderPiExtension(options.model, options.models);
		if (before !== null && before !== after) throw new Error(`${path} already exists and is not managed by Phaseo CLI`);
		return before === after ? [] : [{ path, before, after, description: "Install the Phaseo provider extension for Pi" }];
	},
	async planRemove(options) {
		const path = extensionPath(options);
		const before = await readOptionalFile(path);
		if (before === null || !before.startsWith("// Managed by Phaseo CLI.")) return [];
		return [{ path, before, after: null, description: "Remove the Phaseo provider extension from Pi" }];
	},
};
