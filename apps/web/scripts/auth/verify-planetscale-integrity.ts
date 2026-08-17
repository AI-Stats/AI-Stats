/* eslint-disable no-console -- operator CLI emits a non-secret integrity report */
import { Pool } from "pg";

function connectionString() {
	const value = process.env.PLANETSCALE_MIGRATION_DATABASE_URL?.trim();
	if (!value) throw new Error("PLANETSCALE_MIGRATION_DATABASE_URL is required");
	const url = new URL(value);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return url.toString();
}

async function main() {
	const pool = new Pool({
		allowExitOnIdle: true,
		connectionString: connectionString(),
		connectionTimeoutMillis: 10_000,
		max: 1,
		ssl: { rejectUnauthorized: true },
	});
	try {
		const result = await pool.query<Record<string, string>>(`
			select
				(select count(*)::text from auth.user) as better_auth_users,
				(select count(*)::text from auth.account) as better_auth_accounts,
				(select count(*)::text from auth.session) as better_auth_sessions,
				(select count(*)::text from auth.passkey) as better_auth_passkeys,
				(select count(*)::text from app.users) as phaseo_profiles,
				(select count(*)::text from app.workspaces) as workspaces,
				(select count(*)::text from app.workspace_members) as workspace_members,
				(select count(*)::text from auth.account a left join auth.user u on u.id = a."userId" where u.id is null) as orphan_accounts,
				(select count(*)::text from auth.session s left join auth.user u on u.id = s."userId" where u.id is null) as orphan_sessions,
				(select count(*)::text from auth.passkey p left join auth.user u on u.id = p."userId" where u.id is null) as orphan_passkeys,
				(select count(*)::text from auth."twoFactor" f left join auth.user u on u.id = f."userId" where u.id is null) as orphan_two_factor,
				(select count(*)::text from app.workspaces w left join app.users u on u.user_id = w.owner_user_id where u.user_id is null) as orphan_workspace_owners,
				(select count(*)::text from app.workspace_members m left join app.workspaces w on w.id = m.workspace_id where w.id is null) as orphan_memberships_workspaces,
				(select count(*)::text from app.workspace_members m left join app.users u on u.user_id = m.user_id where u.user_id is null) as orphan_memberships_users,
				(select count(*)::text from app.users u left join app.workspaces w on w.id = u.default_workspace_id where u.default_workspace_id is not null and w.id is null) as orphan_default_workspaces,
				(select count(*)::text from auth.user u left join app.users p on p.user_id::text = u.id where p.user_id is null) as users_without_phaseo_profile,
				(select count(*)::text from app.users p left join auth.user u on u.id = p.user_id::text where u.id is null) as profiles_without_better_auth_user,
				(select count(*)::text from (select lower(email) from auth.user group by lower(email) having count(*) > 1) duplicates) as duplicate_casefolded_emails,
				(select count(*)::text from pg_catalog.pg_constraint c join pg_catalog.pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype in ('f', 'c') and not c.convalidated) as unvalidated_constraints
		`);
		const counts = result.rows[0];
		const issueKeys = Object.keys(counts).filter((key) =>
			(key.startsWith("orphan_") || key.startsWith("duplicate_") || key === "unvalidated_constraints")
			&& Number(counts[key]) !== 0,
		);
		const profileParity = counts.better_auth_users === counts.phaseo_profiles
			&& counts.users_without_phaseo_profile === "0"
			&& counts.profiles_without_better_auth_user === "0";
		const unmatchedProfiles = profileParity ? [] : (await pool.query<{
			created_at: string;
			default_workspace_id: string | null;
			memberships: number;
			owned_workspaces: number;
			role: string;
			user_id: string;
		}>(`
			select p.user_id::text, p.created_at::text, p.role::text, p.default_workspace_id::text,
				(select count(*)::int from app.workspaces w where w.owner_user_id = p.user_id) as owned_workspaces,
				(select count(*)::int from app.workspace_members m where m.user_id = p.user_id) as memberships
			from app.users p
			left join auth.user u on u.id = p.user_id::text
			where u.id is null
			order by p.created_at
		`)).rows;
		const report = { ok: issueKeys.length === 0 && profileParity, profileParity, issueKeys, counts, unmatchedProfiles };
		console.log(JSON.stringify(report, null, 2));
		if (!report.ok) process.exitCode = 2;
	} finally {
		await pool.end();
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
