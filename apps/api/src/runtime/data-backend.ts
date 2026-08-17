import { Client, type QueryResultRow } from "pg";

import type { GatewayBindings } from "./env.types";

export async function queryPlanetScale<Row extends QueryResultRow>(
	bindings: Pick<GatewayBindings, "PLANETSCALE_HYPERDRIVE">,
	text: string,
	values: unknown[] = [],
): Promise<Row[]> {
	const connectionString = bindings.PLANETSCALE_HYPERDRIVE?.connectionString;
	if (!connectionString) {
		throw new Error("PLANETSCALE_HYPERDRIVE is required");
	}

	const client = new Client({ connectionString });
	try {
		await client.connect();
		const result = await client.query<Row>(text, values);
		return result.rows;
	} finally {
		await client.end().catch(() => undefined);
	}
}
