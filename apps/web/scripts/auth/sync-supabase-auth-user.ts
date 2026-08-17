/* eslint-disable no-console -- operator CLI reports only aggregate reconciliation state */
import { Pool } from "pg";

type AdminIdentity = {
	created_at?: string;
	id: string;
	identity_data?: { sub?: string };
	provider: string;
	updated_at?: string;
};

type AdminUser = {
	app_metadata?: Record<string, unknown>;
	confirmed_at?: string | null;
	created_at: string;
	email?: string;
	id: string;
	identities?: AdminIdentity[];
	invited_at?: string | null;
	last_sign_in_at?: string | null;
	updated_at?: string;
	user_metadata?: Record<string, unknown>;
};

function required(name: string) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function argument(name: string) {
	const prefix = `--${name}=`;
	const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length).trim();
	if (!value) throw new Error(`${prefix}<value> is required`);
	return value;
}

function displayName(user: AdminUser) {
	const metadata = user.user_metadata ?? {};
	for (const key of ["full_name", "name", "display_name"]) {
		const candidate = metadata[key];
		if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
	}
	return user.email?.split("@")[0] ?? "Phaseo user";
}

async function main() {
	const apply = process.argv.includes("--apply");
	const userId = argument("user-id");
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
		throw new Error("--user-id must be a UUID");
	}
	const supabaseUrl = required("SUPABASE_URL");
	const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
	const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
		headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
	});
	if (!response.ok) throw new Error(`Supabase Admin API returned ${response.status}`);
	const user = await response.json() as AdminUser;
	if (user.id !== userId || !user.email) throw new Error("Supabase user record is incomplete");

	const connection = new URL(required("PLANETSCALE_MIGRATION_DATABASE_URL"));
	connection.searchParams.delete("sslmode");
	connection.searchParams.delete("sslrootcert");
	connection.searchParams.delete("sslnegotiation");
	const pool = new Pool({ connectionString: connection.toString(), max: 1, ssl: { rejectUnauthorized: true } });
	const client = await pool.connect();
	try {
		await client.query("begin");
		await client.query(`
			insert into auth.user (
				"id", "name", "email", "emailVerified", "createdAt", "updatedAt",
				"appMetadata", "invitedAt", "lastSignInAt", "mfaReenrollmentRequired", "userMetadata"
			) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
			on conflict ("id") do update set
				"name" = excluded."name", "email" = excluded."email",
				"emailVerified" = excluded."emailVerified", "updatedAt" = excluded."updatedAt",
				"appMetadata" = excluded."appMetadata", "invitedAt" = excluded."invitedAt",
				"lastSignInAt" = excluded."lastSignInAt", "userMetadata" = excluded."userMetadata"
		`, [
			user.id, displayName(user), user.email, Boolean(user.confirmed_at), user.created_at,
			user.updated_at ?? user.created_at, user.app_metadata ?? {}, user.invited_at ?? null,
			user.last_sign_in_at ?? null, user.user_metadata ?? {},
		]);

		let socialAccounts = 0;
		for (const identity of user.identities ?? []) {
			if (identity.provider === "email") continue;
			const accountId = identity.identity_data?.sub;
			if (!identity.id || !accountId) throw new Error(`Incomplete ${identity.provider} identity`);
			await client.query(`
				insert into auth.account (
					"id", "accountId", "providerId", "userId", "createdAt", "updatedAt"
				) values ($1, $2, $3, $4, $5, $6)
				on conflict ("id") do update set
					"accountId" = excluded."accountId", "providerId" = excluded."providerId",
					"userId" = excluded."userId", "updatedAt" = excluded."updatedAt"
			`, [
				`oauth:${identity.id}`, accountId, identity.provider, user.id,
				identity.created_at ?? user.created_at, identity.updated_at ?? user.updated_at ?? user.created_at,
			]);
			socialAccounts += 1;
		}

		const verification = await client.query<{ accounts: string; users: string }>(`
			select
				(select count(*)::text from auth.user where id = $1) as users,
				(select count(*)::text from auth.account where "userId" = $1) as accounts
		`, [user.id]);
		if (verification.rows[0]?.users !== "1" || Number(verification.rows[0]?.accounts ?? 0) < socialAccounts) {
			throw new Error("Target identity verification failed");
		}
		if (apply) await client.query("commit");
		else await client.query("rollback");
		console.log(`${apply ? "Reconciled" : "Validated"} one user and ${socialAccounts} social account(s)${apply ? "." : "; transaction rolled back."}`);
	} catch (error) {
		await client.query("rollback");
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
