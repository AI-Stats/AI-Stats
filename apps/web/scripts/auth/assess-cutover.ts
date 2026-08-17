/* eslint-disable no-console -- cutover CLI emits an operator-readable report */
import { Pool, type PoolConfig } from "pg";

type RelationCount = { schema_name: string; table_name: string; row_count: string };
type SequenceState = { schema_name: string; sequence_name: string; last_value: string | null };
type RowHashCount = { occurrences: number; row_hash: string };

const REPOSITORY_MANAGED_RELATIONS = new Set([
	"catalog.v2_benchmark_results", "catalog.v2_benchmarks", "catalog.v2_catalogue_backfill_issues",
	"catalog.v2_catalogue_source_overrides", "catalog.v2_lab_links", "catalog.v2_labs",
	"catalog.v2_meter_definitions", "catalog.v2_model_aliases", "catalog.v2_model_details",
	"catalog.v2_model_families", "catalog.v2_model_links", "catalog.v2_model_page_notices",
	"catalog.v2_model_provider_routes", "catalog.v2_models", "catalog.v2_pricing_sku_meters",
	"catalog.v2_pricing_skus", "catalog.v2_provider_regions", "catalog.v2_providers",
	"catalog.v2_route_capabilities", "catalog.v2_route_variants", "catalog.v2_service_tiers",
	"catalog.v2_subscription_plan_features", "catalog.v2_subscription_plan_models",
	"catalog.v2_subscription_plans",
]);

// These relations are now written or rebuilt by PlanetScale-backed production
// jobs. Supabase is a rollback source for them, not the post-cutover authority.
const TARGET_MANAGED_RELATIONS = new Set([
	"billing.wallets",
	"catalog.model_discovery_runs", "catalog.model_discovery_seen_models",
	"internal.monitor_history_sync_state", "internal.v2_analytics_outbox",
	"internal.v2_rollup_refresh_state",
	"observability.public_model_task_daily", "observability.public_model_user_usage_daily",
	"observability.v2_private_usage_daily", "observability.v2_private_usage_daily_meters",
	"observability.v2_public_provider_health_daily", "observability.v2_public_usage_daily",
	"observability.v2_public_usage_daily_meters", "observability.v2_public_usage_hourly",
	"observability.v2_public_usage_hourly_meters",
]);

