import { contentSchema } from "./namespaces";
import { jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const presets = contentSchema.table("presets", {
	id: uuid().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	config: jsonb().notNull(),
});

export const gatewayFeedback = contentSchema.table("gateway_feedback", {
	id: uuid().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id"),
	sessionId: text("session_id"),
	presetId: uuid("preset_id"),
	rating: text(),
	score: numeric(),
	reason: text(),
	reasonTags: text("reason_tags").array(),
	comment: text(),
	metadataDimensions: jsonb("metadata_dimensions"),
	endUserId: text("end_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
