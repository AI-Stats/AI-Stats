import { spawn } from "node:child_process";
import { isCommandAvailable } from "../files.js";
import type { IntegrationAdapter } from "../types.js";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

function run(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("openclaw", args, { shell: false, stdio: "pipe" });
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (value) => { stdout += value; });
		child.stderr.on("data", (value) => { stderr += value; });
		child.on("error", reject);
		child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `openclaw exited with code ${code}`)));
	});
}

async function getProvider(): Promise<unknown | null> {
	try {
		const output = await run(["config", "get", "models.providers.phaseo", "--json"]);
		return JSON.parse(output);
	} catch (error) {
		if (error instanceof Error && /not found|does not exist|unknown path/i.test(error.message)) return null;
		throw error;
	}
}

async function unset(path: string): Promise<void> {
	await run(["config", "unset", path]).catch((error) => {
		if (!(error instanceof Error) || !/not found|does not exist|unknown path/i.test(error.message)) throw error;
	});
}

export const openClawAdapter: IntegrationAdapter = {
	id: "openclaw",
	name: "OpenClaw",
	setupIsAutomatic: true,
	async inspect() {
		const installed = await isCommandAvailable(["openclaw", "openclaw.exe", "openclaw.cmd"]);
		if (!installed) return { id: "openclaw", name: "OpenClaw", status: "not-installed", configPath: "OpenClaw configuration", details: [] };
		const provider = await getProvider();
		return {
			id: "openclaw",
			name: "OpenClaw",
			status: provider ? "configured" : "available",
			configPath: "models.providers.phaseo",
			details: provider ? ["Phaseo custom provider registered", "Credential source: Phaseo CLI exec SecretRef"] : [],
		};
	},
	async planSetup() { return []; },
	async planRemove() { return []; },
	setupInstructions(options) {
		return [
			`Register the Phaseo provider and ${options.model ?? DEFAULT_MODEL} through OpenClaw's config CLI.`,
			"Keep the existing default model unchanged; select the Phaseo model with openclaw models set when ready.",
		];
	},
	async applySetup(options) {
		if (!await isCommandAvailable(["openclaw", "openclaw.exe", "openclaw.cmd"])) throw new Error("OpenClaw is not installed or is not on PATH");
		if (await getProvider()) throw new Error("OpenClaw already defines models.providers.phaseo; remove or rename it before setup");
		const script = process.argv[1];
		if (!script) throw new Error("Cannot determine the installed Phaseo CLI entry point");
		const secretProvider = { source: "exec", command: process.execPath, args: [script, "integrations", "credential", "openclaw"], jsonOnly: false };
		const model = options.model ?? DEFAULT_MODEL;
		const provider = {
			baseUrl: "https://api.phaseo.app/v1",
			apiKey: { source: "exec", provider: "phaseo_cli", id: "value" },
			api: "openai-completions",
			models: [{ id: model, name: `${model} via Phaseo`, reasoning: true, input: ["text", "image"], contextWindow: 200000, maxTokens: 16384 }],
		};
		await run(["config", "set", "secrets.providers.phaseo_cli", JSON.stringify(secretProvider), "--strict-json"]);
		try {
			await run(["config", "set", "models.providers.phaseo", JSON.stringify(provider), "--strict-json"]);
		} catch (error) {
			await unset("secrets.providers.phaseo_cli");
			throw error;
		}
	},
	async applyRemove() {
		await unset("models.providers.phaseo");
		await unset("secrets.providers.phaseo_cli");
	},
	removeInstructions() { return ["Restart the OpenClaw gateway if it is currently running."]; },
};
