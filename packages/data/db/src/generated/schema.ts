import { pgTable, index, foreignKey, unique, check, uuid, text, boolean, integer, timestamp, date, jsonb, bigint, uniqueIndex, numeric, doublePrecision, type AnyPgColumn, smallint, primaryKey, pgView, pgEnum, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const dataApiProviderCapabilityStatus = pgEnum("data_api_provider_capability_status", ['active', 'deranked', 'disabled', 'inactive', 'internal_testing', 'deranked_lvl1', 'deranked_lvl2', 'deranked_lvl3', 'coming_soon'])
export const joinRequestStatus = pgEnum("join_request_status", ['pending', 'approved', 'denied', 'cancelled'])
export const modelLinks = pgEnum("model_links", ['api_reference', 'paper', 'anouncement', 'repository', 'weights', 'official_playground'])
export const organisationSocialPlatforms = pgEnum("organisation_social_platforms", ['website', 'x', 'github', 'instagram', 'youtube', 'linkedin', 'reddit', 'tiktok', 'threads', 'discord', 'hugging_face'])
export const tieringMode = pgEnum("tiering_mode", ['flat', 'cliff', 'marginal'])
export const userRole = pgEnum("user_role", ['admin', 'editor', 'user'])
export const workspaceRole = pgEnum("workspace_role", ['owner', 'admin', 'member'])


export const byokKeys = pgTable("byok_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	providerId: text("provider_id").notNull(),
	name: text().notNull(),
	enabled: boolean().default(true).notNull(),
	alwaysUse: boolean("always_use").default(false).notNull(),
	encValue: customType<{ data: Buffer }>({ dataType: () => "bytea" })("enc_value").notNull(),
	encIv: customType<{ data: Buffer }>({ dataType: () => "bytea" })("enc_iv").notNull(),
	encTag: customType<{ data: Buffer }>({ dataType: () => "bytea" })("enc_tag").notNull(),
	keyVersion: integer("key_version").default(1).notNull(),
	fingerprintSha256: text("fingerprint_sha256").notNull(),
	prefix: text().notNull(),
	suffix: text().notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: 'string' }),
	verificationStatus: text("verification_status").default('unknown').notNull(),
	errorMessage: text("error_message"),
	routingMode: text("routing_mode").default('fallback').notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	allowedModelSlugs: text("allowed_model_slugs").array(),
	allowedApiKeyIds: uuid("allowed_api_key_ids").array(),
}, (table) => [
	index("byok_keys_always_use_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.providerId.asc().nullsLast().op("text_ops"), table.alwaysUse.asc().nullsLast().op("uuid_ops")).where(sql`(always_use = true)`),
	index("byok_keys_enabled_idx").using("btree", table.workspaceId.asc().nullsLast().op("bool_ops"), table.enabled.asc().nullsLast().op("bool_ops")).where(sql`(enabled = true)`),
	index("byok_keys_gateway_lookup_idx").using("btree", table.workspaceId.asc().nullsLast().op("int4_ops"), table.providerId.asc().nullsLast().op("text_ops"), table.routingMode.asc().nullsLast().op("uuid_ops"), table.sortOrder.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(enabled = true)`),
	index("byok_keys_workspace_provider_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.providerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "byok_keys_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "byok_keys_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("byok_keys_workspace_id_provider_id_fingerprint_sha256_key").on(table.fingerprintSha256, table.providerId, table.workspaceId),
	check("byok_keys_allowed_api_key_ids_limit", sql`(allowed_api_key_ids IS NULL) OR (cardinality(allowed_api_key_ids) <= 256)`),
	check("byok_keys_allowed_model_slugs_limit", sql`(allowed_model_slugs IS NULL) OR (cardinality(allowed_model_slugs) <= 256)`),
	check("byok_keys_routing_mode_check", sql`routing_mode = ANY (ARRAY['priority'::text, 'fallback'::text])`),
]);

export const catalogueInteractionPuzzles = pgTable("catalogue_interaction_puzzles", {
	puzzleId: uuid("puzzle_id").defaultRandom().primaryKey().notNull(),
	gameKey: text("game_key").notNull(),
	puzzleDate: date("puzzle_date").notNull(),
	publicPayload: jsonb("public_payload").notNull(),
	answerPayload: jsonb("answer_payload").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("catalogue_interaction_puzzles_date_idx").using("btree", table.puzzleDate.desc().nullsFirst().op("date_ops"), table.gameKey.asc().nullsLast().op("date_ops")),
	unique("catalogue_interaction_puzzles_game_key_puzzle_date_key").on(table.gameKey, table.puzzleDate),
	check("catalogue_interaction_puzzles_game_key_check", sql`game_key = ANY (ARRAY['modele'::text, 'timeline'::text, 'pricele'::text, 'head-to-head'::text, 'sprint'::text])`),
]);

export const creditGrantRedemptions = pgTable("credit_grant_redemptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	grantId: uuid("grant_id").notNull(),
	userId: uuid("user_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountNanos: bigint("amount_nanos", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("credit_grant_redemptions_user_created_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("credit_grant_redemptions_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.grantId],
			foreignColumns: [creditGrants.id],
			name: "credit_grant_redemptions_grant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "credit_grant_redemptions_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "credit_grant_redemptions_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("credit_grant_redemptions_grant_user_unique").on(table.grantId, table.userId),
	check("credit_grant_redemptions_amount_nanos_check", sql`amount_nanos > 0`),
]);

export const creditGrants = pgTable("credit_grants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	codeNormalized: text("code_normalized").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountNanos: bigint("amount_nanos", { mode: "number" }).notNull(),
	maxRedemptions: integer("max_redemptions").notNull(),
	redemptionsCount: integer("redemptions_count").default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	disabledAt: timestamp("disabled_at", { withTimezone: true, mode: 'string' }),
	note: text(),
}, (table) => [
	index("credit_grants_active_expiry_idx").using("btree", table.isActive.asc().nullsLast().op("text_ops"), table.expiresAt.asc().nullsLast().op("bool_ops"), table.codeNormalized.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("credit_grants_code_normalized_key").using("btree", table.codeNormalized.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "credit_grants_created_by_fkey"
		}).onDelete("set null"),
	check("credit_grants_amount_nanos_check", sql`amount_nanos > 0`),
	check("credit_grants_max_redemptions_check", sql`max_redemptions > 0`),
	check("credit_grants_redemption_bounds", sql`redemptions_count <= max_redemptions`),
	check("credit_grants_redemptions_count_check", sql`redemptions_count >= 0`),
]);

export const creditLedger = pgTable("credit_ledger", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	eventTime: timestamp("event_time", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	kind: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountNanos: bigint("amount_nanos", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	beforeBalanceNanos: bigint("before_balance_nanos", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	afterBalanceNanos: bigint("after_balance_nanos", { mode: "number" }).notNull(),
	refType: text("ref_type").notNull(),
	refId: text("ref_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: text(),
	sourceRefType: text("source_ref_type"),
	sourceRefId: text("source_ref_id"),
	refundClaimState: text("refund_claim_state"),
	refundClaimReason: text("refund_claim_reason"),
	refundClaimedAt: timestamp("refund_claimed_at", { withTimezone: true, mode: 'string' }),
	refundClaimedByUserId: uuid("refund_claimed_by_user_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	beforeReservedNanos: bigint("before_reserved_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	afterReservedNanos: bigint("after_reserved_nanos", { mode: "number" }),
}, (table) => [
	uniqueIndex("credit_ledger_ref_type_ref_id_key").using("btree", table.refType.asc().nullsLast().op("text_ops"), table.refId.asc().nullsLast().op("text_ops")),
	index("credit_ledger_refund_claim_state_idx").using("btree", table.refundClaimState.asc().nullsLast().op("text_ops")).where(sql`(ref_type = 'Stripe_Payment_Intent'::text)`),
	index("credit_ledger_source_ref_idx").using("btree", table.sourceRefType.asc().nullsLast().op("text_ops"), table.sourceRefId.asc().nullsLast().op("text_ops")),
	index("credit_ledger_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")).where(sql`(workspace_id IS NOT NULL)`),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "credit_ledger_workspace_id_fkey"
		}).onDelete("cascade"),
]);

export const dataContributionConsentEvents = pgTable("data_contribution_consent_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	actorType: text("actor_type").notNull(),
	actorUserId: uuid("actor_user_id"),
	actorKeyId: uuid("actor_key_id"),
	action: text().notNull(),
	outcome: text().notNull(),
	policyVersion: text("policy_version").notNull(),
	sampleRateBps: integer("sample_rate_bps").notNull(),
	classifierSampleRateBps: integer("classifier_sample_rate_bps").notNull(),
	discountBps: integer("discount_bps").notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("data_contribution_consent_actor_user_idx").using("btree", table.actorUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(actor_user_id IS NOT NULL)`),
	index("data_contribution_consent_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.userId],
			name: "data_contribution_consent_events_actor_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "data_contribution_consent_events_workspace_id_fkey"
		}).onDelete("cascade"),
	check("data_contribution_consent_even_classifier_sample_rate_bps_check", sql`(classifier_sample_rate_bps >= 0) AND (classifier_sample_rate_bps <= 10000)`),
	check("data_contribution_consent_events_action_check", sql`action = ANY (ARRAY['enabled'::text, 'disabled'::text, 'change_denied'::text])`),
	check("data_contribution_consent_events_actor_type_check", sql`actor_type = ANY (ARRAY['user'::text, 'management_key'::text, 'system'::text])`),
	check("data_contribution_consent_events_discount_bps_check", sql`(discount_bps >= 0) AND (discount_bps <= 10000)`),
	check("data_contribution_consent_events_outcome_check", sql`outcome = ANY (ARRAY['succeeded'::text, 'denied'::text, 'failed'::text])`),
	check("data_contribution_consent_events_sample_rate_bps_check", sql`(sample_rate_bps >= 0) AND (sample_rate_bps <= 10000)`),
]);

export const dataContributions = pgTable("data_contributions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endpoint: text().notNull(),
	modelSlug: text("model_slug").notNull(),
	providerSlug: text("provider_slug"),
	objectKey: text("object_key").notNull(),
	objectBytes: integer("object_bytes").notNull(),
	objectSha256: text("object_sha256").notNull(),
	retentionUntil: timestamp("retention_until", { withTimezone: true, mode: 'string' }).notNull(),
	consentPolicyVersion: text("consent_policy_version").notNull(),
	sampleRateBps: integer("sample_rate_bps").notNull(),
	classifierSampleRateBps: integer("classifier_sample_rate_bps").notNull(),
	sampleBucket: integer("sample_bucket").notNull(),
	redactionVersion: text("redaction_version").notNull(),
	redactionCount: integer("redaction_count").default(0).notNull(),
	discountBps: integer("discount_bps").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	discountNanos: bigint("discount_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputTokens: bigint("input_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputTokens: bigint("output_tokens", { mode: "number" }),
	status: text().default('pending').notNull(),
	attemptCount: integer("attempt_count").default(0).notNull(),
	availableAt: timestamp("available_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("data_contributions_claim_idx").using("btree", table.availableAt.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops"), table.id.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = ANY (ARRAY['pending'::text, 'failed'::text]))`),
	index("data_contributions_claimable_idx").using("btree", sql`(
CASE
    WHEN (status = 'processing'::text) THEN lease_expire`, sql`occurred_at`, sql`id`).where(sql`(status = ANY (ARRAY['pending'::text, 'failed'::text, 'processing'::text]))`),
	index("data_contributions_retention_idx").using("btree", table.retentionUntil.asc().nullsLast().op("timestamptz_ops")).where(sql`(status <> 'deleted'::text)`),
	index("data_contributions_stale_lease_idx").using("btree", table.leaseExpiresAt.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops"), table.id.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'processing'::text)`),
	index("data_contributions_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "data_contributions_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("data_contributions_workspace_id_request_id_key").on(table.requestId, table.workspaceId),
	check("data_contributions_attempt_count_check", sql`attempt_count >= 0`),
	check("data_contributions_classifier_sample_rate_bps_check", sql`(classifier_sample_rate_bps >= 0) AND (classifier_sample_rate_bps <= 10000)`),
	check("data_contributions_discount_bps_check", sql`(discount_bps >= 0) AND (discount_bps <= 10000)`),
	check("data_contributions_discount_nanos_check", sql`discount_nanos >= 0`),
	check("data_contributions_input_tokens_check", sql`(input_tokens IS NULL) OR (input_tokens >= 0)`),
	check("data_contributions_object_bytes_check", sql`object_bytes > 0`),
	check("data_contributions_output_tokens_check", sql`(output_tokens IS NULL) OR (output_tokens >= 0)`),
	check("data_contributions_redaction_count_check", sql`redaction_count >= 0`),
	check("data_contributions_sample_bucket_check", sql`(sample_bucket >= 0) AND (sample_bucket <= 9999)`),
	check("data_contributions_sample_rate_bps_check", sql`(sample_rate_bps >= 0) AND (sample_rate_bps <= 10000)`),
	check("data_contributions_status_check", sql`status = ANY (ARRAY['retained'::text, 'pending'::text, 'processing'::text, 'complete'::text, 'failed'::text, 'deleted'::text])`),
]);

export const emailOutbox = pgTable("email_outbox", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	kind: text().notNull(),
	template: text().default('generic').notNull(),
	toEmail: text("to_email").notNull(),
	subject: text(),
	workspaceId: uuid("workspace_id"),
	userId: uuid("user_id"),
	payload: jsonb().default({}).notNull(),
	attempts: integer().default(0).notNull(),
	lastError: text("last_error"),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	dedupeKey: text("dedupe_key"),
}, (table) => [
	uniqueIndex("email_outbox_dedupe_key_unique").using("btree", table.dedupeKey.asc().nullsLast().op("text_ops")),
	index("email_outbox_pending_idx").using("btree", table.sentAt.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("email_outbox_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("email_outbox_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "email_outbox_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "email_outbox_workspace_id_fkey"
		}).onDelete("set null"),
]);

export const gatewayAsyncOperations = pgTable("gateway_async_operations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	kind: text().notNull(),
	internalId: text("internal_id").notNull(),
	nativeId: text("native_id"),
	provider: text(),
	model: text(),
	status: text(),
	meta: jsonb().default({}).notNull(),
	billedAt: timestamp("billed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	requestId: text("request_id"),
	sessionId: text("session_id"),
	appId: uuid("app_id"),
	nextReconcileAt: timestamp("next_reconcile_at", { withTimezone: true, mode: 'string' }),
	reconcileAttempts: integer("reconcile_attempts").default(0).notNull(),
	reconcileLockedAt: timestamp("reconcile_locked_at", { withTimezone: true, mode: 'string' }),
	reconcileLockedBy: text("reconcile_locked_by"),
	lastReconcileError: text("last_reconcile_error"),
}, (table) => [
	index("gateway_async_operations_app_id_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_async_operations_kind_provider_native_created_idx").using("btree", table.kind.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops"), table.nativeId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((provider IS NOT NULL) AND (native_id IS NOT NULL))`),
	index("gateway_async_operations_kind_status_updated_idx").using("btree", table.kind.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.asc().nullsLast().op("text_ops")).where(sql`(status IS NOT NULL)`),
	index("gateway_async_operations_kind_unbilled_updated_idx").using("btree", table.kind.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(billed_at IS NULL)`),
	index("gateway_async_operations_reconcile_due_idx").using("btree", table.kind.asc().nullsLast().op("timestamptz_ops"), table.nextReconcileAt.asc().nullsFirst().op("timestamptz_ops"), table.updatedAt.asc().nullsLast().op("text_ops")).where(sql`(billed_at IS NULL)`),
	index("gateway_async_operations_reconcile_lock_idx").using("btree", table.kind.asc().nullsLast().op("text_ops"), table.reconcileLockedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((billed_at IS NULL) AND (reconcile_locked_at IS NOT NULL))`),
	index("gateway_async_operations_workspace_app_updated_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.appId.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.desc().nullsFirst().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_async_operations_workspace_kind_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.kind.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_async_operations_workspace_kind_native_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.kind.asc().nullsLast().op("text_ops"), table.nativeId.asc().nullsLast().op("text_ops")).where(sql`(native_id IS NOT NULL)`),
	index("gateway_async_operations_workspace_kind_status_updated_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.kind.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops"), table.updatedAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_async_operations_workspace_kind_updated_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.kind.asc().nullsLast().op("uuid_ops"), table.updatedAt.desc().nullsFirst().op("text_ops")),
	index("gateway_async_operations_workspace_request_updated_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestId.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.desc().nullsFirst().op("text_ops")).where(sql`(request_id IS NOT NULL)`),
	index("gateway_async_operations_workspace_session_updated_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.sessionId.asc().nullsLast().op("uuid_ops"), table.updatedAt.desc().nullsFirst().op("text_ops")).where(sql`(session_id IS NOT NULL)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_async_operations_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_async_operations_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("gateway_async_operations_workspace_kind_internal_unique").on(table.internalId, table.kind, table.workspaceId),
	check("gateway_async_operations_kind_check", sql`kind = ANY (ARRAY['video'::text, 'batch'::text, 'music'::text])`),
]);

export const gatewayBatchRequests = pgTable("gateway_batch_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	batchId: text("batch_id").notNull(),
	provider: text().notNull(),
	nativeBatchId: text("native_batch_id"),
	customId: text("custom_id").notNull(),
	requestIndex: integer("request_index").default(0).notNull(),
	method: text(),
	endpoint: text(),
	model: text(),
	status: text().default('queued').notNull(),
	requestBodyHash: text("request_body_hash"),
	responseStatus: integer("response_status"),
	responseBody: jsonb("response_body"),
	errorBody: jsonb("error_body"),
	usage: jsonb(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	costUsd: numeric("cost_usd"),
	meta: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("gateway_batch_requests_provider_native_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.nativeBatchId.asc().nullsLast().op("text_ops")).where(sql`(native_batch_id IS NOT NULL)`),
	uniqueIndex("gateway_batch_requests_workspace_batch_custom_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.batchId.asc().nullsLast().op("text_ops"), table.customId.asc().nullsLast().op("text_ops")),
	index("gateway_batch_requests_workspace_batch_status_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.batchId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.requestIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_batch_requests_workspace_id_fkey"
		}).onDelete("cascade"),
]);

export const gatewayDynamicRouteVersions = pgTable("gateway_dynamic_route_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	routeId: uuid("route_id").notNull(),
	version: integer().notNull(),
	config: jsonb().notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_dynamic_route_versions_route_idx").using("btree", table.routeId.asc().nullsLast().op("int4_ops"), table.version.desc().nullsFirst().op("int4_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "gateway_dynamic_route_versions_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.routeId],
			foreignColumns: [gatewayDynamicRoutes.id],
			name: "gateway_dynamic_route_versions_route_id_fkey"
		}).onDelete("cascade"),
	unique("gateway_dynamic_route_versions_route_version_key").on(table.routeId, table.version),
	check("gateway_dynamic_route_versions_config_check", sql`(jsonb_typeof(config) = 'object'::text) AND (pg_column_size(config) <= 65536)`),
	check("gateway_dynamic_route_versions_version_check", sql`version > 0`),
]);

export const gatewayDynamicRoutes = pgTable("gateway_dynamic_routes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	status: text().default('active').notNull(),
	version: integer().default(1).notNull(),
	deployedVersion: integer("deployed_version"),
	config: jsonb().default({}).notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_dynamic_routes_workspace_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.updatedAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "gateway_dynamic_routes_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_dynamic_routes_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("gateway_dynamic_routes_workspace_slug_key").on(table.slug, table.workspaceId),
	unique("gateway_dynamic_routes_workspace_name_key").on(table.name, table.workspaceId),
	check("gateway_dynamic_routes_config_check", sql`(jsonb_typeof(config) = 'object'::text) AND (pg_column_size(config) <= 65536)`),
	check("gateway_dynamic_routes_description_check", sql`(description IS NULL) OR (char_length(description) <= 500)`),
	check("gateway_dynamic_routes_name_check", sql`(char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 80)`),
	check("gateway_dynamic_routes_slug_check", sql`slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'::text`),
	check("gateway_dynamic_routes_status_check", sql`status = ANY (ARRAY['active'::text, 'paused'::text])`),
	check("gateway_dynamic_routes_version_check", sql`version > 0`),
]);

export const gatewayIoLogs = pgTable("gateway_io_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ioLogStatus: text("io_log_status").default('not_enabled').notNull(),
	ioLogStorageProvider: text("io_log_storage_provider"),
	ioLogBucket: text("io_log_bucket"),
	ioLogObjectKey: text("io_log_object_key"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ioLogBytes: bigint("io_log_bytes", { mode: "number" }),
	ioLogSha256: text("io_log_sha256"),
	ioLogContentType: text("io_log_content_type"),
	ioLogRetentionUntil: timestamp("io_log_retention_until", { withTimezone: true, mode: 'string' }),
	ioLogError: text("io_log_error"),
}, (table) => [
	index("gateway_io_logs_object_key_idx").using("btree", table.ioLogObjectKey.asc().nullsLast().op("text_ops")).where(sql`(io_log_object_key IS NOT NULL)`),
	index("gateway_io_logs_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_io_logs_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("gateway_io_logs_workspace_request_key").on(table.requestId, table.workspaceId),
	check("gateway_io_logs_status_check", sql`io_log_status = ANY (ARRAY['not_enabled'::text, 'stored'::text, 'missing_bucket'::text, 'too_large'::text, 'error'::text, 'deleted'::text])`),
]);

export const gatewayObservabilityEvents = pgTable("gateway_observability_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id"),
	sessionId: text("session_id"),
	presetId: uuid("preset_id"),
	testRunId: uuid("test_run_id"),
	category: text().default('custom').notNull(),
	eventName: text("event_name").notNull(),
	value: jsonb(),
	numericValue: numeric("numeric_value"),
	metadata: jsonb().default({}).notNull(),
	metadataDimensions: jsonb("metadata_dimensions").default({}).notNull(),
	endUserId: text("end_user_id"),
	source: text().default('api').notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByUserId: uuid("created_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_observability_events_metadata_dimensions_idx").using("gin", table.metadataDimensions.asc().nullsLast().op("jsonb_path_ops")),
	index("gateway_observability_events_preset_occurred_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.presetId.asc().nullsLast().op("uuid_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(preset_id IS NOT NULL)`),
	index("gateway_observability_events_request_occurred_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestId.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")).where(sql`(request_id IS NOT NULL)`),
	index("gateway_observability_events_session_occurred_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.sessionId.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("uuid_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_observability_events_workspace_created_preset_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("uuid_ops"), table.presetId.asc().nullsLast().op("uuid_ops")).where(sql`(preset_id IS NOT NULL)`),
	index("gateway_observability_events_workspace_occurred_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.presetId],
			foreignColumns: [presets.id],
			name: "gateway_observability_events_preset_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.testRunId],
			foreignColumns: [gatewayPresetTestRuns.id],
			name: "gateway_observability_events_test_run_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_observability_events_workspace_id_fkey"
		}).onDelete("cascade"),
	check("gateway_observability_events_category_check", sql`category = ANY (ARRAY['feedback'::text, 'behavior'::text, 'outcome'::text, 'app'::text, 'test'::text, 'custom'::text])`),
	check("gateway_observability_events_metadata_dimensions_object_check", sql`jsonb_typeof(metadata_dimensions) = 'object'::text`),
	check("gateway_observability_events_name_check", sql`(length(btrim(event_name)) >= 1) AND (length(btrim(event_name)) <= 128)`),
	check("gateway_observability_events_source_check", sql`source = ANY (ARRAY['api'::text, 'user'::text, 'system'::text, 'import'::text, 'test'::text])`),
	check("gateway_observability_events_target_check", sql`(request_id IS NOT NULL) OR (session_id IS NOT NULL) OR (preset_id IS NOT NULL) OR (test_run_id IS NOT NULL)`),
]);

export const gatewayPresetTestRunItems = pgTable("gateway_preset_test_run_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	testRunId: uuid("test_run_id").notNull(),
	presetId: uuid("preset_id"),
	requestId: text("request_id"),
	input: jsonb().default({}).notNull(),
	expectedOutput: jsonb("expected_output"),
	actualOutput: jsonb("actual_output"),
	metrics: jsonb().default({}).notNull(),
	status: text().default('pending').notNull(),
	feedbackId: uuid("feedback_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_preset_test_run_items_run_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.testRunId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.feedbackId],
			foreignColumns: [gatewayFeedback.id],
			name: "gateway_preset_test_run_items_feedback_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.presetId],
			foreignColumns: [presets.id],
			name: "gateway_preset_test_run_items_preset_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.testRunId],
			foreignColumns: [gatewayPresetTestRuns.id],
			name: "gateway_preset_test_run_items_test_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_preset_test_run_items_workspace_id_fkey"
		}).onDelete("cascade"),
	check("gateway_preset_test_run_items_status_check", sql`status = ANY (ARRAY['pending'::text, 'running'::text, 'passed'::text, 'failed'::text, 'error'::text, 'skipped'::text])`),
]);

export const gatewayPresetTestRuns = pgTable("gateway_preset_test_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	presetId: uuid("preset_id"),
	baselinePresetId: uuid("baseline_preset_id"),
	name: text(),
	description: text(),
	status: text().default('pending').notNull(),
	datasetName: text("dataset_name"),
	config: jsonb().default({}).notNull(),
	summary: jsonb().default({}).notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdByUserId: uuid("created_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_preset_test_runs_preset_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.presetId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(preset_id IS NOT NULL)`),
	index("gateway_preset_test_runs_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.baselinePresetId],
			foreignColumns: [presets.id],
			name: "gateway_preset_test_runs_baseline_preset_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.presetId],
			foreignColumns: [presets.id],
			name: "gateway_preset_test_runs_preset_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_preset_test_runs_workspace_id_fkey"
		}).onDelete("cascade"),
	check("gateway_preset_test_runs_status_check", sql`status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])`),
]);

export const gatewayProviderEvents = pgTable("gateway_provider_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	provider: text().notNull(),
	providerEventId: text("provider_event_id").notNull(),
	kind: text(),
	workspaceId: uuid("workspace_id"),
	internalId: text("internal_id"),
	payload: jsonb().default({}).notNull(),
	headers: jsonb().default({}).notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	attemptCount: integer("attempt_count").default(0).notNull(),
	nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
	deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true, mode: 'string' }),
	replayLockedAt: timestamp("replay_locked_at", { withTimezone: true, mode: 'string' }),
	replayLockedBy: text("replay_locked_by"),
}, (table) => [
	index("gateway_provider_events_provider_created_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_provider_events_replay_due_idx").using("btree", table.nextAttemptAt.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(processed_at IS NULL)`),
	index("gateway_provider_events_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(workspace_id IS NOT NULL)`),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_provider_events_workspace_id_fkey"
		}).onDelete("set null"),
	unique("gateway_provider_events_provider_event_unique").on(table.provider, table.providerEventId),
]);

