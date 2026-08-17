/* eslint-disable no-console -- shadow validator emits a machine-readable report */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_PATHS = [
	"/api/_web/landing/stats",
	"/api/_web/landing/models/main",
	"/api/_web/models",
	"/api/_web/organisations",
	"/api/_web/benchmarks",
	"/api/_web/api-providers",
	"/api/_web/gateway/models",
	"/api/_web/apps/ids",
	"/api/_web/marketplace/presets",
	"/api/_web/monitor/history/initial",
] as const;

function requiredEnvironment(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value.replace(/\/+$/, "");
}

function canonical(value: unknown, path = "$"): unknown {
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
		const timestamp = Date.parse(value);
		if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
	}
	if (typeof value === "number" && Number.isFinite(value)) return Number(value.toPrecision(14));
	if (Array.isArray(value)) {
		const normalized = value.map((entry, index) => canonical(entry, `${path}[${index}]`));
		if (path.endsWith(".ids")) return normalized.sort((left, right) => String(left).localeCompare(String(right), "en"));
		if (path.endsWith(".initialPage.entries")) {
			return normalized.sort((left, right) => {
				const leftKey = JSON.stringify(left);
				const rightKey = JSON.stringify(right);
				return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
			});
		}
		if (path.endsWith(".benchmarks")) {
			return normalized.sort((left, right) => String((left as Record<string, unknown>).benchmark_id).localeCompare(String((right as Record<string, unknown>).benchmark_id), "en"));
		}
		if (path.endsWith(".capabilities")) {
			return normalized.sort((left, right) => String(left).localeCompare(String(right), "en"));
		}
		if (path.endsWith(".gateway_monitor_rows")) {
			return normalized.sort((left, right) => String((left as Record<string, unknown>).id).localeCompare(String((right as Record<string, unknown>).id), "en"));
		}
		return normalized;
	}
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, nested]) => [key, canonical(nested, `${path}.${key}`)]),
	);
}

function digest(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function keyedSubset(source: unknown, target: unknown, key: (entry: unknown) => string | null): boolean {
	if (!Array.isArray(source) || !Array.isArray(target)) return false;
	const targetByKey = new Map(target.map((entry) => [key(entry), JSON.stringify(canonical(entry))]));
	return source.every((entry) => {
		const entryKey = key(entry);
		return entryKey !== null && targetByKey.get(entryKey) === JSON.stringify(canonical(entry));
	});
}

function canonicalOptionSet(source: unknown, target: unknown): boolean {
	if (!Array.isArray(source) || !Array.isArray(target) || target.length === 0) return false;
	const values = target.map((entry) => {
		const option = entry && typeof entry === "object" ? entry as Record<string, unknown> : null;
		if (!option) return null;
		const value = String(option.value ?? "").trim();
		const label = String(option.label ?? "").trim();
		const query = String(option.query ?? "").trim();
		return value && label && query ? value : null;
	});
	if (values.some((value) => value === null) || new Set(values).size !== values.length) return false;
	if (source.length === 0) return true;
	const sourceValues = new Set(source.map((entry) => {
		const option = entry && typeof entry === "object" ? entry as Record<string, unknown> : null;
		return String(option?.value ?? "").trim();
	}).filter(Boolean));
	const overlap = values.filter((value) => value && sourceValues.has(value)).length;
	return overlap / sourceValues.size >= 0.8;
}

function monitorTargetSuperset(source: unknown, target: unknown): boolean {
	if (!source || !target || typeof source !== "object" || typeof target !== "object") return false;
	const sourceRecord = source as Record<string, any>;
	const targetRecord = target as Record<string, any>;
	const entryKey = (entry: unknown) => Array.isArray(entry) && entry[0] != null ? String(entry[0]) : null;
	if (!canonicalOptionSet(sourceRecord.modelOptions, targetRecord.modelOptions)) return false;
	if (!canonicalOptionSet(sourceRecord.providerOptions, targetRecord.providerOptions)) return false;
	if (!keyedSubset(sourceRecord.initialPage?.entries, targetRecord.initialPage?.entries, entryKey)) return false;
	const sourceRest = structuredClone(sourceRecord);
	const targetRest = structuredClone(targetRecord);
	delete sourceRest.modelOptions;
	delete targetRest.modelOptions;
	delete sourceRest.providerOptions;
	delete targetRest.providerOptions;
	if (sourceRest.initialPage) delete sourceRest.initialPage.entries;
	if (targetRest.initialPage) delete targetRest.initialPage.entries;
	return JSON.stringify(canonical(sourceRest)) === JSON.stringify(canonical(targetRest));
}

function asRecord(value: unknown): Record<string, any> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}

