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
	const pool = new Pool(config());
	try {
		const result = await pool.query<{
			role_name: string;
			foundation_tables: number;
			has_sso: boolean;
			has_mfa_marker: boolean;
			identity_rows: number;
		}>(`
			select current_user as role_name,
				(select count(*)::int from pg_catalog.pg_tables where schemaname = 'public' and tablename in ('user','session','account','verification','twoFactor','passkey')) as foundation_tables,
				to_regclass('public."ssoProvider"') is not null as has_sso,
				exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user' and column_name = 'mfaReenrollmentRequired') as has_mfa_marker,
				(select count(*)::int from public."user") + (select count(*)::int from public."account") as identity_rows
		`);
		const state = result.rows[0];
		if (!state?.role_name.startsWith("pscale_api_")) throw new Error("Target is not a PlanetScale API role");
		if (state.foundation_tables !== 6) throw new Error("Better Auth foundation schema is incomplete");
		if (state.identity_rows !== 0) throw new Error("Better Auth identity tables must be empty before initial import");
		const pending = [
			...(!state.has_sso ? ["20260814010000_better_auth_sso.sql"] : []),
			...(!state.has_mfa_marker ? ["20260814020000_better_auth_mfa_reenrollment.sql"] : []),
		];
		const report = { apply, pending, ...state };
		if (!apply || pending.length === 0) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		await pool.query("begin");
		try {
			for (const filename of pending) {
				const sql = await readFile(resolve(process.cwd(), "../../database/migrations", filename), "utf8");
				await pool.query(sql);
			}
			await pool.query("commit");
		} catch (error) {
			await pool.query("rollback");
			throw error;
		}
		console.log(JSON.stringify({ ...report, applied: pending }, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
