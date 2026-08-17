import { createNodeDatabaseForSchema } from "./node-core";
import { sql, type SQL } from "./query";
import { Pool } from "pg";

const IMPORT_TABLES = new Set([
	"v2_benchmark_results", "v2_benchmarks", "v2_catalogue_backfill_issues",
	"v2_catalogue_source_overrides", "v2_lab_links", "v2_labs", "v2_meter_definitions",
	"v2_model_aliases", "v2_model_details", "v2_model_families", "v2_model_links",
	"v2_model_page_notices", "v2_model_provider_routes", "v2_models", "v2_pricing_sku_meters",
	"v2_pricing_skus", "v2_provider_regions", "v2_providers", "v2_route_capabilities",
	"v2_route_variants", "v2_service_tiers", "v2_subscription_plan_features",
	"v2_subscription_plan_models", "v2_subscription_plans",
	"model_discovery_runs", "model_discovery_seen_models",
]);

const JSON_COLUMNS = new Map<string, ReadonlySet<string>>([
	["v2_benchmark_results", new Set(["metadata"])],
	["v2_catalogue_backfill_issues", new Set(["details"])],
	["v2_labs", new Set(["metadata"])],
	["v2_meter_definitions", new Set(["metadata"])],
	["v2_model_aliases", new Set(["metadata"])],
	["v2_model_details", new Set(["detail_value"])],
	["v2_model_families", new Set(["metadata"])],
	["v2_model_links", new Set(["metadata"])],
	["v2_model_provider_routes", new Set(["metadata"])],
	["v2_models", new Set(["metadata"])],
	["v2_pricing_sku_meters", new Set(["metadata"])],
	["v2_pricing_skus", new Set(["metadata"])],
	["v2_provider_regions", new Set(["metadata"])],
	["v2_providers", new Set(["metadata"])],
	["v2_route_capabilities", new Set(["params", "metadata"])],
	["v2_route_variants", new Set(["metadata"])],
	["v2_service_tiers", new Set(["metadata"])],
	["v2_subscription_plan_features", new Set(["other_info"])],
	["v2_subscription_plan_models", new Set(["model_info", "rate_limit", "other_info"])],
	["v2_subscription_plans", new Set(["other_info"])],
]);

function importValue(table: string, column: string, value: unknown): unknown {
	if (value === null || value === undefined) return null;
	return JSON_COLUMNS.get(table)?.has(column) ? JSON.stringify(value) : value;
}

let pool: Pool | undefined;

function identifier(value: string) {
	if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
	return sql.identifier(value);
}

function tableIdentifier(table: string) {
	if (!IMPORT_TABLES.has(table)) throw new Error(`Importer table is not allowed: ${table}`);
	return identifier(table);
}

function database() {
	const connectionString = process.env.PLANETSCALE_DATABASE_URL ?? process.env.DATABASE_URL;
	if (!connectionString) throw new Error("PLANETSCALE_DATABASE_URL is required");
	const url = new URL(connectionString);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	pool ??= new Pool({ connectionString: url.toString(), max: 4, ssl: { rejectUnauthorized: true } });
	return createNodeDatabaseForSchema(pool, {});
}

export type ImportFilter = { column: string; value: unknown };

function whereClause(filters: ImportFilter[], inFilter?: { column: string; values: unknown[] }): SQL {
	const clauses = filters.map((filter) => sql`${identifier(filter.column)} = ${sql.param(filter.value ?? null)}`);
	if (inFilter) {
		if (!inFilter.values.length) return sql`false`;
		clauses.push(sql`${identifier(inFilter.column)} in (${sql.join(inFilter.values.map((value) => sql.param(value ?? null)), sql`, `)})`);
	}
	return clauses.length ? sql` where ${sql.join(clauses, sql` and `)}` : sql``;
}

export async function selectImportRows(args: {
	table: string;
	columns?: string;
	filters?: ImportFilter[];
	inFilter?: { column: string; values: unknown[] };
	orderBy?: Array<{ column: string; ascending?: boolean }>;
	offset?: number;
	limit?: number;
}): Promise<Record<string, any>[]> {
	const columns = !args.columns || args.columns.trim() === "*"
		? sql.raw("*")
		: sql.join(args.columns.split(",").map((column) => identifier(column.trim())), sql`, `);
	const where = whereClause(args.filters ?? [], args.inFilter);
	const order = args.orderBy?.length
		? sql` order by ${sql.join(args.orderBy.map((item) => sql`${identifier(item.column)} ${item.ascending === false ? sql`desc` : sql`asc`}`), sql`, `)}`
		: sql``;
	const limit = args.limit == null ? sql`` : sql` limit ${args.limit}`;
	const offset = args.offset == null ? sql`` : sql` offset ${args.offset}`;
	const result = await database().execute(sql`select ${columns} from ${tableIdentifier(args.table)}${where}${order}${limit}${offset}`);
	return result.rows as Record<string, any>[];
}

export async function upsertImportRows(table: string, rows: Record<string, any>[], conflictColumns: string[]) {
	if (!rows.length) return;
	const columns = Object.keys(rows[0]);
	if (!columns.length || rows.some((row) => columns.some((column) => !(column in row)))) {
		throw new Error(`Importer rows for ${table} must have a consistent shape`);
	}
	const values = rows.map((row) => sql`(${sql.join(columns.map((column) => sql.param(importValue(table, column, row[column]))), sql`, `)})`);
	const mutable = columns.filter((column) => !conflictColumns.includes(column));
	const action = mutable.length
		? sql`do update set ${sql.join(mutable.map((column) => sql`${identifier(column)} = excluded.${identifier(column)}`), sql`, `)}`
		: sql`do nothing`;
	await database().execute(sql`insert into ${tableIdentifier(table)} (${sql.join(columns.map(identifier), sql`, `)}) values ${sql.join(values, sql`, `)} on conflict (${sql.join(conflictColumns.map(identifier), sql`, `)}) ${action}`);
}

export async function deleteImportRows(args: {
	table: string;
	filters?: ImportFilter[];
	inFilter?: { column: string; values: unknown[] };
}) {
	if (!(args.filters?.length || args.inFilter)) throw new Error(`Refusing unbounded delete from ${args.table}`);
	const result = await database().execute(sql`delete from ${tableIdentifier(args.table)}${whereClause(args.filters ?? [], args.inFilter)}`);
	return result.rowCount ?? 0;
}

export async function updateImportRows(
	table: string,
	values: Record<string, unknown>,
	filters: ImportFilter[],
	inFilter?: { column: string; values: unknown[] },
) {
	if (!filters.length && !inFilter) throw new Error(`Refusing unbounded update of ${table}`);
	const entries = Object.entries(values);
	await database().execute(sql`update ${tableIdentifier(table)} set ${sql.join(entries.map(([column, value]) => sql`${identifier(column)} = ${sql.param(importValue(table, column, value))}`), sql`, `)}${whereClause(filters, inFilter)}`);
}

export async function executeImportQuery(query: SQL) {
	return database().execute(query);
}

export async function closeImporterDatabase() {
	await pool?.end();
	pool = undefined;
}
