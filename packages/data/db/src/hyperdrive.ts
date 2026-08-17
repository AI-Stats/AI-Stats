import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Options } from "postgres";
import * as schema from "./schema";

export type PhaseoHyperdriveDatabase = PostgresJsDatabase<typeof schema>;

type PostgresClient = ReturnType<typeof postgres>;

export type PhaseoHyperdriveDatabaseHandle = {
  db: PhaseoHyperdriveDatabase;
  client: Pick<PostgresClient, "end">;
};

type ParsedPostgresOptions = PostgresClient["options"];

// PostgreSQL array OIDs are database-specific, but postgres.js discovers them
// with a ~2,000-row pg_catalog query for every newly constructed client. Keep
// only the parsed type metadata between clients; request-owned sockets remain
// scoped to the client that created them.
const hyperdriveTypeOptions = new Map<string, ParsedPostgresOptions>();

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
  options: Pick<Options<Record<string, never>>, "max"> = {},
): PhaseoHyperdriveDatabaseHandle {
  const cacheKey = `${connectionString}\u0000${String(options.max ?? 5)}`;
  const cachedOptions = hyperdriveTypeOptions.get(cacheKey);
  const client = cachedOptions
    ? postgres(cachedOptions as unknown as Options<Record<string, never>>)
    : postgres(connectionString, {
        max: 5,
        prepare: false,
        ...options,
        transform: {
          value: {
            from: normalizePostgresTimestamp,
          },
        },
      });

  if (!cachedOptions) hyperdriveTypeOptions.set(cacheKey, client.options);

  const closeClient = client.end.bind(client);
  return {
    db: drizzle(client, { schema }),
    client: {
      end: async (endOptions) => {
        try {
          await closeClient(endOptions);
        } finally {
          const parsedOptions = client.options as unknown as {
            fetch_types: boolean;
            shared: { typeArrayMap?: Record<string, number> };
          };
          if (Object.keys(parsedOptions.shared.typeArrayMap ?? {}).length > 0) {
            // Parsers and serializers now contain the discovered array types.
            // Future request-scoped clients can reuse them without repeating
            // the catalogue query.
            parsedOptions.fetch_types = false;
          }
        }
      },
    },
  };
}
