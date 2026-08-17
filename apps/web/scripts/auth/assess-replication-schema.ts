/* eslint-disable no-console -- cutover CLI emits an operator-readable report */
import { Pool, type PoolConfig } from "pg";

type ColumnShape = {
	schema_name: string;
	table_name: string;
	column_name: string;
	data_type: string;
	udt_name: string;
	is_nullable: string;
	is_identity: string;
	is_generated: string;
};

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function config(value: string, rejectUnauthorized: boolean): PoolConfig {
	const url = new URL(value);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return {
		allowExitOnIdle: true,
		connectionString: url.toString(),
		connectionTimeoutMillis: 10_000,
		max: 1,
		ssl: { rejectUnauthorized },
	};
}

async function columns(pool: Pool): Promise<ColumnShape[]> {
	const result = await pool.query<ColumnShape>(`
		select table_schema as schema_name, table_name, column_name,
			data_type, udt_name, is_nullable, is_identity, is_generated
		from information_schema.columns
		where table_schema = 'public'
			or (table_schema = 'auth' and table_name = 'users' and column_name = 'id')
		order by table_schema, table_name, ordinal_position
	`);
	return result.rows;
}

function key(column: ColumnShape) {
	return `${column.schema_name}.${column.table_name}.${column.column_name}`;
}

async function main() {
	const source = new Pool(config(required("SUPABASE_MIGRATION_DATABASE_URL"), false));
	const target = new Pool(config(required("PLANETSCALE_MIGRATION_DATABASE_URL"), true));
	try {
		const [sourceColumns, targetColumns] = await Promise.all([columns(source), columns(target)]);
		const targetByKey = new Map(targetColumns.map((column) => [key(column), column]));
		const missing: string[] = [];
		const incompatible: Array<{ column: string; source: ColumnShape; target: ColumnShape }> = [];
		for (const sourceColumn of sourceColumns) {
			const targetColumn = targetByKey.get(key(sourceColumn));
			if (!targetColumn) {
				missing.push(key(sourceColumn));
				continue;
			}
			if (sourceColumn.data_type !== targetColumn.data_type
				|| sourceColumn.udt_name !== targetColumn.udt_name
				|| sourceColumn.is_nullable !== targetColumn.is_nullable
				|| sourceColumn.is_identity !== targetColumn.is_identity
				|| sourceColumn.is_generated !== targetColumn.is_generated) {
				incompatible.push({ column: key(sourceColumn), source: sourceColumn, target: targetColumn });
			}
		}
		const report = {
			compatible: missing.length === 0 && incompatible.length === 0,
			sourceColumns: sourceColumns.length,
			targetColumns: targetColumns.length,
			missing,
			incompatible,
		};
		console.log(JSON.stringify(report, null, 2));
		if (!report.compatible) process.exitCode = 2;
	} finally {
		await Promise.all([source.end(), target.end()]);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
