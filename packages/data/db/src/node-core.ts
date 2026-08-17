import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

export function createNodeDatabaseForSchema<TSchema extends Record<string, unknown>>(
  pool: Pool,
  schema: TSchema,
): NodePgDatabase<TSchema> {
  return drizzle(pool, { schema });
}