function landingStatsCanonical(source: unknown, target: unknown): boolean {
	const sourceRecord = asRecord(source);
	const targetRecord = asRecord(target);
	if (!sourceRecord || !targetRecord || !asRecord(sourceRecord.db) || !asRecord(targetRecord.db)) return false;
	const comparableTarget = structuredClone(targetRecord);
	for (const field of ["models", "benchmark_results"]) {
		if (!Number.isFinite(Number(targetRecord.db[field])) || Number(targetRecord.db[field]) < 0) return false;
		comparableTarget.db[field] = sourceRecord.db[field];
	}
	return JSON.stringify(canonical(sourceRecord)) === JSON.stringify(canonical(comparableTarget));
}

function providersCanonical(source: unknown, target: unknown): boolean {
	const sourceRecord = asRecord(source);
	const targetRecord = asRecord(target);
	if (!sourceRecord || !targetRecord || !Array.isArray(sourceRecord.providers) || !Array.isArray(targetRecord.providers)) return false;
	const normalize = (providers: unknown[]) => providers.map((entry) => {
		const row = structuredClone(asRecord(entry) ?? {});
		for (const field of ["last_updated_at", "total_models", "active_models", "modality_support"]) delete row[field];
		return row;
	}).sort((left, right) => String(left.api_provider_id ?? left.id).localeCompare(String(right.api_provider_id ?? right.id), "en"));
	return JSON.stringify(canonical({ ...sourceRecord, providers: normalize(sourceRecord.providers) }))
		=== JSON.stringify(canonical({ ...targetRecord, providers: normalize(targetRecord.providers) }));
}

function catalogueRowsCanonical(source: unknown, target: unknown, kind: "models" | "gateway"): boolean {
	const sourceRows = asRecord(source)?.models;
	const targetRows = asRecord(target)?.models;
	if (!Array.isArray(sourceRows) || !Array.isArray(targetRows) || targetRows.length < 1) return false;
	const key = (entry: unknown) => {
		const row = asRecord(entry);
		if (!row) return null;
		const modelId = String(row.modelId ?? row.model_id ?? row.id ?? "").trim();
		if (!modelId) return null;
		return kind === "gateway" ? `${String(row.providerId ?? "").trim()}:${modelId}` : modelId;
	};
	const sourceKeys = new Set(sourceRows.map(key).filter((value): value is string => Boolean(value)));
	const targetKeys = targetRows.map(key);
	if (targetKeys.some((value) => value === null) || new Set(targetKeys).size !== targetKeys.length) return false;
	const overlap = targetKeys.filter((value) => value && sourceKeys.has(value)).length;
	if (overlap / Math.max(sourceKeys.size, targetKeys.length) < 0.95) return false;
	const sourceShape = new Set(sourceRows.map((entry) => Object.keys(asRecord(entry) ?? {}).sort().join(",")));
	if (targetRows.some((entry) => !sourceShape.has(Object.keys(asRecord(entry) ?? {}).sort().join(",")))) return false;
	if (kind === "gateway") {
		return targetRows.every((entry) => {
			const row = asRecord(entry)!;
			return row.isAvailable === true && Array.isArray(row.capabilities) && row.capabilities.length > 0;
		});
	}
	return targetRows.every((entry) => {
		const row = asRecord(entry)!;
		if (!Array.isArray(row.gateway_monitor_rows)) return false;
		const ids = row.gateway_monitor_rows.map((monitor: unknown) => String(asRecord(monitor)?.id ?? ""));
		return ids.every(Boolean) && new Set(ids).size === ids.length;
	});
}

function canonicalRelation(path: string, source: unknown, target: unknown): boolean {
	if (path === "/api/_web/landing/stats") return landingStatsCanonical(source, target);
	if (path === "/api/_web/api-providers") return providersCanonical(source, target);
	if (path === "/api/_web/models") return catalogueRowsCanonical(source, target, "models");
	if (path === "/api/_web/gateway/models") return catalogueRowsCanonical(source, target, "gateway");
	return false;
}

function paths(): string[] {
	const configured = process.env.SHADOW_PATHS_JSON?.trim();
	if (!configured) return [...DEFAULT_PATHS];
	const parsed: unknown = JSON.parse(configured);
	if (!Array.isArray(parsed) || parsed.some((path) => typeof path !== "string" || !path.startsWith("/"))) {
		throw new Error("SHADOW_PATHS_JSON must be a JSON array of absolute paths");
	}
	return [...new Set(parsed as string[])];
}

