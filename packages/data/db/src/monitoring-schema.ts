import { internalSchema } from "./namespaces";
import { doublePrecision, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const monitorHistoryCommits = internalSchema.table("monitor_history_commits", {
	commitSha: text("commit_sha").primaryKey().notNull(),
	committedAt: timestamp("committed_at", { withTimezone: true, mode: "string" }).notNull(),
	entryCount: integer("entry_count").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const monitorHistoryEvents = internalSchema.table("monitor_history_events", {
	eventId: text("event_id").primaryKey().notNull(),
	commitSha: text("commit_sha").notNull(),
	committedAt: timestamp("committed_at", { withTimezone: true, mode: "string" }).notNull(),
	providerKind: text("provider_kind").notNull(),
	providerSlug: text("provider_slug"),
	providerLabel: text("provider_label").notNull(),
	modelId: text("model_id").notNull(),
	modelLabel: text("model_label").notNull(),
	endpoint: text(),
	field: text().default("").notNull(),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value"),
	percentChange: doublePrecision("percent_change"),
	action: text(),
	entityId: text("entity_id"),
	entityType: text("entity_type"),
	orgId: text("org_id"),
	changeKind: text("change_kind").notNull(),
	sourceFile: text("source_file"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const monitorHistorySyncState = internalSchema.table("monitor_history_sync_state", {
	syncKey: text("sync_key").primaryKey().notNull(),
	sourceBase: text("source_base"),
	sourceHead: text("source_head"),
	lastSha: text("last_sha"),
	generatedAt: timestamp("generated_at", { withTimezone: true, mode: "string" }),
	commitCount: integer("commit_count"),
	entryCount: integer("entry_count"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});
