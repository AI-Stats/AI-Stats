/* eslint-disable no-console -- migration CLI emits an operator-readable report */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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

async function main() {
	const apply = process.argv.includes("--apply");
	const file = resolve(process.cwd(), "../../database/replication/00_target_compatibility.sql");
	const sql = await readFile(file, "utf8");
	const pool = new Pool(config());
	try {
		const preflight = await pool.query<{
			role_name: string;
			not_ready: number;
			better_auth_tables: number;
		}>(`
			select current_user as role_name,
				(select count(*)::int from pg_subscription_rel where srsubstate <> 'r') as not_ready,
				(select count(*)::int from pg_catalog.pg_tables where schemaname = 'public' and tablename in ('user','session','account','verification','twoFactor','passkey','ssoProvider')) as better_auth_tables
		`);
		const state = preflight.rows[0];
		if (!state?.role_name.startsWith("pscale_api_")) throw new Error("Target is not a PlanetScale API role");
		if (state.not_ready !== 0) throw new Error("Replication relations are not all ready");
		if (state.better_auth_tables < 6) {
			throw new Error(`Expected the Better Auth foundation tables, found ${state.better_auth_tables}`);
		}
		const report = { apply, ...state };
		if (!apply) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		await pool.query(sql);
		console.log(JSON.stringify({ ...report, applied: true }, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
