import { billingSchema, observabilitySchema } from "./namespaces";
// Generated from the live PlanetScale Postgres schema with `pnpm db:pull`.
export * from "./generated/schema";

import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// Drizzle Kit omits the partitioned parent from generated schema output.
// Declare the authoritative request table explicitly so runtime repositories
// query the parent instead of depending on a compatibility view.
export const gatewayRequests = observabilitySchema.table("gateway_requests", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	canonicalModelId: text("canonical_model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	errorPayload: jsonb("error_payload"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	authMethod: text("auth_method").default("api_key"),
	oauthClientId: text("oauth_client_id"),
	sessionId: text("session_id"),
	detailMetadata: jsonb("detail_metadata"),
	clientSourceId: text("client_source_id"),
	clientSourceName: text("client_source_name"),
	clientSourceKind: text("client_source_kind"),
	clientSourceVersion: text("client_source_version"),
	clientSourceDetection: text("client_source_detection"),
	throughput: numeric(),
	location: text(),
	finishReason: text("finish_reason"),
});

// This table is part of the source schema but was not present when the initial
// PlanetScale pull was taken. Keep it declared here until the next live pull.
export const gatewayIoRetentionBillingRuns = billingSchema.table("gateway_io_retention_billing_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	billingDate: date("billing_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
	status: text().default("pending").notNull(),
	eventUnits: bigint("event_units", { mode: "number" }).default(0).notNull(),
	billableBytes: bigint("billable_bytes", { mode: "number" }).default(0).notNull(),
	objectCount: bigint("object_count", { mode: "number" }).default(0).notNull(),
	amountNanos: bigint("amount_nanos", { mode: "number" }).default(0).notNull(),
	beforeBalanceNanos: bigint("before_balance_nanos", { mode: "number" }),
	afterBalanceNanos: bigint("after_balance_nanos", { mode: "number" }),
	graceUntil: timestamp("grace_until", { withTimezone: true, mode: "string" }),
	error: text(),
}, (table) => [
	unique("gateway_io_retention_billing_runs_workspace_date_key").on(table.workspaceId, table.billingDate),
	index("gateway_io_retention_billing_runs_workspace_created_idx").on(table.workspaceId, table.createdAt),
	check("gateway_io_retention_billing_runs_status_check", sql`${table.status} in ('pending','charged','already_charged','grace','suspended','skipped','error')`),
]);
