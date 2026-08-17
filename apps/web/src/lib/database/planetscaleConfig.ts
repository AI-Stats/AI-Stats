import type { PoolConfig } from "pg";

// Vercel can create many concurrent function instances. Each instance owns its
// own global pool, so a larger default quickly exhausts small PlanetScale tiers.
const DEFAULT_POOL_SIZE = 1;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_IDLE_TIMEOUT_MS = 5_000;

function positiveInteger(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function planetScaleConnectionConfig(): PoolConfig {
	const connectionString = process.env.PLANETSCALE_DATABASE_URL;
	if (!connectionString) {
		throw new Error("PLANETSCALE_DATABASE_URL is required for the PlanetScale database path");
	}

	const url = new URL(connectionString);

	// node-postgres uses Node's trusted root store. libpq-only query options such
	// as sslrootcert=system must not be forwarded as a literal file path.
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");

	if (process.env.PLANETSCALE_USE_PGBOUNCER !== "false") {
		url.port = "6432";
	}

	return {
		allowExitOnIdle: true,
		connectionString: url.toString(),
		connectionTimeoutMillis: positiveInteger(
			process.env.PLANETSCALE_CONNECTION_TIMEOUT_MS,
			DEFAULT_CONNECTION_TIMEOUT_MS,
		),
		idleTimeoutMillis: positiveInteger(
			process.env.PLANETSCALE_IDLE_TIMEOUT_MS,
			DEFAULT_IDLE_TIMEOUT_MS,
		),
		max: positiveInteger(process.env.PLANETSCALE_POOL_MAX, DEFAULT_POOL_SIZE),
		ssl: { rejectUnauthorized: true },
	};
}
