import { defineConfig } from "drizzle-kit";

// `drizzle-kit check` and `generate` are schema-only and run in unprivileged CI.
// `migrate` still receives the real restricted URL from the approval-gated job;
// the non-routable placeholder cannot accidentally reach a database.
const migrationUrl = process.env.PLANETSCALE_MIGRATION_DATABASE_URL
  ?? "postgresql://schema-check:unused@127.0.0.1:1/phaseo";
const normalizedMigrationUrl = new URL(migrationUrl);
normalizedMigrationUrl.searchParams.delete("sslrootcert");
normalizedMigrationUrl.searchParams.delete("sslnegotiation");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./src/generated",
  dbCredentials: { url: normalizedMigrationUrl.toString() },
  strict: true,
  verbose: true
});
