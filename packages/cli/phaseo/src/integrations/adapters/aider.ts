import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getIntegrationGatewayCredential } from "../credential.js";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationOptions } from "../types.js";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
const MARKER = "# Managed by Phaseo CLI";

function configPath(options: IntegrationOptions): string { return join(options.homeDir, ".aider.conf.yml"); }

export const aiderAdapter: IntegrationAdapter = {
	id: "aider",
	name: "Aider",
	setupIsAutomatic: true,
	guideUrl: "https://phaseo.app/docs/v1/guides/integrations/aider",
	async inspect(options) {
		const path = configPath(options);
		const current = await readOptionalFile(path);
		const installed = await isCommandAvailable(["aider", "aider.exe"]);
		return { id: "aider", name: "Aider", status: current?.startsWith(MARKER) ? "configured" : current ? "conflict" : installed ? "available" : "not-installed", configPath: path, details: current?.startsWith(MARKER) ? ["Phaseo model and credential configured in Aider's supported YAML file"] : current ? ["An existing .aider.conf.yml must be merged manually; Phaseo CLI will not overwrite it."] : [] };
	},
	async planSetup(options) {
		const current = await readOptionalFile(configPath(options));
		if (current && !current.startsWith(MARKER)) throw new Error("Aider already has ~/.aider.conf.yml; use the linked guide to merge Phaseo without overwriting it");
		return [];
	},
	async planRemove() { return []; },
	setupInstructions() { return ["Phaseo CLI will create Aider's supported ~/.aider.conf.yml with the selected model, Base URL, and dedicated key."]; },
	async applySetup(options) {
		const path = configPath(options);
		const existing = await readOptionalFile(path);
		if (existing && !existing.startsWith(MARKER)) throw new Error("Refusing to overwrite the existing Aider configuration");
		const key = await getIntegrationGatewayCredential("aider");
		const model = options.model ?? DEFAULT_MODEL;
		const content = `${MARKER}\nmodel: openai/${model}\nopenai-api-base: https://api.phaseo.app/v1\nopenai-api-key: ${JSON.stringify(key)}\n`;
		try {
			await writeFile(path, content, { mode: 0o600 });
		} catch (error) {
			if (!existing) await rm(path, { force: true }).catch(() => undefined);
			throw error;
		}
	},
	async applyRemove(options) {
		const path = configPath(options);
		try { if ((await readFile(path, "utf8")).startsWith(MARKER)) await rm(path, { force: true }); } catch {}
	},
};