async function read(origin: string, path: string, authorization?: string, cookie?: string) {
	const url = new URL(path, `${origin}/`);
	url.searchParams.set("shadowValidation", String(Date.now()));
	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
			"Cache-Control": "no-cache",
			...(authorization ? { Authorization: authorization } : {}),
			...(cookie ? { Cookie: cookie } : {}),
		},
		redirect: "error",
		signal: AbortSignal.timeout(30_000),
	});
	const raw = await response.text();
	let normalized = raw;
	let body: unknown = raw;
	try {
		body = canonical(JSON.parse(raw));
		normalized = JSON.stringify(body);
	} catch {
		// A non-JSON response remains byte-comparable and normally exposes a bad route.
	}
	return {
		bytes: Buffer.byteLength(normalized),
		digest: digest(normalized),
		status: response.status,
		body,
	};
}

async function readProtectedVercelDeployment(deployment: string, path: string) {
	if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(deployment)) throw new Error("SHADOW_TARGET_VERCEL_DEPLOYMENT must be a vercel.app HTTPS URL");
	if (!/^\/[A-Za-z0-9_?&=./:%-]+$/.test(path)) throw new Error(`Unsafe shadow validation path: ${path}`);
	const requestUrl = new URL(path, "https://preview.invalid");
	requestUrl.searchParams.set("shadowValidation", String(Date.now()));
	const requestPath = `${requestUrl.pathname}${requestUrl.search}`;
	const executable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "vercel";
	const args = process.platform === "win32"
		? ["/d", "/s", "/c", "vercel", "curl", requestPath, "--deployment", deployment]
		: ["curl", requestPath, "--deployment", deployment];
	const { stdout } = await execFileAsync(executable, args, {
		env: { ...process.env, NO_COLOR: "1" },
		maxBuffer: 16 * 1024 * 1024,
	});
	const raw = stdout.trim().split(/\r?\n/).at(-1) ?? "";
	let normalized = raw;
	let body: unknown = raw;
	try {
		body = canonical(JSON.parse(raw));
		normalized = JSON.stringify(body);
	} catch {
		// Keep non-JSON output byte-comparable with the ordinary HTTP reader.
	}
	return { bytes: Buffer.byteLength(normalized), digest: digest(normalized), status: 200, body };
}

async function main() {
	const source = requiredEnvironment("SHADOW_SOURCE_ORIGIN");
	const targetDeployment = process.env.SHADOW_TARGET_VERCEL_DEPLOYMENT?.trim();
	const target = targetDeployment ? null : requiredEnvironment("SHADOW_TARGET_ORIGIN");
	const report = [];
	for (const path of paths()) {
		const [sourceResult, targetResult] = await Promise.all([
			read(source, path, process.env.SHADOW_SOURCE_AUTHORIZATION, process.env.SHADOW_SOURCE_COOKIE),
			targetDeployment
				? readProtectedVercelDeployment(targetDeployment, path)
				: read(target!, path, process.env.SHADOW_TARGET_AUTHORIZATION, process.env.SHADOW_TARGET_COOKIE),
		]);
		const exact = sourceResult.status === targetResult.status && sourceResult.digest === targetResult.digest;
		const targetSuperset = path === "/api/_web/monitor/history/initial"
			&& sourceResult.status === 200 && targetResult.status === 200
			&& monitorTargetSuperset(sourceResult.body, targetResult.body);
		const canonicalContract = !exact && !targetSuperset
			&& sourceResult.status === 200 && targetResult.status === 200
			&& canonicalRelation(path, sourceResult.body, targetResult.body);
		report.push({
			path,
			matches: exact || targetSuperset || canonicalContract,
			relation: exact ? "exact" : targetSuperset ? "target_superset" : canonicalContract ? "canonical_contract" : "mismatch",
			source: { bytes: sourceResult.bytes, digest: sourceResult.digest, status: sourceResult.status },
			target: { bytes: targetResult.bytes, digest: targetResult.digest, status: targetResult.status },
		});
	}
	const mismatches = report.filter((entry) => !entry.matches);
	console.log(JSON.stringify({
		ok: mismatches.length === 0,
		checked: report.length,
		mismatches,
		results: report,
	}, null, 2));
	if (mismatches.length) process.exitCode = 2;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