export const gatewayRealtimeSessions = pgTable("gateway_realtime_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: text("session_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	keyId: uuid("key_id"),
	userId: text("user_id"),
	source: text().default('api').notNull(),
	provider: text().notNull(),
	modelId: text("model_id").notNull(),
	providerModelId: text("provider_model_id"),
	voice: text(),
	status: text().default('created').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	connectedAt: timestamp("connected_at", { withTimezone: true, mode: 'string' }),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	lastEventAt: timestamp("last_event_at", { withTimezone: true, mode: 'string' }),
	reservationPrefix: text("reservation_prefix").notNull(),
	reservationCount: integer("reservation_count").default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reservedNanos: bigint("reserved_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	capturedNanos: bigint("captured_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	releasedNanos: bigint("released_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	estimatedCostNanos: bigint("estimated_cost_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	finalCostNanos: bigint("final_cost_nanos", { mode: "number" }),
	currency: text().default('USD').notNull(),
	usage: jsonb().default({}).notNull(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	providerSessionId: text("provider_session_id"),
	providerNativeId: text("provider_native_id"),
	providerClientSecretHash: text("provider_client_secret_hash"),
	disconnectReason: text("disconnect_reason"),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_gateway_realtime_sessions_active_provider").using("btree", sql`lower(provider)`).where(sql`(status = ANY (ARRAY['created'::text, 'connecting'::text, 'connected'::text, 'ending'::text]))`),
	index("idx_gateway_realtime_sessions_key_created").using("btree", table.keyId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_gateway_realtime_sessions_status_updated").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_gateway_realtime_sessions_workspace_created").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_realtime_sessions_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_realtime_sessions_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("gateway_realtime_sessions_session_id_key").on(table.sessionId),
	check("gateway_realtime_sessions_source_check", sql`source = ANY (ARRAY['api'::text, 'chat'::text])`),
	check("gateway_realtime_sessions_status_check", sql`status = ANY (ARRAY['created'::text, 'connecting'::text, 'connected'::text, 'ending'::text, 'billing_unresolved'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'expired'::text])`),
]);

export const v2Models = pgTable("v2_models", {
	modelSlug: text("model_slug").primaryKey().notNull(),
	labSlug: text("lab_slug").notNull(),
	name: text().notNull(),
	description: text(),
	status: text().default('active').notNull(),
	hidden: boolean().default(false).notNull(),
	inputModalities: text("input_modalities").array().default([""]).notNull(),
	outputModalities: text("output_modalities").array().default([""]).notNull(),
	familySlug: text("family_slug"),
	announcedAt: timestamp("announced_at", { withTimezone: true, mode: 'string' }),
	releasedAt: timestamp("released_at", { withTimezone: true, mode: 'string' }),
	deprecatedAt: timestamp("deprecated_at", { withTimezone: true, mode: 'string' }),
	retiredAt: timestamp("retired_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	license: text(),
	licenseUrl: text("license_url"),
	previousModelSlug: text("previous_model_slug"),
	removalDate: timestamp("removal_date", { withTimezone: true, mode: 'string' }),
	replacementModelSlug: text("replacement_model_slug"),
	variantKind: text("variant_kind").default('standard').notNull(),
	baseModelSlug: text("base_model_slug"),
	catalogueStatus: text("catalogue_status").default('unknown').notNull(),
}, (table) => [
	index("v2_models_catalogue_status_idx").using("btree", table.catalogueStatus.asc().nullsLast().op("text_ops"), table.hidden.asc().nullsLast().op("text_ops"), table.modelSlug.asc().nullsLast().op("text_ops")),
	index("v2_models_input_modalities_idx").using("gin", table.inputModalities.asc().nullsLast().op("array_ops")),
	index("v2_models_lab_idx").using("btree", table.labSlug.asc().nullsLast().op("text_ops")),
	index("v2_models_license_idx").using("btree", table.license.asc().nullsLast().op("text_ops")).where(sql`(license IS NOT NULL)`),
	uniqueIndex("v2_models_one_free_variant_per_base_idx").using("btree", table.baseModelSlug.asc().nullsLast().op("text_ops")).where(sql`(variant_kind = 'free'::text)`),
	index("v2_models_output_modalities_idx").using("gin", table.outputModalities.asc().nullsLast().op("array_ops")),
	index("v2_models_previous_idx").using("btree", table.previousModelSlug.asc().nullsLast().op("text_ops")).where(sql`(previous_model_slug IS NOT NULL)`),
	index("v2_models_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops"), table.hidden.asc().nullsLast().op("bool_ops"), table.modelSlug.asc().nullsLast().op("text_ops")),
	index("v2_models_variant_lookup_idx").using("btree", table.variantKind.asc().nullsLast().op("text_ops"), table.baseModelSlug.asc().nullsLast().op("text_ops"), table.modelSlug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.baseModelSlug],
			foreignColumns: [table.modelSlug],
			name: "v2_models_base_model_slug_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.labSlug],
			foreignColumns: [v2Labs.labSlug],
			name: "v2_models_lab_slug_fkey"
		}).onDelete("restrict"),
	check("v2_models_catalogue_status_check", sql`catalogue_status = ANY (ARRAY['unknown'::text, 'rumoured'::text, 'announced'::text, 'preview'::text, 'available'::text, 'limited_access'::text, 'deprecated'::text, 'retired'::text, 'withheld'::text])`),
	check("v2_models_lab_slug_prefix_check", sql`(split_part(model_slug, '/'::text, 1) = lab_slug) AND (split_part(model_slug, '/'::text, 2) <> ''::text)`),
	check("v2_models_slug_check", sql`(model_slug = lower(model_slug)) AND (model_slug ~ '^[a-z0-9][a-z0-9._:/+@-]*$'::text)`),
	check("v2_models_status_check", sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'retired'::text, 'disabled'::text])`),
	check("v2_models_variant_identity_check", sql`((variant_kind = 'standard'::text) AND (model_slug !~ ':free$'::text) AND (base_model_slug IS NULL)) OR ((variant_kind = 'free'::text) AND (model_slug ~ ':free$'::text) AND (base_model_slug IS NOT NULL) AND (base_model_slug <> model_slug))`),
	check("v2_models_variant_kind_check", sql`variant_kind = ANY (ARRAY['standard'::text, 'free'::text])`),
]);

export const apiApps = pgTable("api_apps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	appKey: text("app_key").notNull(),
	title: text().notNull(),
	url: text().default('about:blank').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	firstSeen: timestamp("first_seen", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSeen: timestamp("last_seen", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	meta: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	imageUrl: text("image_url"),
}, (table) => [
	index("api_apps_last_seen_idx").using("btree", table.lastSeen.asc().nullsLast().op("timestamptz_ops")),
	index("api_apps_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("api_apps_workspace_id_url_key").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.url.asc().nullsLast().op("text_ops")),
	index("idx_api_apps_public_active").using("btree", table.isPublic.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "api_apps_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("api_apps_workspace_appkey_unique").on(table.appKey, table.workspaceId),
]);

export const broadcastDestinationRules = pgTable("broadcast_destination_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ruleGroupId: uuid("rule_group_id").notNull(),
	field: text().notNull(),
	condition: text().notNull(),
	value: text(),
	position: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
}, (table) => [
	index("broadcast_destination_rules_group_id_idx").using("btree", table.ruleGroupId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.ruleGroupId],
			foreignColumns: [broadcastDestinationRuleGroups.id],
			name: "broadcast_destination_rules_rule_group_id_fkey"
		}).onDelete("cascade"),
	check("broadcast_destination_rules_condition_check", sql`condition = ANY (ARRAY['equals'::text, 'not_equals'::text, 'contains'::text, 'not_contains'::text, 'starts_with'::text, 'ends_with'::text, 'exists'::text, 'not_exists'::text, 'matches_regex'::text])`),
	check("broadcast_destination_rules_field_check", sql`field = ANY (ARRAY['model'::text, 'provider'::text, 'session_id'::text, 'user_id'::text, 'api_key_name'::text, 'finish_reason'::text, 'input'::text, 'output'::text, 'token_cost'::text, 'total_cost'::text, 'total_tokens'::text, 'prompt_tokens'::text, 'completion_tokens'::text])`),
]);

export const gatewayWebhookEndpoints = pgTable("gateway_webhook_endpoints", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	url: text().notNull(),
	status: text().default('active').notNull(),
	events: text().array().default(["RAY['video.completed'::text", "'video.failed'::text", "'video.cancelled'::text", "'batch.completed'::text", "'batch.failed'::text", "'batch.cancelled'::tex"]).notNull(),
	secretCiphertext: text("secret_ciphertext").notNull(),
	secretIv: text("secret_iv").notNull(),
	secretHash: text("secret_hash").notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	secretKeyVersion: text("secret_key_version"),
}, (table) => [
	uniqueIndex("gateway_webhook_endpoints_workspace_secret_hash_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.secretHash.asc().nullsLast().op("uuid_ops")),
	index("gateway_webhook_endpoints_workspace_status_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "gateway_webhook_endpoints_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_webhook_endpoints_workspace_id_fkey"
		}).onDelete("cascade"),
	check("gateway_webhook_endpoints_status_check", sql`status = ANY (ARRAY['active'::text, 'disabled'::text, 'deleted'::text])`),
]);

export const keys = pgTable("keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	hash: text().notNull(),
	prefix: text().notNull(),
	status: text().default('active').notNull(),
	scopes: text().notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
	kid: text(),
	softBlocked: boolean("soft_blocked").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dailyLimitRequests: bigint("daily_limit_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	weeklyLimitRequests: bigint("weekly_limit_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyLimitRequests: bigint("monthly_limit_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dailyLimitCostNanos: bigint("daily_limit_cost_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	weeklyLimitCostNanos: bigint("weekly_limit_cost_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyLimitCostNanos: bigint("monthly_limit_cost_nanos", { mode: "number" }).default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	keyKind: text("key_kind").default('standard').notNull(),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	oauthScopes: text("oauth_scopes").array(),
	issuedVia: text("issued_via").default('dashboard').notNull(),
	oauthResource: text("oauth_resource"),
}, (table) => [
	index("keys_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")).where(sql`(created_by IS NOT NULL)`),
	index("keys_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(expires_at IS NOT NULL)`),
	index("keys_hash_idx").using("btree", table.hash.asc().nullsLast().op("text_ops")),
	uniqueIndex("keys_kid_uidx").using("btree", table.kid.asc().nullsLast().op("text_ops")),
	uniqueIndex("keys_oauth_delegated_active_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops"), table.workspaceId.asc().nullsLast().op("uuid_ops"), table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`((key_kind = 'oauth_delegated'::text) AND (status = 'active'::text))`),
	index("keys_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")).where(sql`(workspace_id IS NOT NULL)`),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "keys_created_by_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.oauthUserId],
			foreignColumns: [users.userId],
			name: "keys_oauth_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "keys_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("keys_hash_key").on(table.hash),
	check("keys_active_oauth_delegated_gateway_scope_check", sql`(key_kind <> 'oauth_delegated'::text) OR (status <> 'active'::text) OR ((NULLIF(btrim(oauth_resource), ''::text) IS NOT NULL) AND (NOT COALESCE((btrim(oauth_resource) ~* '^https://api\.phaseo\.app(?::443)?/v1/*$'::text), false))) OR (COALESCE(oauth_scopes, ARRAY[]::text[]) @> ARRAY['gateway:access'::text])`),
	check("keys_issued_via_check", sql`issued_via = ANY (ARRAY['dashboard'::text, 'oauth_pkce'::text, 'cli'::text])`),
	check("keys_key_kind_check", sql`key_kind = ANY (ARRAY['standard'::text, 'oauth_delegated'::text])`),
]);

export const managementKeys = pgTable("management_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	hash: text().notNull(),
	prefix: text().notNull(),
	status: text().default('active').notNull(),
	scopes: text().notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	kid: text(),
	softBlocked: boolean("soft_blocked").default(false).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("management_keys_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(expires_at IS NOT NULL)`),
	index("management_keys_hash_idx").using("btree", table.hash.asc().nullsLast().op("text_ops")),
	index("management_keys_prefix_idx").using("btree", table.prefix.asc().nullsLast().op("text_ops")),
	index("management_keys_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "management_keys_created_by_fkey"
		}),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "management_keys_workspace_id_fkey"
		}),
	unique("provisioning_keys_hash_key").on(table.hash),
]);

export const monitorHistoryCommits = pgTable("monitor_history_commits", {
	commitSha: text("commit_sha").primaryKey().notNull(),
	committedAt: timestamp("committed_at", { withTimezone: true, mode: 'string' }).notNull(),
	entryCount: integer("entry_count").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("monitor_history_commits_committed_at_idx").using("btree", table.committedAt.desc().nullsFirst().op("text_ops"), table.commitSha.desc().nullsFirst().op("text_ops")),
]);

export const monitorHistoryEvents = pgTable("monitor_history_events", {
	eventId: text("event_id").primaryKey().notNull(),
	commitSha: text("commit_sha").notNull(),
	committedAt: timestamp("committed_at", { withTimezone: true, mode: 'string' }).notNull(),
	providerKind: text("provider_kind").notNull(),
	providerSlug: text("provider_slug"),
	providerLabel: text("provider_label").notNull(),
	modelId: text("model_id").notNull(),
	modelLabel: text("model_label").notNull(),
	endpoint: text(),
	field: text().default('').notNull(),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value"),
	percentChange: doublePrecision("percent_change"),
	action: text(),
	entityId: text("entity_id"),
	entityType: text("entity_type"),
	orgId: text("org_id"),
	changeKind: text("change_kind").notNull(),
	sourceFile: text("source_file"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("monitor_history_events_change_kind_idx").using("btree", table.changeKind.asc().nullsLast().op("text_ops"), table.committedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("monitor_history_events_commit_idx").using("btree", table.commitSha.asc().nullsLast().op("timestamptz_ops"), table.committedAt.desc().nullsFirst().op("text_ops")),
	index("monitor_history_events_committed_at_idx").using("btree", table.committedAt.desc().nullsFirst().op("timestamptz_ops"), table.eventId.asc().nullsLast().op("timestamptz_ops")),
	index("monitor_history_events_model_id_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.committedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("monitor_history_events_provider_slug_idx").using("btree", table.providerSlug.asc().nullsLast().op("timestamptz_ops"), table.committedAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.commitSha],
			foreignColumns: [monitorHistoryCommits.commitSha],
			name: "monitor_history_events_commit_sha_fkey"
		}).onDelete("cascade"),
]);

export const monitorHistorySyncState = pgTable("monitor_history_sync_state", {
	syncKey: text("sync_key").primaryKey().notNull(),
	sourceBase: text("source_base"),
	sourceHead: text("source_head"),
	lastSha: text("last_sha"),
	generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }),
	commitCount: integer("commit_count"),
	entryCount: integer("entry_count"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
]);

export const oauthAppMetadata = pgTable("oauth_app_metadata", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: text("client_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	description: text(),
	homepageUrl: text("homepage_url"),
	logoUrl: text("logo_url"),
	privacyPolicyUrl: text("privacy_policy_url"),
	termsOfServiceUrl: text("terms_of_service_url"),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: text().default('active').notNull(),
	redirectUris: text("redirect_uris").array().default([""]).notNull(),
	clientType: text("client_type").default('public').notNull(),
	clientSecretHash: text("client_secret_hash"),
	allowedScopes: text("allowed_scopes").array().default([""]).notNull(),
	isFirstParty: boolean("is_first_party").default(false).notNull(),
	betaStatus: text("beta_status").default('beta').notNull(),
}, (table) => [
	index("oauth_app_metadata_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("oauth_app_metadata_redirect_uris_gin_idx").using("gin", table.redirectUris.asc().nullsLast().op("array_ops")),
	index("oauth_app_metadata_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'active'::text)`),
	index("oauth_app_metadata_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "oauth_app_metadata_created_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "oauth_app_metadata_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_app_metadata_client_id_key").on(table.clientId),
	check("oauth_app_metadata_beta_status_check", sql`beta_status = ANY (ARRAY['private'::text, 'beta'::text, 'public'::text])`),
	check("oauth_app_metadata_client_type_check", sql`client_type = ANY (ARRAY['public'::text, 'confidential'::text])`),
	check("oauth_app_metadata_name_check", sql`(char_length(name) >= 3) AND (char_length(name) <= 100)`),
	check("oauth_app_metadata_status_check", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])`),
]);

export const oauthAuthorizationCodes = pgTable("oauth_authorization_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	codeHash: text("code_hash").notNull(),
	clientId: text("client_id").notNull(),
	userId: uuid("user_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	redirectUri: text("redirect_uri").notNull(),
	scopes: text().array().default([""]).notNull(),
	codeChallenge: text("code_challenge").notNull(),
	codeChallengeMethod: text("code_challenge_method").default('S256').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resource: text(),
}, (table) => [
	index("oauth_authorization_codes_client_idx").using("btree", table.clientId.asc().nullsLast().op("timestamptz_ops"), table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("oauth_authorization_codes_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "oauth_authorization_codes_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "oauth_authorization_codes_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_authorization_codes_code_hash_key").on(table.codeHash),
]);

export const gatewayFeedback = pgTable("gateway_feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id"),
	sessionId: text("session_id"),
	presetId: uuid("preset_id"),
	testRunId: uuid("test_run_id"),
	source: text().default('api').notNull(),
	rating: text(),
	score: numeric(),
	reason: text(),
	reasonTags: text("reason_tags").array().default([""]).notNull(),
	comment: text(),
	metadata: jsonb().default({}).notNull(),
	metadataDimensions: jsonb("metadata_dimensions").default({}).notNull(),
	endUserId: text("end_user_id"),
	createdByUserId: uuid("created_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_feedback_metadata_dimensions_idx").using("gin", table.metadataDimensions.asc().nullsLast().op("jsonb_path_ops")),
	index("gateway_feedback_preset_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.presetId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(preset_id IS NOT NULL)`),
	index("gateway_feedback_request_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(request_id IS NOT NULL)`),
	index("gateway_feedback_session_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.sessionId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_feedback_test_run_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.testRunId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(test_run_id IS NOT NULL)`),
	index("gateway_feedback_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_feedback_workspace_created_preset_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.presetId.asc().nullsLast().op("timestamptz_ops")).where(sql`(preset_id IS NOT NULL)`),
	index("gateway_feedback_workspace_preset_rating_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.presetId.asc().nullsLast().op("timestamptz_ops"), table.rating.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(preset_id IS NOT NULL)`),
	foreignKey({
			columns: [table.presetId],
			foreignColumns: [presets.id],
			name: "gateway_feedback_preset_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.testRunId],
			foreignColumns: [gatewayPresetTestRuns.id],
			name: "gateway_feedback_test_run_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_feedback_workspace_id_fkey"
		}).onDelete("cascade"),
	check("gateway_feedback_metadata_dimensions_object_check", sql`jsonb_typeof(metadata_dimensions) = 'object'::text`),
	check("gateway_feedback_rating_check", sql`(rating IS NULL) OR (rating = ANY (ARRAY['thumbs_up'::text, 'thumbs_down'::text, 'correct'::text, 'partly_correct'::text, 'incorrect'::text, 'bad_format'::text, 'too_slow'::text, 'too_expensive'::text, 'unsafe'::text, 'refused_incorrectly'::text, 'not_helpful'::text, 'other'::text]))`),
	check("gateway_feedback_score_check", sql`(score IS NULL) OR ((score >= (0)::numeric) AND (score <= (1)::numeric))`),
	check("gateway_feedback_source_check", sql`source = ANY (ARRAY['api'::text, 'user'::text, 'system'::text, 'import'::text, 'test'::text])`),
	check("gateway_feedback_target_check", sql`(request_id IS NOT NULL) OR (session_id IS NOT NULL) OR (preset_id IS NOT NULL) OR (test_run_id IS NOT NULL)`),
]);

export const oauthAuthorizations = pgTable("oauth_authorizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	clientId: text("client_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	scopes: text().array().default([""]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("oauth_authorizations_client_id_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")).where(sql`(revoked_at IS NULL)`),
	index("oauth_authorizations_last_used_idx").using("btree", table.lastUsedAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(revoked_at IS NULL)`),
	index("oauth_authorizations_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(revoked_at IS NULL)`),
	index("oauth_authorizations_validation_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.clientId.asc().nullsLast().op("text_ops"), table.workspaceId.asc().nullsLast().op("uuid_ops")).where(sql`(revoked_at IS NULL)`),
	index("oauth_authorizations_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "oauth_authorizations_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "oauth_authorizations_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_authorizations_user_client_workspace_unique").on(table.clientId, table.userId, table.workspaceId),
]);

export const oauthClients = pgTable("oauth_clients", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	logoUrl: text("logo_url"),
	homepageUrl: text("homepage_url"),
	clientType: text("client_type").default('public').notNull(),
	clientSecretHash: text("client_secret_hash"),
	redirectUris: text("redirect_uris").array().default([""]).notNull(),
	allowedScopes: text("allowed_scopes").array().default([""]).notNull(),
	isFirstParty: boolean("is_first_party").default(false).notNull(),
	betaStatus: text("beta_status").default('private').notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	check("oauth_clients_beta_status_check", sql`beta_status = ANY (ARRAY['private'::text, 'beta'::text, 'public'::text])`),
	check("oauth_clients_client_type_check", sql`client_type = ANY (ARRAY['public'::text, 'confidential'::text])`),
	check("oauth_clients_status_check", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])`),
]);

export const oauthDeviceCodes = pgTable("oauth_device_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	deviceCodeHash: text("device_code_hash").notNull(),
	userCodeHash: text("user_code_hash").notNull(),
	clientId: text("client_id").notNull(),
	userId: uuid("user_id"),
	workspaceId: uuid("workspace_id"),
	scopes: text().array().default([""]).notNull(),
	status: text().default('pending').notNull(),
	intervalSeconds: integer("interval_seconds").default(5).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	deniedAt: timestamp("denied_at", { withTimezone: true, mode: 'string' }),
	consumedAt: timestamp("consumed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastPolledAt: timestamp("last_polled_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("oauth_device_codes_client_status_idx").using("btree", table.clientId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("text_ops"), table.expiresAt.asc().nullsLast().op("text_ops")),
	index("oauth_device_codes_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(user_id IS NOT NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "oauth_device_codes_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "oauth_device_codes_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_device_codes_device_code_hash_key").on(table.deviceCodeHash),
	unique("oauth_device_codes_user_code_hash_key").on(table.userCodeHash),
	check("oauth_device_codes_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text])`),
]);

export const oauthRefreshTokens = pgTable("oauth_refresh_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tokenHash: text("token_hash").notNull(),
	userId: uuid("user_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	clientId: text("client_id").notNull(),
	scopes: text().array().default([""]).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	rotatedFrom: uuid("rotated_from"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	familyId: uuid("family_id").notNull(),
}, (table) => [
	index("oauth_refresh_tokens_family_idx").using("btree", table.familyId.asc().nullsLast().op("uuid_ops")),
	index("oauth_refresh_tokens_rotated_from_idx").using("btree", table.rotatedFrom.asc().nullsLast().op("uuid_ops")).where(sql`(rotated_from IS NOT NULL)`),
	index("oauth_refresh_tokens_user_client_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.clientId.asc().nullsLast().op("text_ops")).where(sql`(revoked_at IS NULL)`),
	index("oauth_refresh_tokens_workspace_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.rotatedFrom],
			foreignColumns: [table.id],
			name: "oauth_refresh_tokens_rotated_from_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "oauth_refresh_tokens_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "oauth_refresh_tokens_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_refresh_tokens_token_hash_key").on(table.tokenHash),
]);

export const otelExportOutbox = pgTable("otel_export_outbox", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	destinationId: uuid("destination_id").notNull(),
	eventId: text("event_id").notNull(),
	payload: jsonb().notNull(),
	status: text().default('pending').notNull(),
	attempts: integer().default(0).notNull(),
	nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: 'string' }),
	lastHttpStatus: integer("last_http_status"),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("otel_export_outbox_pending_idx").using("btree", table.nextAttemptAt.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = ANY (ARRAY['pending'::text, 'processing'::text]))`),
	foreignKey({
			columns: [table.destinationId],
			foreignColumns: [workspaceBroadcastDestinations.id],
			name: "otel_export_outbox_destination_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "otel_export_outbox_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("otel_export_outbox_destination_id_event_id_key").on(table.destinationId, table.eventId),
	check("otel_export_outbox_status_check", sql`status = ANY (ARRAY['pending'::text, 'processing'::text, 'delivered'::text, 'failed'::text])`),
]);

export const passkey = pgTable("passkey", {
	id: text().primaryKey().notNull(),
	name: text(),
	publicKey: text().notNull(),
	userId: text().notNull(),
	credentialId: text().notNull(),
	counter: integer().notNull(),
	deviceType: text().notNull(),
	backedUp: boolean().notNull(),
	transports: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }),
	aaguid: text(),
}, (table) => [
	index("passkey_credentialID_idx").using("btree", table.credentialId.asc().nullsLast().op("text_ops")),
	index("passkey_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "passkey_userId_fkey"
		}).onDelete("cascade"),
]);

export const presetVersions = pgTable("preset_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	presetId: uuid("preset_id").notNull(),
	versionNumber: integer("version_number").notNull(),
	versionLabel: text("version_label").notNull(),
	versioningMethod: text("versioning_method").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	config: jsonb().default({}).notNull(),
	visibility: text().notNull(),
	releaseNotes: text("release_notes"),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("preset_versions_preset_created_idx").using("btree", table.presetId.asc().nullsLast().op("uuid_ops"), table.versionNumber.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "preset_versions_created_by_fkey"
		}),
	unique("preset_versions_preset_id_version_label_key").on(table.presetId, table.versionLabel),
	unique("preset_versions_preset_id_version_number_key").on(table.presetId, table.versionNumber),
	check("preset_versions_version_number_check", sql`version_number > 0`),
	check("preset_versions_versioning_method_check", sql`versioning_method = ANY (ARRAY['sequential'::text, 'semver'::text, 'date'::text])`),
	check("preset_versions_visibility_check", sql`visibility = ANY (ARRAY['private'::text, 'team'::text, 'public'::text])`),
]);

export const presets = pgTable("presets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	description: text(),
	config: jsonb().default({}).notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	visibility: text().default('team').notNull(),
	sourcePresetId: uuid("source_preset_id"),
	slug: text().notNull(),
	draftName: text("draft_name"),
	draftSlug: text("draft_slug"),
	draftDescription: text("draft_description"),
	draftConfig: jsonb("draft_config"),
	draftVisibility: text("draft_visibility"),
	activeVersionId: uuid("active_version_id"),
	sourcePresetVersionId: uuid("source_preset_version_id"),
	upstreamVersionId: uuid("upstream_version_id"),
	rootPresetId: uuid("root_preset_id"),
	forkDepth: integer("fork_depth").default(0).notNull(),
	versioningMethod: text("versioning_method").default('sequential').notNull(),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("presets_config_gin_idx").using("gin", table.config.asc().nullsLast().op("jsonb_ops")),
	index("presets_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("presets_name_workspace_id_idx").using("btree", table.name.asc().nullsLast().op("text_ops"), table.workspaceId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("presets_public_workspace_slug_key").using("btree", sql`workspace_id`, sql`lower(slug)`).where(sql`(visibility = 'public'::text)`),
	index("presets_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("presets_source_preset_id_idx").using("btree", table.sourcePresetId.asc().nullsLast().op("uuid_ops")),
	index("presets_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("text_ops")),
	index("presets_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("presets_workspace_id_slug_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.slug.asc().nullsLast().op("text_ops")),
	index("presets_workspace_slug_ci_idx").using("btree", sql`workspace_id`, sql`lower(slug)`),
	foreignKey({
			columns: [table.activeVersionId],
			foreignColumns: [presetVersions.id as AnyPgColumn],
			name: "presets_active_version_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "presets_created_by_fkey"
		}),
	foreignKey({
			columns: [table.rootPresetId],
			foreignColumns: [table.id],
			name: "presets_root_preset_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sourcePresetId],
			foreignColumns: [table.id],
			name: "presets_source_preset_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sourcePresetVersionId],
			foreignColumns: [presetVersions.id as AnyPgColumn],
			name: "presets_source_version_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.upstreamVersionId],
			foreignColumns: [presetVersions.id as AnyPgColumn],
			name: "presets_upstream_version_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "presets_workspace_id_fkey"
		}),
	check("presets_public_requires_creator", sql`(visibility <> 'public'::text) OR (created_by IS NOT NULL)`),
	check("presets_versioning_method_check", sql`versioning_method = ANY (ARRAY['sequential'::text, 'semver'::text, 'date'::text])`),
	check("presets_visibility_check", sql`visibility = ANY (ARRAY['private'::text, 'team'::text, 'public'::text])`),
]);

export const requestClassifications = pgTable("request_classifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contributionId: uuid("contribution_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	classifierId: uuid("classifier_id").notNull(),
	primaryCategory: text("primary_category").notNull(),
	labels: jsonb().default([]).notNull(),
	confidence: numeric({ precision: 5, scale:  4 }),
	model: text().notNull(),
	serviceTier: text("service_tier").notNull(),
	latencyMs: integer("latency_ms"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("request_classifications_classifier_category_idx").using("btree", table.classifierId.asc().nullsLast().op("timestamptz_ops"), table.primaryCategory.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("request_classifications_workspace_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.classifierId],
			foreignColumns: [workspaceClassifiers.id],
			name: "request_classifications_classifier_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contributionId],
			foreignColumns: [dataContributions.id],
			name: "request_classifications_contribution_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "request_classifications_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("request_classifications_contribution_id_classifier_id_key").on(table.classifierId, table.contributionId),
	check("request_classifications_confidence_check", sql`(confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))`),
	check("request_classifications_labels_array_check", sql`jsonb_typeof(labels) = 'array'::text`),
	check("request_classifications_latency_ms_check", sql`(latency_ms IS NULL) OR (latency_ms >= 0)`),
]);

export const securityKeyReports = pgTable("security_key_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	receivedAt: timestamp("received_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	source: text(),
	reporterEmail: text("reporter_email"),
	evidenceUrl: text("evidence_url"),
	comment: text(),
	tokenPrefix: text("token_prefix"),
	tokenFingerprint: text("token_fingerprint"),
	matched: boolean().default(false).notNull(),
	keyTable: text("key_table"),
	apiKeyId: uuid("api_key_id"),
	workspaceId: uuid("workspace_id"),
	actionTaken: text("action_taken"),
	reportMode: text("report_mode"),
	ipHash: text("ip_hash"),
	userAgentHash: text("user_agent_hash"),
	status: text().default('received').notNull(),
	tokenLastFour: text("token_last_four"),
	actionTakenAt: timestamp("action_taken_at", { withTimezone: true, mode: 'string' }),
	actionTakenBy: uuid("action_taken_by"),
}, (table) => [
	index("security_key_reports_matched_idx").using("btree", table.matched.asc().nullsLast().op("timestamptz_ops"), table.receivedAt.desc().nullsFirst().op("bool_ops")),
	index("security_key_reports_received_at_idx").using("btree", table.receivedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("security_key_reports_status_received_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.receivedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("security_key_reports_token_fingerprint_idx").using("btree", table.tokenFingerprint.asc().nullsLast().op("text_ops")),
	index("security_key_reports_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.actionTakenBy],
			foreignColumns: [users.userId],
			name: "security_key_reports_action_taken_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "security_key_reports_workspace_id_fkey"
		}).onDelete("set null"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull(),
	impersonatedBy: text(),
}, (table) => [
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_userId_fkey"
		}).onDelete("cascade"),
	unique("session_token_key").on(table.token),
]);

export const twoFactor = pgTable("twoFactor", {
	id: text().primaryKey().notNull(),
	secret: text().notNull(),
	backupCodes: text().notNull(),
	userId: text().notNull(),
	verified: boolean(),
	failedVerificationCount: integer(),
	lockedUntil: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("twoFactor_secret_idx").using("btree", table.secret.asc().nullsLast().op("text_ops")),
	index("twoFactor_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "twoFactor_userId_fkey"
		}).onDelete("cascade"),
]);

export const updates = pgTable("updates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	type: text().notNull(),
	who: text().notNull(),
	title: text().notNull(),
	link: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
}, (table) => [
	unique("updates_link_key").on(table.link),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean().notNull(),
	image: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	role: text(),
	banned: boolean(),
	banReason: text(),
	banExpires: timestamp({ withTimezone: true, mode: 'string' }),
	twoFactorEnabled: boolean(),
	appMetadata: jsonb(),
	invitedAt: timestamp({ withTimezone: true, mode: 'string' }),
	lastSignInAt: timestamp({ withTimezone: true, mode: 'string' }),
	userMetadata: jsonb(),
	mfaReenrollmentRequired: boolean().default(false).notNull(),
}, (table) => [
	index("user_mfaReenrollmentRequired_idx").using("btree", table.mfaReenrollmentRequired.asc().nullsLast().op("bool_ops")).where(sql`("mfaReenrollmentRequired" IS TRUE)`),
	unique("user_email_key").on(table.email),
]);

export const users = pgTable("users", {
	userId: uuid("user_id").primaryKey().notNull(),
	displayName: text("display_name"),
	defaultWorkspaceId: uuid("default_workspace_id"),
	obfuscateInfo: boolean("obfuscate_info").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	role: userRole().default('user').notNull(),
	betaOptIn: boolean("beta_opt_in").default(false).notNull(),
	betaFeatures: jsonb("beta_features").default({}).notNull(),
	publicProfileEnabled: boolean("public_profile_enabled").default(false).notNull(),
	publicProfileSlug: text("public_profile_slug"),
	onboardingState: jsonb("onboarding_state").default({}).notNull(),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: 'string' }),
	declaredCountryCode: text("declared_country_code"),
	countryDeclaredAt: timestamp("country_declared_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("users_declared_country_code_idx").using("btree", table.declaredCountryCode.asc().nullsLast().op("text_ops")).where(sql`(declared_country_code IS NOT NULL)`),
	index("users_default_workspace_id_idx").using("btree", table.defaultWorkspaceId.asc().nullsLast().op("uuid_ops")).where(sql`(default_workspace_id IS NOT NULL)`),
	index("users_onboarding_completed_at_idx").using("btree", table.onboardingCompletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(onboarding_completed_at IS NOT NULL)`),
	uniqueIndex("users_public_profile_slug_key").using("btree", table.publicProfileSlug.asc().nullsLast().op("text_ops")).where(sql`(public_profile_slug IS NOT NULL)`),
	check("users_declared_country_code_check", sql`(declared_country_code IS NULL) OR (declared_country_code ~ '^[A-Z]{2}$'::text)`),
]);

