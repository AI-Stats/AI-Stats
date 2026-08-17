/* eslint-disable no-console -- migration CLI emits an operator-readable report */
import { Pool } from "pg";

function config() {
	const value = process.env.PLANETSCALE_MIGRATION_DATABASE_URL?.trim();
	if (!value) throw new Error("PLANETSCALE_MIGRATION_DATABASE_URL is required");
	const url = new URL(value);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return {
		allowExitOnIdle: true,
		connectionString: url.toString(),
		connectionTimeoutMillis: 10_000,
		max: 1,
		ssl: { rejectUnauthorized: true },
	};
}

function identifier(value: string) {
	return `"${value.replaceAll('"', '""')}"`;
}

async function main() {
	const apply = process.argv.includes("--apply");
	const pool = new Pool(config());
	try {
		const identity = await pool.query<{ role_name: string }>("select current_user as role_name");
		const roleName = identity.rows[0]?.role_name ?? "";
		if (!roleName.startsWith("pscale_api_")) {
			throw new Error("Refusing rehearsal reset outside a PlanetScale API role");
		}
		const subscriptions = await pool.query<{ count: string }>("select count(*)::text as count from pg_subscription");
		if (subscriptions.rows[0]?.count !== "0") {
			throw new Error("Refusing rehearsal reset while a logical subscription exists");
		}
		const relations = await pool.query<{ schema_name: string; table_name: string }>(`
			select schemaname as schema_name, tablename as table_name
			from pg_catalog.pg_tables
			where schemaname = 'public' or (schemaname = 'auth' and tablename = 'users')
			order by schemaname, tablename
		`);
		const report = { apply, relationCount: relations.rowCount ?? 0, roleName };
		if (!apply) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		if (!relations.rowCount) throw new Error("No rehearsal relations found");
		const names = relations.rows.map((row) => `${identifier(row.schema_name)}.${identifier(row.table_name)}`);
		await pool.query("begin");
		try {
			await pool.query(`truncate table ${names.join(", ")} restart identity cascade`);
			await pool.query("commit");
		} catch (error) {
			await pool.query("rollback");
			throw error;
		}
		console.log(JSON.stringify({ ...report, reset: true }, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
