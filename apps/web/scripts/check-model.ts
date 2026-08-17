import { createNodeDatabaseForSchema } from "@phaseo/db/node-core";
import { gatewayRequests } from "@phaseo/db/schema";
import { desc, ilike } from "@phaseo/db/query";
import { Pool } from "pg";

const connectionString = process.env.PLANETSCALE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("PLANETSCALE_DATABASE_URL is required");

const pool = new Pool({ connectionString, max: 1 });
const db = createNodeDatabaseForSchema(pool, { gatewayRequests });

async function main() {
	const recent = await db.select({
		modelId: gatewayRequests.modelId,
		success: gatewayRequests.success,
		createdAt: gatewayRequests.createdAt,
	}).from(gatewayRequests).orderBy(desc(gatewayRequests.createdAt)).limit(5);

	console.log("Recent gateway requests:");
	console.log(JSON.stringify(recent, null, 2));

	const matching = await db.select({
		modelId: gatewayRequests.modelId,
		success: gatewayRequests.success,
		createdAt: gatewayRequests.createdAt,
	}).from(gatewayRequests)
		.where(ilike(gatewayRequests.modelId, "%gpt-5-nano%"))
		.orderBy(desc(gatewayRequests.createdAt))
		.limit(5);

	console.log("\nWith 'gpt-5-nano':");
	console.log(JSON.stringify(matching, null, 2));
}

main().finally(() => pool.end()).catch(console.error);
