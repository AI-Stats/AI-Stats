/* eslint-disable no-console -- benchmark CLI emits an operator-readable report */

const PATHS = [
	"/api/_web/landing/stats",
	"/api/_web/landing/models/main",
	"/api/_web/models",
	"/api/_web/organisations",
	"/api/_web/benchmarks",
	"/api/_web/api-providers",
	"/api/_web/gateway/models",
	"/api/_web/monitor/history/initial",
] as const;

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value.replace(/\/+$/, "");
}

function percentile(values: number[], fraction: number): number {
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.min(Math.ceil(sorted.length * fraction) - 1, sorted.length - 1)] ?? 0;
}

function targetSloMs(path: string): number {
	if (path === "/api/_web/models") return 5_000;
	if (path === "/api/_web/gateway/models") return 3_000;
	if (path === "/api/_web/monitor/history/initial") return 2_000;
	return 1_500;
}

async function sample(origin: string, path: string, run: number) {
	const url = new URL(path, `${origin}/`);
	url.searchParams.set("performanceValidation", `${Date.now()}-${run}`);
	const started = performance.now();
	const response = await fetch(url, {
		headers: { Accept: "application/json", "Cache-Control": "no-cache" },
		signal: AbortSignal.timeout(30_000),
	});
	await response.arrayBuffer();
	return { durationMs: Number((performance.now() - started).toFixed(1)), status: response.status };
}

async function main() {
	const source = required("SHADOW_SOURCE_ORIGIN");
	const target = required("SHADOW_TARGET_ORIGIN");
	const samples = Math.max(3, Number(process.env.SHADOW_PERFORMANCE_SAMPLES ?? 5));
	const results = [];
	for (const path of PATHS) {
		await Promise.all([sample(source, path, -1), sample(target, path, -1)]);
		const sourceSamples = [];
		const targetSamples = [];
		for (let run = 0; run < samples; run += 1) {
			const [sourceResult, targetResult] = await Promise.all([sample(source, path, run), sample(target, path, run)]);
			sourceSamples.push(sourceResult);
			targetSamples.push(targetResult);
		}
		const sourceP95Ms = percentile(sourceSamples.map((entry) => entry.durationMs), 0.95);
		const targetP95Ms = percentile(targetSamples.map((entry) => entry.durationMs), 0.95);
		const failures = [...sourceSamples, ...targetSamples].filter((entry) => entry.status !== 200).length;
		const sloMs = targetSloMs(path);
		results.push({
			path,
			ok: failures === 0 && targetP95Ms <= sloMs,
			failures,
			sourceP50Ms: percentile(sourceSamples.map((entry) => entry.durationMs), 0.5),
			sourceP95Ms,
			targetP50Ms: percentile(targetSamples.map((entry) => entry.durationMs), 0.5),
			targetP95Ms,
			sourceRatio: Number((targetP95Ms / Math.max(sourceP95Ms, 1)).toFixed(2)),
			targetSloMs: sloMs,
		});
	}
	const failed = results.filter((entry) => !entry.ok);
	console.log(JSON.stringify({ ok: failed.length === 0, samplesPerOrigin: samples, failed, results }, null, 2));
	if (failed.length) process.exitCode = 2;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
