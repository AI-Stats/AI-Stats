import { createNodeDatabase, type PhaseoNodeDatabase } from "@phaseo/db/node";

function connectionString(): string {
	const value = process.env.PLANETSCALE_DATABASE_URL?.trim();
	if (!value) throw new Error("PLANETSCALE_DATABASE_URL is required for live database verification");
	return value;
}

export async function withLiveDatabase<T>(operation: (db: PhaseoNodeDatabase) => Promise<T>): Promise<T> {
	const { db, pool } = createNodeDatabase({ connectionString: connectionString(), max: 1 });
	try {
		return await operation(db);
	} finally {
		await pool.end();
	}
}