export const v2AdapterPrimitives = pgTable("v2_adapter_primitives", {
	primitiveKey: text("primitive_key").primaryKey().notNull(),
	primitiveKind: text("primitive_kind").notNull(),
	codeVersion: integer("code_version").default(1).notNull(),
	configSchema: jsonb("config_schema").default({}).notNull(),
	status: text().default('active').notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("v2_adapter_primitives_key_check", sql`primitive_key ~ '^[a-z0-9][a-z0-9._-]*$'::text`),
	check("v2_adapter_primitives_kind_check", sql`primitive_kind = ANY (ARRAY['request_mapper'::text, 'response_parser'::text, 'stream_parser'::text, 'auth_signer'::text, 'transport'::text, 'usage_normalizer'::text, 'error_normalizer'::text, 'job_handler'::text])`),
	check("v2_adapter_primitives_schema_check", sql`jsonb_typeof(config_schema) = 'object'::text`),
	check("v2_adapter_primitives_status_check", sql`status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const v2AnalyticsOutbox = pgTable("v2_analytics_outbox", {
	requestEventId: uuid("request_event_id").primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('pending').notNull(),
	attemptCount: integer("attempt_count").default(0).notNull(),
	availableAt: timestamp("available_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_analytics_outbox_pending_idx").using("btree", table.status.asc().nullsLast().op("text_ops"), table.availableAt.asc().nullsLast().op("text_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = ANY (ARRAY['pending'::text, 'failed'::text]))`),
	index("v2_analytics_outbox_workspace_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.requestEventId],
			foreignColumns: [v2RequestFacts.requestEventId],
			name: "v2_analytics_outbox_request_event_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "v2_analytics_outbox_workspace_id_fkey"
		}).onDelete("cascade"),
	check("v2_analytics_outbox_attempt_count_check", sql`attempt_count >= 0`),
	check("v2_analytics_outbox_status_check", sql`status = ANY (ARRAY['pending'::text, 'processing'::text, 'complete'::text, 'failed'::text])`),
]);

export const v2BenchmarkResults = pgTable("v2_benchmark_results", {
	resultId: uuid("result_id").defaultRandom().primaryKey().notNull(),
	modelSlug: text("model_slug").notNull(),
	benchmarkId: text("benchmark_id").notNull(),
	score: text(),
	scoreNumeric: numeric("score_numeric"),
	isSelfReported: boolean("is_self_reported").default(false).notNull(),
	otherInfo: text("other_info"),
	sourceLink: text("source_link"),
	rank: integer(),
	occurIdx: integer("occur_idx"),
	variant: text(),
	resultKey: text("result_key"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("v2_benchmark_results_model_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops"), table.benchmarkId.asc().nullsLast().op("text_ops")),
	index("v2_benchmark_results_rank_idx").using("btree", table.benchmarkId.asc().nullsLast().op("int4_ops"), table.rank.asc().nullsLast().op("int4_ops"), table.modelSlug.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.benchmarkId],
			foreignColumns: [v2Benchmarks.benchmarkId],
			name: "v2_benchmark_results_benchmark_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_benchmark_results_model_slug_fkey"
		}).onDelete("cascade"),
]);

export const v2Benchmarks = pgTable("v2_benchmarks", {
	benchmarkId: text("benchmark_id").primaryKey().notNull(),
	name: text().notNull(),
	category: text(),
	link: text(),
	totalModels: integer("total_models"),
	ascendingOrder: boolean("ascending_order").default(false).notNull(),
	benchmarkType: text("benchmark_type"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
]);

export const v2CapabilityAdapters = pgTable("v2_capability_adapters", {
	capabilityAdapterId: uuid("capability_adapter_id").defaultRandom().primaryKey().notNull(),
	capabilityId: text("capability_id").notNull(),
	adapterKey: text("adapter_key").notNull(),
	adapterVersion: integer("adapter_version").default(1).notNull(),
	primitiveBindings: jsonb("primitive_bindings").notNull(),
	defaultConfig: jsonb("default_config").default({}).notNull(),
	status: text().default('draft').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_capability_adapters_lookup_idx").using("btree", table.capabilityId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops"), table.adapterKey.asc().nullsLast().op("int4_ops"), table.adapterVersion.desc().nullsFirst().op("int4_ops")),
	unique("v2_capability_adapters_capability_key").on(table.capabilityAdapterId, table.capabilityId),
	unique("v2_capability_adapters_key").on(table.adapterKey, table.adapterVersion),
	check("v2_capability_adapters_adapter_key_check", sql`adapter_key ~ '^[a-z0-9][a-z0-9._-]*$'::text`),
	check("v2_capability_adapters_bindings_check", sql`jsonb_typeof(primitive_bindings) = 'object'::text`),
	check("v2_capability_adapters_config_check", sql`jsonb_typeof(default_config) = 'object'::text`),
	check("v2_capability_adapters_status_check", sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])`),
	check("v2_capability_adapters_version_check", sql`adapter_version > 0`),
]);

export const v2CapabilityConstraints = pgTable("v2_capability_constraints", {
	constraintId: uuid("constraint_id").defaultRandom().primaryKey().notNull(),
	providerSlug: text("provider_slug"),
	providerModelId: text("provider_model_id"),
	capabilityId: text("capability_id").notNull(),
	constraintKey: text("constraint_key").notNull(),
	expression: jsonb().notNull(),
	outcome: text().default('reject').notNull(),
	message: text().notNull(),
	priority: integer().default(100).notNull(),
	status: text().default('draft').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_capability_constraints_lookup_idx").using("btree", table.providerSlug.asc().nullsLast().op("int4_ops"), table.providerModelId.asc().nullsLast().op("int4_ops"), table.capabilityId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops"), table.priority.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_capability_constraints_provider_model_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_capability_constraints_provider_slug_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerSlug, table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId, v2ModelProviderRoutes.providerSlug],
			name: "v2_capability_constraints_provider_slug_provider_model_id_fkey"
		}).onDelete("cascade"),
	unique("v2_capability_constraints_key").on(table.capabilityId, table.constraintKey, table.providerModelId, table.providerSlug),
	check("v2_capability_constraints_expression_check", sql`jsonb_typeof(expression) = 'object'::text`),
	check("v2_capability_constraints_outcome_check", sql`outcome = ANY (ARRAY['reject'::text, 'warn'::text, 'transform'::text])`),
	check("v2_capability_constraints_scope_check", sql`(provider_slug IS NOT NULL) OR (provider_model_id IS NOT NULL)`),
	check("v2_capability_constraints_status_check", sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const v2CapabilityEvidence = pgTable("v2_capability_evidence", {
	evidenceId: uuid("evidence_id").defaultRandom().primaryKey().notNull(),
	providerSlug: text("provider_slug"),
	providerModelId: text("provider_model_id"),
	capabilityId: text("capability_id").notNull(),
	parameterKey: text("parameter_key"),
	sourceUrl: text("source_url").notNull(),
	sourceType: text("source_type").default('official_docs').notNull(),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }).notNull(),
	confidence: text().default('confirmed').notNull(),
	sourceHash: text("source_hash"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_capability_evidence_lookup_idx").using("btree", table.providerSlug.asc().nullsLast().op("text_ops"), table.providerModelId.asc().nullsLast().op("text_ops"), table.capabilityId.asc().nullsLast().op("text_ops"), table.checkedAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_capability_evidence_provider_model_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_capability_evidence_provider_slug_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerSlug, table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId, v2ModelProviderRoutes.providerSlug],
			name: "v2_capability_evidence_provider_slug_provider_model_id_fkey"
		}).onDelete("cascade"),
	check("v2_capability_evidence_confidence_check", sql`confidence = ANY (ARRAY['confirmed'::text, 'high'::text, 'medium'::text, 'low'::text])`),
	check("v2_capability_evidence_scope_check", sql`(provider_slug IS NOT NULL) OR (provider_model_id IS NOT NULL)`),
	check("v2_capability_evidence_source_check", sql`source_url ~ '^https://'::text`),
	check("v2_capability_evidence_type_check", sql`source_type = ANY (ARRAY['official_docs'::text, 'official_sdk'::text, 'live_test'::text, 'provider_support'::text, 'inference'::text])`),
]);

export const v2CatalogueAdminChanges = pgTable("v2_catalogue_admin_changes", {
	changeId: uuid("change_id").defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id").notNull(),
	resourceType: text("resource_type").notNull(),
	resourceId: text("resource_id").notNull(),
	action: text().notNull(),
	beforeState: jsonb("before_state"),
	afterState: jsonb("after_state"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_catalogue_admin_changes_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("v2_catalogue_admin_changes_resource_idx").using("btree", table.resourceType.asc().nullsLast().op("text_ops"), table.resourceId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.userId],
			name: "v2_catalogue_admin_changes_actor_user_id_fkey"
		}).onDelete("restrict"),
	check("v2_catalogue_admin_changes_action_check", sql`action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'save'::text])`),
	check("v2_catalogue_admin_changes_resource_type_check", sql`resource_type = ANY (ARRAY['pricing_sku'::text, 'organisations'::text, 'providers'::text, 'benchmarks'::text, 'subscription-plans'::text, 'models'::text, 'model_graph'::text, 'provider_route'::text])`),
]);

export const v2CatalogueBackfillIssues = pgTable("v2_catalogue_backfill_issues", {
	issueId: uuid("issue_id").defaultRandom().primaryKey().notNull(),
	sourceType: text("source_type").notNull(),
	sourceKey: text("source_key").notNull(),
	issueCode: text("issue_code").notNull(),
	details: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_catalogue_backfill_issues_type_idx").using("btree", table.sourceType.asc().nullsLast().op("timestamptz_ops"), table.issueCode.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	unique("v2_catalogue_backfill_issues_key").on(table.issueCode, table.sourceKey, table.sourceType),
]);

export const v2ControlPlaneReleases = pgTable("v2_control_plane_releases", {
	releaseId: uuid("release_id").defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequence: bigint({ mode: "number" }).generatedAlwaysAsIdentity({ name: "v2_control_plane_releases_sequence_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	status: text().default('draft').notNull(),
	changeSummary: text("change_summary").notNull(),
	contentHash: text("content_hash"),
	createdBy: uuid("created_by"),
	reviewedBy: uuid("reviewed_by"),
	publishedBy: uuid("published_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	publishedOnceAt: timestamp("published_once_at", { withTimezone: true, mode: 'string' }),
	supersededAt: timestamp("superseded_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("v2_control_plane_single_published_idx").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'published'::text)`),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "v2_control_plane_releases_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.publishedBy],
			foreignColumns: [users.userId],
			name: "v2_control_plane_releases_published_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.userId],
			name: "v2_control_plane_releases_reviewed_by_fkey"
		}).onDelete("set null"),
	unique("v2_control_plane_releases_sequence_key").on(table.sequence),
	check("v2_control_plane_releases_publish_check", sql`(status <> 'published'::text) OR ((reviewed_by IS NOT NULL) AND (published_at IS NOT NULL) AND (published_once_at IS NOT NULL) AND (content_hash IS NOT NULL))`),
	check("v2_control_plane_releases_review_check", sql`(reviewed_by IS NULL) OR (created_by IS NULL) OR (reviewed_by <> created_by)`),
	check("v2_control_plane_releases_status_check", sql`status = ANY (ARRAY['draft'::text, 'validated'::text, 'published'::text, 'superseded'::text, 'rejected'::text])`),
]);

export const v2CreditReservations = pgTable("v2_credit_reservations", {
	reservationId: uuid("reservation_id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	purpose: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountNanos: bigint("amount_nanos", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	capturedNanos: bigint("captured_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	releasedNanos: bigint("released_nanos", { mode: "number" }).default(0).notNull(),
	status: text().default('held').notNull(),
	idempotencyKey: text("idempotency_key").notNull(),
	externalRef: text("external_ref"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }),
	releasedAt: timestamp("released_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	index("v2_credit_reservations_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = ANY (ARRAY['held'::text, 'partially_captured'::text, 'partially_released'::text]))`),
	index("v2_credit_reservations_external_ref_idx").using("btree", table.externalRef.asc().nullsLast().op("text_ops")).where(sql`(external_ref IS NOT NULL)`),
	index("v2_credit_reservations_workspace_status_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "v2_credit_reservations_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("v2_credit_reservations_key").on(table.idempotencyKey, table.workspaceId),
	check("v2_credit_reservations_amount_check", sql`amount_nanos > 0`),
	check("v2_credit_reservations_balance_check", sql`(captured_nanos + released_nanos) <= amount_nanos`),
	check("v2_credit_reservations_captured_check", sql`captured_nanos >= 0`),
	check("v2_credit_reservations_idempotency_check", sql`length(TRIM(BOTH FROM idempotency_key)) > 0`),
	check("v2_credit_reservations_released_check", sql`released_nanos >= 0`),
	check("v2_credit_reservations_status_check", sql`status = ANY (ARRAY['held'::text, 'partially_captured'::text, 'captured'::text, 'partially_released'::text, 'released'::text, 'expired'::text, 'cancelled'::text])`),
]);

export const v2ExecutionPlans = pgTable("v2_execution_plans", {
	executionPlanId: uuid("execution_plan_id").defaultRandom().primaryKey().notNull(),
	releaseId: uuid("release_id").notNull(),
	providerModelId: text("provider_model_id").notNull(),
	capabilityId: text("capability_id").notNull(),
	routeVariantId: uuid("route_variant_id"),
	planVersion: integer("plan_version").default(1).notNull(),
	planHash: text("plan_hash").notNull(),
	plan: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_execution_plans_runtime_lookup_idx").using("btree", table.releaseId.asc().nullsLast().op("text_ops"), table.providerModelId.asc().nullsLast().op("text_ops"), table.capabilityId.asc().nullsLast().op("text_ops"), table.routeVariantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.providerModelId, table.capabilityId],
			foreignColumns: [v2RouteCapabilities.providerModelId, v2RouteCapabilities.capabilityId],
			name: "v2_execution_plans_provider_model_id_capability_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_execution_plans_provider_model_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerModelId, table.routeVariantId],
			foreignColumns: [v2RouteVariants.variantId, v2RouteVariants.providerModelId],
			name: "v2_execution_plans_provider_model_id_route_variant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.releaseId],
			foreignColumns: [v2ControlPlaneReleases.releaseId],
			name: "v2_execution_plans_release_id_fkey"
		}).onDelete("cascade"),
	unique("v2_execution_plans_key").on(table.capabilityId, table.providerModelId, table.releaseId, table.routeVariantId),
	check("v2_execution_plans_plan_check", sql`jsonb_typeof(plan) = 'object'::text`),
	check("v2_execution_plans_version_check", sql`plan_version > 0`),
]);

export const v2Labs = pgTable("v2_labs", {
	labSlug: text("lab_slug").primaryKey().notNull(),
	name: text().notNull(),
	countryCode: text("country_code").default('xx').notNull(),
	description: text(),
	status: text().default('active').notNull(),
	routable: boolean().default(false).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("v2_labs_name_key").using("btree", sql`lower(name)`),
	index("v2_labs_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status <> 'disabled'::text)`),
	check("v2_labs_slug_check", sql`(lab_slug = lower(lab_slug)) AND (lab_slug ~ '^[a-z0-9][a-z0-9._-]*$'::text)`),
	check("v2_labs_status_check", sql`status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const v2MeterDefinitions = pgTable("v2_meter_definitions", {
	meterKey: text("meter_key").primaryKey().notNull(),
	displayName: text("display_name").notNull(),
	modality: text().notNull(),
	direction: text(),
	unit: text().notNull(),
	defaultUnitQuantity: numeric("default_unit_quantity", { precision: 30, scale:  12 }).default('1').notNull(),
	description: text(),
	status: text().default('active').notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_meter_definitions_active_idx").using("btree", table.modality.asc().nullsLast().op("text_ops"), table.direction.asc().nullsLast().op("text_ops"), table.meterKey.asc().nullsLast().op("text_ops")).where(sql`(status = 'active'::text)`),
	check("v2_meter_definitions_direction_check", sql`(direction IS NULL) OR (direction = ANY (ARRAY['input'::text, 'output'::text]))`),
	check("v2_meter_definitions_key_check", sql`(meter_key = lower(meter_key)) AND (meter_key ~ '^[a-z0-9][a-z0-9._:-]*$'::text)`),
	check("v2_meter_definitions_quantity_check", sql`default_unit_quantity > (0)::numeric`),
	check("v2_meter_definitions_status_check", sql`status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const v2ModelAliases = pgTable("v2_model_aliases", {
	aliasSlug: text("alias_slug").primaryKey().notNull(),
	modelSlug: text("model_slug").notNull(),
	aliasType: text("alias_type").default('public').notNull(),
	enabled: boolean().default(true).notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_model_aliases_active_idx").using("btree", table.aliasSlug.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("text_ops"), table.effectiveTo.asc().nullsLast().op("timestamptz_ops")).where(sql`enabled`),
	index("v2_model_aliases_model_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops")).where(sql`enabled`),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_model_aliases_model_slug_fkey"
		}).onDelete("cascade"),
	check("v2_model_aliases_slug_check", sql`(alias_slug = lower(alias_slug)) AND (alias_slug ~ '^[a-z0-9][a-z0-9._:/+@-]*$'::text)`),
	check("v2_model_aliases_window_check", sql`(effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from)`),
]);

export const v2ModelFamilies = pgTable("v2_model_families", {
	familySlug: text("family_slug").primaryKey().notNull(),
	labSlug: text("lab_slug").notNull(),
	name: text().notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.labSlug],
			foreignColumns: [v2Labs.labSlug],
			name: "v2_model_families_lab_slug_fkey"
		}).onDelete("cascade"),
	unique("v2_model_families_lab_slug_family_slug_key").on(table.familySlug, table.labSlug),
]);

export const v2ModelPageNotices = pgTable("v2_model_page_notices", {
	modelSlug: text("model_slug").primaryKey().notNull(),
	tone: text().notNull(),
	markdown: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_model_page_notices_model_slug_fkey"
		}).onDelete("cascade"),
	check("v2_model_page_notices_tone_check", sql`tone = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])`),
]);

export const v2ModelProviderRoutes = pgTable("v2_model_provider_routes", {
	providerModelId: text("provider_model_id").primaryKey().notNull(),
	modelSlug: text("model_slug").notNull(),
	providerSlug: text("provider_slug").notNull(),
	providerModelSlug: text("provider_model_slug").notNull(),
	status: text().default('active').notNull(),
	routingEnabled: boolean("routing_enabled").default(false).notNull(),
	inputModalities: text("input_modalities").array().default([""]).notNull(),
	outputModalities: text("output_modalities").array().default([""]).notNull(),
	regions: text().array().default([""]).notNull(),
	contextLength: integer("context_length"),
	maxOutputTokens: integer("max_output_tokens"),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	providerAvailabilityStatus: text("provider_availability_status").default('unknown').notNull(),
	phaseoStatus: text("phaseo_status").default('disabled').notNull(),
	accessScope: text("access_scope").default('public').notNull(),
}, (table) => [
	index("v2_model_provider_routes_active_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops"), table.providerSlug.asc().nullsLast().op("text_ops")).where(sql`((status = ANY (ARRAY['active'::text, 'degraded'::text])) AND (routing_enabled = true))`),
	index("v2_model_provider_routes_explicit_status_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops"), table.providerAvailabilityStatus.asc().nullsLast().op("bool_ops"), table.phaseoStatus.asc().nullsLast().op("bool_ops"), table.accessScope.asc().nullsLast().op("text_ops"), table.routingEnabled.asc().nullsLast().op("text_ops")),
	index("v2_model_provider_routes_model_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("bool_ops"), table.routingEnabled.asc().nullsLast().op("text_ops")),
	index("v2_model_provider_routes_provider_idx").using("btree", table.providerSlug.asc().nullsLast().op("bool_ops"), table.status.asc().nullsLast().op("bool_ops"), table.routingEnabled.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_model_provider_routes_model_slug_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_model_provider_routes_provider_slug_fkey"
		}).onDelete("restrict"),
	unique("v2_model_provider_routes_provider_model_key").on(table.providerModelId, table.providerSlug),
	check("v2_model_provider_routes_access_scope_check", sql`access_scope = ANY (ARRAY['public'::text, 'internal'::text])`),
	check("v2_model_provider_routes_context_check", sql`(context_length IS NULL) OR (context_length > 0)`),
	check("v2_model_provider_routes_internal_scope_check", sql`(access_scope = 'public'::text) OR (phaseo_status = ANY (ARRAY['testing'::text, 'enabled'::text]))`),
	check("v2_model_provider_routes_output_check", sql`(max_output_tokens IS NULL) OR (max_output_tokens > 0)`),
	check("v2_model_provider_routes_phaseo_routing_check", sql`(NOT routing_enabled) OR (phaseo_status = 'enabled'::text)`),
	check("v2_model_provider_routes_phaseo_status_check", sql`phaseo_status = ANY (ARRAY['unsupported'::text, 'planned'::text, 'implementing'::text, 'testing'::text, 'enabled'::text, 'disabled'::text, 'blocked'::text])`),
	check("v2_model_provider_routes_provider_availability_check", sql`provider_availability_status = ANY (ARRAY['unknown'::text, 'coming_soon'::text, 'preview'::text, 'available'::text, 'limited_access'::text, 'deprecated'::text, 'removed'::text])`),
	check("v2_model_provider_routes_provider_routing_check", sql`(NOT routing_enabled) OR (provider_availability_status = ANY (ARRAY['available'::text, 'preview'::text, 'limited_access'::text]))`),
	check("v2_model_provider_routes_public_routing_check", sql`(NOT routing_enabled) OR (access_scope = 'public'::text)`),
	check("v2_model_provider_routes_status_check", sql`status = ANY (ARRAY['active'::text, 'degraded'::text, 'disabled'::text, 'retired'::text])`),
	check("v2_model_provider_routes_window_check", sql`(effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from)`),
]);

export const v2PricingSkuMeters = pgTable("v2_pricing_sku_meters", {
	skuMeterId: uuid("sku_meter_id").defaultRandom().primaryKey().notNull(),
	skuId: uuid("sku_id").notNull(),
	meterKey: text("meter_key").notNull(),
	modality: text().notNull(),
	direction: text(),
	unit: text().notNull(),
	unitQuantity: numeric("unit_quantity", { precision: 30, scale:  12 }).default('1').notNull(),
	priceNanos: numeric("price_nanos", { precision: 30, scale:  12 }).notNull(),
	displayLabel: text("display_label").notNull(),
	displayUnit: text("display_unit").notNull(),
	billable: boolean().default(true).notNull(),
	meterOrder: integer("meter_order").default(100).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_pricing_sku_meters_lookup_idx").using("btree", table.meterKey.asc().nullsLast().op("text_ops"), table.modality.asc().nullsLast().op("text_ops"), table.direction.asc().nullsLast().op("text_ops")),
	index("v2_pricing_sku_meters_sku_idx").using("btree", table.skuId.asc().nullsLast().op("text_ops"), table.meterOrder.asc().nullsLast().op("text_ops"), table.meterKey.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.meterKey],
			foreignColumns: [v2MeterDefinitions.meterKey],
			name: "v2_pricing_sku_meters_meter_key_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.skuId],
			foreignColumns: [v2PricingSkus.skuId],
			name: "v2_pricing_sku_meters_sku_id_fkey"
		}).onDelete("cascade"),
	unique("v2_pricing_sku_meters_key").on(table.meterKey, table.skuId),
	check("v2_pricing_sku_meters_key_check", sql`(meter_key = lower(meter_key)) AND (meter_key ~ '^[a-z0-9][a-z0-9._:-]*$'::text)`),
	check("v2_pricing_sku_meters_order_check", sql`meter_order >= 0`),
	check("v2_pricing_sku_meters_price_check", sql`price_nanos >= (0)::numeric`),
	check("v2_pricing_sku_meters_unit_quantity_check", sql`unit_quantity > (0)::numeric`),
]);

