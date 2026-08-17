/* eslint-disable no-console -- this operator CLI prints non-secret connection metadata */
import { Pool, type PoolConfig } from "pg";

function config(name: "PLANETSCALE_DATABASE_URL" | "PLANETSCALE_MIGRATION_DATABASE_URL"): PoolConfig {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	const url = new URL(value);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	if (name === "PLANETSCALE_DATABASE_URL" && process.env.PLANETSCALE_USE_PGBOUNCER !== "false") {
		url.port = "6432";
	}
	return {
		allowExitOnIdle: true,
		connectionString: url.toString(),
		connectionTimeoutMillis: 10_000,
		max: 1,
		ssl: { rejectUnauthorized: true },
	};
}

async function verify(name: "PLANETSCALE_DATABASE_URL" | "PLANETSCALE_MIGRATION_DATABASE_URL") {
	const pool = new Pool(config(name));
	try {
		const result = await pool.query<{
			database_name: string;
			role_name: string;
			application_tables: number;
			database_locale: string | null;
			database_collation: string;
			database_locale_provider: string;
			compatible_collations: string[];
			monitor_rows: number;
			row_level_security_tables: number;
			legacy_policies: number;
			auth_uid_defaults: number;
			supabase_context_functions: string[];
			supabase_context_function_callers: string[];
			postgrest_context_functions: string[];
			supabase_context_triggers: string[];
			supabase_context_views: string[];
			drizzle_migration_entries: number;
		}>(`
			select current_database() as database_name,
				current_user as role_name,
				(select datlocale from pg_database where datname = current_database()) as database_locale,
				(select datcollate from pg_database where datname = current_database()) as database_collation,
				(select datlocprovider::text from pg_database where datname = current_database()) as database_locale_provider,
				(select coalesce(jsonb_agg(collname order by collname), '[]'::jsonb) from pg_collation where collname in ('en-US', 'en-US-x-icu')) as compatible_collations,
				(select count(*)::int from public.get_monitor_model_rows(false)) as monitor_rows,
				(select count(*)::int from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity) as row_level_security_tables,
				(select count(*)::int from pg_catalog.pg_policies where schemaname = 'public') as legacy_policies,
				(select count(*)::int from information_schema.columns where table_schema = 'public' and column_default ilike '%auth.uid%') as auth_uid_defaults,
				(
					select coalesce(jsonb_agg(format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) order by n.nspname, p.proname), '[]'::jsonb)
					from pg_catalog.pg_proc p
					join pg_catalog.pg_namespace n on n.oid = p.pronamespace
					where n.nspname in ('public', 'private', 'auth')
						and p.prokind = 'f'
						and pg_get_functiondef(p.oid) ~* '(auth\\.(uid|jwt|role)\\s*\\(|request\\.jwt\\.)'
				) as supabase_context_functions,
				(
					select coalesce(jsonb_agg(format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) order by n.nspname, p.proname), '[]'::jsonb)
					from pg_catalog.pg_proc p
					join pg_catalog.pg_namespace n on n.oid = p.pronamespace
					where n.nspname in ('public', 'private')
						and p.prokind = 'f'
						and p.proname not in ('approve_workspace_join_request', 'is_admin', 'is_admin_user', 'is_team_owner', 'is_workspace_admin', 'is_workspace_member', 'monthly_spend_prev_cents', 'mtd_spend_cents', 'redeem_credit_code', 'reject_workspace_join_request', 'tg_system_settings_audit')
						and pg_get_functiondef(p.oid) ~* '(approve_workspace_join_request|is_admin_user|is_admin\\s*\\(|is_team_owner|is_workspace_admin|is_workspace_member|monthly_spend_prev_cents|mtd_spend_cents|redeem_credit_code|reject_workspace_join_request|tg_system_settings_audit)'
				) as supabase_context_function_callers,
				(
					select coalesce(jsonb_agg(format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) order by n.nspname, p.proname), '[]'::jsonb)
					from pg_catalog.pg_proc p
					join pg_catalog.pg_namespace n on n.oid = p.pronamespace
					where n.nspname in ('public', 'private', 'auth')
						and p.prokind = 'f'
						and pg_get_functiondef(p.oid) ~* '(request\\.(headers|cookies|method|path)|response\\.headers|pgrst\\.)'
				) as postgrest_context_functions,
				(
					select coalesce(jsonb_agg(format('%I.%I.%I -> %I.%I', table_namespace.nspname, relation.relname, trigger.tgname, function_namespace.nspname, function.proname) order by table_namespace.nspname, relation.relname, trigger.tgname), '[]'::jsonb)
					from pg_catalog.pg_trigger trigger
					join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
					join pg_catalog.pg_namespace table_namespace on table_namespace.oid = relation.relnamespace
					join pg_catalog.pg_proc function on function.oid = trigger.tgfoid
					join pg_catalog.pg_namespace function_namespace on function_namespace.oid = function.pronamespace
					where not trigger.tgisinternal
						and table_namespace.nspname in ('public', 'private')
						and (
							pg_get_functiondef(function.oid) ~* '(auth\\.(uid|jwt|role)\\s*\\(|request\\.jwt\\.|pgrst\\.)'
							or function.proname in ('approve_workspace_join_request', 'is_admin', 'is_admin_user', 'is_team_owner', 'is_workspace_admin', 'is_workspace_member', 'monthly_spend_prev_cents', 'mtd_spend_cents', 'redeem_credit_code', 'reject_workspace_join_request', 'tg_system_settings_audit')
						)
				) as supabase_context_triggers,
				(
					select coalesce(jsonb_agg(format('%I.%I', schemaname, viewname) order by schemaname, viewname), '[]'::jsonb)
					from pg_catalog.pg_views
					where schemaname in ('public', 'private')
						and definition ~* '(auth\\.(uid|jwt|role)|request\\.jwt|is_admin_user|is_team_owner|is_workspace_admin|is_workspace_member)'
				) as supabase_context_views,
				(select count(*)::int from drizzle.__drizzle_migrations) as drizzle_migration_entries,
				(
					select count(*)::int
					from pg_catalog.pg_tables
					where schemaname in ('public', 'auth', 'private')
				) as application_tables
		`);
		return { connection: name, ...result.rows[0] };
	} finally {
		await pool.end();
	}
}

async function main() {
	console.log(JSON.stringify({
		runtime: await verify("PLANETSCALE_DATABASE_URL"),
		migration: await verify("PLANETSCALE_MIGRATION_DATABASE_URL"),
	}, null, 2));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
