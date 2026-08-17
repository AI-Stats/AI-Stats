import { bigint, boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const creditLedger = pgTable("credit_ledger", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  eventTime: timestamp("event_time", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  kind: text().notNull(),
  amountNanos: bigint("amount_nanos", { mode: "number" }).notNull(),
  beforeBalanceNanos: bigint("before_balance_nanos", { mode: "number" }).notNull(),
  afterBalanceNanos: bigint("after_balance_nanos", { mode: "number" }).notNull(),
  refType: text("ref_type").notNull(),
  refId: text("ref_id").notNull(),
  status: text(),
  sourceRefType: text("source_ref_type"),
  sourceRefId: text("source_ref_id"),
  refundClaimState: text("refund_claim_state"),
  refundClaimReason: text("refund_claim_reason"),
  refundClaimedAt: timestamp("refund_claimed_at", { withTimezone: true, mode: "string" }),
  refundClaimedByUserId: uuid("refund_claimed_by_user_id"),
});

export const wallets = pgTable("wallets", {
  workspaceId: uuid("workspace_id").primaryKey().notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  balanceNanos: bigint("balance_nanos", { mode: "number" }).default(0).notNull(),
  autoTopUpEnabled: boolean("auto_top_up_enabled").default(false).notNull(),
  autoTopUpAccountId: text("auto_top_up_account_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull(), userId: uuid("user_id").notNull(), role: text().notNull(),
});
export const workspaces = pgTable("workspaces", {
  id: uuid().primaryKey().notNull(),
  name: text().notNull(),
  slug: text().notNull(),
  ownerUserId: uuid("owner_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  tier: text(),
});
export const keys = pgTable("keys", {
  id: uuid().primaryKey().notNull(), workspaceId: uuid("workspace_id").notNull(), name: text().notNull(), status: text().notNull(),
});
export const managementKeys = pgTable("management_keys", {
  id: uuid().primaryKey().notNull(), workspaceId: uuid("workspace_id").notNull(),
});

export const workspaceSettings = pgTable("workspace_settings", {
	workspaceId: uuid("workspace_id").primaryKey().notNull(),
	autoTopUpFailureEmailEnabled: boolean("auto_top_up_failure_email_enabled").default(true).notNull(),
});

export const emailOutbox = pgTable("email_outbox", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	kind: text().notNull(),
	template: text().default("generic").notNull(),
	toEmail: text("to_email").notNull(),
	subject: text(),
	workspaceId: uuid("workspace_id"),
	userId: uuid("user_id"),
	payload: jsonb().default({}).notNull(),
	attempts: integer().default(0).notNull(),
	dedupeKey: text("dedupe_key"),
});

export const gatewayRequests = pgTable("gateway_requests", {
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	success: boolean().notNull(),
	costNanos: bigint("cost_nanos", { mode: "number" }),
});