export const v2PricingSkus = pgTable("v2_pricing_skus", {
	skuId: uuid("sku_id").defaultRandom().primaryKey().notNull(),
	providerModelId: text("provider_model_id").notNull(),
	skuCode: text("sku_code").notNull(),
	version: integer().default(1).notNull(),
	operation: text().default('inference').notNull(),
	status: text().default('active').notNull(),
	region: text(),
	displayName: text("display_name").notNull(),
	description: text(),
	currency: text().default('USD').notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	serviceTierSlug: text("service_tier_slug"),
	routeVariantId: uuid("route_variant_id"),
}, (table) => [
	index("v2_pricing_skus_active_idx").using("btree", table.providerModelId.asc().nullsLast().op("text_ops"), table.operation.asc().nullsLast().op("text_ops"), table.region.asc().nullsLast().op("text_ops")).where(sql`(status = 'active'::text)`),
	index("v2_pricing_skus_route_idx").using("btree", table.providerModelId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops"), table.effectiveFrom.desc().nullsFirst().op("text_ops")),
	index("v2_pricing_skus_route_variant_id_idx").using("btree", table.routeVariantId.asc().nullsLast().op("uuid_ops")).where(sql`(route_variant_id IS NOT NULL)`),
	index("v2_pricing_skus_service_tier_slug_idx").using("btree", table.serviceTierSlug.asc().nullsLast().op("text_ops")).where(sql`(service_tier_slug IS NOT NULL)`),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_pricing_skus_provider_model_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.routeVariantId],
			foreignColumns: [v2RouteVariants.variantId],
			name: "v2_pricing_skus_route_variant_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.serviceTierSlug],
			foreignColumns: [v2ServiceTiers.serviceTierSlug],
			name: "v2_pricing_skus_service_tier_fkey"
		}).onDelete("restrict"),
	unique("v2_pricing_skus_key").on(table.providerModelId, table.skuCode, table.version),
	check("v2_pricing_skus_code_check", sql`(sku_code = lower(sku_code)) AND (sku_code ~ '^[a-z0-9][a-z0-9._:-]*$'::text)`),
	check("v2_pricing_skus_status_check", sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])`),
	check("v2_pricing_skus_version_check", sql`version > 0`),
	check("v2_pricing_skus_window_check", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
]);

export const v2PrivateUsageDaily = pgTable("v2_private_usage_daily", {
	rollupId: uuid("rollup_id").defaultRandom().primaryKey().notNull(),
	usageDate: date("usage_date").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	appId: uuid("app_id"),
	modelSlug: text("model_slug").notNull(),
	providerModelId: text("provider_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successfulRequests: bigint("successful_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedRequests: bigint("failed_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rateLimitedRequests: bigint("rate_limited_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallCount: bigint("tool_call_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	structuredOutputAttempts: bigint("structured_output_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	structuredOutputSuccesses: bigint("structured_output_successes", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencyCount: bigint("latency_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSumMs: bigint("generation_sum_ms", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationCount: bigint("generation_count", { mode: "number" }).default(0).notNull(),
	throughputSum: numeric("throughput_sum", { precision: 30, scale:  12 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	throughputCount: bigint("throughput_count", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cloudflareColo: text("cloudflare_colo"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallRequests: bigint("tool_call_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallSuccesses: bigint("tool_call_successes", { mode: "number" }).default(0).notNull(),
	cachedInputTokens: numeric("cached_input_tokens", { precision: 30, scale:  12 }).default('0').notNull(),
	inputTokens: numeric("input_tokens", { precision: 30, scale:  12 }).default('0').notNull(),
	gatewayTotalSumMs: numeric("gateway_total_sum_ms", { precision: 30, scale:  3 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gatewayTotalCount: bigint("gateway_total_count", { mode: "number" }).default(0).notNull(),
	internalDispatchSumMs: numeric("internal_dispatch_sum_ms", { precision: 30, scale:  3 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	internalDispatchCount: bigint("internal_dispatch_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	upstreamAttempts: bigint("upstream_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedUpstreamAttempts: bigint("failed_upstream_attempts", { mode: "number" }).default(0).notNull(),
	costNanos: numeric("cost_nanos", { precision: 30, scale:  0 }).default('0').notNull(),
}, (table) => [
	index("v2_private_usage_daily_app_date_idx").using("btree", table.appId.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	uniqueIndex("v2_private_usage_daily_key").using("btree", sql`workspace_id`, sql`usage_date`, sql`COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid)`, sql`model_slug`, sql`COALESCE(provider_model_id, ''::text)`, sql`COALESCE(cloudflare_colo, ''::text)`),
	index("v2_private_usage_daily_model_date_idx").using("btree", table.modelSlug.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("text_ops")),
	index("v2_private_usage_daily_provider_model_id_idx").using("btree", table.providerModelId.asc().nullsLast().op("text_ops")).where(sql`(provider_model_id IS NOT NULL)`),
	index("v2_private_usage_daily_workspace_date_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.usageDate.desc().nullsFirst().op("date_ops")),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "v2_private_usage_daily_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_private_usage_daily_model_slug_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_private_usage_daily_provider_model_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "v2_private_usage_daily_workspace_id_fkey"
		}).onDelete("cascade"),
	check("v2_private_usage_daily_cloudflare_colo_check", sql`(cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)`),
	check("v2_private_usage_daily_counts_check", sql`(requests >= 0) AND (successful_requests >= 0) AND (failed_requests >= 0) AND (rate_limited_requests >= 0) AND (tool_call_count >= 0) AND (structured_output_attempts >= 0) AND (structured_output_successes >= 0) AND (latency_sum_ms >= 0) AND (latency_count >= 0) AND (generation_sum_ms >= 0) AND (generation_count >= 0) AND (throughput_sum >= (0)::numeric) AND (throughput_count >= 0)`),
	check("v2_private_usage_daily_observability_counts_check", sql`(tool_call_requests >= 0) AND (tool_call_successes >= 0) AND (tool_call_successes <= tool_call_requests) AND (cached_input_tokens >= (0)::numeric) AND (input_tokens >= (0)::numeric) AND (gateway_total_sum_ms >= (0)::numeric) AND (gateway_total_count >= 0) AND (internal_dispatch_sum_ms >= (0)::numeric) AND (internal_dispatch_count >= 0) AND (upstream_attempts >= 0) AND (failed_upstream_attempts >= 0) AND (failed_upstream_attempts <= upstream_attempts) AND (cost_nanos >= (0)::numeric)`),
]);

export const v2ProviderAuthProfiles = pgTable("v2_provider_auth_profiles", {
	authProfileId: uuid("auth_profile_id").defaultRandom().primaryKey().notNull(),
	providerSlug: text("provider_slug").notNull(),
	profileKey: text("profile_key").notNull(),
	authPrimitiveKey: text("auth_primitive_key").notNull(),
	secretReferenceKey: text("secret_reference_key").notNull(),
	config: jsonb().default({}).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.authPrimitiveKey],
			foreignColumns: [v2AdapterPrimitives.primitiveKey],
			name: "v2_provider_auth_profiles_auth_primitive_key_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_provider_auth_profiles_provider_slug_fkey"
		}).onDelete("cascade"),
	unique("v2_provider_auth_profiles_key").on(table.profileKey, table.providerSlug),
	unique("v2_provider_auth_profiles_provider_key").on(table.authProfileId, table.providerSlug),
	check("v2_provider_auth_profiles_config_check", sql`jsonb_typeof(config) = 'object'::text`),
	check("v2_provider_auth_profiles_status_check", sql`status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const v2ProviderCapabilityAdapters = pgTable("v2_provider_capability_adapters", {
	providerCapabilityAdapterId: uuid("provider_capability_adapter_id").defaultRandom().primaryKey().notNull(),
	providerSlug: text("provider_slug").notNull(),
	capabilityId: text("capability_id").notNull(),
	capabilityAdapterId: uuid("capability_adapter_id").notNull(),
	providerEndpointId: uuid("provider_endpoint_id").notNull(),
	config: jsonb().default({}).notNull(),
	status: text().default('draft').notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_provider_capability_adapters_lookup_idx").using("btree", table.providerSlug.asc().nullsLast().op("text_ops"), table.capabilityId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.capabilityId, table.capabilityAdapterId],
			foreignColumns: [v2CapabilityAdapters.capabilityAdapterId, v2CapabilityAdapters.capabilityId],
			name: "v2_provider_capability_adapte_capability_id_capability_ada_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerSlug, table.capabilityId, table.providerEndpointId],
			foreignColumns: [v2ProviderEndpoints.providerEndpointId, v2ProviderEndpoints.providerSlug, v2ProviderEndpoints.capabilityId],
			name: "v2_provider_capability_adapte_provider_slug_capability_id__fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_provider_capability_adapters_provider_slug_fkey"
		}).onDelete("cascade"),
	unique("v2_provider_capability_adapters_key").on(table.capabilityAdapterId, table.capabilityId, table.providerEndpointId, table.providerSlug),
	check("v2_provider_capability_adapters_config_check", sql`jsonb_typeof(config) = 'object'::text`),
	check("v2_provider_capability_adapters_status_check", sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])`),
	check("v2_provider_capability_adapters_window_check", sql`(effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from)`),
]);

export const v2ProviderCountryRestrictions = pgTable("v2_provider_country_restrictions", {
	restrictionId: uuid("restriction_id").defaultRandom().primaryKey().notNull(),
	providerSlug: text("provider_slug").notNull(),
	countryCode: text("country_code").notNull(),
	reason: text(),
	sourceUrl: text("source_url"),
	effectiveAt: timestamp("effective_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	enabled: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_provider_country_restrictions_lookup_idx").using("btree", table.providerSlug.asc().nullsLast().op("text_ops"), table.countryCode.asc().nullsLast().op("timestamptz_ops"), table.effectiveAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`enabled`),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_provider_country_restrictions_provider_slug_fkey"
		}).onDelete("cascade"),
	unique("v2_provider_country_restrictions_unique").on(table.countryCode, table.effectiveAt, table.providerSlug),
	check("v2_provider_country_restrictions_country_check", sql`country_code ~ '^[A-Z]{2}$'::text`),
	check("v2_provider_country_restrictions_window_check", sql`(expires_at IS NULL) OR (expires_at > effective_at)`),
]);

export const v2ProviderEndpoints = pgTable("v2_provider_endpoints", {
	providerEndpointId: uuid("provider_endpoint_id").defaultRandom().primaryKey().notNull(),
	providerSlug: text("provider_slug").notNull(),
	endpointKey: text("endpoint_key").notNull(),
	capabilityId: text("capability_id").notNull(),
	baseUrl: text("base_url").notNull(),
	pathTemplate: text("path_template").notNull(),
	apiVersion: text("api_version"),
	authProfileId: uuid("auth_profile_id"),
	regionCode: text("region_code"),
	serviceTierSlug: text("service_tier_slug"),
	timeoutMs: integer("timeout_ms").default(120000).notNull(),
	retryPolicy: jsonb("retry_policy").default({}).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_provider_endpoints_lookup_idx").using("btree", table.providerSlug.asc().nullsLast().op("text_ops"), table.capabilityId.asc().nullsLast().op("text_ops"), table.regionCode.asc().nullsLast().op("text_ops"), table.serviceTierSlug.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.providerSlug, table.authProfileId],
			foreignColumns: [v2ProviderAuthProfiles.authProfileId, v2ProviderAuthProfiles.providerSlug],
			name: "v2_provider_endpoints_provider_slug_auth_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_provider_endpoints_provider_slug_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.serviceTierSlug],
			foreignColumns: [v2ServiceTiers.serviceTierSlug],
			name: "v2_provider_endpoints_service_tier_slug_fkey"
		}).onDelete("restrict"),
	unique("v2_provider_endpoints_key").on(table.endpointKey, table.providerSlug),
	unique("v2_provider_endpoints_provider_key").on(table.providerEndpointId, table.providerSlug),
	unique("v2_provider_endpoints_capability_key").on(table.capabilityId, table.providerEndpointId, table.providerSlug),
	check("v2_provider_endpoints_retry_check", sql`jsonb_typeof(retry_policy) = 'object'::text`),
	check("v2_provider_endpoints_status_check", sql`status = ANY (ARRAY['active'::text, 'degraded'::text, 'deprecated'::text, 'disabled'::text])`),
	check("v2_provider_endpoints_timeout_check", sql`(timeout_ms > 0) AND (timeout_ms <= 900000)`),
]);

export const v2ProviderRegions = pgTable("v2_provider_regions", {
	providerRegionId: uuid("provider_region_id").defaultRandom().primaryKey().notNull(),
	providerSlug: text("provider_slug").notNull(),
	regionCode: text("region_code").notNull(),
	displayName: text("display_name"),
	executionSupported: boolean("execution_supported").default(true).notNull(),
	dataResidencySupported: boolean("data_residency_supported").default(false).notNull(),
	status: text().default('active').notNull(),
	routingEnabled: boolean("routing_enabled").default(true).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_provider_regions_lookup_idx").using("btree", table.regionCode.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("bool_ops"), table.routingEnabled.asc().nullsLast().op("text_ops"), table.providerSlug.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.providerSlug],
			foreignColumns: [v2Providers.providerSlug],
			name: "v2_provider_regions_provider_slug_fkey"
		}).onDelete("cascade"),
	unique("v2_provider_regions_key").on(table.providerSlug, table.regionCode),
	check("v2_provider_regions_region_check", sql`(region_code = lower(region_code)) AND (region_code ~ '^[a-z0-9][a-z0-9._-]*$'::text)`),
	check("v2_provider_regions_status_check", sql`status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const v2Providers = pgTable("v2_providers", {
	providerSlug: text("provider_slug").primaryKey().notNull(),
	labSlug: text("lab_slug"),
	name: text().notNull(),
	status: text().default('active').notNull(),
	routingEnabled: boolean("routing_enabled").default(false).notNull(),
	routable: boolean().default(false).notNull(),
	countryCode: text("country_code").default('xx').notNull(),
	baseUrl: text("base_url"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	providerFamilySlug: text("provider_family_slug"),
	offerScope: text("offer_scope").default('global').notNull(),
	offerLabel: text("offer_label"),
	residencyMode: text("residency_mode").default('unknown').notNull(),
	defaultExecutionRegions: text("default_execution_regions").array(),
	defaultDataRegions: text("default_data_regions").array(),
	zeroDataRetention: text("zero_data_retention").default('unknown').notNull(),
	promptTrainingPolicy: text("prompt_training_policy").default('unknown').notNull(),
	dataPolicyTier: text("data_policy_tier").default('unknown').notNull(),
	dataPolicyConfidence: text("data_policy_confidence").default('unknown').notNull(),
	dataPolicyContractMode: text("data_policy_contract_mode").default('none').notNull(),
	dataPolicyVariant: text("data_policy_variant").default('standard').notNull(),
	streamCancellationSupport: text("stream_cancellation_support").default('unknown').notNull(),
	streamCancellationStopsProviderBilling: boolean("stream_cancellation_stops_provider_billing"),
	streamCancellationUsageRecovery: text("stream_cancellation_usage_recovery").default('unknown').notNull(),
	streamCancellationEvidenceKind: text("stream_cancellation_evidence_kind").default('none').notNull(),
	streamCancellationSourceUrl: text("stream_cancellation_source_url"),
	streamCancellationVerifiedAt: timestamp("stream_cancellation_verified_at", { withTimezone: true, mode: 'string' }),
	dataRetentionDays: integer("data_retention_days"),
}, (table) => [
	index("v2_providers_lab_idx").using("btree", table.labSlug.asc().nullsLast().op("text_ops")),
	index("v2_providers_policy_variant_idx").using("btree", table.providerFamilySlug.asc().nullsLast().op("text_ops"), table.dataPolicyVariant.asc().nullsLast().op("text_ops"), table.offerScope.asc().nullsLast().op("text_ops")).where(sql`(status <> ALL (ARRAY['disabled'::text, 'deprecated'::text]))`),
	index("v2_providers_routing_idx").using("btree", table.status.asc().nullsLast().op("bool_ops"), table.routingEnabled.asc().nullsLast().op("text_ops"), table.routable.asc().nullsLast().op("text_ops")).where(sql`(status <> ALL (ARRAY['disabled'::text, 'deprecated'::text]))`),
	foreignKey({
			columns: [table.labSlug],
			foreignColumns: [v2Labs.labSlug],
			name: "v2_providers_lab_slug_fkey"
		}).onDelete("set null"),
	check("v2_providers_data_policy_confidence_check", sql`data_policy_confidence = ANY (ARRAY['unknown'::text, 'confirmed'::text, 'maybe'::text])`),
	check("v2_providers_data_policy_contract_mode_check", sql`data_policy_contract_mode = ANY (ARRAY['none'::text, 'customer_agreement'::text, 'enterprise_agreement'::text])`),
	check("v2_providers_data_policy_tier_check", sql`data_policy_tier = ANY (ARRAY['unknown'::text, 'private'::text, 'logs'::text, 'trains'::text])`),
	check("v2_providers_data_policy_variant_check", sql`data_policy_variant = ANY (ARRAY['standard'::text, 'zdr'::text])`),
	check("v2_providers_data_retention_days_check", sql`(data_retention_days IS NULL) OR (data_retention_days >= 0)`),
	check("v2_providers_offer_scope_check", sql`offer_scope = ANY (ARRAY['global'::text, 'regional'::text, 'specialized'::text])`),
	check("v2_providers_residency_mode_check", sql`residency_mode = ANY (ARRAY['unknown'::text, 'provider_managed'::text, 'customer_selectable'::text, 'account_selected'::text])`),
	check("v2_providers_slug_check", sql`(provider_slug = lower(provider_slug)) AND (provider_slug ~ '^[a-z0-9][a-z0-9._-]*$'::text)`),
	check("v2_providers_status_check", sql`status = ANY (ARRAY['active'::text, 'beta'::text, 'alpha'::text, 'not_ready'::text, 'deprecated'::text, 'disabled'::text, 'external'::text])`),
	check("v2_providers_stream_cancel_billing_check", sql`(stream_cancellation_stops_provider_billing IS DISTINCT FROM true) OR (stream_cancellation_support = 'supported'::text)`),
	check("v2_providers_stream_cancel_evidence_check", sql`stream_cancellation_evidence_kind = ANY (ARRAY['provider'::text, 'aggregator'::text, 'none'::text])`),
	check("v2_providers_stream_cancel_support_check", sql`stream_cancellation_support = ANY (ARRAY['supported'::text, 'unsupported'::text, 'unknown'::text])`),
	check("v2_providers_stream_cancel_usage_check", sql`stream_cancellation_usage_recovery = ANY (ARRAY['authoritative'::text, 'unknown'::text])`),
	check("v2_providers_zdr_variant_integrity_check", sql`(data_policy_variant <> 'zdr'::text) OR ((offer_scope = 'specialized'::text) AND (zero_data_retention = 'default'::text) AND (data_policy_tier = 'private'::text) AND (data_policy_confidence = 'confirmed'::text))`),
	check("v2_providers_zero_data_retention_check", sql`zero_data_retention = ANY (ARRAY['unknown'::text, 'unsupported'::text, 'optional'::text, 'default'::text])`),
]);

export const modelDiscoveryRuns = pgTable("model_discovery_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	trigger: text().notNull(),
	source: text().notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }),
	status: text().default('running').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	providersTotal: integer("providers_total").default(0).notNull(),
	providersSuccess: integer("providers_success").default(0).notNull(),
	providersSkipped: integer("providers_skipped").default(0).notNull(),
	providersError: integer("providers_error").default(0).notNull(),
	changesCount: integer("changes_count").default(0).notNull(),
	staleModelsDeleted: integer("stale_models_deleted").default(0).notNull(),
	summary: jsonb().default({}).notNull(),
	error: text(),
}, (table) => [
	index("model_discovery_runs_started_at_idx").using("btree", table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	check("model_discovery_runs_changes_count_check", sql`changes_count >= 0`),
	check("model_discovery_runs_providers_error_check", sql`providers_error >= 0`),
	check("model_discovery_runs_providers_skipped_check", sql`providers_skipped >= 0`),
	check("model_discovery_runs_providers_success_check", sql`providers_success >= 0`),
	check("model_discovery_runs_providers_total_check", sql`providers_total >= 0`),
	check("model_discovery_runs_stale_models_deleted_check", sql`stale_models_deleted >= 0`),
	check("model_discovery_runs_status_check", sql`status = ANY (ARRAY['running'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text])`),
	check("model_discovery_runs_trigger_check", sql`trigger = ANY (ARRAY['scheduled'::text, 'manual'::text])`),
]);

export const v2RouteVariants = pgTable("v2_route_variants", {
	variantId: uuid("variant_id").defaultRandom().primaryKey().notNull(),
	providerModelId: text("provider_model_id").notNull(),
	variantKey: text("variant_key").notNull(),
	providerRegionId: uuid("provider_region_id"),
	executionRegion: text("execution_region"),
	dataRegion: text("data_region"),
	serviceTierSlug: text("service_tier_slug").notNull(),
	status: text().default('active').notNull(),
	routingEnabled: boolean("routing_enabled").default(true).notNull(),
	endpointLabel: text("endpoint_label"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_route_variants_lookup_idx").using("btree", table.providerModelId.asc().nullsLast().op("text_ops"), table.serviceTierSlug.asc().nullsLast().op("text_ops"), table.executionRegion.asc().nullsLast().op("text_ops"), table.dataRegion.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops"), table.routingEnabled.asc().nullsLast().op("bool_ops")),
	index("v2_route_variants_provider_region_id_idx").using("btree", table.providerRegionId.asc().nullsLast().op("uuid_ops")).where(sql`(provider_region_id IS NOT NULL)`),
	index("v2_route_variants_region_idx").using("btree", table.executionRegion.asc().nullsLast().op("text_ops"), table.dataRegion.asc().nullsLast().op("text_ops"), table.serviceTierSlug.asc().nullsLast().op("text_ops")).where(sql`((status = ANY (ARRAY['active'::text, 'degraded'::text])) AND (routing_enabled = true))`),
	index("v2_route_variants_service_tier_slug_idx").using("btree", table.serviceTierSlug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_route_variants_provider_model_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.providerRegionId],
			foreignColumns: [v2ProviderRegions.providerRegionId],
			name: "v2_route_variants_provider_region_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.serviceTierSlug],
			foreignColumns: [v2ServiceTiers.serviceTierSlug],
			name: "v2_route_variants_service_tier_slug_fkey"
		}).onDelete("restrict"),
	unique("v2_route_variants_key").on(table.providerModelId, table.variantKey),
	check("v2_route_variants_key_check", sql`(variant_key = lower(variant_key)) AND (variant_key ~ '^[a-z0-9][a-z0-9._:-]*$'::text)`),
	check("v2_route_variants_status_check", sql`status = ANY (ARRAY['active'::text, 'degraded'::text, 'disabled'::text, 'retired'::text])`),
]);

export const v2ServiceTiers = pgTable("v2_service_tiers", {
	serviceTierSlug: text("service_tier_slug").primaryKey().notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	status: text().default('active').notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("v2_service_tiers_slug_check", sql`(service_tier_slug = lower(service_tier_slug)) AND (service_tier_slug ~ '^[a-z0-9][a-z0-9._:-]*$'::text)`),
	check("v2_service_tiers_status_check", sql`status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text])`),
]);

export const v2SubscriptionPlans = pgTable("v2_subscription_plans", {
	planUuid: uuid("plan_uuid").primaryKey().notNull(),
	planId: text("plan_id").notNull(),
	name: text().notNull(),
	labSlug: text("lab_slug"),
	description: text(),
	frequency: text(),
	price: numeric(),
	currency: text(),
	link: text(),
	otherInfo: jsonb("other_info").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

export const wallets = pgTable("wallets", {
	workspaceId: uuid("workspace_id").primaryKey().notNull(),
	stripeCustomerId: text("stripe_customer_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	balanceNanos: bigint("balance_nanos", { mode: "number" }).default(sql`'0'`).notNull(),
	autoTopUpEnabled: boolean("auto_top_up_enabled").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lowBalanceThreshold: bigint("low_balance_threshold", { mode: "number" }).default(sql`'0'`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	autoTopUpAmount: bigint("auto_top_up_amount", { mode: "number" }).default(sql`'0'`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	autoTopUpAccountId: text("auto_top_up_account_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reservedNanos: bigint("reserved_nanos", { mode: "number" }).default(0).notNull(),
}, (table) => [
	index("wallets_stripe_customer_id_idx").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "wallets_workspace_id_fkey"
		}).onDelete("cascade"),
]);

export const webCacheGenerations = pgTable("web_cache_generations", {
	scope: text().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generation: bigint({ mode: "number" }).default(1).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedBy: uuid("updated_by"),
}, (table) => [
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.userId],
			name: "web_cache_generations_updated_by_fkey"
		}).onDelete("set null"),
	check("web_cache_generations_generation_check", sql`generation > 0`),
	check("web_cache_generations_scope_check", sql`scope ~ '^[a-z0-9-]{1,64}$'::text`),
]);

export const webCachePurgeEvents = pgTable("web_cache_purge_events", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "web_cache_purge_events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	scope: text().notNull(),
	targetId: text("target_id"),
	tags: text().array().notNull(),
	browserGenerationBumped: boolean("browser_generation_bumped").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generation: bigint({ mode: "number" }),
	actorUserId: uuid("actor_user_id"),
	purgeSucceeded: boolean("purge_succeeded").notNull(),
	purgeError: jsonb("purge_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("web_cache_purge_events_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.userId],
			name: "web_cache_purge_events_actor_user_id_fkey"
		}).onDelete("set null"),
	check("web_cache_purge_events_scope_check", sql`scope ~ '^[a-z0-9-]{1,64}$'::text`),
	check("web_cache_purge_events_tags_check", sql`(cardinality(tags) >= 1) AND (cardinality(tags) <= 100)`),
	check("web_cache_purge_events_target_id_check", sql`(target_id IS NULL) OR (length(target_id) <= 200)`),
]);

export const workspaceBroadcastDestinations = pgTable("workspace_broadcast_destinations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	enabled: boolean().default(false).notNull(),
	destinationId: text("destination_id").notNull(),
	name: text().notNull(),
	destinationConfig: jsonb("destination_config").default({}).notNull(),
	privacyExcludePromptsAndOutputs: boolean("privacy_exclude_prompts_and_outputs").default(false).notNull(),
	samplingRate: numeric("sampling_rate", { precision: 6, scale:  5 }).default('1.0').notNull(),
	groupJoinOperator: text("group_join_operator").default('or').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	destinationConfigCiphertext: text("destination_config_ciphertext"),
	destinationConfigIv: text("destination_config_iv"),
	destinationConfigKeyVersion: text("destination_config_key_version"),
	includeGenerationMetadata: boolean("include_generation_metadata").default(true).notNull(),
	includeCostMetadata: boolean("include_cost_metadata").default(true).notNull(),
	includeIdentityMetadata: boolean("include_identity_metadata").default(true).notNull(),
	includeRequestContext: boolean("include_request_context").default(true).notNull(),
}, (table) => [
	index("workspace_broadcast_destinations_workspace_enabled_idx").using("btree", table.workspaceId.asc().nullsLast().op("bool_ops"), table.enabled.asc().nullsLast().op("bool_ops")),
	index("workspace_broadcast_destinations_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_broadcast_destinations_workspace_id_fkey"
		}).onDelete("cascade"),
	check("workspace_broadcast_destinations_destination_id_check", sql`destination_id = ANY (ARRAY['arize'::text, 'braintrust'::text, 'clickhouse'::text, 'comet_opik'::text, 'datadog'::text, 'grafana_cloud'::text, 'langfuse'::text, 'langsmith'::text, 'new_relic'::text, 'otel_collector'::text, 'posthog'::text, 's3'::text, 'sentry'::text, 'snowflake'::text, 'wandb_weave'::text, 'webhook'::text])`),
	check("workspace_broadcast_destinations_group_join_operator_check", sql`group_join_operator = ANY (ARRAY['and'::text, 'or'::text])`),
	check("workspace_broadcast_destinations_sampling_rate_check", sql`(sampling_rate >= (0)::numeric) AND (sampling_rate <= (1)::numeric)`),
]);

export const workspaceClassifiers = pgTable("workspace_classifiers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	kind: text().default('custom').notNull(),
	instructions: text().notNull(),
	categories: jsonb().notNull(),
	model: text().default('gpt-5-mini').notNull(),
	serviceTier: text("service_tier").default('flex').notNull(),
	sampleRateBps: integer("sample_rate_bps").default(10000).notNull(),
	enabled: boolean().default(true).notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("workspace_classifiers_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")).where(sql`(created_by IS NOT NULL)`),
	index("workspace_classifiers_workspace_enabled_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.enabled.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("bool_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.userId],
			name: "workspace_classifiers_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_classifiers_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("workspace_classifiers_workspace_id_slug_key").on(table.slug, table.workspaceId),
	check("workspace_classifiers_categories_object_check", sql`jsonb_typeof(categories) = 'object'::text`),
	check("workspace_classifiers_kind_check", sql`kind = ANY (ARRAY['phaseo_task'::text, 'custom'::text])`),
	check("workspace_classifiers_sample_rate_bps_check", sql`(sample_rate_bps >= 0) AND (sample_rate_bps <= 10000)`),
	check("workspace_classifiers_service_tier_check", sql`service_tier = ANY (ARRAY['standard'::text, 'flex'::text])`),
]);

export const workspaceGuardrails = pgTable("workspace_guardrails", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	enabled: boolean().default(true).notNull(),
	name: text().notNull(),
	description: text(),
	privacyEnablePaidMayTrain: boolean("privacy_enable_paid_may_train").default(true).notNull(),
	privacyEnableFreeMayTrain: boolean("privacy_enable_free_may_train").default(true).notNull(),
	privacyEnableFreeMayPublishPrompts: boolean("privacy_enable_free_may_publish_prompts").default(true).notNull(),
	privacyEnableInputOutputLogging: boolean("privacy_enable_input_output_logging").default(true).notNull(),
	privacyZdrOnly: boolean("privacy_zdr_only").default(false).notNull(),
	providerRestrictionMode: text("provider_restriction_mode").default('none').notNull(),
	providerRestrictionProviderIds: text("provider_restriction_provider_ids").array().default([""]).notNull(),
	providerRestrictionEnforceAllowed: boolean("provider_restriction_enforce_allowed").default(false).notNull(),
	allowedApiModelIds: text("allowed_api_model_ids").array().default([""]).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dailyLimitRequests: bigint("daily_limit_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	weeklyLimitRequests: bigint("weekly_limit_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyLimitRequests: bigint("monthly_limit_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dailyLimitCostNanos: bigint("daily_limit_cost_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	weeklyLimitCostNanos: bigint("weekly_limit_cost_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyLimitCostNanos: bigint("monthly_limit_cost_nanos", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	promptInjectionEnabled: boolean("prompt_injection_enabled").default(false).notNull(),
	promptInjectionAction: text("prompt_injection_action").default('flag').notNull(),
	sensitiveInfoEnabled: boolean("sensitive_info_enabled").default(false).notNull(),
	sensitiveInfoDefaultAction: text("sensitive_info_default_action").default('redact').notNull(),
	sensitiveInfoRules: jsonb("sensitive_info_rules").default([]).notNull(),
	modelRestrictionMode: text("model_restriction_mode").default('none').notNull(),
}, (table) => [
	index("workspace_guardrails_workspace_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_guardrails_workspace_id_fkey"
		}).onDelete("cascade"),
	check("workspace_guardrails_model_restriction_mode_check", sql`model_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])`),
	check("workspace_guardrails_prompt_injection_action_check", sql`prompt_injection_action = ANY (ARRAY['flag'::text, 'redact'::text, 'block'::text])`),
	check("workspace_guardrails_provider_restriction_mode_check", sql`provider_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])`),
	check("workspace_guardrails_sensitive_info_default_action_check", sql`sensitive_info_default_action = ANY (ARRAY['flag'::text, 'redact'::text, 'block'::text])`),
]);

export const workspaceInvites = pgTable("workspace_invites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	creatorUserId: uuid("creator_user_id").notNull(),
	role: workspaceRole().default('member').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '7 days'::interval)`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	maxUses: integer("max_uses"),
	usesCount: integer("uses_count").default(0).notNull(),
	tokenEncrypted: text("token_encrypted").default('').notNull(),
	tokenPreview: text("token_preview"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tokenFingerprint: text("token_fingerprint"),
	keyVersion: smallint("key_version").default(1).notNull(),
}, (table) => [
	uniqueIndex("uq_workspace_invites_token_fingerprint").using("btree", table.tokenFingerprint.asc().nullsLast().op("text_ops")),
	index("workspace_invites_active_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.expiresAt.asc().nullsLast().op("uuid_ops")),
	index("workspace_invites_preview_idx").using("btree", table.tokenPreview.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.creatorUserId],
			foreignColumns: [users.userId],
			name: "workspace_invites_inviter_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_invites_workspace_id_fkey"
		}).onDelete("cascade"),
	check("workspace_invites_preview_len_ck", sql`(token_preview IS NULL) OR ((char_length(token_preview) >= 1) AND (char_length(token_preview) <= 12))`),
	check("workspace_invites_uses_ck", sql`(max_uses IS NULL) OR (uses_count <= max_uses)`),
]);

export const workspaceJoinRequests = pgTable("workspace_join_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	inviteId: uuid("invite_id"),
	requesterUserId: uuid("requester_user_id").notNull(),
	status: joinRequestStatus().default('pending').notNull(),
	decidedBy: uuid("decided_by"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("workspace_join_requests_pending_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")).where(sql`(status = 'pending'::join_request_status)`),
	uniqueIndex("workspace_join_requests_pending_unique").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.requesterUserId.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'pending'::join_request_status)`),
	index("workspace_join_requests_requester_idx").using("btree", table.requesterUserId.asc().nullsLast().op("uuid_ops")),
	index("workspace_join_requests_workspace_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [users.userId],
			name: "workspace_join_requests_decided_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.inviteId],
			foreignColumns: [workspaceInvites.id],
			name: "workspace_join_requests_invite_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.requesterUserId],
			foreignColumns: [users.userId],
			name: "workspace_join_requests_requester_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_join_requests_workspace_id_fkey"
		}).onDelete("cascade"),
]);

