import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

export type CurieExpectation = { equals?: string; contains?: string; regex?: string };
export type CurieCase = {
	id: string;
	input?: string;
	messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
	expect?: CurieExpectation;
	params?: Record<string, unknown>;
};
export type CurieModel = string | { id: string; label?: string };
export type CurieConfig = {
	version?: 1;
	name?: string;
	baseUrl?: string;
	apiKeyEnv?: string;
	models: CurieModel[];
	cases: CurieCase[];
	repeats?: number;
	params?: Record<string, unknown>;
};
export type CurieResult = {
	model: string; label: string; caseId: string; repeat: number;
	ok: boolean; passed: boolean; latencyMs: number; output: string;
	promptTokens?: number; completionTokens?: number; totalTokens?: number;
	reportedCost?: number; error?: string;
};
export type CurieSummary = {
	model: string; label: string; runs: number; successRate: number;
	passRate: number; averageLatencyMs: number; totalTokens: number; reportedCost: number;
};
export type CurieReport = {
	version: 1; name: string; createdAt: string; baseUrl: string;
	results: CurieResult[]; summary: CurieSummary[];
};

type Flags = Record<string, string | boolean>;
const stringFlag = (flags: Flags, key: string) => typeof flags[key] === "string" ? flags[key] as string : undefined;
const boolFlag = (flags: Flags, key: string) => flags[key] === true || flags[key] === "true" || flags[key] === "1";
const DEFAULT_CURIE_BASE_URL = "https://api.phaseo.app/v1";
const ALLOWED_CURIE_KEY_ENVS = new Set(["PHASEO_API_KEY", "PHASEO_CURIE_API_KEY"]);
const modelDetails = (model: CurieModel) => typeof model === "string"
	? { id: model, label: model }
	: { id: model.id, label: model.label ?? model.id };

export function validateCurieConfig(value: unknown): CurieConfig {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configuration must be a JSON object");
	const config = value as Partial<CurieConfig>;
	if (!Array.isArray(config.models) || !config.models.length) throw new Error("Configuration requires at least one model");
	for (const model of config.models) if (!modelDetails(model).id.trim()) throw new Error("Model ids cannot be empty");
	if (!Array.isArray(config.cases) || !config.cases.length) throw new Error("Configuration requires at least one case");
	const ids = new Set<string>();
	for (const item of config.cases) {
		if (!item || typeof item.id !== "string" || !item.id.trim()) throw new Error("Every case requires a non-empty id");
		if (ids.has(item.id)) throw new Error(`Duplicate case id: ${item.id}`);
		ids.add(item.id);
		if (!item.input && (!Array.isArray(item.messages) || !item.messages.length)) throw new Error(`Case ${item.id} requires input or messages`);
		if (item.expect?.regex) try { new RegExp(item.expect.regex); } catch { throw new Error(`Case ${item.id} has an invalid regular expression`); }
	}
	const repeats = config.repeats ?? 1;
	if (!Number.isInteger(repeats) || repeats < 1 || repeats > 100) throw new Error("repeats must be an integer between 1 and 100");
	return config as CurieConfig;
}

export function evaluateCurieOutput(output: string, expectation?: CurieExpectation): boolean {
	if (!expectation) return true;
	if (expectation.equals !== undefined && output !== expectation.equals) return false;
	if (expectation.contains !== undefined && !output.includes(expectation.contains)) return false;
	if (expectation.regex !== undefined && !new RegExp(expectation.regex).test(output)) return false;
	return true;
}

export function summariseCurieResults(results: CurieResult[]): CurieSummary[] {
	const groups = new Map<string, CurieResult[]>();
	for (const result of results) groups.set(result.model, [...(groups.get(result.model) ?? []), result]);
	return [...groups.entries()].map(([model, runs]) => ({
		model, label: runs[0]?.label ?? model, runs: runs.length,
		successRate: runs.filter((run) => run.ok).length / runs.length,
		passRate: runs.filter((run) => run.passed).length / runs.length,
		averageLatencyMs: runs.reduce((sum, run) => sum + run.latencyMs, 0) / runs.length,
		totalTokens: runs.reduce((sum, run) => sum + (run.totalTokens ?? 0), 0),
		reportedCost: runs.reduce((sum, run) => sum + (run.reportedCost ?? 0), 0),
	})).sort((a, b) => b.passRate - a.passRate || a.averageLatencyMs - b.averageLatencyMs);
}

