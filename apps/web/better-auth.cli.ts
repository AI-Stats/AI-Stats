import { Pool } from "pg";

import { createBetterAuth } from "./src/lib/auth/betterAuthConfig";

const connectionString = new URL(process.env.PLANETSCALE_DATABASE_URL!);
const localDatabase = ["localhost", "127.0.0.1"].includes(connectionString.hostname);
connectionString.searchParams.delete("sslmode");
connectionString.searchParams.delete("sslrootcert");
connectionString.searchParams.delete("sslnegotiation");

// Schema-generation entrypoint only. Runtime code uses the shared hardened
// pool factory; this keeps the CLI independent from Next's server-only guard.
export const auth = createBetterAuth(
	new Pool({
		connectionString: connectionString.toString(),
		max: 1,
		ssl: localDatabase ? false : { rejectUnauthorized: true },
	}),
);