export const ssoProvider = pgTable("ssoProvider", {
	id: text().primaryKey().notNull(),
	issuer: text().notNull(),
	oidcConfig: text(),
	samlConfig: text(),
	userId: text(),
	providerId: text().notNull(),
	organizationId: text(),
	domain: text().notNull(),
}, (table) => [
	index("ssoProvider_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "ssoProvider_userId_fkey"
		}).onDelete("cascade"),
	unique("ssoProvider_providerId_key").on(table.providerId),
]);

export const v2CreditLedger = pgTable("v2_credit_ledger", {
	entryId: uuid("entry_id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	eventTime: timestamp("event_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	entryType: text("entry_type").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountNanos: bigint("amount_nanos", { mode: "number" }).notNull(),
	currency: text().default('USD').notNull(),
	sourceType: text("source_type"),
	sourceId: text("source_id"),
	idempotencyKey: text("idempotency_key").notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("v2_credit_ledger_idempotency_key").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.idempotencyKey.asc().nullsLast().op("uuid_ops")),
	index("v2_credit_ledger_source_idx").using("btree", table.sourceType.asc().nullsLast().op("text_ops"), table.sourceId.asc().nullsLast().op("text_ops")).where(sql`(source_type IS NOT NULL)`),
	index("v2_credit_ledger_workspace_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.eventTime.desc().nullsFirst().op("timestamptz_ops"), table.entryId.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "v2_credit_ledger_workspace_id_fkey"
		}).onDelete("cascade"),
	check("v2_credit_ledger_amount_check", sql`amount_nanos <> 0`),
	check("v2_credit_ledger_idempotency_check", sql`length(TRIM(BOTH FROM idempotency_key)) > 0`),
	check("v2_credit_ledger_source_check", sql`(source_type IS NULL) = (source_id IS NULL)`),
	check("v2_credit_ledger_type_check", sql`entry_type = ANY (ARRAY['payment'::text, 'grant'::text, 'refund'::text, 'charge'::text, 'reservation_capture'::text, 'reservation_release'::text, 'adjustment'::text, 'expiration'::text])`),
]);

export const v2PublicUsageDaily = pgTable("v2_public_usage_daily", {
	rollupId: uuid("rollup_id").defaultRandom().primaryKey().notNull(),
	usageDate: date("usage_date").notNull(),
	appId: uuid("app_id"),
	modelSlug: text("model_slug").notNull(),
	providerModelId: text("provider_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successfulRequests: bigint("successful_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedRequests: bigint("failed_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rateLimitedRequests: bigint("rate_limited_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallCount: bigint("tool_call_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	structuredOutputAttempts: bigint("structured_output_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	structuredOutputSuccesses: bigint("structured_output_successes", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencyCount: bigint("latency_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSumMs: bigint("generation_sum_ms", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationCount: bigint("generation_count", { mode: "number" }).default(0).notNull(),
	throughputSum: numeric("throughput_sum", { precision: 30, scale:  12 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	throughputCount: bigint("throughput_count", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cloudflareColo: text("cloudflare_colo"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallRequests: bigint("tool_call_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallSuccesses: bigint("tool_call_successes", { mode: "number" }).default(0).notNull(),
	cachedInputTokens: numeric("cached_input_tokens", { precision: 30, scale:  12 }).default('0').notNull(),
	inputTokens: numeric("input_tokens", { precision: 30, scale:  12 }).default('0').notNull(),
	gatewayTotalSumMs: numeric("gateway_total_sum_ms", { precision: 30, scale:  3 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gatewayTotalCount: bigint("gateway_total_count", { mode: "number" }).default(0).notNull(),
	internalDispatchSumMs: numeric("internal_dispatch_sum_ms", { precision: 30, scale:  3 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	internalDispatchCount: bigint("internal_dispatch_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	upstreamAttempts: bigint("upstream_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedUpstreamAttempts: bigint("failed_upstream_attempts", { mode: "number" }).default(0).notNull(),
	costNanos: numeric("cost_nanos", { precision: 30, scale:  0 }).default('0').notNull(),
}, (table) => [
	index("v2_public_usage_daily_app_date_idx").using("btree", table.appId.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("date_ops")).where(sql`(app_id IS NOT NULL)`),
	uniqueIndex("v2_public_usage_daily_key").using("btree", sql`usage_date`, sql`COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid)`, sql`model_slug`, sql`COALESCE(provider_model_id, ''::text)`, sql`COALESCE(cloudflare_colo, ''::text)`),
	index("v2_public_usage_daily_model_colo_date_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops"), table.cloudflareColo.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("date_ops")).where(sql`(cloudflare_colo IS NOT NULL)`),
	index("v2_public_usage_daily_model_date_idx").using("btree", table.modelSlug.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("text_ops")),
	index("v2_public_usage_daily_provider_date_idx").using("btree", table.providerModelId.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("date_ops")).where(sql`(provider_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "v2_public_usage_daily_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_public_usage_daily_model_slug_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_public_usage_daily_provider_model_id_fkey"
		}).onDelete("set null"),
	check("v2_public_usage_daily_cloudflare_colo_check", sql`(cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)`),
	check("v2_public_usage_daily_cost_check", sql`cost_nanos >= (0)::numeric`),
	check("v2_public_usage_daily_counts_check", sql`(requests >= 0) AND (successful_requests >= 0) AND (failed_requests >= 0) AND (rate_limited_requests >= 0) AND (tool_call_count >= 0) AND (structured_output_attempts >= 0) AND (structured_output_successes >= 0) AND (latency_sum_ms >= 0) AND (latency_count >= 0) AND (generation_sum_ms >= 0) AND (generation_count >= 0) AND (throughput_sum >= (0)::numeric) AND (throughput_count >= 0)`),
	check("v2_public_usage_daily_observability_counts_check", sql`(tool_call_requests >= 0) AND (tool_call_successes >= 0) AND (tool_call_successes <= tool_call_requests) AND (cached_input_tokens >= (0)::numeric) AND (input_tokens >= (0)::numeric) AND (gateway_total_sum_ms >= (0)::numeric) AND (gateway_total_count >= 0) AND (internal_dispatch_sum_ms >= (0)::numeric) AND (internal_dispatch_count >= 0) AND (upstream_attempts >= 0) AND (failed_upstream_attempts >= 0) AND (failed_upstream_attempts <= upstream_attempts)`),
]);

export const v2PublicUsageHourly = pgTable("v2_public_usage_hourly", {
	rollupId: uuid("rollup_id").defaultRandom().primaryKey().notNull(),
	bucketStart: timestamp("bucket_start", { withTimezone: true, mode: 'string' }).notNull(),
	appId: uuid("app_id"),
	modelSlug: text("model_slug").notNull(),
	providerModelId: text("provider_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successfulRequests: bigint("successful_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedRequests: bigint("failed_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rateLimitedRequests: bigint("rate_limited_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallCount: bigint("tool_call_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	structuredOutputAttempts: bigint("structured_output_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	structuredOutputSuccesses: bigint("structured_output_successes", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencyCount: bigint("latency_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSumMs: bigint("generation_sum_ms", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationCount: bigint("generation_count", { mode: "number" }).default(0).notNull(),
	throughputSum: numeric("throughput_sum", { precision: 30, scale:  12 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	throughputCount: bigint("throughput_count", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cloudflareColo: text("cloudflare_colo"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallRequests: bigint("tool_call_requests", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	toolCallSuccesses: bigint("tool_call_successes", { mode: "number" }).default(0).notNull(),
	cachedInputTokens: numeric("cached_input_tokens", { precision: 30, scale:  12 }).default('0').notNull(),
	inputTokens: numeric("input_tokens", { precision: 30, scale:  12 }).default('0').notNull(),
	gatewayTotalSumMs: numeric("gateway_total_sum_ms", { precision: 30, scale:  3 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gatewayTotalCount: bigint("gateway_total_count", { mode: "number" }).default(0).notNull(),
	internalDispatchSumMs: numeric("internal_dispatch_sum_ms", { precision: 30, scale:  3 }).default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	internalDispatchCount: bigint("internal_dispatch_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	upstreamAttempts: bigint("upstream_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedUpstreamAttempts: bigint("failed_upstream_attempts", { mode: "number" }).default(0).notNull(),
	costNanos: numeric("cost_nanos", { precision: 30, scale:  0 }).default('0').notNull(),
}, (table) => [
	index("v2_public_usage_hourly_app_id_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	uniqueIndex("v2_public_usage_hourly_key").using("btree", sql`bucket_start`, sql`COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid)`, sql`model_slug`, sql`COALESCE(provider_model_id, ''::text)`, sql`COALESCE(cloudflare_colo, ''::text)`),
	index("v2_public_usage_hourly_model_bucket_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops"), table.bucketStart.desc().nullsFirst().op("text_ops")),
	index("v2_public_usage_hourly_model_colo_bucket_idx").using("btree", table.modelSlug.asc().nullsLast().op("timestamptz_ops"), table.cloudflareColo.asc().nullsLast().op("timestamptz_ops"), table.bucketStart.desc().nullsFirst().op("timestamptz_ops")).where(sql`(cloudflare_colo IS NOT NULL)`),
	index("v2_public_usage_hourly_provider_bucket_idx").using("btree", table.providerModelId.asc().nullsLast().op("text_ops"), table.bucketStart.desc().nullsFirst().op("text_ops")).where(sql`(provider_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "v2_public_usage_hourly_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_public_usage_hourly_model_slug_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_public_usage_hourly_provider_model_id_fkey"
		}).onDelete("set null"),
	check("v2_public_usage_hourly_cloudflare_colo_check", sql`(cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)`),
	check("v2_public_usage_hourly_cost_check", sql`cost_nanos >= (0)::numeric`),
	check("v2_public_usage_hourly_counts_check", sql`(requests >= 0) AND (successful_requests >= 0) AND (failed_requests >= 0) AND (rate_limited_requests >= 0) AND (tool_call_count >= 0) AND (structured_output_attempts >= 0) AND (structured_output_successes >= 0) AND (latency_sum_ms >= 0) AND (latency_count >= 0) AND (generation_sum_ms >= 0) AND (generation_count >= 0) AND (throughput_sum >= (0)::numeric) AND (throughput_count >= 0)`),
	check("v2_public_usage_hourly_observability_counts_check", sql`(tool_call_requests >= 0) AND (tool_call_successes >= 0) AND (tool_call_successes <= tool_call_requests) AND (cached_input_tokens >= (0)::numeric) AND (input_tokens >= (0)::numeric) AND (gateway_total_sum_ms >= (0)::numeric) AND (gateway_total_count >= 0) AND (internal_dispatch_sum_ms >= (0)::numeric) AND (internal_dispatch_count >= 0) AND (upstream_attempts >= 0) AND (failed_upstream_attempts >= 0) AND (failed_upstream_attempts <= upstream_attempts)`),
]);

export const v2RequestArtifacts = pgTable("v2_request_artifacts", {
	artifactId: uuid("artifact_id").defaultRandom().primaryKey().notNull(),
	requestEventId: uuid("request_event_id").notNull(),
	attemptId: uuid("attempt_id"),
	artifactKind: text("artifact_kind").notNull(),
	r2Key: text("r2_key").notNull(),
	sha256: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	byteSize: bigint("byte_size", { mode: "number" }),
	contentType: text("content_type"),
	redacted: boolean().default(true).notNull(),
	retentionUntil: timestamp("retention_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("v2_request_artifacts_attempt_kind_key").using("btree", table.attemptId.asc().nullsLast().op("text_ops"), table.artifactKind.asc().nullsLast().op("text_ops")).where(sql`(attempt_id IS NOT NULL)`),
	index("v2_request_artifacts_request_idx").using("btree", table.requestEventId.asc().nullsLast().op("uuid_ops"), table.artifactKind.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("v2_request_artifacts_request_kind_key").using("btree", table.requestEventId.asc().nullsLast().op("text_ops"), table.artifactKind.asc().nullsLast().op("uuid_ops")).where(sql`(attempt_id IS NULL)`),
	index("v2_request_artifacts_retention_idx").using("btree", table.retentionUntil.asc().nullsLast().op("timestamptz_ops")).where(sql`(retention_until IS NOT NULL)`),
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [v2RequestAttempts.attemptId],
			name: "v2_request_artifacts_attempt_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.requestEventId],
			foreignColumns: [v2RequestFacts.requestEventId],
			name: "v2_request_artifacts_request_event_id_fkey"
		}).onDelete("cascade"),
	check("v2_request_artifacts_key_check", sql`(length(TRIM(BOTH FROM r2_key)) > 0) AND (r2_key !~* '^https?://'::text)`),
	check("v2_request_artifacts_kind_check", sql`artifact_kind = ANY (ARRAY['request_body'::text, 'response_body'::text, 'upstream_request'::text, 'upstream_response'::text, 'tool_io'::text])`),
	check("v2_request_artifacts_sha_check", sql`(sha256 IS NULL) OR (sha256 ~ '^[a-f0-9]{64}$'::text)`),
	check("v2_request_artifacts_size_check", sql`(byte_size IS NULL) OR (byte_size >= 0)`),
]);

export const v2RequestAttempts = pgTable("v2_request_attempts", {
	attemptId: uuid("attempt_id").defaultRandom().primaryKey().notNull(),
	requestEventId: uuid("request_event_id").notNull(),
	attemptNumber: smallint("attempt_number").notNull(),
	providerModelId: text("provider_model_id"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	failureClass: text("failure_class"),
	upstreamResponseId: text("upstream_response_id"),
	latencyMs: integer("latency_ms"),
	safeMetadata: jsonb("safe_metadata").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cloudflareColo: text("cloudflare_colo"),
}, (table) => [
	index("v2_request_attempts_request_idx").using("btree", table.requestEventId.asc().nullsLast().op("uuid_ops"), table.attemptNumber.asc().nullsLast().op("uuid_ops")),
	index("v2_request_attempts_route_time_idx").using("btree", table.providerModelId.asc().nullsLast().op("timestamptz_ops"), table.startedAt.desc().nullsFirst().op("text_ops")).where(sql`(provider_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_request_attempts_provider_model_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.requestEventId],
			foreignColumns: [v2RequestFacts.requestEventId],
			name: "v2_request_attempts_request_event_id_fkey"
		}).onDelete("cascade"),
	unique("v2_request_attempts_key").on(table.attemptNumber, table.requestEventId),
	check("v2_request_attempts_cloudflare_colo_check", sql`(cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)`),
	check("v2_request_attempts_latency_check", sql`(latency_ms IS NULL) OR (latency_ms >= 0)`),
	check("v2_request_attempts_number_check", sql`attempt_number > 0`),
	check("v2_request_attempts_status_code_check", sql`(status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))`),
	check("v2_request_attempts_window_check", sql`(completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at)`),
]);

export const v2RequestFacts = pgTable("v2_request_facts", {
	requestEventId: uuid("request_event_id").defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appId: uuid("app_id"),
	keyId: uuid("key_id"),
	endpoint: text().notNull(),
	requestedModelInput: text("requested_model_input").notNull(),
	requestedModelSlug: text("requested_model_slug"),
	routedModelSlug: text("routed_model_slug"),
	providerModelId: text("provider_model_id"),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	stopReason: text("stop_reason"),
	toolCallCount: integer("tool_call_count").default(0).notNull(),
	structuredOutputAttempted: boolean("structured_output_attempted").default(false).notNull(),
	structuredOutputSucceeded: boolean("structured_output_succeeded").default(false).notNull(),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	latencyMs: integer("latency_ms"),
	timeToFirstTokenMs: integer("time_to_first_token_ms"),
	generationMs: integer("generation_ms"),
	queueMs: integer("queue_ms"),
	upstreamLatencyMs: integer("upstream_latency_ms"),
	upstreamAttemptCount: smallint("upstream_attempt_count").default(0).notNull(),
	throughput: numeric({ precision: 30, scale:  12 }),
	userAgent: text("user_agent"),
	sdkName: text("sdk_name"),
	sdkVersion: text("sdk_version"),
	clientVersion: text("client_version"),
	region: text(),
	safeMetadata: jsonb("safe_metadata").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cloudflareColo: text("cloudflare_colo"),
	internalDispatchMs: numeric("internal_dispatch_ms", { precision: 12, scale:  3 }),
	gatewayTotalMs: numeric("gateway_total_ms", { precision: 12, scale:  3 }),
	sessionId: text("session_id"),
	endUserId: text("end_user_id"),
	authMethod: text("auth_method"),
	nativeResponseId: text("native_response_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	toolCallSucceeded: boolean("tool_call_succeeded"),
	gatewayRequestId: uuid("gateway_request_id").notNull(),
	gatewayRequestCreatedAt: timestamp("gateway_request_created_at", { withTimezone: true, mode: 'string' }).notNull(),
	edgeCountry: text("edge_country"),
	edgeContinent: text("edge_continent"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((safe_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((safe_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((safe_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((safe_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((safe_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("v2_request_facts_app_time_idx").using("btree", table.appId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(app_id IS NOT NULL)`),
	index("v2_request_facts_country_time_idx").using("btree", table.edgeCountry.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")).where(sql`(edge_country IS NOT NULL)`),
	uniqueIndex("v2_request_facts_gateway_request_key").using("btree", table.gatewayRequestId.asc().nullsLast().op("timestamptz_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("timestamptz_ops")),
	index("v2_request_facts_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("v2_request_facts_model_colo_time_idx").using("btree", table.requestedModelSlug.asc().nullsLast().op("timestamptz_ops"), table.cloudflareColo.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")).where(sql`(cloudflare_colo IS NOT NULL)`),
	index("v2_request_facts_model_stream_context_time_idx").using("btree", sql`COALESCE(routed_model_slug, requested_model_slug)`, sql`stream`, sql`occurred_at`),
	index("v2_request_facts_model_time_idx").using("btree", table.requestedModelSlug.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")),
	index("v2_request_facts_occurred_brin_idx").using("brin", table.occurredAt.asc().nullsLast().op("timestamptz_minmax_ops")),
	index("v2_request_facts_provider_route_time_idx").using("btree", table.providerModelId.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")),
	index("v2_request_facts_routed_colo_time_idx").using("btree", table.routedModelSlug.asc().nullsLast().op("timestamptz_ops"), table.cloudflareColo.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")).where(sql`(cloudflare_colo IS NOT NULL)`),
	index("v2_request_facts_routed_model_time_idx").using("btree", table.routedModelSlug.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")),
	index("v2_request_facts_workspace_client_source_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.clientSourceId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("v2_request_facts_workspace_country_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.edgeCountry.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(edge_country IS NOT NULL)`),
	index("v2_request_facts_workspace_end_user_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.endUserId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("v2_request_facts_workspace_provider_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.providerModelId.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider_model_id IS NOT NULL)`),
	index("v2_request_facts_workspace_session_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.sessionId.asc().nullsLast().op("uuid_ops"), table.occurredAt.desc().nullsFirst().op("uuid_ops")).where(sql`(session_id IS NOT NULL)`),
	index("v2_request_facts_workspace_status_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.success.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("uuid_ops")),
	index("v2_request_facts_workspace_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.occurredAt.desc().nullsFirst().op("timestamptz_ops"), table.requestEventId.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "v2_request_facts_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequests202603.id, gatewayRequests202603.createdAt],
			name: "v2_request_facts_gateway_request_fkey_1"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequests202604.id, gatewayRequests202604.createdAt],
			name: "v2_request_facts_gateway_request_fkey_2"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequests202605.id, gatewayRequests202605.createdAt],
			name: "v2_request_facts_gateway_request_fkey_3"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequests202606.id, gatewayRequests202606.createdAt],
			name: "v2_request_facts_gateway_request_fkey_4"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequests202607.id, gatewayRequests202607.createdAt],
			name: "v2_request_facts_gateway_request_fkey_5"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequests202608.id, gatewayRequests202608.createdAt],
			name: "v2_request_facts_gateway_request_fkey_6"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequests202609.id, gatewayRequests202609.createdAt],
			name: "v2_request_facts_gateway_request_fkey_7"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gatewayRequestId, table.gatewayRequestCreatedAt],
			foreignColumns: [gatewayRequestsDefault.id, gatewayRequestsDefault.createdAt],
			name: "v2_request_facts_gateway_request_fkey_8"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "v2_request_facts_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_request_facts_provider_model_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.requestedModelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_request_facts_requested_model_slug_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.routedModelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_request_facts_routed_model_slug_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "v2_request_facts_workspace_id_fkey"
		}).onDelete("cascade"),
	unique("v2_request_facts_request_key").on(table.requestId, table.workspaceId),
	check("v2_request_facts_attempt_count_check", sql`upstream_attempt_count >= 0`),
	check("v2_request_facts_auth_method_check", sql`(auth_method IS NULL) OR (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text]))`),
	check("v2_request_facts_client_source_detection_check", sql`(client_source_detection IS NULL) OR (client_source_detection = ANY (ARRAY['declared'::text, 'user_agent'::text, 'unknown'::text]))`),
	check("v2_request_facts_client_source_kind_check", sql`(client_source_kind IS NULL) OR (client_source_kind = ANY (ARRAY['sdk'::text, 'agent_sdk'::text, 'coding_agent'::text, 'http_client'::text, 'app'::text, 'api'::text, 'unknown'::text]))`),
	check("v2_request_facts_cloudflare_colo_check", sql`(cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)`),
	check("v2_request_facts_cost_check", sql`(cost_nanos IS NULL) OR (cost_nanos >= 0)`),
	check("v2_request_facts_gateway_timing_check", sql`((internal_dispatch_ms IS NULL) OR (internal_dispatch_ms >= (0)::numeric)) AND ((gateway_total_ms IS NULL) OR (gateway_total_ms >= (0)::numeric))`),
	check("v2_request_facts_model_input_check", sql`length(TRIM(BOTH FROM requested_model_input)) > 0`),
	check("v2_request_facts_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
	check("v2_request_facts_request_id_check", sql`length(TRIM(BOTH FROM request_id)) > 0`),
	check("v2_request_facts_status_code_check", sql`(status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))`),
	check("v2_request_facts_throughput_check", sql`(throughput IS NULL) OR (throughput >= (0)::numeric)`),
	check("v2_request_facts_timing_check", sql`((latency_ms IS NULL) OR (latency_ms >= 0)) AND ((time_to_first_token_ms IS NULL) OR (time_to_first_token_ms >= 0)) AND ((generation_ms IS NULL) OR (generation_ms >= 0)) AND ((queue_ms IS NULL) OR (queue_ms >= 0)) AND ((upstream_latency_ms IS NULL) OR (upstream_latency_ms >= 0))`),
	check("v2_request_facts_tool_count_check", sql`tool_call_count >= 0`),
]);

export const v2RequestFeedback = pgTable("v2_request_feedback", {
	feedbackId: uuid("feedback_id").defaultRandom().primaryKey().notNull(),
	requestEventId: uuid("request_event_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	feedbackType: text("feedback_type").notNull(),
	value: text().notNull(),
	score: numeric({ precision: 10, scale:  4 }),
	source: text().default('user').notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_request_feedback_request_idx").using("btree", table.requestEventId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("v2_request_feedback_workspace_time_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.requestEventId],
			foreignColumns: [v2RequestFacts.requestEventId],
			name: "v2_request_feedback_request_event_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "v2_request_feedback_workspace_id_fkey"
		}).onDelete("cascade"),
	check("v2_request_feedback_score_check", sql`(score IS NULL) OR ((score >= ('-1'::integer)::numeric) AND (score <= (1)::numeric))`),
]);

export const v2RequestPricingLines = pgTable("v2_request_pricing_lines", {
	pricingLineId: uuid("pricing_line_id").defaultRandom().primaryKey().notNull(),
	requestEventId: uuid("request_event_id").notNull(),
	skuId: uuid("sku_id"),
	skuMeterId: uuid("sku_meter_id"),
	meterKey: text("meter_key").notNull(),
	quantity: numeric({ precision: 30, scale:  12 }).notNull(),
	unit: text().notNull(),
	unitPriceNanos: numeric("unit_price_nanos", { precision: 30, scale:  12 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	chargedNanos: bigint("charged_nanos", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_request_pricing_lines_request_idx").using("btree", table.requestEventId.asc().nullsLast().op("text_ops"), table.meterKey.asc().nullsLast().op("uuid_ops")),
	index("v2_request_pricing_lines_sku_meter_id_idx").using("btree", table.skuMeterId.asc().nullsLast().op("uuid_ops")).where(sql`(sku_meter_id IS NOT NULL)`),
	index("v2_request_pricing_lines_sku_time_idx").using("btree", table.skuId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(sku_id IS NOT NULL)`),
	foreignKey({
			columns: [table.requestEventId],
			foreignColumns: [v2RequestFacts.requestEventId],
			name: "v2_request_pricing_lines_request_event_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.skuId],
			foreignColumns: [v2PricingSkus.skuId],
			name: "v2_request_pricing_lines_sku_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.skuMeterId],
			foreignColumns: [v2PricingSkuMeters.skuMeterId],
			name: "v2_request_pricing_lines_sku_meter_id_fkey"
		}).onDelete("set null"),
	check("v2_request_pricing_lines_charge_check", sql`charged_nanos >= 0`),
	check("v2_request_pricing_lines_quantity_check", sql`quantity >= (0)::numeric`),
	check("v2_request_pricing_lines_unit_price_check", sql`unit_price_nanos >= (0)::numeric`),
]);

export const v2RequestRoutingDecisions = pgTable("v2_request_routing_decisions", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	routingDecisionId: bigint("routing_decision_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "v2_request_routing_decisions_routing_decision_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	requestEventId: uuid("request_event_id").notNull(),
	decisionOrder: smallint("decision_order").notNull(),
	providerModelId: text("provider_model_id"),
	providerSlug: text("provider_slug").notNull(),
	providerApiModelId: text("provider_api_model_id"),
	decision: text().notNull(),
	rank: smallint(),
	score: numeric({ precision: 20, scale:  12 }),
	selected: boolean().default(false).notNull(),
	attempted: boolean().default(false).notNull(),
	breaker: text(),
	breakerUntil: timestamp("breaker_until", { withTimezone: true, mode: 'string' }),
	providerStatus: text("provider_status"),
	providerRoutingStatus: text("provider_routing_status"),
	modelRoutingStatus: text("model_routing_status"),
	capabilityStatus: text("capability_status"),
	exclusionStage: text("exclusion_stage"),
	exclusionReason: text("exclusion_reason"),
	scoreFactors: jsonb("score_factors").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_request_routing_decisions_excluded_idx").using("btree", table.exclusionReason.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(decision = 'excluded'::text)`),
	index("v2_request_routing_decisions_request_idx").using("btree", table.requestEventId.asc().nullsLast().op("uuid_ops"), table.decisionOrder.asc().nullsLast().op("uuid_ops")),
	index("v2_request_routing_decisions_route_idx").using("btree", table.providerModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(provider_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_request_routing_decisions_provider_model_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.requestEventId],
			foreignColumns: [v2RequestFacts.requestEventId],
			name: "v2_request_routing_decisions_request_event_id_fkey"
		}).onDelete("cascade"),
	unique("v2_request_routing_decisions_request_order_key").on(table.decisionOrder, table.requestEventId),
	check("v2_request_routing_decisions_decision_check", sql`decision = ANY (ARRAY['ranked'::text, 'excluded'::text])`),
	check("v2_request_routing_decisions_factors_check", sql`(jsonb_typeof(score_factors) = 'object'::text) AND (pg_column_size(score_factors) <= 4096)`),
	check("v2_request_routing_decisions_order_check", sql`decision_order > 0`),
	check("v2_request_routing_decisions_rank_check", sql`(rank IS NULL) OR (rank > 0)`),
	check("v2_request_routing_decisions_score_check", sql`(score IS NULL) OR (score >= (0)::numeric)`),
]);

export const v2RequestUsage = pgTable("v2_request_usage", {
	usageId: uuid("usage_id").defaultRandom().primaryKey().notNull(),
	requestEventId: uuid("request_event_id").notNull(),
	skuMeterId: uuid("sku_meter_id"),
	meterKey: text("meter_key").notNull(),
	modality: text().notNull(),
	unit: text().notNull(),
	quantity: numeric({ precision: 30, scale:  12 }).notNull(),
	source: text().default('provider').notNull(),
	billable: boolean().default(true).notNull(),
	sequence: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_request_usage_meter_time_idx").using("btree", table.meterKey.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("v2_request_usage_modality_time_idx").using("btree", table.modality.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("v2_request_usage_request_idx").using("btree", table.requestEventId.asc().nullsLast().op("text_ops"), table.meterKey.asc().nullsLast().op("text_ops")),
	index("v2_request_usage_sku_meter_id_idx").using("btree", table.skuMeterId.asc().nullsLast().op("uuid_ops")).where(sql`(sku_meter_id IS NOT NULL)`),
	foreignKey({
			columns: [table.requestEventId],
			foreignColumns: [v2RequestFacts.requestEventId],
			name: "v2_request_usage_request_event_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.skuMeterId],
			foreignColumns: [v2PricingSkuMeters.skuMeterId],
			name: "v2_request_usage_sku_meter_id_fkey"
		}).onDelete("set null"),
	unique("v2_request_usage_key").on(table.meterKey, table.requestEventId, table.sequence),
	check("v2_request_usage_quantity_check", sql`quantity >= (0)::numeric`),
	check("v2_request_usage_sequence_check", sql`sequence >= 0`),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_userId_fkey"
		}).onDelete("cascade"),
]);

export const accountGuardrailSettings = pgTable("account_guardrail_settings", {
	userId: uuid("user_id").primaryKey().notNull(),
	privacyEnablePaidMayTrain: boolean("privacy_enable_paid_may_train").default(true).notNull(),
	privacyEnableFreeMayTrain: boolean("privacy_enable_free_may_train").default(true).notNull(),
	privacyEnableInputOutputLogging: boolean("privacy_enable_input_output_logging").default(true).notNull(),
	privacyZdrOnly: boolean("privacy_zdr_only").default(false).notNull(),
	blockedProviderIds: text("blocked_provider_ids").array().default([""]).notNull(),
	blockedApiModelIds: text("blocked_api_model_ids").array().default([""]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	providerRestrictionMode: text("provider_restriction_mode").default('none').notNull(),
	providerRestrictionProviderIds: text("provider_restriction_provider_ids").array().default([""]).notNull(),
	modelRestrictionMode: text("model_restriction_mode").default('none').notNull(),
	modelRestrictionModelIds: text("model_restriction_model_ids").array().default([""]).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "account_guardrail_settings_user_id_fkey"
		}).onDelete("cascade"),
	check("account_guardrail_settings_model_ids_valid", sql`array_position(blocked_api_model_ids, NULL::text) IS NULL`),
	check("account_guardrail_settings_model_mode_valid", sql`model_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])`),
	check("account_guardrail_settings_provider_ids_valid", sql`array_position(blocked_provider_ids, NULL::text) IS NULL`),
	check("account_guardrail_settings_provider_mode_valid", sql`provider_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])`),
]);

export const broadcastDestinationRuleGroups = pgTable("broadcast_destination_rule_groups", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	destinationId: uuid("destination_id").notNull(),
	name: text().notNull(),
	matchOperator: text("match_operator").default('and').notNull(),
	position: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
}, (table) => [
	index("broadcast_destination_rule_groups_destination_id_idx").using("btree", table.destinationId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.destinationId],
			foreignColumns: [workspaceBroadcastDestinations.id],
			name: "broadcast_destination_rule_groups_destination_id_fkey"
		}).onDelete("cascade"),
	check("broadcast_destination_rule_groups_match_operator_check", sql`match_operator = ANY (ARRAY['and'::text, 'or'::text])`),
]);

export const workspacePublisherHandleAliases = pgTable("workspace_publisher_handle_aliases", {
	handle: text().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("workspace_publisher_handle_aliases_workspace_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_publisher_handle_aliases_workspace_id_fkey"
		}).onDelete("cascade"),
	check("workspace_publisher_handle_alias_format", sql`handle ~ '^[a-z0-9][a-z0-9_-]{2,39}$'::text`),
]);

export const workspaceSettings = pgTable("workspace_settings", {
	workspaceId: uuid("workspace_id").primaryKey().notNull(),
	routingMode: text("routing_mode").default('balanced').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	byokFallbackEnabled: boolean("byok_fallback_enabled").default(true).notNull(),
	betaChannelEnabled: boolean("beta_channel_enabled").default(false).notNull(),
	privacyEnablePaidMayTrain: boolean("privacy_enable_paid_may_train").default(true).notNull(),
	privacyEnableFreeMayTrain: boolean("privacy_enable_free_may_train").default(true).notNull(),
	privacyEnableFreeMayPublishPrompts: boolean("privacy_enable_free_may_publish_prompts").default(true).notNull(),
	privacyEnableInputOutputLogging: boolean("privacy_enable_input_output_logging").default(true).notNull(),
	privacyZdrOnly: boolean("privacy_zdr_only").default(false).notNull(),
	providerRestrictionMode: text("provider_restriction_mode").default('none').notNull(),
	providerRestrictionProviderIds: text("provider_restriction_provider_ids").array().default([""]).notNull(),
	providerRestrictionEnforceAllowed: boolean("provider_restriction_enforce_allowed").default(false).notNull(),
	ssoEnabled: boolean("sso_enabled").default(false).notNull(),
	ssoEnforced: boolean("sso_enforced").default(false).notNull(),
	ssoMode: text("sso_mode").default('none').notNull(),
	ssoProviderIdentifier: text("sso_provider_identifier"),
	ssoDomains: text("sso_domains").array().default([""]).notNull(),
	alphaChannelEnabled: boolean("alpha_channel_enabled").default(false).notNull(),
	gatewayPlugins: jsonb("gateway_plugins").default([]).notNull(),
	ioLoggingEnabled: boolean("io_logging_enabled").default(false).notNull(),
	ioLoggingRetentionDays: integer("io_logging_retention_days").default(90).notNull(),
	ioLoggingIncludeProviderPayloads: boolean("io_logging_include_provider_payloads").default(true).notNull(),
	ioLoggingUpdatedAt: timestamp("io_logging_updated_at", { withTimezone: true, mode: 'string' }),
	dataContributionEnabled: boolean("data_contribution_enabled").default(false).notNull(),
	dataContributionPolicyVersion: text("data_contribution_policy_version"),
	dataContributionConsentedAt: timestamp("data_contribution_consented_at", { withTimezone: true, mode: 'string' }),
	dataContributionConsentedBy: uuid("data_contribution_consented_by"),
	dataContributionSampleRateBps: integer("data_contribution_sample_rate_bps").default(10000).notNull(),
	dataContributionClassifierSampleRateBps: integer("data_contribution_classifier_sample_rate_bps").default(1000).notNull(),
	dataContributionDiscountBps: integer("data_contribution_discount_bps").default(100).notNull(),
	responseHealingEnabled: boolean("response_healing_enabled").default(false).notNull(),
	responseHealingLocked: boolean("response_healing_locked").default(false).notNull(),
	responseHealingMode: text("response_healing_mode").default('safe').notNull(),
	cacheAwareRoutingEnabled: boolean("cache_aware_routing_enabled").default(true).notNull(),
	lowBalanceEmailEnabled: boolean("low_balance_email_enabled").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lowBalanceEmailThresholdNanos: bigint("low_balance_email_threshold_nanos", { mode: "number" }).default(0).notNull(),
	lowBalanceEmailLastSentAt: timestamp("low_balance_email_last_sent_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lowBalanceEmailLastSentBalanceNanos: bigint("low_balance_email_last_sent_balance_nanos", { mode: "number" }),
	autoTopUpFailureEmailEnabled: boolean("auto_top_up_failure_email_enabled").default(true).notNull(),
	paymentMethodExpiringEmailEnabled: boolean("payment_method_expiring_email_enabled").default(true).notNull(),
	modelRestrictionMode: text("model_restriction_mode").default('none').notNull(),
	modelRestrictionModelIds: text("model_restriction_model_ids").array().default([""]).notNull(),
	ioLoggingBillingStatus: text("io_logging_billing_status").default('active').notNull(),
	ioLoggingGraceUntil: timestamp("io_logging_grace_until", { withTimezone: true, mode: 'string' }),
	ioLoggingLastBilledAt: timestamp("io_logging_last_billed_at", { withTimezone: true, mode: 'string' }),
	ioLoggingLastBillingWarningAt: timestamp("io_logging_last_billing_warning_at", { withTimezone: true, mode: 'string' }),
	ioLoggingLastBillingWarningKind: text("io_logging_last_billing_warning_kind"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ioLoggingPricePerMillionUnitsNanos: bigint("io_logging_price_per_million_units_nanos", { mode: "number" }).default(0).notNull(),
}, (table) => [
	index("workspace_settings_data_contribution_actor_idx").using("btree", table.dataContributionConsentedBy.asc().nullsLast().op("uuid_ops")).where(sql`(data_contribution_consented_by IS NOT NULL)`),
	foreignKey({
			columns: [table.dataContributionConsentedBy],
			foreignColumns: [users.userId],
			name: "workspace_settings_data_contribution_consented_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_settings_workspace_id_fkey"
		}).onDelete("cascade"),
	check("workspace_settings_alpha_requires_beta_channel_check", sql`(alpha_channel_enabled = false) OR (beta_channel_enabled = true)`),
	check("workspace_settings_data_contribution_classifier_sample_rate_che", sql`(data_contribution_classifier_sample_rate_bps >= 0) AND (data_contribution_classifier_sample_rate_bps <= 10000)`),
	check("workspace_settings_data_contribution_consent_check", sql`(NOT data_contribution_enabled) OR ((data_contribution_policy_version IS NOT NULL) AND (data_contribution_consented_at IS NOT NULL))`),
	check("workspace_settings_data_contribution_discount_check", sql`(data_contribution_discount_bps >= 0) AND (data_contribution_discount_bps <= 10000)`),
	check("workspace_settings_data_contribution_sample_rate_check", sql`(data_contribution_sample_rate_bps >= 0) AND (data_contribution_sample_rate_bps <= 10000)`),
	check("workspace_settings_io_logging_billing_status_check", sql`io_logging_billing_status = ANY (ARRAY['active'::text, 'grace'::text, 'suspended'::text])`),
	check("workspace_settings_io_logging_price_per_million_units_check", sql`io_logging_price_per_million_units_nanos >= 0`),
	check("workspace_settings_io_logging_retention_days_check", sql`(io_logging_retention_days >= 90) AND (io_logging_retention_days <= 365)`),
	check("workspace_settings_low_balance_threshold_nonnegative", sql`low_balance_email_threshold_nanos >= 0`),
	check("workspace_settings_model_restriction_mode_valid", sql`model_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])`),
	check("workspace_settings_provider_restriction_mode_check", sql`provider_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])`),
	check("workspace_settings_response_healing_mode_check", sql`response_healing_mode = ANY (ARRAY['safe'::text, 'strict'::text])`),
	check("workspace_settings_sso_mode_check", sql`sso_mode = ANY (ARRAY['none'::text, 'saml'::text, 'custom_oidc'::text])`),
]);

export const workspaces = pgTable("workspaces", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	ownerUserId: uuid("owner_user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	tier: text().default('basic'),
	billingMode: text("billing_mode").default('wallet').notNull(),
	publisherHandle: text("publisher_handle").notNull(),
}, (table) => [
	index("workspaces_owner_user_id_idx").using("btree", table.ownerUserId.asc().nullsLast().op("uuid_ops")).where(sql`(owner_user_id IS NOT NULL)`),
	uniqueIndex("workspaces_publisher_handle_key").using("btree", sql`lower(publisher_handle)`),
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [users.userId as AnyPgColumn],
			name: "workspaces_owner_user_id_fkey"
		}).onDelete("cascade"),
	unique("workspaces_slug_key").on(table.slug),
	check("workspaces_billing_mode_check", sql`billing_mode = ANY (ARRAY['wallet'::text, 'invoice'::text])`),
	check("workspaces_publisher_handle_format", sql`publisher_handle ~ '^[a-z0-9][a-z0-9_-]{2,39}$'::text`),
]);

export const keyGuardrails = pgTable("key_guardrails", {
	keyId: uuid("key_id").notNull(),
	guardrailId: uuid("guardrail_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
}, (table) => [
	index("key_guardrails_guardrail_id_idx").using("btree", table.guardrailId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.guardrailId],
			foreignColumns: [workspaceGuardrails.id],
			name: "key_guardrails_guardrail_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "key_guardrails_key_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.guardrailId, table.keyId], name: "key_guardrails_pkey"}),
]);

export const presetLineage = pgTable("preset_lineage", {
	ancestorPresetId: uuid("ancestor_preset_id").notNull(),
	descendantPresetId: uuid("descendant_preset_id").notNull(),
	depth: integer().notNull(),
}, (table) => [
	index("preset_lineage_descendant_idx").using("btree", table.descendantPresetId.asc().nullsLast().op("int4_ops"), table.depth.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.ancestorPresetId],
			foreignColumns: [presets.id],
			name: "preset_lineage_ancestor_preset_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.descendantPresetId],
			foreignColumns: [presets.id],
			name: "preset_lineage_descendant_preset_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.ancestorPresetId, table.descendantPresetId], name: "preset_lineage_pkey"}),
	check("preset_lineage_depth_check", sql`depth >= 0`),
]);

export const gatewayDynamicRouteKeys = pgTable("gateway_dynamic_route_keys", {
	routeId: uuid("route_id").notNull(),
	keyId: uuid("key_id").notNull(),
	attachedBy: uuid("attached_by"),
	attachedAt: timestamp("attached_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_dynamic_route_keys_route_idx").using("btree", table.routeId.asc().nullsLast().op("uuid_ops"), table.keyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.attachedBy],
			foreignColumns: [users.userId],
			name: "gateway_dynamic_route_keys_attached_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_dynamic_route_keys_key_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.routeId],
			foreignColumns: [gatewayDynamicRoutes.id],
			name: "gateway_dynamic_route_keys_route_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.keyId, table.routeId], name: "gateway_dynamic_route_keys_pkey"}),
	unique("gateway_dynamic_route_keys_one_route_per_key").on(table.keyId),
]);

export const modelDiscoveryHfSeenModels = pgTable("model_discovery_hf_seen_models", {
	orgId: text("org_id").notNull(),
	modelId: text("model_id").notNull(),
	firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
}, (table) => [
	index("model_discovery_hf_seen_models_last_seen_at_idx").using("btree", table.lastSeenAt.asc().nullsLast().op("timestamptz_ops")),
	primaryKey({ columns: [table.modelId, table.orgId], name: "model_discovery_hf_seen_models_pkey"}),
]);

export const v2CapabilityParameters = pgTable("v2_capability_parameters", {
	capabilityId: text("capability_id").notNull(),
	parameterKey: text("parameter_key").notNull(),
	valueSchema: jsonb("value_schema").default({}).notNull(),
	description: text(),
}, (table) => [
	primaryKey({ columns: [table.capabilityId, table.parameterKey], name: "v2_capability_parameters_pkey"}),
	check("v2_capability_parameters_key_check", sql`parameter_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]*$'::text`),
	check("v2_capability_parameters_schema_check", sql`jsonb_typeof(value_schema) = 'object'::text`),
]);

export const broadcastDestinationKeys = pgTable("broadcast_destination_keys", {
	destinationId: uuid("destination_id").notNull(),
	keyId: uuid("key_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	filterMode: text("filter_mode").default('include').notNull(),
}, (table) => [
	index("broadcast_destination_keys_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.destinationId],
			foreignColumns: [workspaceBroadcastDestinations.id],
			name: "broadcast_destination_keys_destination_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "broadcast_destination_keys_key_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.destinationId, table.keyId], name: "broadcast_destination_keys_pkey"}),
	check("broadcast_destination_keys_filter_mode_check", sql`filter_mode = ANY (ARRAY['include'::text, 'exclude'::text])`),
]);

export const workspaceMemberGuardrails = pgTable("workspace_member_guardrails", {
	workspaceId: uuid("workspace_id").notNull(),
	userId: uuid("user_id").notNull(),
	guardrailId: uuid("guardrail_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("workspace_member_guardrails_guardrail_id_idx").using("btree", table.guardrailId.asc().nullsLast().op("uuid_ops")),
	index("workspace_member_guardrails_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.guardrailId],
			foreignColumns: [workspaceGuardrails.id],
			name: "workspace_member_guardrails_guardrail_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "workspace_member_guardrails_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_member_guardrails_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.guardrailId, table.userId, table.workspaceId], name: "workspace_member_guardrails_pkey"}),
]);

export const workspaceMembers = pgTable("workspace_members", {
	workspaceId: uuid("workspace_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: workspaceRole().notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
}, (table) => [
	index("workspace_members_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("workspace_members_workspace_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "workspace_members_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_members_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.workspaceId], name: "workspace_members_pkey"}),
]);

export const v2SubscriptionPlanFeatures = pgTable("v2_subscription_plan_features", {
	planUuid: uuid("plan_uuid").notNull(),
	featureName: text("feature_name").notNull(),
	featureValue: text("feature_value"),
	featureDescription: text("feature_description"),
	otherInfo: jsonb("other_info").default({}).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.planUuid],
			foreignColumns: [v2SubscriptionPlans.planUuid],
			name: "v2_subscription_plan_features_plan_uuid_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.featureName, table.planUuid], name: "v2_subscription_plan_features_pkey"}),
]);

export const v2LabLinks = pgTable("v2_lab_links", {
	labSlug: text("lab_slug").notNull(),
	platform: text().notNull(),
	url: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.labSlug],
			foreignColumns: [v2Labs.labSlug],
			name: "v2_lab_links_lab_slug_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.labSlug, table.platform, table.url], name: "v2_lab_links_pkey"}),
]);

export const v2SubscriptionPlanModels = pgTable("v2_subscription_plan_models", {
	planUuid: uuid("plan_uuid").notNull(),
	modelSlug: text("model_slug").notNull(),
	modelInfo: jsonb("model_info").default({}).notNull(),
	rateLimit: jsonb("rate_limit").default({}).notNull(),
	otherInfo: jsonb("other_info").default({}).notNull(),
}, (table) => [
	index("v2_subscription_plan_models_model_idx").using("btree", table.modelSlug.asc().nullsLast().op("text_ops"), table.planUuid.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_subscription_plan_models_model_slug_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planUuid],
			foreignColumns: [v2SubscriptionPlans.planUuid],
			name: "v2_subscription_plan_models_plan_uuid_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.modelSlug, table.planUuid], name: "v2_subscription_plan_models_pkey"}),
]);

export const workspaceByokMonthlyUsage = pgTable("workspace_byok_monthly_usage", {
	workspaceId: uuid("workspace_id").notNull(),
	monthStart: timestamp("month_start", { withTimezone: true, mode: 'string' }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestCount: bigint("request_count", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("workspace_byok_monthly_usage_month_start_idx").using("btree", table.monthStart.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_byok_monthly_usage_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.monthStart, table.workspaceId], name: "workspace_byok_monthly_usage_pkey"}),
]);

export const v2CatalogueSourceOverrides = pgTable("v2_catalogue_source_overrides", {
	sourceType: text("source_type").notNull(),
	sourceKey: text("source_key").notNull(),
	disposition: text().notNull(),
	actorUserId: uuid("actor_user_id").notNull(),
	resourceId: text("resource_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.userId],
			name: "v2_catalogue_source_overrides_actor_user_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.sourceKey, table.sourceType], name: "v2_catalogue_source_overrides_pkey"}),
	check("v2_catalogue_source_overrides_disposition_check", sql`disposition = ANY (ARRAY['database_managed'::text, 'database'::text, 'suppressed'::text])`),
	check("v2_catalogue_source_overrides_type_check", sql`source_type = ANY (ARRAY['pricing_rule'::text, 'organisations'::text, 'providers'::text, 'benchmarks'::text, 'subscription-plans'::text, 'models'::text, 'model'::text, 'provider_route'::text])`),
]);

export const v2ModelDetails = pgTable("v2_model_details", {
	modelSlug: text("model_slug").notNull(),
	detailName: text("detail_name").notNull(),
	detailValue: jsonb("detail_value").default(null).notNull(),
	detailOrder: integer("detail_order").default(100).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_model_details_model_slug_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.detailName, table.modelSlug], name: "v2_model_details_pkey"}),
]);