function requiredEnvironment(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function postgresConfig(connectionString: string, rejectUnauthorized: boolean): PoolConfig {
	const url = new URL(connectionString);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return {
		allowExitOnIdle: true,
		connectionString: url.toString(),
		connectionTimeoutMillis: 10_000,
		max: 2,
		ssl: { rejectUnauthorized },
	};
}

function identifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

async function relationCounts(pool: Pool, target = false): Promise<RelationCount[]> {
	const relations = await pool.query<{ schema_name: string; table_name: string }>(`
		select schemaname as schema_name, tablename as table_name
		from pg_catalog.pg_tables
		where ${target
			? "schemaname = any (array['auth', 'app', 'billing', 'catalog', 'content', 'gateway', 'internal', 'observability', 'public'])"
			: "schemaname = 'public' or (schemaname = 'auth' and tablename = 'users')"}
		order by schemaname, tablename
	`);
	const counts: RelationCount[] = [];
	for (const relation of relations.rows) {
		const result = await pool.query<{ row_count: string }>(
			`select count(*)::text as row_count from ${identifier(relation.schema_name)}.${identifier(relation.table_name)}`,
		);
		counts.push({ ...relation, row_count: result.rows[0]?.row_count ?? "0" });
	}
	return counts;
}

async function sequenceStates(pool: Pool, target = false): Promise<SequenceState[]> {
	const sequences = await pool.query<SequenceState>(`
		select schemaname as schema_name, sequencename as sequence_name,
			last_value::text as last_value
		from pg_catalog.pg_sequences
		where ${target
			? "schemaname = any (array['auth', 'app', 'billing', 'catalog', 'content', 'gateway', 'internal', 'observability', 'public'])"
			: "schemaname = 'public'"}
		order by schemaname, sequencename
	`);
	return sequences.rows;
}

function keyed<T extends { schema_name: string }>(rows: T[], name: (row: T) => string) {
	return new Map(rows.map((row) => [`${row.schema_name}.${name(row)}`, row]));
}

async function rowHashCounts(pool: Pool, schema: string, table: string) {
	const result = await pool.query<RowHashCount>(`
		select md5(to_jsonb(row_value)::text) as row_hash, count(*)::int as occurrences
		from ${identifier(schema)}.${identifier(table)} row_value
		group by 1
	`);
	return new Map(result.rows.map((row) => [row.row_hash, Number(row.occurrences)]));
}

async function sourceSubset(source: Pool, target: Pool, sourceRelation: RelationCount, targetRelation: RelationCount) {
	const [sourceHashes, targetHashes] = await Promise.all([
		rowHashCounts(source, sourceRelation.schema_name, sourceRelation.table_name),
		rowHashCounts(target, targetRelation.schema_name, targetRelation.table_name),
	]);
	let sourceRowsMissingOrChanged = 0;
	let matchedRows = 0;
	for (const [hash, sourceOccurrences] of sourceHashes) {
		const targetOccurrences = targetHashes.get(hash) ?? 0;
		matchedRows += Math.min(sourceOccurrences, targetOccurrences);
		sourceRowsMissingOrChanged += Math.max(sourceOccurrences - targetOccurrences, 0);
	}
	const targetRows = [...targetHashes.values()].reduce((total, count) => total + count, 0);
	return {
		sourceRowsMissingOrChanged,
		targetOnlyRows: targetRows - matchedRows,
	};
}

async function semanticSourceSubset(source: Pool, target: Pool, sourceRelation: RelationCount, targetRelation: RelationCount) {
	const keys = await primaryKeyColumns(source, sourceRelation.schema_name, sourceRelation.table_name);
	if (!keys.length) return sourceSubset(source, target, sourceRelation, targetRelation);
	const sourceQuery = `select to_jsonb(row_value) as row from ${identifier(sourceRelation.schema_name)}.${identifier(sourceRelation.table_name)} row_value`;
	const targetQuery = `select to_jsonb(row_value) as row from ${identifier(targetRelation.schema_name)}.${identifier(targetRelation.table_name)} row_value`;
	const [sourceRows, targetRows] = await Promise.all([
		source.query<{ row: Record<string, unknown> }>(sourceQuery),
		target.query<{ row: Record<string, unknown> }>(targetQuery),
	]);
	const rowKey = (row: Record<string, unknown>) => JSON.stringify(keys.map((key) => row[key] ?? null));
	const targetByKey = new Map(targetRows.rows.map(({ row }) => [rowKey(row), row]));
	let sourceRowsMissingOrChanged = 0;
	for (const { row: sourceRow } of sourceRows.rows) {
		const targetRow = targetByKey.get(rowKey(sourceRow));
		if (!targetRow) {
			sourceRowsMissingOrChanged += 1;
			continue;
		}
		const comparableSource = { ...sourceRow };
		const comparableTarget = { ...targetRow };
		if (sourceRelation.table_name === "api_apps") {
			for (const column of ["last_seen", "updated_at"]) {
				const sourceTime = Date.parse(String(sourceRow[column] ?? ""));
				const targetTime = Date.parse(String(targetRow[column] ?? ""));
				if (Number.isFinite(sourceTime) && Number.isFinite(targetTime) && targetTime >= sourceTime) {
					comparableSource[column] = comparableTarget[column];
				}
			}
		}
		if (sourceRelation.table_name === "monitor_history_events") {
			for (const row of [comparableSource, comparableTarget]) {
				if (typeof row.percent_change === "number" && Number.isFinite(row.percent_change)) {
					row.percent_change = Number(row.percent_change.toPrecision(12));
				}
			}
		}
		if (JSON.stringify(comparableSource) !== JSON.stringify(comparableTarget)) sourceRowsMissingOrChanged += 1;
	}
	return { sourceRowsMissingOrChanged, targetOnlyRows: Math.max(targetRows.rows.length - sourceRows.rows.length, 0) };
}

async function primaryKeyColumns(pool: Pool, schema: string, table: string): Promise<string[]> {
	const result = await pool.query<{ column_name: string }>(`
		select attribute.attname as column_name
		from pg_index index_definition
		join pg_class relation on relation.oid = index_definition.indrelid
		join pg_namespace namespace on namespace.oid = relation.relnamespace
		join unnest(index_definition.indkey) with ordinality key_attribute(attnum, position) on true
		join pg_attribute attribute on attribute.attrelid = relation.oid and attribute.attnum = key_attribute.attnum
		where index_definition.indisprimary and namespace.nspname = $1 and relation.relname = $2
		order by key_attribute.position
	`, [schema, table]);
	return result.rows.map((row) => row.column_name);
}

async function changedRowSamples(source: Pool, target: Pool, sourceRelation: RelationCount, targetRelation: RelationCount) {
	const keys = await primaryKeyColumns(source, sourceRelation.schema_name, sourceRelation.table_name);
	if (!keys.length) return [];
	const sourceQuery = `select to_jsonb(row_value) as row from ${identifier(sourceRelation.schema_name)}.${identifier(sourceRelation.table_name)} row_value`;
	const targetQuery = `select to_jsonb(row_value) as row from ${identifier(targetRelation.schema_name)}.${identifier(targetRelation.table_name)} row_value`;
	const [sourceRows, targetRows] = await Promise.all([
		source.query<{ row: Record<string, unknown> }>(sourceQuery),
		target.query<{ row: Record<string, unknown> }>(targetQuery),
	]);
	const rowKey = (row: Record<string, unknown>) => JSON.stringify(keys.map((key) => row[key] ?? null));
	const targetByKey = new Map(targetRows.rows.map(({ row }) => [rowKey(row), row]));
	const safeScalar = (value: unknown): unknown => typeof value === "number"
		? value
		: typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : typeof value;
	const samples: Array<{ key: string; kind: "missing" | "changed"; changedColumns: string[]; changedValues?: Record<string, unknown> }> = [];
	for (const { row } of sourceRows.rows) {
		const key = rowKey(row);
		const targetRow = targetByKey.get(key);
		if (!targetRow) {
			samples.push({ key, kind: "missing", changedColumns: [] });
			continue;
		}
		const changedColumns = Object.keys(row).filter((column) => JSON.stringify(row[column]) !== JSON.stringify(targetRow[column]));
		if (changedColumns.length) samples.push({
			key,
			kind: "changed",
			changedColumns,
			changedValues: Object.fromEntries(changedColumns.map((column) => [column, {
				source: safeScalar(row[column]),
				target: safeScalar(targetRow[column]),
			}])),
		});
		if (samples.length >= 10) break;
	}
	return samples;
}

async function main() {
	const source = new Pool(postgresConfig(requiredEnvironment("SUPABASE_MIGRATION_DATABASE_URL"), false));
	const target = new Pool(postgresConfig(requiredEnvironment("PLANETSCALE_MIGRATION_DATABASE_URL"), true));
	try {
		const [sourceCounts, targetCounts, sourceSequences, targetSequences] = await Promise.all([
				relationCounts(source), relationCounts(target, true), sequenceStates(source), sequenceStates(target, true),
		]);
		const sourceByTable = keyed(sourceCounts, (row) => row.table_name);
		// Better Auth adds target-only tables. Source relations must all exist and
		// match; target-only relations are assessed by the auth-specific checks.
		const sourceTables = [...sourceByTable.keys()].sort();
		const tableMismatches = [];
		for (const table of sourceTables) {
			const relation = sourceByTable.get(table)!;
			const targetRelation = targetCounts.find((candidate) =>
				candidate.table_name === relation.table_name
				&& (relation.schema_name === "auth" ? candidate.schema_name === "auth" : candidate.schema_name !== "auth"),
			);
			const sourceCount = relation.row_count;
			const targetCount = targetRelation?.row_count ?? "missing";
			const targetName = targetRelation ? `${targetRelation.schema_name}.${targetRelation.table_name}` : table;
			const authority = table === "auth.users"
				? "identity"
				: REPOSITORY_MANAGED_RELATIONS.has(targetName)
					? "repository"
					: TARGET_MANAGED_RELATIONS.has(targetName) ? "target" : "source";
			if (targetCount === "missing") {
				tableMismatches.push({ table, authority, sourceCount, targetCount, sourceRowsMissingOrChanged: Number(sourceCount) || 0, targetOnlyRows: 0 });
				continue;
			}
			const comparison = ["api_apps", "monitor_history_events"].includes(relation.table_name)
				? await semanticSourceSubset(source, target, relation, targetRelation!)
				: await sourceSubset(source, target, relation, targetRelation!);
			if (comparison.sourceRowsMissingOrChanged || comparison.targetOnlyRows) {
				tableMismatches.push({ table, authority, sourceCount, targetCount, ...comparison });
			}
		}

		const sourceBySequence = keyed(sourceSequences, (row) => row.sequence_name);
		const sequenceMismatches = [...sourceBySequence.entries()].flatMap(([sequence, sourceState]) => {
			const targetState = targetSequences.find((candidate) => candidate.sequence_name === sourceState.sequence_name);
			const sourceValue = sourceState.last_value === null ? null : BigInt(sourceState.last_value);
			const targetValue = targetState?.last_value == null ? null : BigInt(targetState.last_value);
			if (!targetState) {
				return [{ sequence, sourceValue: sourceState.last_value, targetValue: "missing" }];
			}
			if (sourceValue === null || (targetValue !== null && targetValue >= sourceValue)) return [];
			return [{ sequence, sourceValue: sourceState.last_value, targetValue: targetState.last_value ?? "uninitialized" }];
		});
		const [sourceIdentity, targetIdentity] = await Promise.all([
			source.query<{ accounts: string; mfa_protected: string; users: string }>(`
				select count(*)::text as users,
					((select count(*) from auth.users where encrypted_password is not null)
						+ (select count(*) from auth.identities where provider <> 'email'))::text as accounts,
					(select count(distinct user_id)::text from auth.mfa_factors where status = 'verified') as mfa_protected
				from auth.users
			`),
			target.query<{ accounts: string; mfa_protected: string; users: string }>(`
				select (select count(*) from auth.user)::text as users,
					(select count(*) from auth.account)::text as accounts,
					(select count(*) from auth.user
					 where "twoFactorEnabled" is true or "mfaReenrollmentRequired" is true)::text as mfa_protected
			`),
		]);
		const sourceIdentityCounts = sourceIdentity.rows[0];
		const targetIdentityCounts = targetIdentity.rows[0];
		const identityMismatch = Number(sourceIdentityCounts?.users ?? 0) > Number(targetIdentityCounts?.users ?? 0)
			|| Number(sourceIdentityCounts?.accounts ?? 0) > Number(targetIdentityCounts?.accounts ?? 0)
			|| Number(targetIdentityCounts?.mfa_protected ?? 0) < Number(sourceIdentityCounts?.mfa_protected ?? 0);
		const diagnosedTableMismatches = [];
		for (const mismatch of tableMismatches) {
			const relation = sourceByTable.get(mismatch.table);
			const targetRelation = relation && targetCounts.find((candidate) =>
				candidate.table_name === relation.table_name
				&& (relation.schema_name === "auth" ? candidate.schema_name === "auth" : candidate.schema_name !== "auth"),
			);
			const samples = mismatch.authority === "source" && mismatch.sourceRowsMissingOrChanged > 0
				&& mismatch.table !== "auth.users" && relation && targetRelation
				? await changedRowSamples(source, target, relation, targetRelation)
				: [];
			diagnosedTableMismatches.push({ ...mismatch, ...(samples.length ? { samples } : {}) });
		}
		const sourceRowsMissingOrChanged = tableMismatches.filter((mismatch) => mismatch.authority === "source" && mismatch.table !== "auth.users").reduce(
			(total, mismatch) => total + mismatch.sourceRowsMissingOrChanged,
			0,
		);
		const repositoryRowsDiverged = tableMismatches.filter((mismatch) => mismatch.authority === "repository").reduce(
			(total, mismatch) => total + mismatch.sourceRowsMissingOrChanged + mismatch.targetOnlyRows,
			0,
		);

		console.log(JSON.stringify({
			ok: sourceRowsMissingOrChanged === 0 && sequenceMismatches.length === 0 && !identityMismatch,
			sourceTables: sourceCounts.length,
			targetTables: targetCounts.length,
			sourceRowsMissingOrChanged,
			repositoryRowsDiverged,
			tableMismatches: diagnosedTableMismatches,
			sequenceMismatches,
			identity: {
				source: sourceIdentityCounts,
				target: targetIdentityCounts,
				matches: !identityMismatch,
			},
		}, null, 2));
		if (sourceRowsMissingOrChanged || sequenceMismatches.length || identityMismatch) process.exitCode = 2;
	} finally {
		await Promise.all([source.end(), target.end()]);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
