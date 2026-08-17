/* eslint-disable no-console -- migration CLI emits an operator-readable report */
import { Pool } from "pg";

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function targetConfig() {
	const url = new URL(required("PLANETSCALE_MIGRATION_DATABASE_URL"));
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

function subscriptionConnectionString(): string {
	const url = new URL(required("SUPABASE_MIGRATION_DATABASE_URL"));
	if (!/^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname) || url.port !== "5432") {
		throw new Error("SUPABASE_MIGRATION_DATABASE_URL must use the direct Supabase host on port 5432");
	}
	return [
		`host=${url.hostname}`,
		"port=5432",
		`dbname=${url.pathname.replace(/^\//, "") || "postgres"}`,
		`user=${decodeURIComponent(url.username)}`,
		`password=${decodeURIComponent(url.password)}`,
		"sslmode=require",
	].join(" ");
}

function literal(value: string) {
	return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
	const apply = process.argv.includes("--apply");
	const pool = new Pool(targetConfig());
	try {
		const preflight = await pool.query<{
			role_name: string;
			can_create_subscription: boolean;
			subscription_count: number;
			nonempty_relation_count: number;
		}>(`
			select current_user as role_name,
				pg_has_role(current_user, 'pg_create_subscription', 'member') as can_create_subscription,
				(select count(*)::int from pg_subscription) as subscription_count,
				(
					select count(*)::int
					from (
						select format('%I.%I', schemaname, tablename) as relation_name
						from pg_catalog.pg_tables
						where schemaname = 'public' or (schemaname = 'auth' and tablename = 'users')
					) relations
					where (xpath('/row/present/text()', query_to_xml(
						format('select exists (select 1 from %s limit 1) as present', relation_name),
						false, true, ''
					)))[1]::text::boolean
				) as nonempty_relation_count
		`);
		const state = preflight.rows[0];
		if (!state?.role_name.startsWith("pscale_api_")) throw new Error("Target is not a PlanetScale API role");
		if (!state.can_create_subscription) throw new Error("PlanetScale migration role lacks pg_create_subscription");
		if (state.subscription_count !== 0) throw new Error("A target subscription already exists");
		if (state.nonempty_relation_count !== 0) throw new Error("PlanetScale target is not empty");
		const report = { apply, ...state, sourceHost: new URL(required("SUPABASE_MIGRATION_DATABASE_URL")).hostname };
		if (!apply) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		const connection = subscriptionConnectionString();
		await pool.query(`
			create subscription phaseo_from_supabase
			connection ${literal(connection)}
			publication phaseo_to_planetscale
			with (copy_data = true, create_slot = true, enabled = true)
		`);
		console.log(JSON.stringify({ ...report, started: true }, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