export const gatewayBatchFileUploads = pgTable("gateway_batch_file_uploads", {
	workspaceId: uuid("workspace_id").notNull(),
	uploadId: text("upload_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bytes: bigint({ mode: "number" }).notNull(),
	status: text().notNull(),
	providerFileId: text("provider_file_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_batch_file_uploads_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.uploadId, table.workspaceId], name: "gateway_batch_file_uploads_pkey"}),
	check("gateway_batch_file_uploads_bytes_check", sql`bytes > 0`),
	check("gateway_batch_file_uploads_status_check", sql`status = ANY (ARRAY['claimed'::text, 'completed'::text, 'failed'::text])`),
]);

export const publicModelUserUsageDaily = pgTable("public_model_user_usage_daily", {
	dayBucket: date("day_bucket").notNull(),
	modelId: text("model_id").notNull(),
	providerId: text("provider_id").notNull(),
	actorHash: text("actor_hash").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tokens: bigint({ mode: "number" }).default(0).notNull(),
	refreshedAt: timestamp("refreshed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("public_model_user_usage_daily_day_idx").using("btree", table.dayBucket.desc().nullsFirst().op("date_ops")),
	index("public_model_user_usage_daily_model_day_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.dayBucket.desc().nullsFirst().op("text_ops")),
	primaryKey({ columns: [table.actorHash, table.dayBucket, table.modelId, table.providerId], name: "public_model_user_usage_daily_pkey"}),
]);

export const v2ModelLinks = pgTable("v2_model_links", {
	modelSlug: text("model_slug").notNull(),
	linkKind: text("link_kind").notNull(),
	title: text().notNull(),
	url: text().notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_model_links_model_slug_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.linkKind, table.modelSlug, table.url], name: "v2_model_links_pkey"}),
]);

export const v2PrivateUsageDailyMeters = pgTable("v2_private_usage_daily_meters", {
	rollupId: uuid("rollup_id").notNull(),
	meterKey: text("meter_key").notNull(),
	modality: text().notNull(),
	unit: text().notNull(),
	quantity: numeric({ precision: 30, scale:  12 }).default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_private_usage_daily_meters_lookup_idx").using("btree", table.meterKey.asc().nullsLast().op("text_ops"), table.modality.asc().nullsLast().op("text_ops"), table.unit.asc().nullsLast().op("text_ops"), table.rollupId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.rollupId],
			foreignColumns: [v2PrivateUsageDaily.rollupId],
			name: "v2_private_usage_daily_meters_rollup_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.meterKey, table.modality, table.rollupId, table.unit], name: "v2_private_usage_daily_meters_pkey"}),
	check("v2_private_usage_daily_meters_quantity_check", sql`quantity >= (0)::numeric`),
]);

export const v2PublicUsageDailyMeters = pgTable("v2_public_usage_daily_meters", {
	rollupId: uuid("rollup_id").notNull(),
	meterKey: text("meter_key").notNull(),
	modality: text().notNull(),
	unit: text().notNull(),
	quantity: numeric({ precision: 30, scale:  12 }).default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_public_usage_daily_meters_lookup_idx").using("btree", table.meterKey.asc().nullsLast().op("text_ops"), table.modality.asc().nullsLast().op("text_ops"), table.unit.asc().nullsLast().op("text_ops"), table.rollupId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.rollupId],
			foreignColumns: [v2PublicUsageDaily.rollupId],
			name: "v2_public_usage_daily_meters_rollup_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.meterKey, table.modality, table.rollupId, table.unit], name: "v2_public_usage_daily_meters_pkey"}),
	check("v2_public_usage_daily_meters_quantity_check", sql`quantity >= (0)::numeric`),
]);

export const v2PublicUsageHourlyMeters = pgTable("v2_public_usage_hourly_meters", {
	rollupId: uuid("rollup_id").notNull(),
	meterKey: text("meter_key").notNull(),
	modality: text().notNull(),
	unit: text().notNull(),
	quantity: numeric({ precision: 30, scale:  12 }).default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_public_usage_hourly_meters_lookup_idx").using("btree", table.meterKey.asc().nullsLast().op("text_ops"), table.modality.asc().nullsLast().op("text_ops"), table.unit.asc().nullsLast().op("text_ops"), table.rollupId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.rollupId],
			foreignColumns: [v2PublicUsageHourly.rollupId],
			name: "v2_public_usage_hourly_meters_rollup_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.meterKey, table.modality, table.rollupId, table.unit], name: "v2_public_usage_hourly_meters_pkey"}),
	check("v2_public_usage_hourly_meters_quantity_check", sql`quantity >= (0)::numeric`),
]);

export const v2RollupRefreshState = pgTable("v2_rollup_refresh_state", {
	rollupName: text("rollup_name").notNull(),
	bucketStart: timestamp("bucket_start", { withTimezone: true, mode: 'string' }).notNull(),
	lastStartedAt: timestamp("last_started_at", { withTimezone: true, mode: 'string' }),
	lastCompletedAt: timestamp("last_completed_at", { withTimezone: true, mode: 'string' }),
	sourceWatermark: timestamp("source_watermark", { withTimezone: true, mode: 'string' }),
	status: text().default('pending').notNull(),
	errorMessage: text("error_message"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_rollup_refresh_state_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops"), table.bucketStart.asc().nullsLast().op("text_ops")),
	primaryKey({ columns: [table.bucketStart, table.rollupName], name: "v2_rollup_refresh_state_pkey"}),
	check("v2_rollup_refresh_state_status_check", sql`status = ANY (ARRAY['pending'::text, 'running'::text, 'complete'::text, 'failed'::text])`),
]);

export const v2RouteParameterSupport = pgTable("v2_route_parameter_support", {
	providerModelId: text("provider_model_id").notNull(),
	capabilityId: text("capability_id").notNull(),
	parameterKey: text("parameter_key").notNull(),
	supportLevel: text("support_level").notNull(),
	config: jsonb().default({}).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_route_parameter_support_lookup_idx").using("btree", table.capabilityId.asc().nullsLast().op("text_ops"), table.parameterKey.asc().nullsLast().op("text_ops"), table.supportLevel.asc().nullsLast().op("text_ops"), table.providerModelId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.capabilityId, table.parameterKey],
			foreignColumns: [v2CapabilityParameters.capabilityId, v2CapabilityParameters.parameterKey],
			name: "v2_route_parameter_support_capability_id_parameter_key_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.providerModelId, table.capabilityId],
			foreignColumns: [v2RouteCapabilities.providerModelId, v2RouteCapabilities.capabilityId],
			name: "v2_route_parameter_support_provider_model_id_capability_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.capabilityId, table.parameterKey, table.providerModelId], name: "v2_route_parameter_support_pkey"}),
	check("v2_route_parameter_support_config_check", sql`jsonb_typeof(config) = 'object'::text`),
	check("v2_route_parameter_support_level_check", sql`support_level = ANY (ARRAY['native'::text, 'emulated'::text, 'ignored'::text, 'unsupported'::text, 'unknown'::text])`),
]);

export const gatewayRequestCharges = pgTable("gateway_request_charges", {
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }).notNull(),
	status: text().default('applying').notNull(),
	deductedStatus: text("deducted_status"),
	autoTopUpRequired: boolean("auto_top_up_required").default(false).notNull(),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_gateway_request_charges_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_request_charges_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.requestId, table.workspaceId], name: "gateway_request_charges_pkey"}),
	check("gateway_request_charges_cost_nanos_check", sql`cost_nanos > 0`),
	check("gateway_request_charges_status_check", sql`status = ANY (ARRAY['applying'::text, 'applied'::text, 'failed'::text])`),
]);

export const modelDiscoverySeenModels = pgTable("model_discovery_seen_models", {
	providerId: text("provider_id").notNull(),
	modelId: text("model_id").notNull(),
	providerName: text("provider_name").notNull(),
	firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).default(sql`(now() AT TIME ZONE 'utc'::text)`).notNull(),
	lastRunId: uuid("last_run_id"),
	modelDetails: jsonb("model_details").default({}).notNull(),
	pricingDetails: jsonb("pricing_details"),
	removalPending: boolean("removal_pending").default(false).notNull(),
}, (table) => [
	index("model_discovery_seen_models_last_run_id_idx").using("btree", table.lastRunId.asc().nullsLast().op("uuid_ops")).where(sql`(last_run_id IS NOT NULL)`),
	index("model_discovery_seen_models_last_seen_at_idx").using("btree", table.lastSeenAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.lastRunId],
			foreignColumns: [modelDiscoveryRuns.id],
			name: "model_discovery_seen_models_last_run_id_fkey"
		}).onDelete("set null"),
	primaryKey({ columns: [table.modelId, table.providerId], name: "model_discovery_seen_models_pkey"}),
]);

export const catalogueGameResults = pgTable("catalogue_game_results", {
	userId: uuid("user_id").notNull(),
	gameKey: text("game_key").notNull(),
	puzzleId: uuid("puzzle_id").notNull(),
	puzzleDate: date("puzzle_date").notNull(),
	won: boolean().notNull(),
	score: integer().notNull(),
	maxScore: integer("max_score").notNull(),
	attempts: integer(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("catalogue_game_results_user_date_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.puzzleDate.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.puzzleId],
			foreignColumns: [catalogueInteractionPuzzles.puzzleId],
			name: "catalogue_game_results_puzzle_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "catalogue_game_results_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.gameKey, table.puzzleDate, table.userId], name: "catalogue_game_results_pkey"}),
	check("catalogue_game_results_attempts_check", sql`(attempts IS NULL) OR (attempts >= 0)`),
	check("catalogue_game_results_check", sql`(max_score > 0) AND (score <= max_score)`),
	check("catalogue_game_results_game_key_check", sql`game_key = ANY (ARRAY['modele'::text, 'timeline'::text, 'pricele'::text, 'head-to-head'::text, 'sprint'::text])`),
	check("catalogue_game_results_score_check", sql`score >= 0`),
]);

