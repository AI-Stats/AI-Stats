import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Options } from "postgres";
import * as schema from "./schema";

export type PhaseoHyperdriveDatabase = PostgresJsDatabase<typeof schema>;

const POSTGRES_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})(?::?(\d{2}))?$/;

export function normalizePostgresTimestamp(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const match = POSTGRES_TIMESTAMP.exec(value);
  if (!match) return value;
  const [, date, time, hours, minutes = "00"] = match;
  return `${date}T${time}${hours}:${minutes}`;
}

export function createHyperdriveDatabase(
  connectionString: string,
  options: Options<Record<string, never>> = {},
): { db: PhaseoHyperdriveDatabase; client: ReturnType<typeof postgres> } {
  const client = postgres(connectionString, {
    max: 5,
    prepare: false,
    ...options,
    transform: {
      ...options.transform,
      value: {
        from: normalizePostgresTimestamp,
      },
    },
  });
  return { db: drizzle(client, { schema }), client };
}
