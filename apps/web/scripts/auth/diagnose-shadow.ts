/* eslint-disable no-console -- shadow diagnostic emits bounded structural differences */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value.replace(/\/+$/, "");
}

function describeValue(value: unknown): unknown {
	if (Array.isArray(value)) return { type: "array", length: value.length };
	if (value && typeof value === "object") return { type: "object", keys: Object.keys(value).sort() };
	return value;
}

function comparable(value: unknown): unknown {
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
		const timestamp = Date.parse(value);
		if (Number.isFinite(timestamp)) return timestamp;
	}
	if (typeof value === "number" && Number.isFinite(value)) return Number(value.toPrecision(14));
	return value;
}

function identity(value: unknown): string | null {
	if (Array.isArray(value)) return typeof value[0] === "string" ? `tuple:${value[0]}` : null;
	if (!value || typeof value !== "object") return null;
	const row = value as Record<string, unknown>;
	if (typeof row.providerId === "string" && typeof row.modelId === "string") {
		return `providerModel:${row.providerId}:${row.modelId}`;
	}
	for (const key of ["api_provider_id", "modelId", "model_id", "id"]) {
		if (typeof row[key] === "string") return `${key}:${row[key]}`;
	}
	return null;
}

function differences(source: unknown, target: unknown, path = "$", output: unknown[] = []): unknown[] {
	if (output.length >= 30 || Object.is(comparable(source), comparable(target))) return output;
	if (Array.isArray(source) && Array.isArray(target)) {
		if (source.length !== target.length) output.push({ path, sourceLength: source.length, targetLength: target.length });
		const sourceIdentities = source.map(identity);
		const targetIdentities = target.map(identity);
		let comparableSource = source;
		let comparableTarget = target;
		if (path.endsWith(".gateway_monitor_rows")) {
			comparableSource = [...source].sort((left, right) => String((left as Record<string, unknown>)?.id).localeCompare(String((right as Record<string, unknown>)?.id), "en"));
			comparableTarget = [...target].sort((left, right) => String((left as Record<string, unknown>)?.id).localeCompare(String((right as Record<string, unknown>)?.id), "en"));
		}
		if (sourceIdentities.every(Boolean) && targetIdentities.every(Boolean)) {
			const sourceSet = new Set(sourceIdentities as string[]);
			const targetSet = new Set(targetIdentities as string[]);
			const missingFromTarget = [...sourceSet].filter((entry) => !targetSet.has(entry));
			const targetOnly = [...targetSet].filter((entry) => !sourceSet.has(entry));
			if (missingFromTarget.length || targetOnly.length) output.push({
				path,
				missingFromTarget,
				targetOnly,
				missingRows: source.filter((_, index) => missingFromTarget.includes(sourceIdentities[index]!)).slice(0, 10),
				targetOnlyRows: target.filter((_, index) => targetOnly.includes(targetIdentities[index]!)).slice(0, 10),
			});
			if (!path.endsWith(".gateway_monitor_rows")) {
				comparableSource = [...source].sort((left, right) => identity(left)!.localeCompare(identity(right)!, "en"));
				comparableTarget = [...target].sort((left, right) => identity(left)!.localeCompare(identity(right)!, "en"));
			}
		}
		for (let index = 0; index < Math.min(comparableSource.length, comparableTarget.length) && output.length < 30; index += 1) {
			differences(comparableSource[index], comparableTarget[index], `${path}[${index}]`, output);
		}
		return output;
	}
	if (source && target && typeof source === "object" && typeof target === "object") {
		const sourceRecord = source as Record<string, unknown>;
		const targetRecord = target as Record<string, unknown>;
		for (const key of new Set([...Object.keys(sourceRecord), ...Object.keys(targetRecord)])) {
			if (output.length >= 30) break;
			if (!(key in sourceRecord) || !(key in targetRecord)) {
				output.push({ path: `${path}.${key}`, source: key in sourceRecord ? describeValue(sourceRecord[key]) : "missing", target: key in targetRecord ? describeValue(targetRecord[key]) : "missing" });
			} else differences(sourceRecord[key], targetRecord[key], `${path}.${key}`, output);
		}
		return output;
	}
	output.push({ path, source: describeValue(source), target: describeValue(target) });
	return output;
}

async function read(origin: string, path: string) {
	const url = new URL(path, `${origin}/`);
	url.searchParams.set("shadowDiagnostic", String(Date.now()));
	const response = await fetch(url, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(30_000) });
	return { status: response.status, body: await response.json() as unknown };
}

async function readProtectedVercelDeployment(deployment: string, path: string) {
	if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(deployment)) throw new Error("SHADOW_TARGET_VERCEL_DEPLOYMENT must be a vercel.app HTTPS URL");
	if (!/^\/[A-Za-z0-9_?&=./:%-]+$/.test(path)) throw new Error(`Unsafe shadow diagnostic path: ${path}`);
	const requestUrl = new URL(path, "https://preview.invalid");
	requestUrl.searchParams.set("shadowDiagnostic", String(Date.now()));
	const requestPath = `${requestUrl.pathname}${requestUrl.search}`;
	const executable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "vercel";
	const args = process.platform === "win32"
		? ["/d", "/s", "/c", "vercel", "curl", requestPath, "--deployment", deployment]
		: ["curl", requestPath, "--deployment", deployment];
	const { stdout } = await execFileAsync(executable, args, { env: { ...process.env, NO_COLOR: "1" }, maxBuffer: 16 * 1024 * 1024 });
	const raw = stdout.trim().split(/\r?\n/).at(-1) ?? "";
	return { status: 200, body: JSON.parse(raw) as unknown };
}

async function main() {
	const source = required("SHADOW_SOURCE_ORIGIN");
	const targetDeployment = process.env.SHADOW_TARGET_VERCEL_DEPLOYMENT?.trim();
	const target = targetDeployment ? null : required("SHADOW_TARGET_ORIGIN");
	const paths = JSON.parse(process.env.SHADOW_PATHS_JSON ?? "[]") as string[];
	if (!Array.isArray(paths) || paths.some((path) => typeof path !== "string" || !path.startsWith("/"))) {
		throw new Error("SHADOW_PATHS_JSON must be an array of absolute paths");
	}
	const report = [];
	for (const path of paths) {
		const [sourceResult, targetResult] = await Promise.all([
			read(source, path),
			targetDeployment ? readProtectedVercelDeployment(targetDeployment, path) : read(target!, path),
		]);
		report.push({ path, sourceStatus: sourceResult.status, targetStatus: targetResult.status, differences: differences(sourceResult.body, targetResult.body) });
	}
	console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
