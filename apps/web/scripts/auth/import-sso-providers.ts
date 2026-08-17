/* eslint-disable no-console -- migration CLI reports provider IDs only */
import { Pool, type PoolConfig } from "pg";
import { z } from "zod";

const providerSchema = z.object({
	domain: z.string().min(1),
	issuer: z.string().url(),
	oidcConfig: z.record(z.string(), z.unknown()).optional(),
	providerId: z.string().min(1),
	samlConfig: z.record(z.string(), z.unknown()).optional(),
	sourceProvider: z.string().min(1).optional(),
	userId: z.string().uuid(),
}).refine((provider) => Boolean(provider.oidcConfig) !== Boolean(provider.samlConfig), {
	message: "Each SSO provider must include exactly one of oidcConfig or samlConfig",
});

function config(connectionString: string): PoolConfig {
	const url = new URL(connectionString);
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
	const databaseUrl = process.env.PLANETSCALE_MIGRATION_DATABASE_URL?.trim();
	if (!databaseUrl) throw new Error("PLANETSCALE_MIGRATION_DATABASE_URL is required");
	const providers = z.array(providerSchema).parse(
		JSON.parse(process.env.BETTER_AUTH_SSO_PROVIDERS_JSON ?? "[]"),
	);
	if (!providers.length) throw new Error("BETTER_AUTH_SSO_PROVIDERS_JSON contains no providers");
	const apply = process.argv.includes("--apply");
	const pool = new Pool(config(databaseUrl));
	const client = await pool.connect();
	try {
		await client.query("begin");
		for (const provider of providers) {
			await client.query(`
				insert into auth."ssoProvider" (
					"id", "issuer", "oidcConfig", "samlConfig", "userId", "providerId", "domain"
				) values ($1, $2, $3, $4, $5, $6, $7)
				on conflict ("providerId") do update set
					"issuer" = excluded."issuer",
					"oidcConfig" = excluded."oidcConfig",
					"samlConfig" = excluded."samlConfig",
					"userId" = excluded."userId",
					"domain" = excluded."domain"
			`, [
				crypto.randomUUID(),
				provider.issuer,
				provider.oidcConfig ? JSON.stringify(provider.oidcConfig) : null,
				provider.samlConfig ? JSON.stringify(provider.samlConfig) : null,
				provider.userId,
				provider.providerId,
				provider.domain,
			]);
		}
		if (apply) await client.query("commit");
		else await client.query("rollback");
		console.log(`${apply ? "Imported" : "Validated"} ${providers.length} SSO provider(s): ${providers.map((provider) => provider.providerId).join(", ")}`);
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
