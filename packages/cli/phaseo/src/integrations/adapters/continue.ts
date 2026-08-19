import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getIntegrationGatewayCredential } from "../credential.js";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationOptions } from "../types.js";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
const MARKER = "# Managed by Phaseo CLI";

function paths(options: IntegrationOptions) { const dir = join(options.homeDir, ".continue"); return { dir, config: join(dir, "config.yaml"), env: join(dir, ".env") }; }

export const continueAdapter: IntegrationAdapter = {
	id: "continue",
	name: "Continue",
	setupIsAutomatic: true,
	guideUrl: "https://phaseo.app/docs/v1/guides/integrations/continue",
	async inspect(options) {
		const { config } = paths(options);
		const current = await readOptionalFile(config);
		const installed = await isCommandAvailable(["cn", "cn.exe", "code", "code.cmd"]);
		return { id: "continue", name: "Continue", status: current?.startsWith(MARKER) ? "configured" : current ? "conflict" : installed ? "available" : "not-installed", configPath: config, details: current?.startsWith(MARKER) ? ["Phaseo local model configured"] : current ? ["An existing Continue config.yaml must be merged manually; Phaseo CLI will not overwrite it."] : [] };
	},
	async planSetup(options) {
		const { config, env } = paths(options);
		for (const path of [config, env]) {
			const current = await readOptionalFile(path);
			if (current && !current.startsWith(MARKER)) throw new Error(`Continue already has ${path}; use the linked guide to merge Phaseo without overwriting it`);
		}
		return [];
	},
	async planRemove() { return []; },
	setupInstructions() { return ["Phaseo CLI will create Continue's local config.yaml and .env when those files are not already in use."]; },
	async applySetup(options) {
		const { dir, config, env } = paths(options);
		await mkdir(dir, { recursive: true });
		const key = await getIntegrationGatewayCredential("continue");
		const model = options.model ?? DEFAULT_MODEL;
		try {
			await writeFile(config, `${MARKER}\nname: Phaseo\nversion: 1.0.0\nschema: v1\nmodels:\n  - name: ${JSON.stringify(`${model} via Phaseo`)}\n    provider: openai\n    model: ${JSON.stringify(model)}\n    apiBase: https://api.phaseo.app/v1\n    apiKey: \${{ secrets.PHASEO_API_KEY }}\n    useResponsesApi: false\n    roles: [chat, edit, apply]\n`, { mode: 0o600 });
			await writeFile(env, `${MARKER}\nPHASEO_API_KEY=${key}\n`, { mode: 0o600 });
		} catch (error) {
			await Promise.all([rm(config, { force: true }), rm(env, { force: true })]);
			throw error;
		}
	},
	async applyRemove(options) {
		for (const path of [paths(options).config, paths(options).env]) {
			try { if ((await readFile(path, "utf8")).startsWith(MARKER)) await rm(path, { force: true }); } catch {}
		}
	},
};
