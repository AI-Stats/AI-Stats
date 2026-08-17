import "dotenv/config";

import { compareBenchmarkScoresForBenchmark } from "../../src/lib/benchmarks/scoreFormat";
import { isDryRun, logWrite } from "./runtime";
import { selectImportRows, updateImportRows } from "./database";
import { chunk } from "./util";

type BenchmarkResultRow = {
	id: string;
	result_key: string | null;
	model_id: string;
	benchmark_id: string;
	score: string | number | null;
	is_self_reported: boolean | null;
	other_info: string | null;
	source_link: string | null;
	occur_idx: number | null;
	variant: string | null;
	rank: number | null;
};

type BenchmarkMetaRow = {
	id?: string;
	benchmark_id?: string;
	ascending_order: boolean | null;
};

const PAGE_SIZE = 1000;

const getArgValue = (name: string): string | null => {
	const prefixed = `--${name}=`;
	const match = process.argv.find((arg) => arg.startsWith(prefixed));
	return match ? match.slice(prefixed.length) : null;
};

function parseScore(value: string | number | null): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const numeric = Number(trimmed);
		return Number.isFinite(numeric) ? numeric : null;
	}
	return null;
}

async function fetchAllBenchmarkRows(
	benchmarkIds: string[] | null,
): Promise<BenchmarkResultRow[]> {
	const out: BenchmarkResultRow[] = [];

	if (benchmarkIds && benchmarkIds.length === 0) return out;

	const idGroups =
		benchmarkIds && benchmarkIds.length
			? chunk(Array.from(new Set(benchmarkIds)), 200)
			: [null];

	for (const ids of idGroups) {
		for (let offset = 0; ; offset += PAGE_SIZE) {
			const rawRows = await selectImportRows({
				table: "v2_benchmark_results",
				columns: "result_id,result_key,model_slug,benchmark_id,score,is_self_reported,other_info,source_link,occur_idx,variant,rank",
				inFilter: ids ? { column: "benchmark_id", values: ids } : undefined,
				orderBy: [{ column: "benchmark_id" }, { column: "id" }],
				offset,
				limit: PAGE_SIZE,
			}) as Array<Omit<BenchmarkResultRow, "id" | "model_id"> & { result_id: string; model_slug: string }>;

			if (!rawRows.length) break;
			out.push(...rawRows.map((row) => ({ ...row, id: row.result_id, model_id: row.model_slug })));
			if (rawRows.length < PAGE_SIZE) break;
		}
	}

	return out;
}

async function fetchBenchmarkMeta(
	benchmarkIds: string[],
): Promise<Map<string, boolean | null>> {
	const out = new Map<string, boolean | null>();
	if (!benchmarkIds.length) return out;

	for (const ids of chunk(Array.from(new Set(benchmarkIds)), 200)) {
		const rows = await selectImportRows({
			table: "v2_benchmarks",
			columns: "benchmark_id,ascending_order",
			inFilter: { column: "benchmark_id", values: ids },
		}) as BenchmarkMetaRow[];

		for (const row of rows) {
			const benchmarkId = row.id ?? row.benchmark_id;
			if (benchmarkId) out.set(benchmarkId, typeof row.ascending_order === "boolean" ? row.ascending_order : null);
		}
	}

	return out;
}

async function benchmarkIdsForModel(modelId: string): Promise<string[]> {
	const rows: Array<{ benchmark_id: string | null }> = [];

	for (let offset = 0; ; offset += PAGE_SIZE) {
		const page = await selectImportRows({
			table: "v2_benchmark_results",
			columns: "result_id,benchmark_id",
			filters: [{ column: "model_slug", value: modelId }],
			orderBy: [{ column: "benchmark_id" }, { column: "id" }],
			offset,
			limit: PAGE_SIZE,
		}) as Array<{ benchmark_id: string | null }>;

		if (!page.length) break;
		rows.push(...page);
		if (page.length < PAGE_SIZE) break;
	}

	return Array.from(
		new Set(
			rows
				.map((row) => row.benchmark_id)
				.filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);
}

function buildRankedRows(
	rows: BenchmarkResultRow[],
	ascendingByBenchmark: Map<string, boolean | null>,
): BenchmarkResultRow[] {
	const byBenchmark = new Map<string, BenchmarkResultRow[]>();

	for (const row of rows) {
		const bucket = byBenchmark.get(row.benchmark_id) ?? [];
		bucket.push(row);
		byBenchmark.set(row.benchmark_id, bucket);
	}

	const ranked: BenchmarkResultRow[] = [];

	for (const [benchmarkId, group] of byBenchmark) {
		const numeric = group
			.map((row) => ({ row, numericScore: parseScore(row.score) }))
			.filter(
				(item): item is { row: BenchmarkResultRow; numericScore: number } =>
					item.numericScore != null,
			)
			.sort((a, b) => {
				if (a.numericScore !== b.numericScore) {
					return compareBenchmarkScoresForBenchmark(
						a.numericScore,
						b.numericScore,
						benchmarkId,
						ascendingByBenchmark,
					);
				}
				const resultKeyCompare = (a.row.result_key ?? "").localeCompare(
					b.row.result_key ?? "",
				);
				if (resultKeyCompare !== 0) return resultKeyCompare;
				return a.row.id.localeCompare(b.row.id);
			});

		const rankById = new Map<string, number>();
		numeric.forEach((item, index) => {
			rankById.set(item.row.id, index + 1);
		});

		for (const row of group) {
			ranked.push({
				...row,
				rank: rankById.get(row.id) ?? null,
			});
		}
	}

	return ranked;
}

async function writeRankedRows(rows: BenchmarkResultRow[]): Promise<void> {
	if (!rows.length) return;

	if (isDryRun()) {
		for (const row of rows) {
			logWrite("public.v2_benchmark_results", "UPDATE_RANK", { result_id: row.id, rank: row.rank }, {
				onConflict: "result_id",
			});
		}
		return;
	}

	for (const batch of chunk(rows, 500)) {
		for (const row of batch) {
			await updateImportRows(
				"v2_benchmark_results",
				{ rank: row.rank },
				[{ column: "result_id", value: row.id }],
			);
		}
	}
}

async function main() {
	const benchmarkFilter = getArgValue("benchmark");
	const modelFilter = getArgValue("model");

	let benchmarkIds: string[] | null = null;
	if (benchmarkFilter) {
		benchmarkIds = [benchmarkFilter];
	}
	if (modelFilter) {
		const modelBenchmarkIds = await benchmarkIdsForModel(modelFilter);
		benchmarkIds = benchmarkIds
			? benchmarkIds.filter((id) => modelBenchmarkIds.includes(id))
			: modelBenchmarkIds;
	}

	console.log(">> Recomputing benchmark ranks in DB");
	if (benchmarkFilter) console.log(`>> Benchmark filter: ${benchmarkFilter}`);
	if (modelFilter) console.log(`>> Model filter: ${modelFilter}`);
	if (isDryRun()) console.log(">> Dry run enabled");

	const rows = await fetchAllBenchmarkRows(benchmarkIds);
	const touchedBenchmarkIds = Array.from(new Set(rows.map((row) => row.benchmark_id)));
	const benchmarkMeta = await fetchBenchmarkMeta(touchedBenchmarkIds);
	const rankedRows = buildRankedRows(rows, benchmarkMeta);

	await writeRankedRows(rankedRows);

	console.log(
		`>> Done. recomputed_rows=${rankedRows.length} benchmarks=${touchedBenchmarkIds.length}`,
	);
}

if (require.main === module) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
