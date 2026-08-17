/* eslint-disable no-console -- this migration CLI reports only aggregate progress */
import { Pool, type PoolClient, type PoolConfig } from "pg";

type SupabaseUser = {
	app_metadata: Record<string, unknown>;
	confirmed_at: Date | null;
	created_at: Date;
	email: string;
	encrypted_password: string | null;
	id: string;
	invited_at: Date | null;
	last_sign_in_at: Date | null;
	mfa_reenrollment_required: boolean;
	updated_at: Date;
	user_metadata: Record<string, unknown>;
};

type SupabaseIdentity = {
	created_at: Date;
	id: string;
	provider: string;
	provider_id: string;
	updated_at: Date;
	user_id: string;
};

function requiredEnvironment(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function postgresConfig(connectionString: string, rejectUnauthorized = true): PoolConfig {
	const url = new URL(connectionString);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return {
		allowExitOnIdle: true,
		connectionString: url.toString(),
		connectionTimeoutMillis: 30_000,
		max: 1,
		ssl: { rejectUnauthorized },
	};
}

function displayName(user: SupabaseUser): string {
	const candidates = [
		user.user_metadata.full_name,
		user.user_metadata.name,
		user.user_metadata.display_name,
	];
	const configured = candidates.find(
		(candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
	);
	return configured?.trim() ?? user.email.split("@")[0] ?? user.email;
}

function ssoProviderMappings(): Map<string, string> {
	const raw = JSON.parse(process.env.BETTER_AUTH_SSO_PROVIDERS_JSON ?? "[]") as unknown;
	if (!Array.isArray(raw)) throw new Error("BETTER_AUTH_SSO_PROVIDERS_JSON must be an array");
	const mappings = new Map<string, string>();
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const sourceProvider = String((entry as Record<string, unknown>).sourceProvider ?? "").trim();
		const providerId = String((entry as Record<string, unknown>).providerId ?? "").trim();
		if (!sourceProvider) continue;
		if (!providerId) throw new Error(`SSO source provider ${sourceProvider} is missing providerId`);
		if (mappings.has(sourceProvider)) throw new Error(`Duplicate SSO sourceProvider: ${sourceProvider}`);
		mappings.set(sourceProvider, providerId);
	}
	return mappings;
}

async function assertEmptyTarget(client: PoolClient): Promise<void> {
	const result = await client.query<{ accounts: string; users: string }>(
		`select
			(select count(*) from auth.user)::text as users,
			(select count(*) from auth.account)::text as accounts`,
	);
	const counts = result.rows[0];
	if (!counts || counts.users !== "0" || counts.accounts !== "0") {
		throw new Error(
			`Target Better Auth tables must be empty (found ${counts?.users ?? "?"} users and ${counts?.accounts ?? "?"} accounts)`,
		);
	}
}

async function upsertUsers(client: PoolClient, users: SupabaseUser[]): Promise<void> {
	for (const user of users) {
		await client.query(
			`insert into auth.user (
				"id", "name", "email", "emailVerified", "createdAt", "updatedAt",
				"appMetadata", "invitedAt", "lastSignInAt", "mfaReenrollmentRequired", "userMetadata"
			) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			on conflict ("id") do update set
				"name" = excluded."name",
				"email" = excluded."email",
				"emailVerified" = excluded."emailVerified",
				"updatedAt" = excluded."updatedAt",
				"appMetadata" = excluded."appMetadata",
				"invitedAt" = excluded."invitedAt",
				"lastSignInAt" = excluded."lastSignInAt",
				"mfaReenrollmentRequired" = case
					when "user"."twoFactorEnabled" is true then false
					else excluded."mfaReenrollmentRequired"
				end,
				"userMetadata" = excluded."userMetadata"`,
			[
				user.id,
				displayName(user),
				user.email,
				user.confirmed_at !== null,
				user.created_at,
				user.updated_at,
				user.app_metadata,
				user.invited_at,
				user.last_sign_in_at,
				user.mfa_reenrollment_required,
				user.user_metadata,
			],
		);
	}
}

async function upsertAccounts(
	client: PoolClient,
	users: SupabaseUser[],
	identities: SupabaseIdentity[],
	providerMappings: Map<string, string>,
): Promise<number> {
	let inserted = 0;
	for (const user of users) {
		if (!user.encrypted_password) continue;
		if (!user.encrypted_password.startsWith("$2")) {
			throw new Error(`Unsupported password hash for user ${user.id}`);
		}
		await client.query(
			`insert into auth.account (
				"id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt"
			) values ($1, $2, 'credential', $3, $4, $5, $6)
			on conflict ("id") do update set
				"accountId" = excluded."accountId",
				"providerId" = excluded."providerId",
				"userId" = excluded."userId",
				"password" = excluded."password",
				"updatedAt" = excluded."updatedAt"`,
			[
				`credential:${user.id}`,
				user.id,
				user.id,
				user.encrypted_password,
				user.created_at,
				user.updated_at,
			],
		);
		inserted += 1;
	}

	for (const identity of identities) {
		if (identity.provider === "email") continue;
		await client.query(
			`insert into auth.account (
				"id", "accountId", "providerId", "userId", "createdAt", "updatedAt"
			) values ($1, $2, $3, $4, $5, $6)
			on conflict ("id") do update set
				"accountId" = excluded."accountId",
				"providerId" = excluded."providerId",
				"userId" = excluded."userId",
				"updatedAt" = excluded."updatedAt"`,
			[
				`oauth:${identity.id}`,
				identity.provider_id,
				providerMappings.get(identity.provider) ?? identity.provider,
				identity.user_id,
				identity.created_at,
				identity.updated_at,
			],
		);
		inserted += 1;
	}
	return inserted;
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");
	const sync = process.argv.includes("--sync");
	// Supabase's shared pooler currently presents a chain that Node does not
	// validate with its bundled roots. This matches libpq sslmode=require: the
	// migration remains encrypted, while the PlanetScale target always uses
	// full certificate verification.
	const source = new Pool(
		postgresConfig(requiredEnvironment("SUPABASE_MIGRATION_DATABASE_URL"), false),
	);
	const target = new Pool(postgresConfig(requiredEnvironment("PLANETSCALE_MIGRATION_DATABASE_URL")));

	try {
		const [usersResult, identitiesResult] = await Promise.all([
			source.query<SupabaseUser>(
				`select users.id::text, users.email, users.encrypted_password, users.email_confirmed_at as confirmed_at,
					created_at, updated_at, invited_at, last_sign_in_at,
					raw_app_meta_data as app_metadata, raw_user_meta_data as user_metadata,
					exists (
						select 1 from auth.mfa_factors factor
						where factor.user_id = users.id and factor.status = 'verified'
					) as mfa_reenrollment_required
				from auth.users users order by created_at, id`,
			),
			source.query<SupabaseIdentity>(
				`select id::text, user_id::text, provider, provider_id, created_at, updated_at
				from auth.identities order by created_at, id`,
			),
		]);

		const users = usersResult.rows;
		const identities = identitiesResult.rows;
		const providerMappings = ssoProviderMappings();

		const client = await target.connect();
		try {
			await client.query("begin");
			if (!sync) await assertEmptyTarget(client);
			await upsertUsers(client, users);
			const accounts = await upsertAccounts(client, users, identities, providerMappings);
			if (sync) {
				const expectedUserIds = users.map((user) => user.id);
				const expectedAccountIds = [
					...users.filter((user) => Boolean(user.encrypted_password)).map((user) => `credential:${user.id}`),
					...identities.filter((identity) => identity.provider !== "email").map((identity) => `oauth:${identity.id}`),
				];
				await client.query(
					`delete from auth.account
					 where ("id" like 'credential:%' or "id" like 'oauth:%')
					   and not ("id" = any($1::text[]))`,
					[expectedAccountIds],
				);
				await client.query(`delete from auth.user where not ("id" = any($1::text[]))`, [expectedUserIds]);
			}

			const verification = await client.query<{ accounts: string; users: string }>(
				`select
					(select count(*) from auth.user)::text as users,
					(select count(*) from auth.account)::text as accounts`,
			);
			const counts = verification.rows[0];
			if (counts?.users !== String(users.length) || counts.accounts !== String(accounts)) {
				throw new Error("Target identity counts did not match the planned import");
			}

			if (apply) {
				await client.query("commit");
				console.log(`${sync ? "Identity reconciliation" : "Identity import"} committed.`);
			} else {
				await client.query("rollback");
				console.log("Identity migration dry run passed; transaction rolled back.");
			}
		} catch (error) {
			await client.query("rollback");
			throw error;
		} finally {
			client.release();
		}
	} finally {
		await Promise.all([source.end(), target.end()]);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Identity migration failed");
	process.exitCode = 1;
});
