import { createHyperdriveDatabase } from "@phaseo/db/hyperdrive";

import type { GatewayBindings } from "./env.types";

export function createDatabase(
	bindings: Pick<GatewayBindings, "PLANETSCALE_HYPERDRIVE">,
) {
	const connectionString = bindings.PLANETSCALE_HYPERDRIVE?.connectionString;
	if (!connectionString) {
		throw new Error("PLANETSCALE_HYPERDRIVE is required");
	}

	return createHyperdriveDatabase(connectionString, { max: 1 });
}