export function validateCurieEndpoint(
	baseUrlValue: string,
	apiKeyEnv: string,
	allowCustomBaseUrl: boolean,
): string {
	if (!ALLOWED_CURIE_KEY_ENVS.has(apiKeyEnv)) {
		throw new Error("Curie API keys must use PHASEO_API_KEY or PHASEO_CURIE_API_KEY");
	}
	let parsed: URL;
	try {
		parsed = new URL(baseUrlValue);
	} catch {
		throw new Error("Curie base URL must be a valid HTTP(S) URL");
	}
	if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
		throw new Error("Curie base URL must be an HTTP(S) URL without credentials, query parameters, or fragments");
	}
	const normalized = parsed.toString().replace(/\/$/, "");
	if (normalized === DEFAULT_CURIE_BASE_URL) return normalized;
	if (!allowCustomBaseUrl) {
		throw new Error("Custom Curie endpoints require --allow-custom-base-url");
	}
	if (apiKeyEnv !== "PHASEO_CURIE_API_KEY") {
		throw new Error("Custom Curie endpoints require the isolated PHASEO_CURIE_API_KEY variable");
	}
	return normalized;
}

function outputText(body: any): string {
	const content = body.choices?.[0]?.message?.content;
	if (typeof content === "string") return content;
	return Array.isArray(content) ? content.map((part: any) => typeof part?.text === "string" ? part.text : "").join("") : "";
}

function outputCost(body: any): number {
	for (const candidate of [body.cost, body.usage?.cost, body.usage?.total_cost]) if (Number.isFinite(Number(candidate))) return Number(candidate);
	return 0;
}

export async function runCurie(configPath: string | undefined, flags: Flags): Promise<void> {
	if (!configPath) throw new Error("Configuration path is required");
	const config = validateCurieConfig(JSON.parse(await readFile(configPath, "utf8")));
	const baseUrlValue = stringFlag(flags, "base-url") ?? config.baseUrl ?? DEFAULT_CURIE_BASE_URL;
	const apiKeyEnv = stringFlag(flags, "api-key-env") ?? config.apiKeyEnv ?? "PHASEO_API_KEY";
	const baseUrl = validateCurieEndpoint(baseUrlValue, apiKeyEnv, boolFlag(flags, "allow-custom-base-url"));
	const repeats = stringFlag(flags, "repeats") === undefined ? config.repeats ?? 1 : Number(stringFlag(flags, "repeats"));
	if (!Number.isInteger(repeats) || repeats < 1 || repeats > 100) throw new Error("--repeats must be an integer between 1 and 100");
	if (boolFlag(flags, "dry-run")) {
		process.stdout.write(`${JSON.stringify({ name: config.name ?? "Curie run", baseUrl, requests: config.models.length * config.cases.length * repeats, models: config.models.map(modelDetails), cases: config.cases.map((item) => item.id) }, null, 2)}\n`);
		return;
	}
	const apiKey = process.env[apiKeyEnv];
	if (!apiKey) throw new Error(`Missing API key in ${apiKeyEnv}`);
	const results: CurieResult[] = [];
	for (const modelValue of config.models) for (const item of config.cases) for (let repeat = 1; repeat <= repeats; repeat += 1) {
		const model = modelDetails(modelValue);
		const started = performance.now();
		try {
			const response = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
				body: JSON.stringify({ model: model.id, messages: item.messages ?? [{ role: "user", content: item.input }], ...config.params, ...item.params, stream: false }),
			});
			const body: any = await response.json();
			if (!response.ok) throw new Error(typeof body.error?.message === "string" ? body.error.message : `Request failed (${response.status})`);
			const output = outputText(body);
			results.push({ model: model.id, label: model.label, caseId: item.id, repeat, ok: true, passed: evaluateCurieOutput(output, item.expect), latencyMs: performance.now() - started, output, promptTokens: body.usage?.prompt_tokens, completionTokens: body.usage?.completion_tokens, totalTokens: body.usage?.total_tokens, reportedCost: outputCost(body) });
		} catch (error) {
			results.push({ model: model.id, label: model.label, caseId: item.id, repeat, ok: false, passed: false, latencyMs: performance.now() - started, output: "", error: error instanceof Error ? error.message : String(error) });
		}
	}
	const report: CurieReport = { version: 1, name: config.name ?? "Curie run", createdAt: new Date().toISOString(), baseUrl, results, summary: summariseCurieResults(results) };
	const reportPath = stringFlag(flags, "report");
	if (reportPath) await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
	if (boolFlag(flags, "json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	else {
		process.stdout.write(`${report.name}\nmodel\tpass\tsuccess\tlatency\ttokens\tcost\n`);
		for (const item of report.summary) process.stdout.write(`${item.label}\t${(item.passRate * 100).toFixed(1)}%\t${(item.successRate * 100).toFixed(1)}%\t${item.averageLatencyMs.toFixed(0)}ms\t${item.totalTokens}\t$${item.reportedCost.toFixed(6)}\n`);
	}
	if (results.some((result) => !result.passed)) process.exitCode = 1;
}