export const gatewayProviderHealthStates = pgTable("gateway_provider_health_states", {
	providerId: text("provider_id").notNull(),
	modelId: text("model_id").notNull(),
	endpoint: text().notNull(),
	breakerState: text("breaker_state").default('closed').notNull(),
	isDeranked: boolean("is_deranked").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	openUntilMs: bigint("open_until_ms", { mode: "number" }).default(0).notNull(),
	openUntil: timestamp("open_until", { withTimezone: true, mode: 'string' }),
	lastTransitionAt: timestamp("last_transition_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastReason: text("last_reason"),
}, (table) => [
	index("gateway_provider_health_states_deranked_idx").using("btree", table.providerId.asc().nullsLast().op("timestamptz_ops"), table.isDeranked.asc().nullsLast().op("text_ops"), table.updatedAt.desc().nullsFirst().op("bool_ops")),
	index("gateway_provider_health_states_provider_updated_idx").using("btree", table.providerId.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.desc().nullsFirst().op("timestamptz_ops")),
	primaryKey({ columns: [table.endpoint, table.modelId, table.providerId], name: "gateway_provider_health_states_pkey"}),
	check("gateway_provider_health_states_breaker_state_chk", sql`breaker_state = ANY (ARRAY['closed'::text, 'open'::text, 'half_open'::text])`),
]);

export const modelDiscoveryIssueSignals = pgTable("model_discovery_issue_signals", {
	source: text().notNull(),
	providerId: text("provider_id").notNull(),
	action: text().notNull(),
	modelId: text("model_id").notNull(),
	entry: jsonb().notNull(),
	consecutiveSweeps: integer("consecutive_sweeps").default(1).notNull(),
	firstObservedAt: timestamp("first_observed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastObservedAt: timestamp("last_observed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastObservedRunId: uuid("last_observed_run_id"),
	emittedAt: timestamp("emitted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("model_discovery_issue_signals_pending_idx").using("btree", table.providerId.asc().nullsLast().op("text_ops"), table.emittedAt.asc().nullsLast().op("text_ops")).where(sql`(emitted_at IS NULL)`),
	primaryKey({ columns: [table.action, table.modelId, table.providerId, table.source], name: "model_discovery_issue_signals_pkey"}),
	check("model_discovery_issue_signals_action_check", sql`action = 'delete'::text`),
	check("model_discovery_issue_signals_consecutive_sweeps_check", sql`consecutive_sweeps > 0`),
]);

export const publicModelTaskDaily = pgTable("public_model_task_daily", {
	usageDate: date("usage_date").notNull(),
	taxonomySlug: text("taxonomy_slug").notNull(),
	primaryCategory: text("primary_category").notNull(),
	modelSlug: text("model_slug").notNull(),
	providerSlug: text("provider_slug").default('').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	workspaceCount: bigint("workspace_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestCount: bigint("request_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputTokens: bigint("input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputTokens: bigint("output_tokens", { mode: "number" }).default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("public_model_task_daily_model_date_idx").using("btree", table.modelSlug.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("date_ops")),
	primaryKey({ columns: [table.modelSlug, table.primaryCategory, table.providerSlug, table.taxonomySlug, table.usageDate], name: "public_model_task_daily_pkey"}),
	check("public_model_task_daily_input_tokens_check", sql`input_tokens >= 0`),
	check("public_model_task_daily_output_tokens_check", sql`output_tokens >= 0`),
	check("public_model_task_daily_request_count_check", sql`request_count >= 0`),
	check("public_model_task_daily_workspace_count_check", sql`workspace_count >= 0`),
]);

export const requestClassificationDaily = pgTable("request_classification_daily", {
	usageDate: date("usage_date").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	classifierId: uuid("classifier_id").notNull(),
	primaryCategory: text("primary_category").notNull(),
	modelSlug: text("model_slug").notNull(),
	providerSlug: text("provider_slug").default('').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestCount: bigint("request_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputTokens: bigint("input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputTokens: bigint("output_tokens", { mode: "number" }).default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("request_classification_daily_classifier_idx").using("btree", table.classifierId.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("date_ops")),
	index("request_classification_daily_public_rollup_idx").using("btree", table.usageDate.asc().nullsLast().op("date_ops"), table.classifierId.asc().nullsLast().op("text_ops"), table.primaryCategory.asc().nullsLast().op("date_ops"), table.modelSlug.asc().nullsLast().op("date_ops"), table.providerSlug.asc().nullsLast().op("date_ops"), table.workspaceId.asc().nullsLast().op("date_ops"), table.requestCount.asc().nullsLast().op("date_ops"), table.inputTokens.asc().nullsLast().op("text_ops"), table.outputTokens.asc().nullsLast().op("uuid_ops")),
	index("request_classification_daily_workspace_date_idx").using("btree", table.workspaceId.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.classifierId],
			foreignColumns: [workspaceClassifiers.id],
			name: "request_classification_daily_classifier_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "request_classification_daily_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.classifierId, table.modelSlug, table.primaryCategory, table.providerSlug, table.usageDate, table.workspaceId], name: "request_classification_daily_pkey"}),
	check("request_classification_daily_input_tokens_check", sql`input_tokens >= 0`),
	check("request_classification_daily_output_tokens_check", sql`output_tokens >= 0`),
	check("request_classification_daily_request_count_check", sql`request_count >= 0`),
]);

export const gatewayBatchKeyUsageRecords = pgTable("gateway_batch_key_usage_records", {
	workspaceId: uuid("workspace_id").notNull(),
	batchId: text("batch_id").notNull(),
	customId: text("custom_id").notNull(),
	keyId: uuid("key_id").notNull(),
	provider: text(),
	endpoint: text().notNull(),
	model: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }).notNull(),
	usage: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_batch_key_usage_records_key_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_batch_key_usage_records_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.batchId, table.customId, table.workspaceId], name: "gateway_batch_key_usage_records_pkey"}),
	check("gateway_batch_key_usage_records_cost_nanos_check", sql`cost_nanos >= 0`),
]);

export const v2RouteCapabilities = pgTable("v2_route_capabilities", {
	providerModelId: text("provider_model_id").notNull(),
	capabilityId: text("capability_id").notNull(),
	status: text().default('active').notNull(),
	maxInputTokens: integer("max_input_tokens"),
	maxOutputTokens: integer("max_output_tokens"),
	params: jsonb().default({}).notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_route_capabilities_capability_idx").using("btree", table.capabilityId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops"), table.providerModelId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.providerModelId],
			foreignColumns: [v2ModelProviderRoutes.providerModelId],
			name: "v2_route_capabilities_provider_model_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.capabilityId, table.providerModelId], name: "v2_route_capabilities_pkey"}),
	check("v2_route_capabilities_status_check", sql`status = ANY (ARRAY['active'::text, 'degraded'::text, 'disabled'::text, 'internal_testing'::text])`),
	check("v2_route_capabilities_window_check", sql`(effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from)`),
]);

export const v2PublicProviderHealthDaily = pgTable("v2_public_provider_health_daily", {
	usageDate: date("usage_date").notNull(),
	modelSlug: text("model_slug").notNull(),
	providerModelId: text("provider_model_id").notNull(),
	providerSlug: text("provider_slug").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestCount: bigint("request_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successfulRequestCount: bigint("successful_request_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	attemptCount: bigint("attempt_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successfulAttempts: bigint("successful_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedAttempts: bigint("failed_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fallbackAttempts: bigint("fallback_attempts", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencyCount: bigint("latency_count", { mode: "number" }).default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("v2_public_provider_health_model_idx").using("btree", table.modelSlug.asc().nullsLast().op("date_ops"), table.usageDate.desc().nullsFirst().op("date_ops"), table.providerSlug.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.modelSlug],
			foreignColumns: [v2Models.modelSlug],
			name: "v2_public_provider_health_daily_model_slug_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.modelSlug, table.providerModelId, table.providerSlug, table.usageDate], name: "v2_public_provider_health_daily_pkey"}),
]);

export const gatewayAsyncWebhookDeliveries = pgTable("gateway_async_webhook_deliveries", {
	workspaceId: uuid("workspace_id").notNull(),
	kind: text().notNull(),
	internalId: text("internal_id").notNull(),
	deliveryKey: text("delivery_key").notNull(),
	status: text().default('claimed').notNull(),
	claimToken: text("claim_token"),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	eventType: text("event_type"),
	phase: text(),
	progress: doublePrecision(),
	previousStatus: text("previous_status"),
	currentStatus: text("current_status"),
	nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
}, (table) => [
	index("gateway_async_webhook_deliveries_pending_idx").using("btree", table.nextAttemptAt.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'pending'::text)`),
	primaryKey({ columns: [table.deliveryKey, table.internalId, table.kind, table.workspaceId], name: "gateway_async_webhook_deliveries_pkey"}),
	check("gateway_async_webhook_delivery_status_check", sql`status = ANY (ARRAY['claimed'::text, 'pending'::text, 'delivered'::text, 'failed'::text])`),
]);

export const gatewayWalletReservations = pgTable("gateway_wallet_reservations", {
	workspaceId: uuid("workspace_id").notNull(),
	reservationId: text("reservation_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountNanos: bigint("amount_nanos", { mode: "number" }).notNull(),
	status: text().notNull(),
	holdRefId: text("hold_ref_id"),
	captureRefId: text("capture_ref_id"),
	releaseRefId: text("release_ref_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	settledAmountNanos: bigint("settled_amount_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	capturedNanos: bigint("captured_nanos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	releasedNanos: bigint("released_nanos", { mode: "number" }).default(0).notNull(),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }),
	releasedAt: timestamp("released_at", { withTimezone: true, mode: 'string' }),
	keyId: uuid("key_id"),
	requestCount: integer("request_count"),
	keyUsageRecordedAt: timestamp("key_usage_recorded_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("gateway_wallet_reservations_key_pending_idx").using("btree", table.keyId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("idx_gateway_wallet_reservations_status_updated").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_wallet_reservations_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_wallet_reservations_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.reservationId, table.workspaceId], name: "gateway_wallet_reservations_pkey"}),
	check("gateway_wallet_reservations_amount_nanos_check", sql`amount_nanos > 0`),
	check("gateway_wallet_reservations_capture_amount_check", sql`(captured_nanos >= 0) AND (released_nanos >= 0) AND ((captured_nanos + released_nanos) <= amount_nanos)`),
	check("gateway_wallet_reservations_request_count_check", sql`(request_count IS NULL) OR (request_count > 0)`),
	check("gateway_wallet_reservations_status_check", sql`status = ANY (ARRAY['held'::text, 'reserved'::text, 'captured'::text, 'released'::text])`),
]);

export const gatewayUpstreamRequests202607 = pgTable("gateway_upstream_requests_2026_07", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	gatewayRequestId: uuid("gateway_request_id").notNull(),
	gatewayRequestCreatedAt: timestamp("gateway_request_created_at", { withTimezone: true, mode: 'string' }).notNull(),
	requestId: text("request_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	appId: uuid("app_id"),
	keyId: uuid("key_id"),
	sequence: integer().notNull(),
	roundNumber: integer("round_number").default(1).notNull(),
	attemptNumber: integer("attempt_number"),
	internalAttemptNumber: integer("internal_attempt_number"),
	stage: text().default('upstream').notNull(),
	endpoint: text().notNull(),
	modelId: text("model_id").notNull(),
	provider: text(),
	apiModelId: text("api_model_id"),
	providerModelSlug: text("provider_model_slug"),
	upstreamRoute: text("upstream_route"),
	upstreamUrl: text("upstream_url"),
	statusCode: integer("status_code"),
	statusText: text("status_text"),
	success: boolean().default(false).notNull(),
	outcome: text().notNull(),
	retryable: boolean(),
	fallbackAttempted: boolean("fallback_attempted").default(false).notNull(),
	wasProbe: boolean("was_probe").default(false).notNull(),
	keySource: text("key_source"),
	nativeResponseId: text("native_response_id"),
	providerFinishReason: text("provider_finish_reason"),
	finishReason: text("finish_reason"),
	durationMs: integer("duration_ms"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	totalMs: integer("total_ms"),
	requestBuildMs: integer("request_build_ms"),
	upstreamHeadersMs: integer("upstream_headers_ms"),
	retryDelayMs: integer("retry_delay_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }).default(0).notNull(),
	currency: text(),
	errorCode: text("error_code"),
	errorType: text("error_type"),
	errorMessage: text("error_message"),
	errorDescription: text("error_description"),
	errorParam: text("error_param"),
	requestPayload: jsonb("request_payload"),
	responsePayload: jsonb("response_payload"),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	index("gateway_upstream_requests_2026_07_app_id_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_upstream_requests_2026_07_key_id_created_at_idx").using("btree", table.keyId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_upstream_requests_2026_07_workspace_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_upstream_requests_202_gateway_request_id_gateway_re_idx").using("btree", table.gatewayRequestId.asc().nullsLast().op("timestamptz_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("uuid_ops"), table.sequence.asc().nullsLast().op("uuid_ops")),
	index("gateway_upstream_requests_202_workspace_id_provider_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_upstream_requests_202_workspace_id_request_id_gatew_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestId.asc().nullsLast().op("text_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("timestamptz_ops"), table.sequence.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_upstream_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_upstream_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_upstream_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_upstream_requests_2026_07_pkey"}),
	unique("gateway_upstream_requests_202_gateway_request_id_gateway_re_key").on(table.createdAt, table.gatewayRequestCreatedAt, table.gatewayRequestId, table.sequence),
	check("gateway_upstream_requests_attempt_ck", sql`(attempt_number IS NULL) OR (attempt_number > 0)`),
	check("gateway_upstream_requests_internal_attempt_ck", sql`(internal_attempt_number IS NULL) OR (internal_attempt_number > 0)`),
	check("gateway_upstream_requests_key_source_ck", sql`(key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))`),
	check("gateway_upstream_requests_round_ck", sql`round_number > 0`),
	check("gateway_upstream_requests_sequence_ck", sql`sequence > 0`),
	check("gateway_upstream_requests_stage_ck", sql`stage = ANY (ARRAY['routing'::text, 'upstream'::text])`),
	check("gateway_upstream_requests_status_ck", sql`(status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))`),
]);

export const gatewayUpstreamRequests202608 = pgTable("gateway_upstream_requests_2026_08", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	gatewayRequestId: uuid("gateway_request_id").notNull(),
	gatewayRequestCreatedAt: timestamp("gateway_request_created_at", { withTimezone: true, mode: 'string' }).notNull(),
	requestId: text("request_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	appId: uuid("app_id"),
	keyId: uuid("key_id"),
	sequence: integer().notNull(),
	roundNumber: integer("round_number").default(1).notNull(),
	attemptNumber: integer("attempt_number"),
	internalAttemptNumber: integer("internal_attempt_number"),
	stage: text().default('upstream').notNull(),
	endpoint: text().notNull(),
	modelId: text("model_id").notNull(),
	provider: text(),
	apiModelId: text("api_model_id"),
	providerModelSlug: text("provider_model_slug"),
	upstreamRoute: text("upstream_route"),
	upstreamUrl: text("upstream_url"),
	statusCode: integer("status_code"),
	statusText: text("status_text"),
	success: boolean().default(false).notNull(),
	outcome: text().notNull(),
	retryable: boolean(),
	fallbackAttempted: boolean("fallback_attempted").default(false).notNull(),
	wasProbe: boolean("was_probe").default(false).notNull(),
	keySource: text("key_source"),
	nativeResponseId: text("native_response_id"),
	providerFinishReason: text("provider_finish_reason"),
	finishReason: text("finish_reason"),
	durationMs: integer("duration_ms"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	totalMs: integer("total_ms"),
	requestBuildMs: integer("request_build_ms"),
	upstreamHeadersMs: integer("upstream_headers_ms"),
	retryDelayMs: integer("retry_delay_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }).default(0).notNull(),
	currency: text(),
	errorCode: text("error_code"),
	errorType: text("error_type"),
	errorMessage: text("error_message"),
	errorDescription: text("error_description"),
	errorParam: text("error_param"),
	requestPayload: jsonb("request_payload"),
	responsePayload: jsonb("response_payload"),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	index("gateway_upstream_requests_2026_08_app_id_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_upstream_requests_2026_08_key_id_created_at_idx").using("btree", table.keyId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_upstream_requests_2026_08_workspace_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_upstream_requests_202_gateway_request_id_gateway_r_idx1").using("btree", table.gatewayRequestId.asc().nullsLast().op("int4_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("uuid_ops"), table.sequence.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_upstream_requests_202_workspace_id_provider_create_idx1").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_upstream_requests_202_workspace_id_request_id_gate_idx1").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.requestId.asc().nullsLast().op("int4_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("text_ops"), table.sequence.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_upstream_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_upstream_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_upstream_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_upstream_requests_2026_08_pkey"}),
	unique("gateway_upstream_requests_202_gateway_request_id_gateway_r_key1").on(table.createdAt, table.gatewayRequestCreatedAt, table.gatewayRequestId, table.sequence),
	check("gateway_upstream_requests_attempt_ck", sql`(attempt_number IS NULL) OR (attempt_number > 0)`),
	check("gateway_upstream_requests_internal_attempt_ck", sql`(internal_attempt_number IS NULL) OR (internal_attempt_number > 0)`),
	check("gateway_upstream_requests_key_source_ck", sql`(key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))`),
	check("gateway_upstream_requests_round_ck", sql`round_number > 0`),
	check("gateway_upstream_requests_sequence_ck", sql`sequence > 0`),
	check("gateway_upstream_requests_stage_ck", sql`stage = ANY (ARRAY['routing'::text, 'upstream'::text])`),
	check("gateway_upstream_requests_status_ck", sql`(status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))`),
]);

export const gatewayUpstreamRequests202609 = pgTable("gateway_upstream_requests_2026_09", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	gatewayRequestId: uuid("gateway_request_id").notNull(),
	gatewayRequestCreatedAt: timestamp("gateway_request_created_at", { withTimezone: true, mode: 'string' }).notNull(),
	requestId: text("request_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	appId: uuid("app_id"),
	keyId: uuid("key_id"),
	sequence: integer().notNull(),
	roundNumber: integer("round_number").default(1).notNull(),
	attemptNumber: integer("attempt_number"),
	internalAttemptNumber: integer("internal_attempt_number"),
	stage: text().default('upstream').notNull(),
	endpoint: text().notNull(),
	modelId: text("model_id").notNull(),
	provider: text(),
	apiModelId: text("api_model_id"),
	providerModelSlug: text("provider_model_slug"),
	upstreamRoute: text("upstream_route"),
	upstreamUrl: text("upstream_url"),
	statusCode: integer("status_code"),
	statusText: text("status_text"),
	success: boolean().default(false).notNull(),
	outcome: text().notNull(),
	retryable: boolean(),
	fallbackAttempted: boolean("fallback_attempted").default(false).notNull(),
	wasProbe: boolean("was_probe").default(false).notNull(),
	keySource: text("key_source"),
	nativeResponseId: text("native_response_id"),
	providerFinishReason: text("provider_finish_reason"),
	finishReason: text("finish_reason"),
	durationMs: integer("duration_ms"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	totalMs: integer("total_ms"),
	requestBuildMs: integer("request_build_ms"),
	upstreamHeadersMs: integer("upstream_headers_ms"),
	retryDelayMs: integer("retry_delay_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }).default(0).notNull(),
	currency: text(),
	errorCode: text("error_code"),
	errorType: text("error_type"),
	errorMessage: text("error_message"),
	errorDescription: text("error_description"),
	errorParam: text("error_param"),
	requestPayload: jsonb("request_payload"),
	responsePayload: jsonb("response_payload"),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	index("gateway_upstream_requests_2026_09_app_id_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_upstream_requests_2026_09_key_id_created_at_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_upstream_requests_2026_09_workspace_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_upstream_requests_202_gateway_request_id_gateway_r_idx2").using("btree", table.gatewayRequestId.asc().nullsLast().op("timestamptz_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("int4_ops"), table.sequence.asc().nullsLast().op("uuid_ops")),
	index("gateway_upstream_requests_202_workspace_id_provider_create_idx2").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_upstream_requests_202_workspace_id_request_id_gate_idx2").using("btree", table.workspaceId.asc().nullsLast().op("int4_ops"), table.requestId.asc().nullsLast().op("text_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("int4_ops"), table.sequence.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_upstream_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_upstream_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_upstream_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_upstream_requests_2026_09_pkey"}),
	unique("gateway_upstream_requests_202_gateway_request_id_gateway_r_key2").on(table.createdAt, table.gatewayRequestCreatedAt, table.gatewayRequestId, table.sequence),
	check("gateway_upstream_requests_attempt_ck", sql`(attempt_number IS NULL) OR (attempt_number > 0)`),
	check("gateway_upstream_requests_internal_attempt_ck", sql`(internal_attempt_number IS NULL) OR (internal_attempt_number > 0)`),
	check("gateway_upstream_requests_key_source_ck", sql`(key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))`),
	check("gateway_upstream_requests_round_ck", sql`round_number > 0`),
	check("gateway_upstream_requests_sequence_ck", sql`sequence > 0`),
	check("gateway_upstream_requests_stage_ck", sql`stage = ANY (ARRAY['routing'::text, 'upstream'::text])`),
	check("gateway_upstream_requests_status_ck", sql`(status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))`),
]);

export const gatewayUpstreamRequestsDefault = pgTable("gateway_upstream_requests_default", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	gatewayRequestId: uuid("gateway_request_id").notNull(),
	gatewayRequestCreatedAt: timestamp("gateway_request_created_at", { withTimezone: true, mode: 'string' }).notNull(),
	requestId: text("request_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	appId: uuid("app_id"),
	keyId: uuid("key_id"),
	sequence: integer().notNull(),
	roundNumber: integer("round_number").default(1).notNull(),
	attemptNumber: integer("attempt_number"),
	internalAttemptNumber: integer("internal_attempt_number"),
	stage: text().default('upstream').notNull(),
	endpoint: text().notNull(),
	modelId: text("model_id").notNull(),
	provider: text(),
	apiModelId: text("api_model_id"),
	providerModelSlug: text("provider_model_slug"),
	upstreamRoute: text("upstream_route"),
	upstreamUrl: text("upstream_url"),
	statusCode: integer("status_code"),
	statusText: text("status_text"),
	success: boolean().default(false).notNull(),
	outcome: text().notNull(),
	retryable: boolean(),
	fallbackAttempted: boolean("fallback_attempted").default(false).notNull(),
	wasProbe: boolean("was_probe").default(false).notNull(),
	keySource: text("key_source"),
	nativeResponseId: text("native_response_id"),
	providerFinishReason: text("provider_finish_reason"),
	finishReason: text("finish_reason"),
	durationMs: integer("duration_ms"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	totalMs: integer("total_ms"),
	requestBuildMs: integer("request_build_ms"),
	upstreamHeadersMs: integer("upstream_headers_ms"),
	retryDelayMs: integer("retry_delay_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }).default(0).notNull(),
	currency: text(),
	errorCode: text("error_code"),
	errorType: text("error_type"),
	errorMessage: text("error_message"),
	errorDescription: text("error_description"),
	errorParam: text("error_param"),
	requestPayload: jsonb("request_payload"),
	responsePayload: jsonb("response_payload"),
	metadata: jsonb().default({}).notNull(),
}, (table) => [
	index("gateway_upstream_requests_def_gateway_request_id_gateway_re_idx").using("btree", table.gatewayRequestId.asc().nullsLast().op("uuid_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("int4_ops"), table.sequence.asc().nullsLast().op("uuid_ops")),
	index("gateway_upstream_requests_def_workspace_id_provider_created_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_upstream_requests_def_workspace_id_request_id_gatew_idx").using("btree", table.workspaceId.asc().nullsLast().op("int4_ops"), table.requestId.asc().nullsLast().op("timestamptz_ops"), table.gatewayRequestCreatedAt.asc().nullsLast().op("timestamptz_ops"), table.sequence.asc().nullsLast().op("uuid_ops")),
	index("gateway_upstream_requests_default_app_id_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_upstream_requests_default_key_id_created_at_idx").using("btree", table.keyId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_upstream_requests_default_workspace_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_upstream_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_upstream_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_upstream_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_upstream_requests_default_pkey"}),
	unique("gateway_upstream_requests_def_gateway_request_id_gateway_re_key").on(table.createdAt, table.gatewayRequestCreatedAt, table.gatewayRequestId, table.sequence),
	check("gateway_upstream_requests_attempt_ck", sql`(attempt_number IS NULL) OR (attempt_number > 0)`),
	check("gateway_upstream_requests_internal_attempt_ck", sql`(internal_attempt_number IS NULL) OR (internal_attempt_number > 0)`),
	check("gateway_upstream_requests_key_source_ck", sql`(key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))`),
	check("gateway_upstream_requests_round_ck", sql`round_number > 0`),
	check("gateway_upstream_requests_sequence_ck", sql`sequence > 0`),
	check("gateway_upstream_requests_stage_ck", sql`stage = ANY (ARRAY['routing'::text, 'upstream'::text])`),
	check("gateway_upstream_requests_status_ck", sql`(status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))`),
]);

export const gatewayRequests202603 = pgTable("gateway_requests_2026_03", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_2026_03_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_2026_03_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_2026_03_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_2026_03_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_2026_03_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_2026_03_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_2026_03_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_2026_03_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_2026_03_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_2026_03_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_2026_03_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_03_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("text_ops"), table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.costNanos.asc().nullsLast().op("text_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_2026_03_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_2026_03_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_2026_03_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_03_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_03_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_03_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_2026_03_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_2026_03_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_03_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_2026_03_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_03_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_03_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_03_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("bool_ops")),
	index("gateway_requests_2026_03_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_auth_method_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.authMethod.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_2026_03_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.clientSourceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.id.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_03_workspace_id_end_user_id_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.endUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_finish_reason_created_at_").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.finishReason.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_03_workspace_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_oauth_client_id_created_a").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.oauthClientId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_request_id_create_2cece09").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_03_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestedModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.sessionId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_2026_03_workspace_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.success.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(success = true)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_2026_03_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);

export const gatewayRequests202604 = pgTable("gateway_requests_2026_04", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_2026_04_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_2026_04_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_2026_04_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_2026_04_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_2026_04_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_2026_04_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_2026_04_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_2026_04_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_2026_04_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_2026_04_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_2026_04_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_04_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("text_ops"), table.routedModelId.asc().nullsLast().op("text_ops"), table.costNanos.asc().nullsLast().op("timestamptz_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_2026_04_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_2026_04_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_2026_04_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_04_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_04_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_04_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_2026_04_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_2026_04_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_04_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_2026_04_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_04_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_04_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_04_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("bool_ops")),
	index("gateway_requests_2026_04_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_auth_method_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.authMethod.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_04_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.clientSourceId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.id.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_04_workspace_id_end_user_id_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.endUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_finish_reason_created_at_").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.finishReason.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_2026_04_workspace_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_oauth_client_id_created_a").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.oauthClientId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_request_id_create_cefa2f4").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.requestId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_04_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestedModelId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.routedModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.sessionId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_2026_04_workspace_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.success.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(success = true)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_2026_04_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);

export const gatewayRequests202605 = pgTable("gateway_requests_2026_05", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_2026_05_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_2026_05_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_2026_05_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_2026_05_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_2026_05_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_2026_05_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_2026_05_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_2026_05_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_2026_05_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_2026_05_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_2026_05_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_05_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("text_ops"), table.routedModelId.asc().nullsLast().op("text_ops"), table.costNanos.asc().nullsLast().op("timestamptz_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_2026_05_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_2026_05_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_2026_05_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_05_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_05_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_05_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_2026_05_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_2026_05_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("text_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_05_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_2026_05_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_05_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_05_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_05_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_05_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_auth_method_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.authMethod.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_05_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.clientSourceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.id.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_05_workspace_id_end_user_id_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.endUserId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_finish_reason_created_at_").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.finishReason.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_2026_05_workspace_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_oauth_client_id_created_a").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.oauthClientId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_request_id_create_ca18a44").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_05_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestedModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.sessionId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_2026_05_workspace_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.success.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(success = true)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_2026_05_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);

export const gatewayRequests202606 = pgTable("gateway_requests_2026_06", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_2026_06_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_2026_06_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_2026_06_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_2026_06_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_2026_06_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_2026_06_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_2026_06_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_2026_06_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_2026_06_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_2026_06_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_2026_06_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_06_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.routedModelId.asc().nullsLast().op("text_ops"), table.costNanos.asc().nullsLast().op("timestamptz_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_2026_06_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_2026_06_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_2026_06_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_06_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_06_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_06_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_2026_06_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_2026_06_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_06_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_2026_06_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_06_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_06_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_06_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_06_team_id_auth_method_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.authMethod.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_06_team_id_end_user_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.endUserId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_2026_06_team_id_finish_reason_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.finishReason.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_06_team_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_06_team_id_oauth_client_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.oauthClientId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_06_team_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_06_team_id_request_id_created_at_idx1").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_2026_06_team_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.sessionId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_2026_06_team_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.success.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(success = true)`),
	index("gateway_requests_2026_06_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_2026_06_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.clientSourceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_2026_06_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.id.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_06_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestedModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_2026_06_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.routedModelId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_2026_06_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);

export const gatewayRequests202607 = pgTable("gateway_requests_2026_07", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_2026_07_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_2026_07_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_2026_07_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_2026_07_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_2026_07_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_2026_07_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_2026_07_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_2026_07_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_2026_07_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_2026_07_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_2026_07_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_07_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.costNanos.asc().nullsLast().op("timestamptz_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_2026_07_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_2026_07_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_2026_07_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_07_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_07_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_07_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_2026_07_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_2026_07_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_07_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_2026_07_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_07_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_07_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_07_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("bool_ops")),
	index("gateway_requests_2026_07_team_id_auth_method_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.authMethod.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_07_team_id_end_user_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.endUserId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_2026_07_team_id_finish_reason_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.finishReason.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_2026_07_team_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.modelId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_07_team_id_oauth_client_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.oauthClientId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_07_team_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.provider.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_07_team_id_request_id_created_at_idx1").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.requestId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_07_team_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.sessionId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_2026_07_team_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.success.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("bool_ops")).where(sql`(success = true)`),
	index("gateway_requests_2026_07_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_2026_07_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.clientSourceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_2026_07_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops"), table.id.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_07_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestedModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_2026_07_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.routedModelId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_2026_07_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);

export const gatewayRequests202608 = pgTable("gateway_requests_2026_08", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_2026_08_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_2026_08_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_2026_08_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_2026_08_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_2026_08_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_2026_08_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_2026_08_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_2026_08_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_2026_08_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_2026_08_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_2026_08_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_08_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.routedModelId.asc().nullsLast().op("text_ops"), table.costNanos.asc().nullsLast().op("text_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_2026_08_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_2026_08_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_2026_08_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_08_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_08_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_08_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_2026_08_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_2026_08_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_08_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_2026_08_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_08_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_08_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_08_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_2026_08_team_id_auth_method_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.authMethod.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_08_team_id_end_user_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.endUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_2026_08_team_id_finish_reason_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.finishReason.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_2026_08_team_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_08_team_id_oauth_client_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.oauthClientId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_08_team_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_08_team_id_request_id_created_at_idx1").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_08_team_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.sessionId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_2026_08_team_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("bool_ops"), table.success.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")).where(sql`(success = true)`),
	index("gateway_requests_2026_08_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_2026_08_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.clientSourceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_2026_08_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops"), table.id.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_08_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestedModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_2026_08_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.routedModelId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_2026_08_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);

export const gatewayRequests202609 = pgTable("gateway_requests_2026_09", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_2026_09_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_2026_09_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_2026_09_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_2026_09_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_2026_09_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_2026_09_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_2026_09_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_2026_09_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_2026_09_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_2026_09_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_2026_09_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_09_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.routedModelId.asc().nullsLast().op("text_ops"), table.costNanos.asc().nullsLast().op("text_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_2026_09_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_2026_09_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_2026_09_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_09_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_09_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_09_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_2026_09_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_2026_09_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_09_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_2026_09_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	index("gateway_requests_2026_09_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_09_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_2026_09_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("bool_ops")),
	index("gateway_requests_2026_09_team_id_auth_method_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.authMethod.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_2026_09_team_id_end_user_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.endUserId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_2026_09_team_id_finish_reason_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.finishReason.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_2026_09_team_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_2026_09_team_id_oauth_client_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.oauthClientId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_2026_09_team_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.provider.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_2026_09_team_id_request_id_created_at_idx1").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.requestId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_09_team_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.sessionId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_2026_09_team_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.success.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("bool_ops")).where(sql`(success = true)`),
	index("gateway_requests_2026_09_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_2026_09_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.clientSourceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_2026_09_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops"), table.id.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_2026_09_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestedModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_2026_09_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_2026_09_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);

