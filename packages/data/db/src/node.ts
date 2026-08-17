import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export type PhaseoNodeDatabase = NodePgDatabase<typeof schema>;

export function createNodeDatabaseFromPool(pool: Pool): PhaseoNodeDatabase {
  return drizzle(pool, { schema });
}

export function createNodeDatabase(config: PoolConfig): {
  db: PhaseoNodeDatabase;
  pool: Pool;
} {
  const pool = new Pool(config);
  return { db: createNodeDatabaseFromPool(pool), pool };
}
