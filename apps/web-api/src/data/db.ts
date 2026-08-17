import { createHyperdriveDatabase } from "@phaseo/db/hyperdrive";

import type { Env } from "@/env";

export function createDatabase(env: Pick<Env, "PLANETSCALE_HYPERDRIVE">) {
	const connectionString = env.PLANETSCALE_HYPERDRIVE?.connectionString;
	if (!connectionString) {
		throw new Error("PLANETSCALE_HYPERDRIVE is required");
	}

	// Keep request-local fan-out bounded while allowing independent read queries
	// to run concurrently through Hyperdrive instead of serializing every round trip.
	return createHyperdriveDatabase(connectionString, { max: 3 });
}