export const gatewayRequestsDefault = pgTable("gateway_requests_default", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	requestId: text("request_id").notNull(),
	appId: uuid("app_id"),
	endpoint: text().notNull(),
	modelId: text("model_id"),
	provider: text(),
	nativeResponseId: text("native_response_id"),
	stream: boolean().default(false).notNull(),
	byok: boolean().default(false).notNull(),
	statusCode: integer("status_code"),
	success: boolean().default(false).notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	latencyMs: integer("latency_ms"),
	generationMs: integer("generation_ms"),
	usage: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costNanos: bigint("cost_nanos", { mode: "number" }),
	currency: text(),
	pricingLines: jsonb("pricing_lines").default([]).notNull(),
	keyId: uuid("key_id"),
	throughput: numeric(),
	location: text(),
	authMethod: text("auth_method").default('api_key'),
	oauthClientId: text("oauth_client_id"),
	oauthUserId: uuid("oauth_user_id"),
	finishReason: text("finish_reason"),
	endUserId: text("end_user_id"),
	sessionId: text("session_id"),
	traceData: jsonb("trace_data"),
	canonicalModelId: text("canonical_model_id"),
	providerAttempts: jsonb("provider_attempts").default([]).notNull(),
	errorPayload: jsonb("error_payload"),
	requestedModelId: text("requested_model_id"),
	routedModelId: text("routed_model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalTokens: bigint("usage_total_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTokens: bigint("usage_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTokens: bigint("usage_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageReasoningTokens: bigint("usage_reasoning_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputTextTokens: bigint("usage_input_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputTextTokens: bigint("usage_output_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputImageTokens: bigint("usage_input_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputImageTokens: bigint("usage_output_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputAudioTokens: bigint("usage_input_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputAudioTokens: bigint("usage_output_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputVideoTokens: bigint("usage_input_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputVideoTokens: bigint("usage_output_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageInputs: bigint("usage_image_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageImageOutputs: bigint("usage_image_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioInputs: bigint("usage_audio_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageAudioOutputs: bigint("usage_audio_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoInputs: bigint("usage_video_inputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageVideoOutputs: bigint("usage_video_outputs", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTokens: bigint("usage_cached_read_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTokens: bigint("usage_cached_write_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadTextTokens: bigint("usage_cached_read_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens: bigint("usage_cached_write_text_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens5M: bigint("usage_cached_write_text_tokens_5m", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteTextTokens1H: bigint("usage_cached_write_text_tokens_1h", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadImageTokens: bigint("usage_cached_read_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteImageTokens: bigint("usage_cached_write_image_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadAudioTokens: bigint("usage_cached_read_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteAudioTokens: bigint("usage_cached_write_audio_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedReadVideoTokens: bigint("usage_cached_read_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageCachedWriteVideoTokens: bigint("usage_cached_write_video_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputQuadTokens: bigint("usage_input_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputQuadTokens: bigint("usage_output_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalQuadTokens: bigint("usage_total_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTextQuadTokens: bigint("usage_text_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageRerankQuadTokens: bigint("usage_rerank_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingQuadTokens: bigint("usage_embedding_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageModerationQuadTokens: bigint("usage_moderation_quad_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOcrQuadTokens: bigint("usage_ocr_quad_tokens", { mode: "number" }).default(0).notNull(),
	usageImageMegapixels: numeric("usage_image_megapixels").default('0').notNull(),
	usageAudioSeconds: numeric("usage_audio_seconds").default('0').notNull(),
	usageVideoPixelSeconds: numeric("usage_video_pixel_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageInputCharacters: bigint("usage_input_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageOutputCharacters: bigint("usage_output_characters", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageTotalCharacters: bigint("usage_total_characters", { mode: "number" }).default(0).notNull(),
	usageNormalizedAt: timestamp("usage_normalized_at", { withTimezone: true, mode: 'string' }),
	detailMetadata: jsonb("detail_metadata"),
	usageVideoSeconds: numeric("usage_video_seconds").default('0').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageEmbeddingTokens: bigint("usage_embedding_tokens", { mode: "number" }).default(0).notNull(),
	apiModelId: text("api_model_id"),
	pricingPlan: text("pricing_plan"),
	isFreeVariant: boolean("is_free_variant").default(false).notNull(),
	realtimeSessionId: text("realtime_session_id"),
	providerTtftMs: integer("provider_ttft_ms"),
	gatewayTtftMs: integer("gateway_ttft_ms"),
	outputSpeedTps: numeric("output_speed_tps", { precision: 30, scale:  12 }),
	tpotMs: numeric("tpot_ms", { precision: 30, scale:  12 }),
	itlMs: numeric("itl_ms", { precision: 30, scale:  12 }),
	phaseoOverheadMs: integer("phaseo_overhead_ms"),
	clientSourceId: text("client_source_id").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)`),
	clientSourceName: text("client_source_name").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)`),
	clientSourceKind: text("client_source_kind").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)`),
	clientSourceVersion: text("client_source_version").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)`),
	clientSourceDetection: text("client_source_detection").generatedAlwaysAs(sql`NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)`),
}, (table) => [
	index("gateway_requests_default_api_model_id_created_at_idx").using("btree", table.apiModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(api_model_id IS NOT NULL)`),
	index("gateway_requests_default_app_id_created_at_idx").using("btree", table.appId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(app_id IS NOT NULL)`),
	index("gateway_requests_default_auth_method_idx").using("btree", table.authMethod.asc().nullsLast().op("text_ops")).where(sql`(auth_method = 'oauth'::text)`),
	index("gateway_requests_default_canonical_model_id_created_at_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_total_tokens > 0)`),
	index("gateway_requests_default_canonical_model_id_created_at_idx1").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0))`),
	index("gateway_requests_default_canonical_model_id_created_at_idx2").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0))`),
	index("gateway_requests_default_canonical_model_id_created_at_idx3").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(usage_reasoning_tokens > 0)`),
	index("gateway_requests_default_canonical_model_id_created_at_idx4").using("btree", table.canonicalModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(usage_total_quad_tokens > 0)`),
	index("gateway_requests_default_canonical_model_id_created_at_idx5").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric))`),
	index("gateway_requests_default_canonical_model_id_created_at_prov_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops")).where(sql`(canonical_model_id IS NOT NULL)`),
	index("gateway_requests_default_canonical_model_id_provider_create_idx").using("btree", table.canonicalModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_default_created_at_routed_model_id_cost_na_idx").using("btree", table.createdAt.desc().nullsFirst().op("text_ops"), table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.costNanos.asc().nullsLast().op("timestamptz_ops")).where(sql`(requested_model_id = 'phaseo/free'::text)`),
	index("gateway_requests_default_finish_reason_created_at_idx").using("btree", table.finishReason.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(finish_reason IS NOT NULL)`),
	index("gateway_requests_default_key_id_idx").using("btree", table.keyId.asc().nullsLast().op("uuid_ops")).where(sql`(key_id IS NOT NULL)`),
	index("gateway_requests_default_model_id_created_at_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_default_model_id_created_at_provider_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_default_oauth_client_id_idx").using("btree", table.oauthClientId.asc().nullsLast().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_default_oauth_user_id_idx").using("btree", table.oauthUserId.asc().nullsLast().op("uuid_ops")).where(sql`(oauth_user_id IS NOT NULL)`),
	index("gateway_requests_default_pricing_plan_created_at_idx").using("btree", table.pricingPlan.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(pricing_plan IS NOT NULL)`),
	index("gateway_requests_default_provider_created_at_idx").using("btree", table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_default_provider_model_id_created_at_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`((provider IS NOT NULL) AND (model_id IS NOT NULL))`),
	uniqueIndex("gateway_requests_default_realtime_session_id_created_at_idx").using("btree", table.realtimeSessionId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_default_requested_model_id_provider_create_idx").using("btree", table.requestedModelId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((requested_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_default_routed_model_id_provider_created_a_idx").using("btree", table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`((routed_model_id IS NOT NULL) AND (provider IS NOT NULL))`),
	index("gateway_requests_default_success_created_at_idx").using("btree", table.success.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("bool_ops")),
	index("gateway_requests_default_trace_data_idx").using("gin", table.traceData.asc().nullsLast().op("jsonb_path_ops")).where(sql`(trace_data IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_auth_method_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.authMethod.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_default_workspace_id_client_source_id_crea_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.clientSourceId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(client_source_id IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_created_at_id_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops"), table.id.desc().nullsFirst().op("timestamptz_ops")),
	index("gateway_requests_default_workspace_id_end_user_id_created_at_id").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.endUserId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(end_user_id IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_finish_reason_created_at_").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.finishReason.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("gateway_requests_default_workspace_id_model_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.modelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(model_id IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_oauth_client_id_created_a").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops"), table.oauthClientId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("text_ops")).where(sql`(oauth_client_id IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_provider_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(provider IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_request_id_create_50040d5").using("btree", table.workspaceId.asc().nullsLast().op("text_ops"), table.requestId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	index("gateway_requests_default_workspace_id_requested_model_id_cr_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.requestedModelId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(requested_model_id IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_routed_model_id_creat_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.routedModelId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")).where(sql`(routed_model_id IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_session_id_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("timestamptz_ops"), table.sessionId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(session_id IS NOT NULL)`),
	index("gateway_requests_default_workspace_id_success_created_at_idx").using("btree", table.workspaceId.asc().nullsLast().op("bool_ops"), table.success.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(success = true)`),
	foreignKey({
			columns: [table.appId],
			foreignColumns: [apiApps.id],
			name: "gateway_requests_app_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [keys.id],
			name: "gateway_requests_key_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "gateway_requests_workspace_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.createdAt, table.id], name: "gateway_requests_default_pkey"}),
	check("gateway_requests_auth_method_check", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_auth_method_ck", sql`auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])`),
	check("gateway_requests_model_id_present_ck", sql`NULLIF(btrim(model_id), ''::text) IS NOT NULL`),
	check("gateway_requests_performance_metrics_nonnegative", sql`((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))`),
]);
export const oauthAppsWithStats = pgView("oauth_apps_with_stats", {	id: uuid(),
	clientId: text("client_id"),
	workspaceId: uuid("workspace_id"),
	name: text(),
	description: text(),
	homepageUrl: text("homepage_url"),
	logoUrl: text("logo_url"),
	privacyPolicyUrl: text("privacy_policy_url"),
	termsOfServiceUrl: text("terms_of_service_url"),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	status: text(),
	redirectUris: text("redirect_uris"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activeAuthorizations: bigint("active_authorizations", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalAuthorizations: bigint("total_authorizations", { mode: "number" }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requestsLast30D: bigint("requests_last_30d", { mode: "number" }),
}).with({"securityInvoker":true}).as(sql`SELECT oam.id, oam.client_id, oam.workspace_id, oam.name, oam.description, oam.homepage_url, oam.logo_url, oam.privacy_policy_url, oam.terms_of_service_url, oam.created_by, oam.created_at, oam.updated_at, oam.status, oam.redirect_uris, count(DISTINCT oa.id) FILTER (WHERE oa.revoked_at IS NULL) AS active_authorizations, count(DISTINCT oa.id) AS total_authorizations, max(oa.last_used_at) AS last_used_at, count(DISTINCT gr.id) AS requests_last_30d FROM oauth_app_metadata oam LEFT JOIN oauth_authorizations oa ON oa.client_id = oam.client_id LEFT JOIN gateway_requests gr ON gr.oauth_client_id = oam.client_id AND gr.created_at > (now() - '30 days'::interval) WHERE oam.status = 'active'::text GROUP BY oam.id`);

export const v2RpcGatewayActivityRollupDaily = pgView("v2_rpc_gateway_activity_rollup_daily", {	dayBucket: date("day_bucket"),
	teamId: uuid("team_id"),
	modelId: text("model_id"),
	endpoint: text(),
	provider: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageNanos: bigint("usage_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	byokUsageNanos: bigint("byok_usage_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	promptTokens: bigint("prompt_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	completionTokens: bigint("completion_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reasoningTokens: bigint("reasoning_tokens", { mode: "number" }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}).with({"securityInvoker":true}).as(sql`SELECT usage.usage_date AS day_bucket, usage.workspace_id AS team_id, usage.model_slug AS model_id, 'unknown'::text AS endpoint, route.provider_slug AS provider, 0::bigint AS usage_nanos, 0::bigint AS byok_usage_nanos, usage.requests, 0::bigint AS prompt_tokens, 0::bigint AS completion_tokens, 0::bigint AS reasoning_tokens, usage.updated_at FROM v2_private_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id`);

export const v2RpcGatewayModelUsageDaily = pgView("v2_rpc_gateway_model_usage_daily", {	dayBucket: date("day_bucket"),
	modelId: text("model_id"),
	providerId: text("provider_id"),
	endpoint: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successRequests: bigint("success_requests", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedRequests: bigint("failed_requests", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	neutralRequests: bigint("neutral_requests", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rateLimitedRequests: bigint("rate_limited_requests", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalTokens: bigint("total_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputTokens: bigint("input_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputTokens: bigint("output_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reasoningTokens: bigint("reasoning_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputTextTokens: bigint("input_text_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputTextTokens: bigint("output_text_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputImageTokens: bigint("input_image_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputImageTokens: bigint("output_image_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputAudioTokens: bigint("input_audio_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputAudioTokens: bigint("output_audio_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputVideoTokens: bigint("input_video_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputVideoTokens: bigint("output_video_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	imageInputs: bigint("image_inputs", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	imageOutputs: bigint("image_outputs", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	audioInputs: bigint("audio_inputs", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	audioOutputs: bigint("audio_outputs", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	videoInputs: bigint("video_inputs", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	videoOutputs: bigint("video_outputs", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedReadTokens: bigint("cached_read_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedWriteTokens: bigint("cached_write_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedReadTextTokens: bigint("cached_read_text_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedWriteTextTokens: bigint("cached_write_text_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedReadImageTokens: bigint("cached_read_image_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedWriteImageTokens: bigint("cached_write_image_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedReadAudioTokens: bigint("cached_read_audio_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedWriteAudioTokens: bigint("cached_write_audio_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedReadVideoTokens: bigint("cached_read_video_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedWriteVideoTokens: bigint("cached_write_video_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCostNanos: bigint("total_cost_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySamples: bigint("latency_samples", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSumMs: bigint("generation_sum_ms", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSamples: bigint("generation_samples", { mode: "number" }),
	throughputSum: numeric("throughput_sum", { precision: 30, scale:  12 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	throughputSamples: bigint("throughput_samples", { mode: "number" }),
	lastRequestAt: timestamp("last_request_at", { withTimezone: true, mode: 'string' }),
	refreshedAt: timestamp("refreshed_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputQuadTokens: bigint("input_quad_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputQuadTokens: bigint("output_quad_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalQuadTokens: bigint("total_quad_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedWriteTextTokens5M: bigint("cached_write_text_tokens_5m", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cachedWriteTextTokens1H: bigint("cached_write_text_tokens_1h", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	textQuadTokens: bigint("text_quad_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rerankQuadTokens: bigint("rerank_quad_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	embeddingQuadTokens: bigint("embedding_quad_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	moderationQuadTokens: bigint("moderation_quad_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ocrQuadTokens: bigint("ocr_quad_tokens", { mode: "number" }),
	imageMegapixels: numeric("image_megapixels"),
	audioSeconds: numeric("audio_seconds"),
	videoPixelSeconds: numeric("video_pixel_seconds"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputCharacters: bigint("input_characters", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputCharacters: bigint("output_characters", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCharacters: bigint("total_characters", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	embeddingTokens: bigint("embedding_tokens", { mode: "number" }),
	videoSeconds: numeric("video_seconds"),
}).with({"securityInvoker":true}).as(sql`WITH meters AS ( SELECT meter.rollup_id, jsonb_object_agg(meter.meter_key, meter.quantity) AS "values" FROM v2_public_usage_daily_meters meter GROUP BY meter.rollup_id ) SELECT usage.usage_date AS day_bucket, usage.model_slug AS model_id, route.provider_slug AS provider_id, 'unknown'::text AS endpoint, usage.requests, usage.successful_requests AS success_requests, usage.failed_requests, 0::bigint AS neutral_requests, usage.rate_limited_requests, COALESCE((meters."values" ->> 'total_tokens'::text)::numeric, ((meters."values" ->> 'input_tokens'::text)::numeric) + ((meters."values" ->> 'output_tokens'::text)::numeric), ((meters."values" ->> 'input_text_tokens'::text)::numeric) + ((meters."values" ->> 'output_text_tokens'::text)::numeric), 0::numeric)::bigint AS total_tokens, COALESCE((meters."values" ->> 'input_tokens'::text)::numeric, (meters."values" ->> 'input_text_tokens'::text)::numeric, 0::numeric)::bigint AS input_tokens, COALESCE((meters."values" ->> 'output_tokens'::text)::numeric, (meters."values" ->> 'output_text_tokens'::text)::numeric, 0::numeric)::bigint AS output_tokens, COALESCE((meters."values" ->> 'reasoning_tokens'::text)::numeric, 0::numeric)::bigint AS reasoning_tokens, COALESCE((meters."values" ->> 'input_text_tokens'::text)::numeric, 0::numeric)::bigint AS input_text_tokens, COALESCE((meters."values" ->> 'output_text_tokens'::text)::numeric, 0::numeric)::bigint AS output_text_tokens, COALESCE((meters."values" ->> 'input_image_tokens'::text)::numeric, 0::numeric)::bigint AS input_image_tokens, COALESCE((meters."values" ->> 'output_image_tokens'::text)::numeric, 0::numeric)::bigint AS output_image_tokens, COALESCE((meters."values" ->> 'input_audio_tokens'::text)::numeric, 0::numeric)::bigint AS input_audio_tokens, COALESCE((meters."values" ->> 'output_audio_tokens'::text)::numeric, 0::numeric)::bigint AS output_audio_tokens, COALESCE((meters."values" ->> 'input_video_tokens'::text)::numeric, 0::numeric)::bigint AS input_video_tokens, COALESCE((meters."values" ->> 'output_video_tokens'::text)::numeric, 0::numeric)::bigint AS output_video_tokens, COALESCE((meters."values" ->> 'image_inputs'::text)::numeric, (meters."values" ->> 'input_images'::text)::numeric, 0::numeric)::bigint AS image_inputs, COALESCE((meters."values" ->> 'image_outputs'::text)::numeric, (meters."values" ->> 'output_images'::text)::numeric, 0::numeric)::bigint AS image_outputs, COALESCE((meters."values" ->> 'audio_inputs'::text)::numeric, 0::numeric)::bigint AS audio_inputs, COALESCE((meters."values" ->> 'audio_outputs'::text)::numeric, 0::numeric)::bigint AS audio_outputs, COALESCE((meters."values" ->> 'video_inputs'::text)::numeric, 0::numeric)::bigint AS video_inputs, COALESCE((meters."values" ->> 'video_outputs'::text)::numeric, 0::numeric)::bigint AS video_outputs, COALESCE((meters."values" ->> 'cached_read_tokens'::text)::numeric, (meters."values" ->> 'cached_input_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_tokens, COALESCE((meters."values" ->> 'cached_write_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_tokens, COALESCE((meters."values" ->> 'cached_read_text_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_text_tokens, COALESCE((meters."values" ->> 'cached_write_text_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_text_tokens, COALESCE((meters."values" ->> 'cached_read_image_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_image_tokens, COALESCE((meters."values" ->> 'cached_write_image_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_image_tokens, COALESCE((meters."values" ->> 'cached_read_audio_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_audio_tokens, COALESCE((meters."values" ->> 'cached_write_audio_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_audio_tokens, COALESCE((meters."values" ->> 'cached_read_video_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_video_tokens, COALESCE((meters."values" ->> 'cached_write_video_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_video_tokens, 0::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.generation_sum_ms, usage.generation_count AS generation_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, usage.updated_at AS last_request_at, usage.updated_at AS refreshed_at, COALESCE((meters."values" ->> 'input_quad_tokens'::text)::numeric, 0::numeric)::bigint AS input_quad_tokens, COALESCE((meters."values" ->> 'output_quad_tokens'::text)::numeric, 0::numeric)::bigint AS output_quad_tokens, COALESCE((meters."values" ->> 'total_quad_tokens'::text)::numeric, 0::numeric)::bigint AS total_quad_tokens, COALESCE((meters."values" ->> 'cached_write_text_tokens_5m'::text)::numeric, 0::numeric)::bigint AS cached_write_text_tokens_5m, COALESCE((meters."values" ->> 'cached_write_text_tokens_1h'::text)::numeric, 0::numeric)::bigint AS cached_write_text_tokens_1h, COALESCE((meters."values" ->> 'text_quad_tokens'::text)::numeric, 0::numeric)::bigint AS text_quad_tokens, COALESCE((meters."values" ->> 'rerank_quad_tokens'::text)::numeric, 0::numeric)::bigint AS rerank_quad_tokens, COALESCE((meters."values" ->> 'embedding_quad_tokens'::text)::numeric, 0::numeric)::bigint AS embedding_quad_tokens, COALESCE((meters."values" ->> 'moderation_quad_tokens'::text)::numeric, 0::numeric)::bigint AS moderation_quad_tokens, COALESCE((meters."values" ->> 'ocr_quad_tokens'::text)::numeric, 0::numeric)::bigint AS ocr_quad_tokens, COALESCE((meters."values" ->> 'image_megapixels'::text)::numeric, 0::numeric) AS image_megapixels, COALESCE((meters."values" ->> 'audio_seconds'::text)::numeric, 0::numeric) AS audio_seconds, COALESCE((meters."values" ->> 'video_pixel_seconds'::text)::numeric, 0::numeric) AS video_pixel_seconds, COALESCE((meters."values" ->> 'input_characters'::text)::numeric, 0::numeric)::bigint AS input_characters, COALESCE((meters."values" ->> 'output_characters'::text)::numeric, 0::numeric)::bigint AS output_characters, COALESCE((meters."values" ->> 'total_characters'::text)::numeric, 0::numeric)::bigint AS total_characters, COALESCE((meters."values" ->> 'embedding_tokens'::text)::numeric, 0::numeric)::bigint AS embedding_tokens, COALESCE((meters."values" ->> 'video_seconds'::text)::numeric, 0::numeric) AS video_seconds FROM v2_public_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id`);

export const v2WebPublicUsageDaily = pgView("v2_web_public_usage_daily", {	dayBucket: date("day_bucket"),
	canonicalModelId: text("canonical_model_id"),
	provider: text(),
	appId: uuid("app_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successRequests: bigint("success_requests", { mode: "number" }),
	totalTokens: numeric("total_tokens"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCostNanos: bigint("total_cost_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySamples: bigint("latency_samples", { mode: "number" }),
	throughputSum: numeric("throughput_sum", { precision: 30, scale:  12 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	throughputSamples: bigint("throughput_samples", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSumMs: bigint("generation_sum_ms", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSamples: bigint("generation_samples", { mode: "number" }),
}).with({"securityInvoker":true}).as(sql`WITH meters AS ( SELECT meter.rollup_id, COALESCE(max(meter.quantity) FILTER (WHERE meter.meter_key = 'total_tokens'::text), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_tokens'::text, 'output_tokens'::text])), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_text_tokens'::text, 'output_text_tokens'::text])), 0::numeric) AS total_tokens FROM v2_public_usage_daily_meters meter GROUP BY meter.rollup_id ) SELECT usage.usage_date AS day_bucket, usage.model_slug AS canonical_model_id, route.provider_slug AS provider, usage.app_id, usage.requests, usage.successful_requests AS success_requests, COALESCE(meters.total_tokens, 0::numeric) AS total_tokens, usage.cost_nanos::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, usage.generation_sum_ms, usage.generation_count AS generation_samples FROM v2_public_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id`);

export const v2RpcGatewayUsageRollupDailyApp = pgView("v2_rpc_gateway_usage_rollup_daily_app", {	dayBucket: timestamp("day_bucket", { withTimezone: true, mode: 'string' }),
	appId: uuid("app_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successRequests: bigint("success_requests", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalTokens: bigint("total_tokens", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCostNanos: bigint("total_cost_nanos", { mode: "number" }),
	uniqueModels: integer("unique_models"),
}).with({"securityInvoker":true}).as(sql`SELECT day_bucket::timestamp with time zone AS day_bucket, app_id, sum(requests)::bigint AS requests, sum(success_requests)::bigint AS success_requests, sum(total_tokens)::bigint AS total_tokens, sum(total_cost_nanos)::bigint AS total_cost_nanos, count(DISTINCT canonical_model_id)::integer AS unique_models FROM v2_web_public_usage_daily usage WHERE app_id IS NOT NULL GROUP BY day_bucket, app_id`);

export const v2RpcPublicAppModelUsageDaily = pgView("v2_rpc_public_app_model_usage_daily", {	dayBucket: date("day_bucket"),
	appId: text("app_id"),
	modelId: text("model_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tokens: bigint({ mode: "number" }),
	refreshedAt: timestamp("refreshed_at", { withTimezone: true, mode: 'string' }),
}).with({"securityInvoker":true}).as(sql`SELECT usage.day_bucket, usage.app_id::text AS app_id, usage.canonical_model_id AS model_id, usage.requests, usage.total_tokens::bigint AS tokens, now() AS refreshed_at FROM v2_web_public_usage_daily usage JOIN api_apps app ON app.id = usage.app_id AND app.is_public = true`);

export const v2WebPrivateUsageDaily = pgView("v2_web_private_usage_daily", {	bucket15M: timestamp("bucket_15m", { withTimezone: true, mode: 'string' }),
	workspaceId: uuid("workspace_id"),
	canonicalModelId: text("canonical_model_id"),
	provider: text(),
	appId: uuid("app_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successRequests: bigint("success_requests", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCostNanos: bigint("total_cost_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySamples: bigint("latency_samples", { mode: "number" }),
	throughputSum: numeric("throughput_sum", { precision: 30, scale:  12 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	throughputSamples: bigint("throughput_samples", { mode: "number" }),
	totalTokens: numeric("total_tokens"),
}).with({"securityInvoker":true}).as(sql`WITH meters AS ( SELECT meter.rollup_id, COALESCE(max(meter.quantity) FILTER (WHERE meter.meter_key = 'total_tokens'::text), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_tokens'::text, 'output_tokens'::text, 'input_text_tokens'::text, 'output_text_tokens'::text])), 0::numeric) AS total_tokens FROM v2_private_usage_daily_meters meter GROUP BY meter.rollup_id ) SELECT usage.usage_date::timestamp with time zone AS bucket_15m, usage.workspace_id, usage.model_slug AS canonical_model_id, route.provider_slug AS provider, usage.app_id, usage.requests, usage.successful_requests AS success_requests, usage.cost_nanos::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, COALESCE(meters.total_tokens, 0::numeric) AS total_tokens FROM v2_private_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id`);

export const v2WebPublicUsageHourly = pgView("v2_web_public_usage_hourly", {	bucket15M: timestamp("bucket_15m", { withTimezone: true, mode: 'string' }),
	canonicalModelId: text("canonical_model_id"),
	provider: text(),
	appId: uuid("app_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	requests: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successRequests: bigint("success_requests", { mode: "number" }),
	totalTokens: numeric("total_tokens"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCostNanos: bigint("total_cost_nanos", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySumMs: bigint("latency_sum_ms", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	latencySamples: bigint("latency_samples", { mode: "number" }),
	throughputSum: numeric("throughput_sum", { precision: 30, scale:  12 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	throughputSamples: bigint("throughput_samples", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSumMs: bigint("generation_sum_ms", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	generationSamples: bigint("generation_samples", { mode: "number" }),
}).with({"securityInvoker":true}).as(sql`WITH meters AS ( SELECT meter.rollup_id, COALESCE(max(meter.quantity) FILTER (WHERE meter.meter_key = 'total_tokens'::text), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_tokens'::text, 'output_tokens'::text])), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_text_tokens'::text, 'output_text_tokens'::text])), 0::numeric) AS total_tokens FROM v2_public_usage_hourly_meters meter GROUP BY meter.rollup_id ) SELECT usage.bucket_start AS bucket_15m, usage.model_slug AS canonical_model_id, route.provider_slug AS provider, usage.app_id, usage.requests, usage.successful_requests AS success_requests, COALESCE(meters.total_tokens, 0::numeric) AS total_tokens, usage.cost_nanos::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, usage.generation_sum_ms, usage.generation_count AS generation_samples FROM v2_public_usage_hourly usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id`);
