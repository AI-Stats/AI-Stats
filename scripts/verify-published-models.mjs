import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const MODEL_FILE_PATTERN = /^packages\/data\/catalog\/src\/data\/models\/.+\/model\.json$/;
const DEFAULT_ORIGIN = "https://phaseo.app";

function argument(name) {
	const prefix = `--${name}=`;
	return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function changedModelFiles(baseSha) {
	const effectiveBase = baseSha && !/^0+$/.test(baseSha) ? baseSha : "HEAD^";
	const output = execFileSync(
		"git",
		["diff", "--name-only", "--diff-filter=ACMR", effectiveBase, "HEAD", "--", "packages/data/catalog/src/data/models"],
		{ encoding: "utf8" },
	);
	return output.split(/\r?\n/).filter((file) => MODEL_FILE_PATTERN.test(file));
}

async function modelIdsForFiles(files) {
	const ids = await Promise.all(files.map(async (file) => {
		const model = JSON.parse(await readFile(file, "utf8"));
		if (typeof model.model_id !== "string" || !model.model_id.trim()) {
			throw new Error(`${file} does not contain a valid model_id`);
		}
		return model.model_id.trim();
	}));
	return [...new Set(ids)].sort();
}

async function verifyModel(origin, modelId, requestTimeoutMs) {
	const url = `${origin}/api/_web/models/${encodeURIComponent(modelId)}?projection=variants-v1`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
			cache: "no-store",
			signal: controller.signal,
		});
		if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
		const payload = await response.json();
		return payload?.model?.model_id === modelId
			? { ok: true }
			: { ok: false, detail: `unexpected model_id ${JSON.stringify(payload?.model?.model_id)}` };
	} catch (error) {
		return { ok: false, detail: error instanceof Error ? error.message : String(error) };
	} finally {
		clearTimeout(timeout);
	}
}

async function main() {
	const baseSha = argument("base-sha") ?? process.env.IMPORT_BASE_SHA;
	const origin = (argument("origin") ?? process.env.WEB_API_ORIGIN ?? DEFAULT_ORIGIN).replace(/\/+$/, "");
	const attempts = Number(argument("attempts") ?? 10);
	const intervalMs = Number(argument("interval-ms") ?? 6_000);
	const requestTimeoutMs = Number(argument("request-timeout-ms") ?? 10_000);
	const modelIds = await modelIdsForFiles(changedModelFiles(baseSha));

	if (modelIds.length === 0) {
		console.log("No changed model records require publication verification.");
		return;
	}

	let pending = modelIds;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const results = await Promise.all(pending.map(async (modelId) => ({
			modelId,
			...(await verifyModel(origin, modelId, requestTimeoutMs)),
		})));
		pending = results.filter((result) => !result.ok).map((result) => result.modelId);
		for (const result of results) {
			console.log(`${result.ok ? "Published" : "Pending"}: ${result.modelId}${result.detail ? ` (${result.detail})` : ""}`);
		}
		if (pending.length === 0) return;
		if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error(`Models were not published after ${attempts} attempts: ${pending.join(", ")}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
