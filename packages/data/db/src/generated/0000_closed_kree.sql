-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."data_api_provider_capability_status" AS ENUM('active', 'deranked', 'disabled', 'inactive', 'internal_testing', 'deranked_lvl1', 'deranked_lvl2', 'deranked_lvl3', 'coming_soon');--> statement-breakpoint
CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'approved', 'denied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."model_links" AS ENUM('api_reference', 'paper', 'anouncement', 'repository', 'weights', 'official_playground');--> statement-breakpoint
CREATE TYPE "public"."organisation_social_platforms" AS ENUM('website', 'x', 'github', 'instagram', 'youtube', 'linkedin', 'reddit', 'tiktok', 'threads', 'discord', 'hugging_face');--> statement-breakpoint
CREATE TYPE "public"."tiering_mode" AS ENUM('flat', 'cliff', 'marginal');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'user');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "byok_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"always_use" boolean DEFAULT false NOT NULL,
	"enc_value" "bytea" NOT NULL,
	"enc_iv" "bytea" NOT NULL,
	"enc_tag" "bytea" NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"fingerprint_sha256" text NOT NULL,
	"prefix" text NOT NULL,
	"suffix" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"verification_status" text DEFAULT 'unknown' NOT NULL,
	"error_message" text,
	"routing_mode" text DEFAULT 'fallback' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"allowed_model_slugs" text[],
	"allowed_api_key_ids" uuid[],
	CONSTRAINT "byok_keys_workspace_id_provider_id_fingerprint_sha256_key" UNIQUE("fingerprint_sha256","provider_id","workspace_id"),
	CONSTRAINT "byok_keys_allowed_api_key_ids_limit" CHECK ((allowed_api_key_ids IS NULL) OR (cardinality(allowed_api_key_ids) <= 256)),
	CONSTRAINT "byok_keys_allowed_model_slugs_limit" CHECK ((allowed_model_slugs IS NULL) OR (cardinality(allowed_model_slugs) <= 256)),
	CONSTRAINT "byok_keys_routing_mode_check" CHECK (routing_mode = ANY (ARRAY['priority'::text, 'fallback'::text]))
);
--> statement-breakpoint
ALTER TABLE "byok_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "catalogue_interaction_puzzles" (
	"puzzle_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_key" text NOT NULL,
	"puzzle_date" date NOT NULL,
	"public_payload" jsonb NOT NULL,
	"answer_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalogue_interaction_puzzles_game_key_puzzle_date_key" UNIQUE("game_key","puzzle_date"),
	CONSTRAINT "catalogue_interaction_puzzles_game_key_check" CHECK (game_key = ANY (ARRAY['modele'::text, 'timeline'::text, 'pricele'::text, 'head-to-head'::text, 'sprint'::text]))
);
--> statement-breakpoint
ALTER TABLE "catalogue_interaction_puzzles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_grant_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"amount_nanos" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_grant_redemptions_grant_user_unique" UNIQUE("grant_id","user_id"),
	CONSTRAINT "credit_grant_redemptions_amount_nanos_check" CHECK (amount_nanos > 0)
);
--> statement-breakpoint
ALTER TABLE "credit_grant_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"code_normalized" text NOT NULL,
	"amount_nanos" bigint NOT NULL,
	"max_redemptions" integer NOT NULL,
	"redemptions_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "credit_grants_amount_nanos_check" CHECK (amount_nanos > 0),
	CONSTRAINT "credit_grants_max_redemptions_check" CHECK (max_redemptions > 0),
	CONSTRAINT "credit_grants_redemption_bounds" CHECK (redemptions_count <= max_redemptions),
	CONSTRAINT "credit_grants_redemptions_count_check" CHECK (redemptions_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_time" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"kind" text NOT NULL,
	"amount_nanos" bigint NOT NULL,
	"before_balance_nanos" bigint NOT NULL,
	"after_balance_nanos" bigint NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text,
	"source_ref_type" text,
	"source_ref_id" text,
	"refund_claim_state" text,
	"refund_claim_reason" text,
	"refund_claimed_at" timestamp with time zone,
	"refund_claimed_by_user_id" uuid,
	"before_reserved_nanos" bigint,
	"after_reserved_nanos" bigint
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "data_contribution_consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"actor_key_id" uuid,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"policy_version" text NOT NULL,
	"sample_rate_bps" integer NOT NULL,
	"classifier_sample_rate_bps" integer NOT NULL,
	"discount_bps" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_contribution_consent_even_classifier_sample_rate_bps_check" CHECK ((classifier_sample_rate_bps >= 0) AND (classifier_sample_rate_bps <= 10000)),
	CONSTRAINT "data_contribution_consent_events_action_check" CHECK (action = ANY (ARRAY['enabled'::text, 'disabled'::text, 'change_denied'::text])),
	CONSTRAINT "data_contribution_consent_events_actor_type_check" CHECK (actor_type = ANY (ARRAY['user'::text, 'management_key'::text, 'system'::text])),
	CONSTRAINT "data_contribution_consent_events_discount_bps_check" CHECK ((discount_bps >= 0) AND (discount_bps <= 10000)),
	CONSTRAINT "data_contribution_consent_events_outcome_check" CHECK (outcome = ANY (ARRAY['succeeded'::text, 'denied'::text, 'failed'::text])),
	CONSTRAINT "data_contribution_consent_events_sample_rate_bps_check" CHECK ((sample_rate_bps >= 0) AND (sample_rate_bps <= 10000))
);
--> statement-breakpoint
ALTER TABLE "data_contribution_consent_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "data_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"endpoint" text NOT NULL,
	"model_slug" text NOT NULL,
	"provider_slug" text,
	"object_key" text NOT NULL,
	"object_bytes" integer NOT NULL,
	"object_sha256" text NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"consent_policy_version" text NOT NULL,
	"sample_rate_bps" integer NOT NULL,
	"classifier_sample_rate_bps" integer NOT NULL,
	"sample_bucket" integer NOT NULL,
	"redaction_version" text NOT NULL,
	"redaction_count" integer DEFAULT 0 NOT NULL,
	"discount_bps" integer NOT NULL,
	"discount_nanos" bigint DEFAULT 0 NOT NULL,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_contributions_workspace_id_request_id_key" UNIQUE("request_id","workspace_id"),
	CONSTRAINT "data_contributions_attempt_count_check" CHECK (attempt_count >= 0),
	CONSTRAINT "data_contributions_classifier_sample_rate_bps_check" CHECK ((classifier_sample_rate_bps >= 0) AND (classifier_sample_rate_bps <= 10000)),
	CONSTRAINT "data_contributions_discount_bps_check" CHECK ((discount_bps >= 0) AND (discount_bps <= 10000)),
	CONSTRAINT "data_contributions_discount_nanos_check" CHECK (discount_nanos >= 0),
	CONSTRAINT "data_contributions_input_tokens_check" CHECK ((input_tokens IS NULL) OR (input_tokens >= 0)),
	CONSTRAINT "data_contributions_object_bytes_check" CHECK (object_bytes > 0),
	CONSTRAINT "data_contributions_output_tokens_check" CHECK ((output_tokens IS NULL) OR (output_tokens >= 0)),
	CONSTRAINT "data_contributions_redaction_count_check" CHECK (redaction_count >= 0),
	CONSTRAINT "data_contributions_sample_bucket_check" CHECK ((sample_bucket >= 0) AND (sample_bucket <= 9999)),
	CONSTRAINT "data_contributions_sample_rate_bps_check" CHECK ((sample_rate_bps >= 0) AND (sample_rate_bps <= 10000)),
	CONSTRAINT "data_contributions_status_check" CHECK (status = ANY (ARRAY['retained'::text, 'pending'::text, 'processing'::text, 'complete'::text, 'failed'::text, 'deleted'::text]))
);
--> statement-breakpoint
ALTER TABLE "data_contributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"template" text DEFAULT 'generic' NOT NULL,
	"to_email" text NOT NULL,
	"subject" text,
	"workspace_id" uuid,
	"user_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"dedupe_key" text
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_async_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"internal_id" text NOT NULL,
	"native_id" text,
	"provider" text,
	"model" text,
	"status" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"billed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"session_id" text,
	"app_id" uuid,
	"next_reconcile_at" timestamp with time zone,
	"reconcile_attempts" integer DEFAULT 0 NOT NULL,
	"reconcile_locked_at" timestamp with time zone,
	"reconcile_locked_by" text,
	"last_reconcile_error" text,
	CONSTRAINT "gateway_async_operations_workspace_kind_internal_unique" UNIQUE("internal_id","kind","workspace_id"),
	CONSTRAINT "gateway_async_operations_kind_check" CHECK (kind = ANY (ARRAY['video'::text, 'batch'::text, 'music'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_async_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_batch_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"batch_id" text NOT NULL,
	"provider" text NOT NULL,
	"native_batch_id" text,
	"custom_id" text NOT NULL,
	"request_index" integer DEFAULT 0 NOT NULL,
	"method" text,
	"endpoint" text,
	"model" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"request_body_hash" text,
	"response_status" integer,
	"response_body" jsonb,
	"error_body" jsonb,
	"usage" jsonb,
	"cost_nanos" bigint,
	"cost_usd" numeric,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "gateway_batch_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_dynamic_route_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_dynamic_route_versions_route_version_key" UNIQUE("route_id","version"),
	CONSTRAINT "gateway_dynamic_route_versions_config_check" CHECK ((jsonb_typeof(config) = 'object'::text) AND (pg_column_size(config) <= 65536)),
	CONSTRAINT "gateway_dynamic_route_versions_version_check" CHECK (version > 0)
);
--> statement-breakpoint
ALTER TABLE "gateway_dynamic_route_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_dynamic_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deployed_version" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_dynamic_routes_workspace_slug_key" UNIQUE("slug","workspace_id"),
	CONSTRAINT "gateway_dynamic_routes_workspace_name_key" UNIQUE("name","workspace_id"),
	CONSTRAINT "gateway_dynamic_routes_config_check" CHECK ((jsonb_typeof(config) = 'object'::text) AND (pg_column_size(config) <= 65536)),
	CONSTRAINT "gateway_dynamic_routes_description_check" CHECK ((description IS NULL) OR (char_length(description) <= 500)),
	CONSTRAINT "gateway_dynamic_routes_name_check" CHECK ((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 80)),
	CONSTRAINT "gateway_dynamic_routes_slug_check" CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'::text),
	CONSTRAINT "gateway_dynamic_routes_status_check" CHECK (status = ANY (ARRAY['active'::text, 'paused'::text])),
	CONSTRAINT "gateway_dynamic_routes_version_check" CHECK (version > 0)
);
--> statement-breakpoint
ALTER TABLE "gateway_dynamic_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_io_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"io_log_status" text DEFAULT 'not_enabled' NOT NULL,
	"io_log_storage_provider" text,
	"io_log_bucket" text,
	"io_log_object_key" text,
	"io_log_bytes" bigint,
	"io_log_sha256" text,
	"io_log_content_type" text,
	"io_log_retention_until" timestamp with time zone,
	"io_log_error" text,
	CONSTRAINT "gateway_io_logs_workspace_request_key" UNIQUE("request_id","workspace_id"),
	CONSTRAINT "gateway_io_logs_status_check" CHECK (io_log_status = ANY (ARRAY['not_enabled'::text, 'stored'::text, 'missing_bucket'::text, 'too_large'::text, 'error'::text, 'deleted'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_io_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_observability_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text,
	"session_id" text,
	"preset_id" uuid,
	"test_run_id" uuid,
	"category" text DEFAULT 'custom' NOT NULL,
	"event_name" text NOT NULL,
	"value" jsonb,
	"numeric_value" numeric,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"end_user_id" text,
	"source" text DEFAULT 'api' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_observability_events_category_check" CHECK (category = ANY (ARRAY['feedback'::text, 'behavior'::text, 'outcome'::text, 'app'::text, 'test'::text, 'custom'::text])),
	CONSTRAINT "gateway_observability_events_metadata_dimensions_object_check" CHECK (jsonb_typeof(metadata_dimensions) = 'object'::text),
	CONSTRAINT "gateway_observability_events_name_check" CHECK ((length(btrim(event_name)) >= 1) AND (length(btrim(event_name)) <= 128)),
	CONSTRAINT "gateway_observability_events_source_check" CHECK (source = ANY (ARRAY['api'::text, 'user'::text, 'system'::text, 'import'::text, 'test'::text])),
	CONSTRAINT "gateway_observability_events_target_check" CHECK ((request_id IS NOT NULL) OR (session_id IS NOT NULL) OR (preset_id IS NOT NULL) OR (test_run_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "gateway_observability_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_preset_test_run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"test_run_id" uuid NOT NULL,
	"preset_id" uuid,
	"request_id" text,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_output" jsonb,
	"actual_output" jsonb,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"feedback_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_preset_test_run_items_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'passed'::text, 'failed'::text, 'error'::text, 'skipped'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_preset_test_run_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_preset_test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"preset_id" uuid,
	"baseline_preset_id" uuid,
	"name" text,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"dataset_name" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_preset_test_runs_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_preset_test_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"kind" text,
	"workspace_id" uuid,
	"internal_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"dead_lettered_at" timestamp with time zone,
	"replay_locked_at" timestamp with time zone,
	"replay_locked_by" text,
	CONSTRAINT "gateway_provider_events_provider_event_unique" UNIQUE("provider","provider_event_id")
);
--> statement-breakpoint
ALTER TABLE "gateway_provider_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_realtime_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key_id" uuid,
	"user_id" text,
	"source" text DEFAULT 'api' NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"provider_model_id" text,
	"voice" text,
	"status" text DEFAULT 'created' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connected_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"reservation_prefix" text NOT NULL,
	"reservation_count" integer DEFAULT 0 NOT NULL,
	"reserved_nanos" bigint DEFAULT 0 NOT NULL,
	"captured_nanos" bigint DEFAULT 0 NOT NULL,
	"released_nanos" bigint DEFAULT 0 NOT NULL,
	"estimated_cost_nanos" bigint DEFAULT 0 NOT NULL,
	"final_cost_nanos" bigint,
	"currency" text DEFAULT 'USD' NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_session_id" text,
	"provider_native_id" text,
	"provider_client_secret_hash" text,
	"disconnect_reason" text,
	"error_code" text,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_realtime_sessions_session_id_key" UNIQUE("session_id"),
	CONSTRAINT "gateway_realtime_sessions_source_check" CHECK (source = ANY (ARRAY['api'::text, 'chat'::text])),
	CONSTRAINT "gateway_realtime_sessions_status_check" CHECK (status = ANY (ARRAY['created'::text, 'connecting'::text, 'connected'::text, 'ending'::text, 'billing_unresolved'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'expired'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_realtime_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_models" (
	"model_slug" text PRIMARY KEY NOT NULL,
	"lab_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"input_modalities" text[] DEFAULT '{""}' NOT NULL,
	"output_modalities" text[] DEFAULT '{""}' NOT NULL,
	"family_slug" text,
	"announced_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"deprecated_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"license" text,
	"license_url" text,
	"previous_model_slug" text,
	"removal_date" timestamp with time zone,
	"replacement_model_slug" text,
	"variant_kind" text DEFAULT 'standard' NOT NULL,
	"base_model_slug" text,
	"catalogue_status" text DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "v2_models_catalogue_status_check" CHECK (catalogue_status = ANY (ARRAY['unknown'::text, 'rumoured'::text, 'announced'::text, 'preview'::text, 'available'::text, 'limited_access'::text, 'deprecated'::text, 'retired'::text, 'withheld'::text])),
	CONSTRAINT "v2_models_lab_slug_prefix_check" CHECK ((split_part(model_slug, '/'::text, 1) = lab_slug) AND (split_part(model_slug, '/'::text, 2) <> ''::text)),
	CONSTRAINT "v2_models_slug_check" CHECK ((model_slug = lower(model_slug)) AND (model_slug ~ '^[a-z0-9][a-z0-9._:/+@-]*$'::text)),
	CONSTRAINT "v2_models_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'retired'::text, 'disabled'::text])),
	CONSTRAINT "v2_models_variant_identity_check" CHECK (((variant_kind = 'standard'::text) AND (model_slug !~ ':free$'::text) AND (base_model_slug IS NULL)) OR ((variant_kind = 'free'::text) AND (model_slug ~ ':free$'::text) AND (base_model_slug IS NOT NULL) AND (base_model_slug <> model_slug))),
	CONSTRAINT "v2_models_variant_kind_check" CHECK (variant_kind = ANY (ARRAY['standard'::text, 'free'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_key" text NOT NULL,
	"title" text NOT NULL,
	"url" text DEFAULT 'about:blank' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"image_url" text,
	CONSTRAINT "api_apps_workspace_appkey_unique" UNIQUE("app_key","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "api_apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "broadcast_destination_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_group_id" uuid NOT NULL,
	"field" text NOT NULL,
	"condition" text NOT NULL,
	"value" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "broadcast_destination_rules_condition_check" CHECK (condition = ANY (ARRAY['equals'::text, 'not_equals'::text, 'contains'::text, 'not_contains'::text, 'starts_with'::text, 'ends_with'::text, 'exists'::text, 'not_exists'::text, 'matches_regex'::text])),
	CONSTRAINT "broadcast_destination_rules_field_check" CHECK (field = ANY (ARRAY['model'::text, 'provider'::text, 'session_id'::text, 'user_id'::text, 'api_key_name'::text, 'finish_reason'::text, 'input'::text, 'output'::text, 'token_cost'::text, 'total_cost'::text, 'total_tokens'::text, 'prompt_tokens'::text, 'completion_tokens'::text]))
);
--> statement-breakpoint
ALTER TABLE "broadcast_destination_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"events" text[] DEFAULT '{"RAY['video.completed'::text","'video.failed'::text","'video.cancelled'::text","'batch.completed'::text","'batch.failed'::text","'batch.cancelled'::tex"}' NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"secret_iv" text NOT NULL,
	"secret_hash" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"secret_key_version" text,
	CONSTRAINT "gateway_webhook_endpoints_status_check" CHECK (status = ANY (ARRAY['active'::text, 'disabled'::text, 'deleted'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_webhook_endpoints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"hash" text NOT NULL,
	"prefix" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"scopes" text NOT NULL,
	"created_by" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"kid" text,
	"soft_blocked" boolean DEFAULT false NOT NULL,
	"daily_limit_requests" bigint DEFAULT 0 NOT NULL,
	"weekly_limit_requests" bigint DEFAULT 0 NOT NULL,
	"monthly_limit_requests" bigint DEFAULT 0 NOT NULL,
	"daily_limit_cost_nanos" bigint DEFAULT 0 NOT NULL,
	"weekly_limit_cost_nanos" bigint DEFAULT 0 NOT NULL,
	"monthly_limit_cost_nanos" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"key_kind" text DEFAULT 'standard' NOT NULL,
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"oauth_scopes" text[],
	"issued_via" text DEFAULT 'dashboard' NOT NULL,
	"oauth_resource" text,
	CONSTRAINT "keys_hash_key" UNIQUE("hash"),
	CONSTRAINT "keys_active_oauth_delegated_gateway_scope_check" CHECK ((key_kind <> 'oauth_delegated'::text) OR (status <> 'active'::text) OR ((NULLIF(btrim(oauth_resource), ''::text) IS NOT NULL) AND (NOT COALESCE((btrim(oauth_resource) ~* '^https://api\.phaseo\.app(?::443)?/v1/*$'::text), false))) OR (COALESCE(oauth_scopes, ARRAY[]::text[]) @> ARRAY['gateway:access'::text])),
	CONSTRAINT "keys_issued_via_check" CHECK (issued_via = ANY (ARRAY['dashboard'::text, 'oauth_pkce'::text, 'cli'::text])),
	CONSTRAINT "keys_key_kind_check" CHECK (key_kind = ANY (ARRAY['standard'::text, 'oauth_delegated'::text]))
);
--> statement-breakpoint
ALTER TABLE "keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "management_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"hash" text NOT NULL,
	"prefix" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"scopes" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"last_used_at" timestamp with time zone,
	"kid" text,
	"soft_blocked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"expires_at" timestamp with time zone,
	CONSTRAINT "provisioning_keys_hash_key" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "management_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "monitor_history_commits" (
	"commit_sha" text PRIMARY KEY NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitor_history_commits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "monitor_history_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"commit_sha" text NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	"provider_kind" text NOT NULL,
	"provider_slug" text,
	"provider_label" text NOT NULL,
	"model_id" text NOT NULL,
	"model_label" text NOT NULL,
	"endpoint" text,
	"field" text DEFAULT '' NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"percent_change" double precision,
	"action" text,
	"entity_id" text,
	"entity_type" text,
	"org_id" text,
	"change_kind" text NOT NULL,
	"source_file" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitor_history_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "monitor_history_sync_state" (
	"sync_key" text PRIMARY KEY NOT NULL,
	"source_base" text,
	"source_head" text,
	"last_sha" text,
	"generated_at" timestamp with time zone,
	"commit_count" integer,
	"entry_count" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitor_history_sync_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_app_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"homepage_url" text,
	"logo_url" text,
	"privacy_policy_url" text,
	"terms_of_service_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"redirect_uris" text[] DEFAULT '{""}' NOT NULL,
	"client_type" text DEFAULT 'public' NOT NULL,
	"client_secret_hash" text,
	"allowed_scopes" text[] DEFAULT '{""}' NOT NULL,
	"is_first_party" boolean DEFAULT false NOT NULL,
	"beta_status" text DEFAULT 'beta' NOT NULL,
	CONSTRAINT "oauth_app_metadata_client_id_key" UNIQUE("client_id"),
	CONSTRAINT "oauth_app_metadata_beta_status_check" CHECK (beta_status = ANY (ARRAY['private'::text, 'beta'::text, 'public'::text])),
	CONSTRAINT "oauth_app_metadata_client_type_check" CHECK (client_type = ANY (ARRAY['public'::text, 'confidential'::text])),
	CONSTRAINT "oauth_app_metadata_name_check" CHECK ((char_length(name) >= 3) AND (char_length(name) <= 100)),
	CONSTRAINT "oauth_app_metadata_status_check" CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text]))
);
--> statement-breakpoint
ALTER TABLE "oauth_app_metadata" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_authorization_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"scopes" text[] DEFAULT '{""}' NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text DEFAULT 'S256' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resource" text,
	CONSTRAINT "oauth_authorization_codes_code_hash_key" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text,
	"session_id" text,
	"preset_id" uuid,
	"test_run_id" uuid,
	"source" text DEFAULT 'api' NOT NULL,
	"rating" text,
	"score" numeric,
	"reason" text,
	"reason_tags" text[] DEFAULT '{""}' NOT NULL,
	"comment" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"end_user_id" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_feedback_metadata_dimensions_object_check" CHECK (jsonb_typeof(metadata_dimensions) = 'object'::text),
	CONSTRAINT "gateway_feedback_rating_check" CHECK ((rating IS NULL) OR (rating = ANY (ARRAY['thumbs_up'::text, 'thumbs_down'::text, 'correct'::text, 'partly_correct'::text, 'incorrect'::text, 'bad_format'::text, 'too_slow'::text, 'too_expensive'::text, 'unsafe'::text, 'refused_incorrectly'::text, 'not_helpful'::text, 'other'::text]))),
	CONSTRAINT "gateway_feedback_score_check" CHECK ((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (1)::numeric))),
	CONSTRAINT "gateway_feedback_source_check" CHECK (source = ANY (ARRAY['api'::text, 'user'::text, 'system'::text, 'import'::text, 'test'::text])),
	CONSTRAINT "gateway_feedback_target_check" CHECK ((request_id IS NOT NULL) OR (session_id IS NOT NULL) OR (preset_id IS NOT NULL) OR (test_run_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "gateway_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"scopes" text[] DEFAULT '{""}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "oauth_authorizations_user_client_workspace_unique" UNIQUE("client_id","user_id","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "oauth_authorizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"homepage_url" text,
	"client_type" text DEFAULT 'public' NOT NULL,
	"client_secret_hash" text,
	"redirect_uris" text[] DEFAULT '{""}' NOT NULL,
	"allowed_scopes" text[] DEFAULT '{""}' NOT NULL,
	"is_first_party" boolean DEFAULT false NOT NULL,
	"beta_status" text DEFAULT 'private' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "oauth_clients_beta_status_check" CHECK (beta_status = ANY (ARRAY['private'::text, 'beta'::text, 'public'::text])),
	CONSTRAINT "oauth_clients_client_type_check" CHECK (client_type = ANY (ARRAY['public'::text, 'confidential'::text])),
	CONSTRAINT "oauth_clients_status_check" CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text]))
);
--> statement-breakpoint
ALTER TABLE "oauth_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_device_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid,
	"workspace_id" uuid,
	"scopes" text[] DEFAULT '{""}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"interval_seconds" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"denied_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_polled_at" timestamp with time zone,
	CONSTRAINT "oauth_device_codes_device_code_hash_key" UNIQUE("device_code_hash"),
	CONSTRAINT "oauth_device_codes_user_code_hash_key" UNIQUE("user_code_hash"),
	CONSTRAINT "oauth_device_codes_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text]))
);
--> statement-breakpoint
ALTER TABLE "oauth_device_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"scopes" text[] DEFAULT '{""}' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"rotated_from" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"family_id" uuid NOT NULL,
	CONSTRAINT "oauth_refresh_tokens_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "otel_export_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"last_http_status" integer,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otel_export_outbox_destination_id_event_id_key" UNIQUE("destination_id","event_id"),
	CONSTRAINT "otel_export_outbox_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'delivered'::text, 'failed'::text]))
);
--> statement-breakpoint
ALTER TABLE "otel_export_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"publicKey" text NOT NULL,
	"userId" text NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"createdAt" timestamp with time zone,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "preset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"version_label" text NOT NULL,
	"versioning_method" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text NOT NULL,
	"release_notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preset_versions_preset_id_version_label_key" UNIQUE("preset_id","version_label"),
	CONSTRAINT "preset_versions_preset_id_version_number_key" UNIQUE("preset_id","version_number"),
	CONSTRAINT "preset_versions_version_number_check" CHECK (version_number > 0),
	CONSTRAINT "preset_versions_versioning_method_check" CHECK (versioning_method = ANY (ARRAY['sequential'::text, 'semver'::text, 'date'::text])),
	CONSTRAINT "preset_versions_visibility_check" CHECK (visibility = ANY (ARRAY['private'::text, 'team'::text, 'public'::text]))
);
--> statement-breakpoint
ALTER TABLE "preset_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"visibility" text DEFAULT 'team' NOT NULL,
	"source_preset_id" uuid,
	"slug" text NOT NULL,
	"draft_name" text,
	"draft_slug" text,
	"draft_description" text,
	"draft_config" jsonb,
	"draft_visibility" text,
	"active_version_id" uuid,
	"source_preset_version_id" uuid,
	"upstream_version_id" uuid,
	"root_preset_id" uuid,
	"fork_depth" integer DEFAULT 0 NOT NULL,
	"versioning_method" text DEFAULT 'sequential' NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "presets_public_requires_creator" CHECK ((visibility <> 'public'::text) OR (created_by IS NOT NULL)),
	CONSTRAINT "presets_versioning_method_check" CHECK (versioning_method = ANY (ARRAY['sequential'::text, 'semver'::text, 'date'::text])),
	CONSTRAINT "presets_visibility_check" CHECK (visibility = ANY (ARRAY['private'::text, 'team'::text, 'public'::text]))
);
--> statement-breakpoint
ALTER TABLE "presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "request_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"classifier_id" uuid NOT NULL,
	"primary_category" text NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" numeric(5, 4),
	"model" text NOT NULL,
	"service_tier" text NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_classifications_contribution_id_classifier_id_key" UNIQUE("classifier_id","contribution_id"),
	CONSTRAINT "request_classifications_confidence_check" CHECK ((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
	CONSTRAINT "request_classifications_labels_array_check" CHECK (jsonb_typeof(labels) = 'array'::text),
	CONSTRAINT "request_classifications_latency_ms_check" CHECK ((latency_ms IS NULL) OR (latency_ms >= 0))
);
--> statement-breakpoint
ALTER TABLE "request_classifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "security_key_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"source" text,
	"reporter_email" text,
	"evidence_url" text,
	"comment" text,
	"token_prefix" text,
	"token_fingerprint" text,
	"matched" boolean DEFAULT false NOT NULL,
	"key_table" text,
	"api_key_id" uuid,
	"workspace_id" uuid,
	"action_taken" text,
	"report_mode" text,
	"ip_hash" text,
	"user_agent_hash" text,
	"status" text DEFAULT 'received' NOT NULL,
	"token_last_four" text,
	"action_taken_at" timestamp with time zone,
	"action_taken_by" uuid
);
--> statement-breakpoint
ALTER TABLE "security_key_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "session_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "twoFactor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" text NOT NULL,
	"verified" boolean,
	"failedVerificationCount" integer,
	"lockedUntil" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"who" text NOT NULL,
	"title" text NOT NULL,
	"link" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "updates_link_key" UNIQUE("link")
);
--> statement-breakpoint
ALTER TABLE "updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp with time zone,
	"twoFactorEnabled" boolean,
	"appMetadata" jsonb,
	"invitedAt" timestamp with time zone,
	"lastSignInAt" timestamp with time zone,
	"userMetadata" jsonb,
	"mfaReenrollmentRequired" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"default_workspace_id" uuid,
	"obfuscate_info" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"beta_opt_in" boolean DEFAULT false NOT NULL,
	"beta_features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"public_profile_enabled" boolean DEFAULT false NOT NULL,
	"public_profile_slug" text,
	"onboarding_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"declared_country_code" text,
	"country_declared_at" timestamp with time zone,
	CONSTRAINT "users_declared_country_code_check" CHECK ((declared_country_code IS NULL) OR (declared_country_code ~ '^[A-Z]{2}$'::text))
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_adapter_primitives" (
	"primitive_key" text PRIMARY KEY NOT NULL,
	"primitive_kind" text NOT NULL,
	"code_version" integer DEFAULT 1 NOT NULL,
	"config_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_adapter_primitives_key_check" CHECK (primitive_key ~ '^[a-z0-9][a-z0-9._-]*$'::text),
	CONSTRAINT "v2_adapter_primitives_kind_check" CHECK (primitive_kind = ANY (ARRAY['request_mapper'::text, 'response_parser'::text, 'stream_parser'::text, 'auth_signer'::text, 'transport'::text, 'usage_normalizer'::text, 'error_normalizer'::text, 'job_handler'::text])),
	CONSTRAINT "v2_adapter_primitives_schema_check" CHECK (jsonb_typeof(config_schema) = 'object'::text),
	CONSTRAINT "v2_adapter_primitives_status_check" CHECK (status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_adapter_primitives" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_analytics_outbox" (
	"request_event_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_analytics_outbox_attempt_count_check" CHECK (attempt_count >= 0),
	CONSTRAINT "v2_analytics_outbox_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'complete'::text, 'failed'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_analytics_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_benchmark_results" (
	"result_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_slug" text NOT NULL,
	"benchmark_id" text NOT NULL,
	"score" text,
	"score_numeric" numeric,
	"is_self_reported" boolean DEFAULT false NOT NULL,
	"other_info" text,
	"source_link" text,
	"rank" integer,
	"occur_idx" integer,
	"variant" text,
	"result_key" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "v2_benchmark_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_benchmarks" (
	"benchmark_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"link" text,
	"total_models" integer,
	"ascending_order" boolean DEFAULT false NOT NULL,
	"benchmark_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "v2_benchmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_capability_adapters" (
	"capability_adapter_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability_id" text NOT NULL,
	"adapter_key" text NOT NULL,
	"adapter_version" integer DEFAULT 1 NOT NULL,
	"primitive_bindings" jsonb NOT NULL,
	"default_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_capability_adapters_capability_key" UNIQUE("capability_adapter_id","capability_id"),
	CONSTRAINT "v2_capability_adapters_key" UNIQUE("adapter_key","adapter_version"),
	CONSTRAINT "v2_capability_adapters_adapter_key_check" CHECK (adapter_key ~ '^[a-z0-9][a-z0-9._-]*$'::text),
	CONSTRAINT "v2_capability_adapters_bindings_check" CHECK (jsonb_typeof(primitive_bindings) = 'object'::text),
	CONSTRAINT "v2_capability_adapters_config_check" CHECK (jsonb_typeof(default_config) = 'object'::text),
	CONSTRAINT "v2_capability_adapters_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])),
	CONSTRAINT "v2_capability_adapters_version_check" CHECK (adapter_version > 0)
);
--> statement-breakpoint
ALTER TABLE "v2_capability_adapters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_capability_constraints" (
	"constraint_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_slug" text,
	"provider_model_id" text,
	"capability_id" text NOT NULL,
	"constraint_key" text NOT NULL,
	"expression" jsonb NOT NULL,
	"outcome" text DEFAULT 'reject' NOT NULL,
	"message" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_capability_constraints_key" UNIQUE("capability_id","constraint_key","provider_model_id","provider_slug"),
	CONSTRAINT "v2_capability_constraints_expression_check" CHECK (jsonb_typeof(expression) = 'object'::text),
	CONSTRAINT "v2_capability_constraints_outcome_check" CHECK (outcome = ANY (ARRAY['reject'::text, 'warn'::text, 'transform'::text])),
	CONSTRAINT "v2_capability_constraints_scope_check" CHECK ((provider_slug IS NOT NULL) OR (provider_model_id IS NOT NULL)),
	CONSTRAINT "v2_capability_constraints_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_capability_constraints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_capability_evidence" (
	"evidence_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_slug" text,
	"provider_model_id" text,
	"capability_id" text NOT NULL,
	"parameter_key" text,
	"source_url" text NOT NULL,
	"source_type" text DEFAULT 'official_docs' NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"confidence" text DEFAULT 'confirmed' NOT NULL,
	"source_hash" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_capability_evidence_confidence_check" CHECK (confidence = ANY (ARRAY['confirmed'::text, 'high'::text, 'medium'::text, 'low'::text])),
	CONSTRAINT "v2_capability_evidence_scope_check" CHECK ((provider_slug IS NOT NULL) OR (provider_model_id IS NOT NULL)),
	CONSTRAINT "v2_capability_evidence_source_check" CHECK (source_url ~ '^https://'::text),
	CONSTRAINT "v2_capability_evidence_type_check" CHECK (source_type = ANY (ARRAY['official_docs'::text, 'official_sdk'::text, 'live_test'::text, 'provider_support'::text, 'inference'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_capability_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_catalogue_admin_changes" (
	"change_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"action" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_catalogue_admin_changes_action_check" CHECK (action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'save'::text])),
	CONSTRAINT "v2_catalogue_admin_changes_resource_type_check" CHECK (resource_type = ANY (ARRAY['pricing_sku'::text, 'organisations'::text, 'providers'::text, 'benchmarks'::text, 'subscription-plans'::text, 'models'::text, 'model_graph'::text, 'provider_route'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_catalogue_admin_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_catalogue_backfill_issues" (
	"issue_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_key" text NOT NULL,
	"issue_code" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_catalogue_backfill_issues_key" UNIQUE("issue_code","source_key","source_type")
);
--> statement-breakpoint
ALTER TABLE "v2_catalogue_backfill_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_control_plane_releases" (
	"release_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "v2_control_plane_releases_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"status" text DEFAULT 'draft' NOT NULL,
	"change_summary" text NOT NULL,
	"content_hash" text,
	"created_by" uuid,
	"reviewed_by" uuid,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_once_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "v2_control_plane_releases_sequence_key" UNIQUE("sequence"),
	CONSTRAINT "v2_control_plane_releases_publish_check" CHECK ((status <> 'published'::text) OR ((reviewed_by IS NOT NULL) AND (published_at IS NOT NULL) AND (published_once_at IS NOT NULL) AND (content_hash IS NOT NULL))),
	CONSTRAINT "v2_control_plane_releases_review_check" CHECK ((reviewed_by IS NULL) OR (created_by IS NULL) OR (reviewed_by <> created_by)),
	CONSTRAINT "v2_control_plane_releases_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'validated'::text, 'published'::text, 'superseded'::text, 'rejected'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_control_plane_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_credit_reservations" (
	"reservation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"amount_nanos" bigint NOT NULL,
	"captured_nanos" bigint DEFAULT 0 NOT NULL,
	"released_nanos" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"idempotency_key" text NOT NULL,
	"external_ref" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "v2_credit_reservations_key" UNIQUE("idempotency_key","workspace_id"),
	CONSTRAINT "v2_credit_reservations_amount_check" CHECK (amount_nanos > 0),
	CONSTRAINT "v2_credit_reservations_balance_check" CHECK ((captured_nanos + released_nanos) <= amount_nanos),
	CONSTRAINT "v2_credit_reservations_captured_check" CHECK (captured_nanos >= 0),
	CONSTRAINT "v2_credit_reservations_idempotency_check" CHECK (length(TRIM(BOTH FROM idempotency_key)) > 0),
	CONSTRAINT "v2_credit_reservations_released_check" CHECK (released_nanos >= 0),
	CONSTRAINT "v2_credit_reservations_status_check" CHECK (status = ANY (ARRAY['held'::text, 'partially_captured'::text, 'captured'::text, 'partially_released'::text, 'released'::text, 'expired'::text, 'cancelled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_credit_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_execution_plans" (
	"execution_plan_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"provider_model_id" text NOT NULL,
	"capability_id" text NOT NULL,
	"route_variant_id" uuid,
	"plan_version" integer DEFAULT 1 NOT NULL,
	"plan_hash" text NOT NULL,
	"plan" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_execution_plans_key" UNIQUE("capability_id","provider_model_id","release_id","route_variant_id"),
	CONSTRAINT "v2_execution_plans_plan_check" CHECK (jsonb_typeof(plan) = 'object'::text),
	CONSTRAINT "v2_execution_plans_version_check" CHECK (plan_version > 0)
);
--> statement-breakpoint
ALTER TABLE "v2_execution_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_labs" (
	"lab_slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country_code" text DEFAULT 'xx' NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"routable" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_labs_slug_check" CHECK ((lab_slug = lower(lab_slug)) AND (lab_slug ~ '^[a-z0-9][a-z0-9._-]*$'::text)),
	CONSTRAINT "v2_labs_status_check" CHECK (status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_labs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_meter_definitions" (
	"meter_key" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"modality" text NOT NULL,
	"direction" text,
	"unit" text NOT NULL,
	"default_unit_quantity" numeric(30, 12) DEFAULT '1' NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_meter_definitions_direction_check" CHECK ((direction IS NULL) OR (direction = ANY (ARRAY['input'::text, 'output'::text]))),
	CONSTRAINT "v2_meter_definitions_key_check" CHECK ((meter_key = lower(meter_key)) AND (meter_key ~ '^[a-z0-9][a-z0-9._:-]*$'::text)),
	CONSTRAINT "v2_meter_definitions_quantity_check" CHECK (default_unit_quantity > (0)::numeric),
	CONSTRAINT "v2_meter_definitions_status_check" CHECK (status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_meter_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_model_aliases" (
	"alias_slug" text PRIMARY KEY NOT NULL,
	"model_slug" text NOT NULL,
	"alias_type" text DEFAULT 'public' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_model_aliases_slug_check" CHECK ((alias_slug = lower(alias_slug)) AND (alias_slug ~ '^[a-z0-9][a-z0-9._:/+@-]*$'::text)),
	CONSTRAINT "v2_model_aliases_window_check" CHECK ((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from))
);
--> statement-breakpoint
ALTER TABLE "v2_model_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_model_families" (
	"family_slug" text PRIMARY KEY NOT NULL,
	"lab_slug" text NOT NULL,
	"name" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_model_families_lab_slug_family_slug_key" UNIQUE("family_slug","lab_slug")
);
--> statement-breakpoint
ALTER TABLE "v2_model_families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_model_page_notices" (
	"model_slug" text PRIMARY KEY NOT NULL,
	"tone" text NOT NULL,
	"markdown" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_model_page_notices_tone_check" CHECK (tone = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_model_page_notices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_model_provider_routes" (
	"provider_model_id" text PRIMARY KEY NOT NULL,
	"model_slug" text NOT NULL,
	"provider_slug" text NOT NULL,
	"provider_model_slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"routing_enabled" boolean DEFAULT false NOT NULL,
	"input_modalities" text[] DEFAULT '{""}' NOT NULL,
	"output_modalities" text[] DEFAULT '{""}' NOT NULL,
	"regions" text[] DEFAULT '{""}' NOT NULL,
	"context_length" integer,
	"max_output_tokens" integer,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_availability_status" text DEFAULT 'unknown' NOT NULL,
	"phaseo_status" text DEFAULT 'disabled' NOT NULL,
	"access_scope" text DEFAULT 'public' NOT NULL,
	CONSTRAINT "v2_model_provider_routes_provider_model_key" UNIQUE("provider_model_id","provider_slug"),
	CONSTRAINT "v2_model_provider_routes_access_scope_check" CHECK (access_scope = ANY (ARRAY['public'::text, 'internal'::text])),
	CONSTRAINT "v2_model_provider_routes_context_check" CHECK ((context_length IS NULL) OR (context_length > 0)),
	CONSTRAINT "v2_model_provider_routes_internal_scope_check" CHECK ((access_scope = 'public'::text) OR (phaseo_status = ANY (ARRAY['testing'::text, 'enabled'::text]))),
	CONSTRAINT "v2_model_provider_routes_output_check" CHECK ((max_output_tokens IS NULL) OR (max_output_tokens > 0)),
	CONSTRAINT "v2_model_provider_routes_phaseo_routing_check" CHECK ((NOT routing_enabled) OR (phaseo_status = 'enabled'::text)),
	CONSTRAINT "v2_model_provider_routes_phaseo_status_check" CHECK (phaseo_status = ANY (ARRAY['unsupported'::text, 'planned'::text, 'implementing'::text, 'testing'::text, 'enabled'::text, 'disabled'::text, 'blocked'::text])),
	CONSTRAINT "v2_model_provider_routes_provider_availability_check" CHECK (provider_availability_status = ANY (ARRAY['unknown'::text, 'coming_soon'::text, 'preview'::text, 'available'::text, 'limited_access'::text, 'deprecated'::text, 'removed'::text])),
	CONSTRAINT "v2_model_provider_routes_provider_routing_check" CHECK ((NOT routing_enabled) OR (provider_availability_status = ANY (ARRAY['available'::text, 'preview'::text, 'limited_access'::text]))),
	CONSTRAINT "v2_model_provider_routes_public_routing_check" CHECK ((NOT routing_enabled) OR (access_scope = 'public'::text)),
	CONSTRAINT "v2_model_provider_routes_status_check" CHECK (status = ANY (ARRAY['active'::text, 'degraded'::text, 'disabled'::text, 'retired'::text])),
	CONSTRAINT "v2_model_provider_routes_window_check" CHECK ((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from))
);
--> statement-breakpoint
ALTER TABLE "v2_model_provider_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_pricing_sku_meters" (
	"sku_meter_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" uuid NOT NULL,
	"meter_key" text NOT NULL,
	"modality" text NOT NULL,
	"direction" text,
	"unit" text NOT NULL,
	"unit_quantity" numeric(30, 12) DEFAULT '1' NOT NULL,
	"price_nanos" numeric(30, 12) NOT NULL,
	"display_label" text NOT NULL,
	"display_unit" text NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"meter_order" integer DEFAULT 100 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_pricing_sku_meters_key" UNIQUE("meter_key","sku_id"),
	CONSTRAINT "v2_pricing_sku_meters_key_check" CHECK ((meter_key = lower(meter_key)) AND (meter_key ~ '^[a-z0-9][a-z0-9._:-]*$'::text)),
	CONSTRAINT "v2_pricing_sku_meters_order_check" CHECK (meter_order >= 0),
	CONSTRAINT "v2_pricing_sku_meters_price_check" CHECK (price_nanos >= (0)::numeric),
	CONSTRAINT "v2_pricing_sku_meters_unit_quantity_check" CHECK (unit_quantity > (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "v2_pricing_sku_meters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_pricing_skus" (
	"sku_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_model_id" text NOT NULL,
	"sku_code" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"operation" text DEFAULT 'inference' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"region" text,
	"display_name" text NOT NULL,
	"description" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"service_tier_slug" text,
	"route_variant_id" uuid,
	CONSTRAINT "v2_pricing_skus_key" UNIQUE("provider_model_id","sku_code","version"),
	CONSTRAINT "v2_pricing_skus_code_check" CHECK ((sku_code = lower(sku_code)) AND (sku_code ~ '^[a-z0-9][a-z0-9._:-]*$'::text)),
	CONSTRAINT "v2_pricing_skus_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])),
	CONSTRAINT "v2_pricing_skus_version_check" CHECK (version > 0),
	CONSTRAINT "v2_pricing_skus_window_check" CHECK ((effective_to IS NULL) OR (effective_to > effective_from))
);
--> statement-breakpoint
ALTER TABLE "v2_pricing_skus" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_private_usage_daily" (
	"rollup_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_date" date NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid,
	"model_slug" text NOT NULL,
	"provider_model_id" text,
	"requests" bigint DEFAULT 0 NOT NULL,
	"successful_requests" bigint DEFAULT 0 NOT NULL,
	"failed_requests" bigint DEFAULT 0 NOT NULL,
	"rate_limited_requests" bigint DEFAULT 0 NOT NULL,
	"tool_call_count" bigint DEFAULT 0 NOT NULL,
	"structured_output_attempts" bigint DEFAULT 0 NOT NULL,
	"structured_output_successes" bigint DEFAULT 0 NOT NULL,
	"latency_sum_ms" bigint DEFAULT 0 NOT NULL,
	"latency_count" bigint DEFAULT 0 NOT NULL,
	"generation_sum_ms" bigint DEFAULT 0 NOT NULL,
	"generation_count" bigint DEFAULT 0 NOT NULL,
	"throughput_sum" numeric(30, 12) DEFAULT '0' NOT NULL,
	"throughput_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cloudflare_colo" text,
	"tool_call_requests" bigint DEFAULT 0 NOT NULL,
	"tool_call_successes" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" numeric(30, 12) DEFAULT '0' NOT NULL,
	"input_tokens" numeric(30, 12) DEFAULT '0' NOT NULL,
	"gateway_total_sum_ms" numeric(30, 3) DEFAULT '0' NOT NULL,
	"gateway_total_count" bigint DEFAULT 0 NOT NULL,
	"internal_dispatch_sum_ms" numeric(30, 3) DEFAULT '0' NOT NULL,
	"internal_dispatch_count" bigint DEFAULT 0 NOT NULL,
	"upstream_attempts" bigint DEFAULT 0 NOT NULL,
	"failed_upstream_attempts" bigint DEFAULT 0 NOT NULL,
	"cost_nanos" numeric(30, 0) DEFAULT '0' NOT NULL,
	CONSTRAINT "v2_private_usage_daily_cloudflare_colo_check" CHECK ((cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)),
	CONSTRAINT "v2_private_usage_daily_counts_check" CHECK ((requests >= 0) AND (successful_requests >= 0) AND (failed_requests >= 0) AND (rate_limited_requests >= 0) AND (tool_call_count >= 0) AND (structured_output_attempts >= 0) AND (structured_output_successes >= 0) AND (latency_sum_ms >= 0) AND (latency_count >= 0) AND (generation_sum_ms >= 0) AND (generation_count >= 0) AND (throughput_sum >= (0)::numeric) AND (throughput_count >= 0)),
	CONSTRAINT "v2_private_usage_daily_observability_counts_check" CHECK ((tool_call_requests >= 0) AND (tool_call_successes >= 0) AND (tool_call_successes <= tool_call_requests) AND (cached_input_tokens >= (0)::numeric) AND (input_tokens >= (0)::numeric) AND (gateway_total_sum_ms >= (0)::numeric) AND (gateway_total_count >= 0) AND (internal_dispatch_sum_ms >= (0)::numeric) AND (internal_dispatch_count >= 0) AND (upstream_attempts >= 0) AND (failed_upstream_attempts >= 0) AND (failed_upstream_attempts <= upstream_attempts) AND (cost_nanos >= (0)::numeric))
);
--> statement-breakpoint
ALTER TABLE "v2_private_usage_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_provider_auth_profiles" (
	"auth_profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_slug" text NOT NULL,
	"profile_key" text NOT NULL,
	"auth_primitive_key" text NOT NULL,
	"secret_reference_key" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_provider_auth_profiles_key" UNIQUE("profile_key","provider_slug"),
	CONSTRAINT "v2_provider_auth_profiles_provider_key" UNIQUE("auth_profile_id","provider_slug"),
	CONSTRAINT "v2_provider_auth_profiles_config_check" CHECK (jsonb_typeof(config) = 'object'::text),
	CONSTRAINT "v2_provider_auth_profiles_status_check" CHECK (status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_provider_auth_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_provider_capability_adapters" (
	"provider_capability_adapter_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_slug" text NOT NULL,
	"capability_id" text NOT NULL,
	"capability_adapter_id" uuid NOT NULL,
	"provider_endpoint_id" uuid NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_provider_capability_adapters_key" UNIQUE("capability_adapter_id","capability_id","provider_endpoint_id","provider_slug"),
	CONSTRAINT "v2_provider_capability_adapters_config_check" CHECK (jsonb_typeof(config) = 'object'::text),
	CONSTRAINT "v2_provider_capability_adapters_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'disabled'::text])),
	CONSTRAINT "v2_provider_capability_adapters_window_check" CHECK ((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from))
);
--> statement-breakpoint
ALTER TABLE "v2_provider_capability_adapters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_provider_country_restrictions" (
	"restriction_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_slug" text NOT NULL,
	"country_code" text NOT NULL,
	"reason" text,
	"source_url" text,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_provider_country_restrictions_unique" UNIQUE("country_code","effective_at","provider_slug"),
	CONSTRAINT "v2_provider_country_restrictions_country_check" CHECK (country_code ~ '^[A-Z]{2}$'::text),
	CONSTRAINT "v2_provider_country_restrictions_window_check" CHECK ((expires_at IS NULL) OR (expires_at > effective_at))
);
--> statement-breakpoint
ALTER TABLE "v2_provider_country_restrictions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_provider_endpoints" (
	"provider_endpoint_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_slug" text NOT NULL,
	"endpoint_key" text NOT NULL,
	"capability_id" text NOT NULL,
	"base_url" text NOT NULL,
	"path_template" text NOT NULL,
	"api_version" text,
	"auth_profile_id" uuid,
	"region_code" text,
	"service_tier_slug" text,
	"timeout_ms" integer DEFAULT 120000 NOT NULL,
	"retry_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_provider_endpoints_key" UNIQUE("endpoint_key","provider_slug"),
	CONSTRAINT "v2_provider_endpoints_provider_key" UNIQUE("provider_endpoint_id","provider_slug"),
	CONSTRAINT "v2_provider_endpoints_capability_key" UNIQUE("capability_id","provider_endpoint_id","provider_slug"),
	CONSTRAINT "v2_provider_endpoints_retry_check" CHECK (jsonb_typeof(retry_policy) = 'object'::text),
	CONSTRAINT "v2_provider_endpoints_status_check" CHECK (status = ANY (ARRAY['active'::text, 'degraded'::text, 'deprecated'::text, 'disabled'::text])),
	CONSTRAINT "v2_provider_endpoints_timeout_check" CHECK ((timeout_ms > 0) AND (timeout_ms <= 900000))
);
--> statement-breakpoint
ALTER TABLE "v2_provider_endpoints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_provider_regions" (
	"provider_region_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_slug" text NOT NULL,
	"region_code" text NOT NULL,
	"display_name" text,
	"execution_supported" boolean DEFAULT true NOT NULL,
	"data_residency_supported" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"routing_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_provider_regions_key" UNIQUE("provider_slug","region_code"),
	CONSTRAINT "v2_provider_regions_region_check" CHECK ((region_code = lower(region_code)) AND (region_code ~ '^[a-z0-9][a-z0-9._-]*$'::text)),
	CONSTRAINT "v2_provider_regions_status_check" CHECK (status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_provider_regions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_providers" (
	"provider_slug" text PRIMARY KEY NOT NULL,
	"lab_slug" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"routing_enabled" boolean DEFAULT false NOT NULL,
	"routable" boolean DEFAULT false NOT NULL,
	"country_code" text DEFAULT 'xx' NOT NULL,
	"base_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_family_slug" text,
	"offer_scope" text DEFAULT 'global' NOT NULL,
	"offer_label" text,
	"residency_mode" text DEFAULT 'unknown' NOT NULL,
	"default_execution_regions" text[],
	"default_data_regions" text[],
	"zero_data_retention" text DEFAULT 'unknown' NOT NULL,
	"prompt_training_policy" text DEFAULT 'unknown' NOT NULL,
	"data_policy_tier" text DEFAULT 'unknown' NOT NULL,
	"data_policy_confidence" text DEFAULT 'unknown' NOT NULL,
	"data_policy_contract_mode" text DEFAULT 'none' NOT NULL,
	"data_policy_variant" text DEFAULT 'standard' NOT NULL,
	"stream_cancellation_support" text DEFAULT 'unknown' NOT NULL,
	"stream_cancellation_stops_provider_billing" boolean,
	"stream_cancellation_usage_recovery" text DEFAULT 'unknown' NOT NULL,
	"stream_cancellation_evidence_kind" text DEFAULT 'none' NOT NULL,
	"stream_cancellation_source_url" text,
	"stream_cancellation_verified_at" timestamp with time zone,
	"data_retention_days" integer,
	CONSTRAINT "v2_providers_data_policy_confidence_check" CHECK (data_policy_confidence = ANY (ARRAY['unknown'::text, 'confirmed'::text, 'maybe'::text])),
	CONSTRAINT "v2_providers_data_policy_contract_mode_check" CHECK (data_policy_contract_mode = ANY (ARRAY['none'::text, 'customer_agreement'::text, 'enterprise_agreement'::text])),
	CONSTRAINT "v2_providers_data_policy_tier_check" CHECK (data_policy_tier = ANY (ARRAY['unknown'::text, 'private'::text, 'logs'::text, 'trains'::text])),
	CONSTRAINT "v2_providers_data_policy_variant_check" CHECK (data_policy_variant = ANY (ARRAY['standard'::text, 'zdr'::text])),
	CONSTRAINT "v2_providers_data_retention_days_check" CHECK ((data_retention_days IS NULL) OR (data_retention_days >= 0)),
	CONSTRAINT "v2_providers_offer_scope_check" CHECK (offer_scope = ANY (ARRAY['global'::text, 'regional'::text, 'specialized'::text])),
	CONSTRAINT "v2_providers_residency_mode_check" CHECK (residency_mode = ANY (ARRAY['unknown'::text, 'provider_managed'::text, 'customer_selectable'::text, 'account_selected'::text])),
	CONSTRAINT "v2_providers_slug_check" CHECK ((provider_slug = lower(provider_slug)) AND (provider_slug ~ '^[a-z0-9][a-z0-9._-]*$'::text)),
	CONSTRAINT "v2_providers_status_check" CHECK (status = ANY (ARRAY['active'::text, 'beta'::text, 'alpha'::text, 'not_ready'::text, 'deprecated'::text, 'disabled'::text, 'external'::text])),
	CONSTRAINT "v2_providers_stream_cancel_billing_check" CHECK ((stream_cancellation_stops_provider_billing IS DISTINCT FROM true) OR (stream_cancellation_support = 'supported'::text)),
	CONSTRAINT "v2_providers_stream_cancel_evidence_check" CHECK (stream_cancellation_evidence_kind = ANY (ARRAY['provider'::text, 'aggregator'::text, 'none'::text])),
	CONSTRAINT "v2_providers_stream_cancel_support_check" CHECK (stream_cancellation_support = ANY (ARRAY['supported'::text, 'unsupported'::text, 'unknown'::text])),
	CONSTRAINT "v2_providers_stream_cancel_usage_check" CHECK (stream_cancellation_usage_recovery = ANY (ARRAY['authoritative'::text, 'unknown'::text])),
	CONSTRAINT "v2_providers_zdr_variant_integrity_check" CHECK ((data_policy_variant <> 'zdr'::text) OR ((offer_scope = 'specialized'::text) AND (zero_data_retention = 'default'::text) AND (data_policy_tier = 'private'::text) AND (data_policy_confidence = 'confirmed'::text))),
	CONSTRAINT "v2_providers_zero_data_retention_check" CHECK (zero_data_retention = ANY (ARRAY['unknown'::text, 'unsupported'::text, 'optional'::text, 'default'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "model_discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" text NOT NULL,
	"source" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"finished_at" timestamp with time zone,
	"providers_total" integer DEFAULT 0 NOT NULL,
	"providers_success" integer DEFAULT 0 NOT NULL,
	"providers_skipped" integer DEFAULT 0 NOT NULL,
	"providers_error" integer DEFAULT 0 NOT NULL,
	"changes_count" integer DEFAULT 0 NOT NULL,
	"stale_models_deleted" integer DEFAULT 0 NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	CONSTRAINT "model_discovery_runs_changes_count_check" CHECK (changes_count >= 0),
	CONSTRAINT "model_discovery_runs_providers_error_check" CHECK (providers_error >= 0),
	CONSTRAINT "model_discovery_runs_providers_skipped_check" CHECK (providers_skipped >= 0),
	CONSTRAINT "model_discovery_runs_providers_success_check" CHECK (providers_success >= 0),
	CONSTRAINT "model_discovery_runs_providers_total_check" CHECK (providers_total >= 0),
	CONSTRAINT "model_discovery_runs_stale_models_deleted_check" CHECK (stale_models_deleted >= 0),
	CONSTRAINT "model_discovery_runs_status_check" CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text])),
	CONSTRAINT "model_discovery_runs_trigger_check" CHECK (trigger = ANY (ARRAY['scheduled'::text, 'manual'::text]))
);
--> statement-breakpoint
ALTER TABLE "model_discovery_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_route_variants" (
	"variant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_model_id" text NOT NULL,
	"variant_key" text NOT NULL,
	"provider_region_id" uuid,
	"execution_region" text,
	"data_region" text,
	"service_tier_slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"routing_enabled" boolean DEFAULT true NOT NULL,
	"endpoint_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_route_variants_key" UNIQUE("provider_model_id","variant_key"),
	CONSTRAINT "v2_route_variants_key_check" CHECK ((variant_key = lower(variant_key)) AND (variant_key ~ '^[a-z0-9][a-z0-9._:-]*$'::text)),
	CONSTRAINT "v2_route_variants_status_check" CHECK (status = ANY (ARRAY['active'::text, 'degraded'::text, 'disabled'::text, 'retired'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_route_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_service_tiers" (
	"service_tier_slug" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_service_tiers_slug_check" CHECK ((service_tier_slug = lower(service_tier_slug)) AND (service_tier_slug ~ '^[a-z0-9][a-z0-9._:-]*$'::text)),
	CONSTRAINT "v2_service_tiers_status_check" CHECK (status = ANY (ARRAY['active'::text, 'deprecated'::text, 'disabled'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_service_tiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_subscription_plans" (
	"plan_uuid" uuid PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"lab_slug" text,
	"description" text,
	"frequency" text,
	"price" numeric,
	"currency" text,
	"link" text,
	"other_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "v2_subscription_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"balance_nanos" bigint DEFAULT '0' NOT NULL,
	"auto_top_up_enabled" boolean DEFAULT false NOT NULL,
	"low_balance_threshold" bigint DEFAULT '0' NOT NULL,
	"auto_top_up_amount" bigint DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"auto_top_up_account_id" text,
	"reserved_nanos" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "web_cache_generations" (
	"scope" text PRIMARY KEY NOT NULL,
	"generation" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "web_cache_generations_generation_check" CHECK (generation > 0),
	CONSTRAINT "web_cache_generations_scope_check" CHECK (scope ~ '^[a-z0-9-]{1,64}$'::text)
);
--> statement-breakpoint
ALTER TABLE "web_cache_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "web_cache_purge_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "web_cache_purge_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"scope" text NOT NULL,
	"target_id" text,
	"tags" text[] NOT NULL,
	"browser_generation_bumped" boolean DEFAULT false NOT NULL,
	"generation" bigint,
	"actor_user_id" uuid,
	"purge_succeeded" boolean NOT NULL,
	"purge_error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "web_cache_purge_events_scope_check" CHECK (scope ~ '^[a-z0-9-]{1,64}$'::text),
	CONSTRAINT "web_cache_purge_events_tags_check" CHECK ((cardinality(tags) >= 1) AND (cardinality(tags) <= 100)),
	CONSTRAINT "web_cache_purge_events_target_id_check" CHECK ((target_id IS NULL) OR (length(target_id) <= 200))
);
--> statement-breakpoint
ALTER TABLE "web_cache_purge_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_broadcast_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"destination_id" text NOT NULL,
	"name" text NOT NULL,
	"destination_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"privacy_exclude_prompts_and_outputs" boolean DEFAULT false NOT NULL,
	"sampling_rate" numeric(6, 5) DEFAULT '1.0' NOT NULL,
	"group_join_operator" text DEFAULT 'or' NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"destination_config_ciphertext" text,
	"destination_config_iv" text,
	"destination_config_key_version" text,
	"include_generation_metadata" boolean DEFAULT true NOT NULL,
	"include_cost_metadata" boolean DEFAULT true NOT NULL,
	"include_identity_metadata" boolean DEFAULT true NOT NULL,
	"include_request_context" boolean DEFAULT true NOT NULL,
	CONSTRAINT "workspace_broadcast_destinations_destination_id_check" CHECK (destination_id = ANY (ARRAY['arize'::text, 'braintrust'::text, 'clickhouse'::text, 'comet_opik'::text, 'datadog'::text, 'grafana_cloud'::text, 'langfuse'::text, 'langsmith'::text, 'new_relic'::text, 'otel_collector'::text, 'posthog'::text, 's3'::text, 'sentry'::text, 'snowflake'::text, 'wandb_weave'::text, 'webhook'::text])),
	CONSTRAINT "workspace_broadcast_destinations_group_join_operator_check" CHECK (group_join_operator = ANY (ARRAY['and'::text, 'or'::text])),
	CONSTRAINT "workspace_broadcast_destinations_sampling_rate_check" CHECK ((sampling_rate >= (0)::numeric) AND (sampling_rate <= (1)::numeric))
);
--> statement-breakpoint
ALTER TABLE "workspace_broadcast_destinations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_classifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'custom' NOT NULL,
	"instructions" text NOT NULL,
	"categories" jsonb NOT NULL,
	"model" text DEFAULT 'gpt-5-mini' NOT NULL,
	"service_tier" text DEFAULT 'flex' NOT NULL,
	"sample_rate_bps" integer DEFAULT 10000 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_classifiers_workspace_id_slug_key" UNIQUE("slug","workspace_id"),
	CONSTRAINT "workspace_classifiers_categories_object_check" CHECK (jsonb_typeof(categories) = 'object'::text),
	CONSTRAINT "workspace_classifiers_kind_check" CHECK (kind = ANY (ARRAY['phaseo_task'::text, 'custom'::text])),
	CONSTRAINT "workspace_classifiers_sample_rate_bps_check" CHECK ((sample_rate_bps >= 0) AND (sample_rate_bps <= 10000)),
	CONSTRAINT "workspace_classifiers_service_tier_check" CHECK (service_tier = ANY (ARRAY['standard'::text, 'flex'::text]))
);
--> statement-breakpoint
ALTER TABLE "workspace_classifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_guardrails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"privacy_enable_paid_may_train" boolean DEFAULT true NOT NULL,
	"privacy_enable_free_may_train" boolean DEFAULT true NOT NULL,
	"privacy_enable_free_may_publish_prompts" boolean DEFAULT true NOT NULL,
	"privacy_enable_input_output_logging" boolean DEFAULT true NOT NULL,
	"privacy_zdr_only" boolean DEFAULT false NOT NULL,
	"provider_restriction_mode" text DEFAULT 'none' NOT NULL,
	"provider_restriction_provider_ids" text[] DEFAULT '{""}' NOT NULL,
	"provider_restriction_enforce_allowed" boolean DEFAULT false NOT NULL,
	"allowed_api_model_ids" text[] DEFAULT '{""}' NOT NULL,
	"daily_limit_requests" bigint DEFAULT 0 NOT NULL,
	"weekly_limit_requests" bigint DEFAULT 0 NOT NULL,
	"monthly_limit_requests" bigint DEFAULT 0 NOT NULL,
	"daily_limit_cost_nanos" bigint DEFAULT 0 NOT NULL,
	"weekly_limit_cost_nanos" bigint DEFAULT 0 NOT NULL,
	"monthly_limit_cost_nanos" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"prompt_injection_enabled" boolean DEFAULT false NOT NULL,
	"prompt_injection_action" text DEFAULT 'flag' NOT NULL,
	"sensitive_info_enabled" boolean DEFAULT false NOT NULL,
	"sensitive_info_default_action" text DEFAULT 'redact' NOT NULL,
	"sensitive_info_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_restriction_mode" text DEFAULT 'none' NOT NULL,
	CONSTRAINT "workspace_guardrails_model_restriction_mode_check" CHECK (model_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])),
	CONSTRAINT "workspace_guardrails_prompt_injection_action_check" CHECK (prompt_injection_action = ANY (ARRAY['flag'::text, 'redact'::text, 'block'::text])),
	CONSTRAINT "workspace_guardrails_provider_restriction_mode_check" CHECK (provider_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])),
	CONSTRAINT "workspace_guardrails_sensitive_info_default_action_check" CHECK (sensitive_info_default_action = ANY (ARRAY['flag'::text, 'redact'::text, 'block'::text]))
);
--> statement-breakpoint
ALTER TABLE "workspace_guardrails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"creator_user_id" uuid NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"expires_at" timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"token_encrypted" text DEFAULT '' NOT NULL,
	"token_preview" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_fingerprint" text,
	"key_version" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "workspace_invites_preview_len_ck" CHECK ((token_preview IS NULL) OR ((char_length(token_preview) >= 1) AND (char_length(token_preview) <= 12))),
	CONSTRAINT "workspace_invites_uses_ck" CHECK ((max_uses IS NULL) OR (uses_count <= max_uses))
);
--> statement-breakpoint
ALTER TABLE "workspace_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invite_id" uuid,
	"requester_user_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_join_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ssoProvider" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"oidcConfig" text,
	"samlConfig" text,
	"userId" text,
	"providerId" text NOT NULL,
	"organizationId" text,
	"domain" text NOT NULL,
	CONSTRAINT "ssoProvider_providerId_key" UNIQUE("providerId")
);
--> statement-breakpoint
CREATE TABLE "v2_credit_ledger" (
	"entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_time" timestamp with time zone DEFAULT now() NOT NULL,
	"entry_type" text NOT NULL,
	"amount_nanos" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"source_type" text,
	"source_id" text,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_credit_ledger_amount_check" CHECK (amount_nanos <> 0),
	CONSTRAINT "v2_credit_ledger_idempotency_check" CHECK (length(TRIM(BOTH FROM idempotency_key)) > 0),
	CONSTRAINT "v2_credit_ledger_source_check" CHECK ((source_type IS NULL) = (source_id IS NULL)),
	CONSTRAINT "v2_credit_ledger_type_check" CHECK (entry_type = ANY (ARRAY['payment'::text, 'grant'::text, 'refund'::text, 'charge'::text, 'reservation_capture'::text, 'reservation_release'::text, 'adjustment'::text, 'expiration'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_public_usage_daily" (
	"rollup_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_date" date NOT NULL,
	"app_id" uuid,
	"model_slug" text NOT NULL,
	"provider_model_id" text,
	"requests" bigint DEFAULT 0 NOT NULL,
	"successful_requests" bigint DEFAULT 0 NOT NULL,
	"failed_requests" bigint DEFAULT 0 NOT NULL,
	"rate_limited_requests" bigint DEFAULT 0 NOT NULL,
	"tool_call_count" bigint DEFAULT 0 NOT NULL,
	"structured_output_attempts" bigint DEFAULT 0 NOT NULL,
	"structured_output_successes" bigint DEFAULT 0 NOT NULL,
	"latency_sum_ms" bigint DEFAULT 0 NOT NULL,
	"latency_count" bigint DEFAULT 0 NOT NULL,
	"generation_sum_ms" bigint DEFAULT 0 NOT NULL,
	"generation_count" bigint DEFAULT 0 NOT NULL,
	"throughput_sum" numeric(30, 12) DEFAULT '0' NOT NULL,
	"throughput_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cloudflare_colo" text,
	"tool_call_requests" bigint DEFAULT 0 NOT NULL,
	"tool_call_successes" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" numeric(30, 12) DEFAULT '0' NOT NULL,
	"input_tokens" numeric(30, 12) DEFAULT '0' NOT NULL,
	"gateway_total_sum_ms" numeric(30, 3) DEFAULT '0' NOT NULL,
	"gateway_total_count" bigint DEFAULT 0 NOT NULL,
	"internal_dispatch_sum_ms" numeric(30, 3) DEFAULT '0' NOT NULL,
	"internal_dispatch_count" bigint DEFAULT 0 NOT NULL,
	"upstream_attempts" bigint DEFAULT 0 NOT NULL,
	"failed_upstream_attempts" bigint DEFAULT 0 NOT NULL,
	"cost_nanos" numeric(30, 0) DEFAULT '0' NOT NULL,
	CONSTRAINT "v2_public_usage_daily_cloudflare_colo_check" CHECK ((cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)),
	CONSTRAINT "v2_public_usage_daily_cost_check" CHECK (cost_nanos >= (0)::numeric),
	CONSTRAINT "v2_public_usage_daily_counts_check" CHECK ((requests >= 0) AND (successful_requests >= 0) AND (failed_requests >= 0) AND (rate_limited_requests >= 0) AND (tool_call_count >= 0) AND (structured_output_attempts >= 0) AND (structured_output_successes >= 0) AND (latency_sum_ms >= 0) AND (latency_count >= 0) AND (generation_sum_ms >= 0) AND (generation_count >= 0) AND (throughput_sum >= (0)::numeric) AND (throughput_count >= 0)),
	CONSTRAINT "v2_public_usage_daily_observability_counts_check" CHECK ((tool_call_requests >= 0) AND (tool_call_successes >= 0) AND (tool_call_successes <= tool_call_requests) AND (cached_input_tokens >= (0)::numeric) AND (input_tokens >= (0)::numeric) AND (gateway_total_sum_ms >= (0)::numeric) AND (gateway_total_count >= 0) AND (internal_dispatch_sum_ms >= (0)::numeric) AND (internal_dispatch_count >= 0) AND (upstream_attempts >= 0) AND (failed_upstream_attempts >= 0) AND (failed_upstream_attempts <= upstream_attempts))
);
--> statement-breakpoint
ALTER TABLE "v2_public_usage_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_public_usage_hourly" (
	"rollup_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"app_id" uuid,
	"model_slug" text NOT NULL,
	"provider_model_id" text,
	"requests" bigint DEFAULT 0 NOT NULL,
	"successful_requests" bigint DEFAULT 0 NOT NULL,
	"failed_requests" bigint DEFAULT 0 NOT NULL,
	"rate_limited_requests" bigint DEFAULT 0 NOT NULL,
	"tool_call_count" bigint DEFAULT 0 NOT NULL,
	"structured_output_attempts" bigint DEFAULT 0 NOT NULL,
	"structured_output_successes" bigint DEFAULT 0 NOT NULL,
	"latency_sum_ms" bigint DEFAULT 0 NOT NULL,
	"latency_count" bigint DEFAULT 0 NOT NULL,
	"generation_sum_ms" bigint DEFAULT 0 NOT NULL,
	"generation_count" bigint DEFAULT 0 NOT NULL,
	"throughput_sum" numeric(30, 12) DEFAULT '0' NOT NULL,
	"throughput_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cloudflare_colo" text,
	"tool_call_requests" bigint DEFAULT 0 NOT NULL,
	"tool_call_successes" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" numeric(30, 12) DEFAULT '0' NOT NULL,
	"input_tokens" numeric(30, 12) DEFAULT '0' NOT NULL,
	"gateway_total_sum_ms" numeric(30, 3) DEFAULT '0' NOT NULL,
	"gateway_total_count" bigint DEFAULT 0 NOT NULL,
	"internal_dispatch_sum_ms" numeric(30, 3) DEFAULT '0' NOT NULL,
	"internal_dispatch_count" bigint DEFAULT 0 NOT NULL,
	"upstream_attempts" bigint DEFAULT 0 NOT NULL,
	"failed_upstream_attempts" bigint DEFAULT 0 NOT NULL,
	"cost_nanos" numeric(30, 0) DEFAULT '0' NOT NULL,
	CONSTRAINT "v2_public_usage_hourly_cloudflare_colo_check" CHECK ((cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)),
	CONSTRAINT "v2_public_usage_hourly_cost_check" CHECK (cost_nanos >= (0)::numeric),
	CONSTRAINT "v2_public_usage_hourly_counts_check" CHECK ((requests >= 0) AND (successful_requests >= 0) AND (failed_requests >= 0) AND (rate_limited_requests >= 0) AND (tool_call_count >= 0) AND (structured_output_attempts >= 0) AND (structured_output_successes >= 0) AND (latency_sum_ms >= 0) AND (latency_count >= 0) AND (generation_sum_ms >= 0) AND (generation_count >= 0) AND (throughput_sum >= (0)::numeric) AND (throughput_count >= 0)),
	CONSTRAINT "v2_public_usage_hourly_observability_counts_check" CHECK ((tool_call_requests >= 0) AND (tool_call_successes >= 0) AND (tool_call_successes <= tool_call_requests) AND (cached_input_tokens >= (0)::numeric) AND (input_tokens >= (0)::numeric) AND (gateway_total_sum_ms >= (0)::numeric) AND (gateway_total_count >= 0) AND (internal_dispatch_sum_ms >= (0)::numeric) AND (internal_dispatch_count >= 0) AND (upstream_attempts >= 0) AND (failed_upstream_attempts >= 0) AND (failed_upstream_attempts <= upstream_attempts))
);
--> statement-breakpoint
ALTER TABLE "v2_public_usage_hourly" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_request_artifacts" (
	"artifact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_event_id" uuid NOT NULL,
	"attempt_id" uuid,
	"artifact_kind" text NOT NULL,
	"r2_key" text NOT NULL,
	"sha256" text,
	"byte_size" bigint,
	"content_type" text,
	"redacted" boolean DEFAULT true NOT NULL,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_request_artifacts_key_check" CHECK ((length(TRIM(BOTH FROM r2_key)) > 0) AND (r2_key !~* '^https?://'::text)),
	CONSTRAINT "v2_request_artifacts_kind_check" CHECK (artifact_kind = ANY (ARRAY['request_body'::text, 'response_body'::text, 'upstream_request'::text, 'upstream_response'::text, 'tool_io'::text])),
	CONSTRAINT "v2_request_artifacts_sha_check" CHECK ((sha256 IS NULL) OR (sha256 ~ '^[a-f0-9]{64}$'::text)),
	CONSTRAINT "v2_request_artifacts_size_check" CHECK ((byte_size IS NULL) OR (byte_size >= 0))
);
--> statement-breakpoint
ALTER TABLE "v2_request_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_request_attempts" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_event_id" uuid NOT NULL,
	"attempt_number" smallint NOT NULL,
	"provider_model_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"failure_class" text,
	"upstream_response_id" text,
	"latency_ms" integer,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cloudflare_colo" text,
	CONSTRAINT "v2_request_attempts_key" UNIQUE("attempt_number","request_event_id"),
	CONSTRAINT "v2_request_attempts_cloudflare_colo_check" CHECK ((cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)),
	CONSTRAINT "v2_request_attempts_latency_check" CHECK ((latency_ms IS NULL) OR (latency_ms >= 0)),
	CONSTRAINT "v2_request_attempts_number_check" CHECK (attempt_number > 0),
	CONSTRAINT "v2_request_attempts_status_code_check" CHECK ((status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))),
	CONSTRAINT "v2_request_attempts_window_check" CHECK ((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))
);
--> statement-breakpoint
ALTER TABLE "v2_request_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_request_facts" (
	"request_event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"app_id" uuid,
	"key_id" uuid,
	"endpoint" text NOT NULL,
	"requested_model_input" text NOT NULL,
	"requested_model_slug" text,
	"routed_model_slug" text,
	"provider_model_id" text,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"stop_reason" text,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"structured_output_attempted" boolean DEFAULT false NOT NULL,
	"structured_output_succeeded" boolean DEFAULT false NOT NULL,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"latency_ms" integer,
	"time_to_first_token_ms" integer,
	"generation_ms" integer,
	"queue_ms" integer,
	"upstream_latency_ms" integer,
	"upstream_attempt_count" smallint DEFAULT 0 NOT NULL,
	"throughput" numeric(30, 12),
	"user_agent" text,
	"sdk_name" text,
	"sdk_version" text,
	"client_version" text,
	"region" text,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cloudflare_colo" text,
	"internal_dispatch_ms" numeric(12, 3),
	"gateway_total_ms" numeric(12, 3),
	"session_id" text,
	"end_user_id" text,
	"auth_method" text,
	"native_response_id" text,
	"cost_nanos" bigint,
	"currency" text,
	"tool_call_succeeded" boolean,
	"gateway_request_id" uuid NOT NULL,
	"gateway_request_created_at" timestamp with time zone NOT NULL,
	"edge_country" text,
	"edge_continent" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((safe_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((safe_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((safe_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((safe_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((safe_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "v2_request_facts_request_key" UNIQUE("request_id","workspace_id"),
	CONSTRAINT "v2_request_facts_attempt_count_check" CHECK (upstream_attempt_count >= 0),
	CONSTRAINT "v2_request_facts_auth_method_check" CHECK ((auth_method IS NULL) OR (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text]))),
	CONSTRAINT "v2_request_facts_client_source_detection_check" CHECK ((client_source_detection IS NULL) OR (client_source_detection = ANY (ARRAY['declared'::text, 'user_agent'::text, 'unknown'::text]))),
	CONSTRAINT "v2_request_facts_client_source_kind_check" CHECK ((client_source_kind IS NULL) OR (client_source_kind = ANY (ARRAY['sdk'::text, 'agent_sdk'::text, 'coding_agent'::text, 'http_client'::text, 'app'::text, 'api'::text, 'unknown'::text]))),
	CONSTRAINT "v2_request_facts_cloudflare_colo_check" CHECK ((cloudflare_colo IS NULL) OR (cloudflare_colo ~ '^[A-Z0-9]{3}$'::text)),
	CONSTRAINT "v2_request_facts_cost_check" CHECK ((cost_nanos IS NULL) OR (cost_nanos >= 0)),
	CONSTRAINT "v2_request_facts_gateway_timing_check" CHECK (((internal_dispatch_ms IS NULL) OR (internal_dispatch_ms >= (0)::numeric)) AND ((gateway_total_ms IS NULL) OR (gateway_total_ms >= (0)::numeric))),
	CONSTRAINT "v2_request_facts_model_input_check" CHECK (length(TRIM(BOTH FROM requested_model_input)) > 0),
	CONSTRAINT "v2_request_facts_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0))),
	CONSTRAINT "v2_request_facts_request_id_check" CHECK (length(TRIM(BOTH FROM request_id)) > 0),
	CONSTRAINT "v2_request_facts_status_code_check" CHECK ((status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599))),
	CONSTRAINT "v2_request_facts_throughput_check" CHECK ((throughput IS NULL) OR (throughput >= (0)::numeric)),
	CONSTRAINT "v2_request_facts_timing_check" CHECK (((latency_ms IS NULL) OR (latency_ms >= 0)) AND ((time_to_first_token_ms IS NULL) OR (time_to_first_token_ms >= 0)) AND ((generation_ms IS NULL) OR (generation_ms >= 0)) AND ((queue_ms IS NULL) OR (queue_ms >= 0)) AND ((upstream_latency_ms IS NULL) OR (upstream_latency_ms >= 0))),
	CONSTRAINT "v2_request_facts_tool_count_check" CHECK (tool_call_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "v2_request_facts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_request_feedback" (
	"feedback_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_event_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"feedback_type" text NOT NULL,
	"value" text NOT NULL,
	"score" numeric(10, 4),
	"source" text DEFAULT 'user' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_request_feedback_score_check" CHECK ((score IS NULL) OR ((score >= ('-1'::integer)::numeric) AND (score <= (1)::numeric)))
);
--> statement-breakpoint
ALTER TABLE "v2_request_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_request_pricing_lines" (
	"pricing_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_event_id" uuid NOT NULL,
	"sku_id" uuid,
	"sku_meter_id" uuid,
	"meter_key" text NOT NULL,
	"quantity" numeric(30, 12) NOT NULL,
	"unit" text NOT NULL,
	"unit_price_nanos" numeric(30, 12) NOT NULL,
	"charged_nanos" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_request_pricing_lines_charge_check" CHECK (charged_nanos >= 0),
	CONSTRAINT "v2_request_pricing_lines_quantity_check" CHECK (quantity >= (0)::numeric),
	CONSTRAINT "v2_request_pricing_lines_unit_price_check" CHECK (unit_price_nanos >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "v2_request_pricing_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_request_routing_decisions" (
	"routing_decision_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "v2_request_routing_decisions_routing_decision_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_event_id" uuid NOT NULL,
	"decision_order" smallint NOT NULL,
	"provider_model_id" text,
	"provider_slug" text NOT NULL,
	"provider_api_model_id" text,
	"decision" text NOT NULL,
	"rank" smallint,
	"score" numeric(20, 12),
	"selected" boolean DEFAULT false NOT NULL,
	"attempted" boolean DEFAULT false NOT NULL,
	"breaker" text,
	"breaker_until" timestamp with time zone,
	"provider_status" text,
	"provider_routing_status" text,
	"model_routing_status" text,
	"capability_status" text,
	"exclusion_stage" text,
	"exclusion_reason" text,
	"score_factors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_request_routing_decisions_request_order_key" UNIQUE("decision_order","request_event_id"),
	CONSTRAINT "v2_request_routing_decisions_decision_check" CHECK (decision = ANY (ARRAY['ranked'::text, 'excluded'::text])),
	CONSTRAINT "v2_request_routing_decisions_factors_check" CHECK ((jsonb_typeof(score_factors) = 'object'::text) AND (pg_column_size(score_factors) <= 4096)),
	CONSTRAINT "v2_request_routing_decisions_order_check" CHECK (decision_order > 0),
	CONSTRAINT "v2_request_routing_decisions_rank_check" CHECK ((rank IS NULL) OR (rank > 0)),
	CONSTRAINT "v2_request_routing_decisions_score_check" CHECK ((score IS NULL) OR (score >= (0)::numeric))
);
--> statement-breakpoint
ALTER TABLE "v2_request_routing_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_request_usage" (
	"usage_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_event_id" uuid NOT NULL,
	"sku_meter_id" uuid,
	"meter_key" text NOT NULL,
	"modality" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(30, 12) NOT NULL,
	"source" text DEFAULT 'provider' NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_request_usage_key" UNIQUE("meter_key","request_event_id","sequence"),
	CONSTRAINT "v2_request_usage_quantity_check" CHECK (quantity >= (0)::numeric),
	CONSTRAINT "v2_request_usage_sequence_check" CHECK (sequence >= 0)
);
--> statement-breakpoint
ALTER TABLE "v2_request_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_guardrail_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"privacy_enable_paid_may_train" boolean DEFAULT true NOT NULL,
	"privacy_enable_free_may_train" boolean DEFAULT true NOT NULL,
	"privacy_enable_input_output_logging" boolean DEFAULT true NOT NULL,
	"privacy_zdr_only" boolean DEFAULT false NOT NULL,
	"blocked_provider_ids" text[] DEFAULT '{""}' NOT NULL,
	"blocked_api_model_ids" text[] DEFAULT '{""}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_restriction_mode" text DEFAULT 'none' NOT NULL,
	"provider_restriction_provider_ids" text[] DEFAULT '{""}' NOT NULL,
	"model_restriction_mode" text DEFAULT 'none' NOT NULL,
	"model_restriction_model_ids" text[] DEFAULT '{""}' NOT NULL,
	CONSTRAINT "account_guardrail_settings_model_ids_valid" CHECK (array_position(blocked_api_model_ids, NULL::text) IS NULL),
	CONSTRAINT "account_guardrail_settings_model_mode_valid" CHECK (model_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])),
	CONSTRAINT "account_guardrail_settings_provider_ids_valid" CHECK (array_position(blocked_provider_ids, NULL::text) IS NULL),
	CONSTRAINT "account_guardrail_settings_provider_mode_valid" CHECK (provider_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text]))
);
--> statement-breakpoint
ALTER TABLE "account_guardrail_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "broadcast_destination_rule_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"name" text NOT NULL,
	"match_operator" text DEFAULT 'and' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "broadcast_destination_rule_groups_match_operator_check" CHECK (match_operator = ANY (ARRAY['and'::text, 'or'::text]))
);
--> statement-breakpoint
ALTER TABLE "broadcast_destination_rule_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_publisher_handle_aliases" (
	"handle" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_publisher_handle_alias_format" CHECK (handle ~ '^[a-z0-9][a-z0-9_-]{2,39}$'::text)
);
--> statement-breakpoint
ALTER TABLE "workspace_publisher_handle_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"routing_mode" text DEFAULT 'balanced' NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"byok_fallback_enabled" boolean DEFAULT true NOT NULL,
	"beta_channel_enabled" boolean DEFAULT false NOT NULL,
	"privacy_enable_paid_may_train" boolean DEFAULT true NOT NULL,
	"privacy_enable_free_may_train" boolean DEFAULT true NOT NULL,
	"privacy_enable_free_may_publish_prompts" boolean DEFAULT true NOT NULL,
	"privacy_enable_input_output_logging" boolean DEFAULT true NOT NULL,
	"privacy_zdr_only" boolean DEFAULT false NOT NULL,
	"provider_restriction_mode" text DEFAULT 'none' NOT NULL,
	"provider_restriction_provider_ids" text[] DEFAULT '{""}' NOT NULL,
	"provider_restriction_enforce_allowed" boolean DEFAULT false NOT NULL,
	"sso_enabled" boolean DEFAULT false NOT NULL,
	"sso_enforced" boolean DEFAULT false NOT NULL,
	"sso_mode" text DEFAULT 'none' NOT NULL,
	"sso_provider_identifier" text,
	"sso_domains" text[] DEFAULT '{""}' NOT NULL,
	"alpha_channel_enabled" boolean DEFAULT false NOT NULL,
	"gateway_plugins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"io_logging_enabled" boolean DEFAULT false NOT NULL,
	"io_logging_retention_days" integer DEFAULT 90 NOT NULL,
	"io_logging_include_provider_payloads" boolean DEFAULT true NOT NULL,
	"io_logging_updated_at" timestamp with time zone,
	"data_contribution_enabled" boolean DEFAULT false NOT NULL,
	"data_contribution_policy_version" text,
	"data_contribution_consented_at" timestamp with time zone,
	"data_contribution_consented_by" uuid,
	"data_contribution_sample_rate_bps" integer DEFAULT 10000 NOT NULL,
	"data_contribution_classifier_sample_rate_bps" integer DEFAULT 1000 NOT NULL,
	"data_contribution_discount_bps" integer DEFAULT 100 NOT NULL,
	"response_healing_enabled" boolean DEFAULT false NOT NULL,
	"response_healing_locked" boolean DEFAULT false NOT NULL,
	"response_healing_mode" text DEFAULT 'safe' NOT NULL,
	"cache_aware_routing_enabled" boolean DEFAULT true NOT NULL,
	"low_balance_email_enabled" boolean DEFAULT false NOT NULL,
	"low_balance_email_threshold_nanos" bigint DEFAULT 0 NOT NULL,
	"low_balance_email_last_sent_at" timestamp with time zone,
	"low_balance_email_last_sent_balance_nanos" bigint,
	"auto_top_up_failure_email_enabled" boolean DEFAULT true NOT NULL,
	"payment_method_expiring_email_enabled" boolean DEFAULT true NOT NULL,
	"model_restriction_mode" text DEFAULT 'none' NOT NULL,
	"model_restriction_model_ids" text[] DEFAULT '{""}' NOT NULL,
	"io_logging_billing_status" text DEFAULT 'active' NOT NULL,
	"io_logging_grace_until" timestamp with time zone,
	"io_logging_last_billed_at" timestamp with time zone,
	"io_logging_last_billing_warning_at" timestamp with time zone,
	"io_logging_last_billing_warning_kind" text,
	"io_logging_price_per_million_units_nanos" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "workspace_settings_alpha_requires_beta_channel_check" CHECK ((alpha_channel_enabled = false) OR (beta_channel_enabled = true)),
	CONSTRAINT "workspace_settings_data_contribution_classifier_sample_rate_che" CHECK ((data_contribution_classifier_sample_rate_bps >= 0) AND (data_contribution_classifier_sample_rate_bps <= 10000)),
	CONSTRAINT "workspace_settings_data_contribution_consent_check" CHECK ((NOT data_contribution_enabled) OR ((data_contribution_policy_version IS NOT NULL) AND (data_contribution_consented_at IS NOT NULL))),
	CONSTRAINT "workspace_settings_data_contribution_discount_check" CHECK ((data_contribution_discount_bps >= 0) AND (data_contribution_discount_bps <= 10000)),
	CONSTRAINT "workspace_settings_data_contribution_sample_rate_check" CHECK ((data_contribution_sample_rate_bps >= 0) AND (data_contribution_sample_rate_bps <= 10000)),
	CONSTRAINT "workspace_settings_io_logging_billing_status_check" CHECK (io_logging_billing_status = ANY (ARRAY['active'::text, 'grace'::text, 'suspended'::text])),
	CONSTRAINT "workspace_settings_io_logging_price_per_million_units_check" CHECK (io_logging_price_per_million_units_nanos >= 0),
	CONSTRAINT "workspace_settings_io_logging_retention_days_check" CHECK ((io_logging_retention_days >= 90) AND (io_logging_retention_days <= 365)),
	CONSTRAINT "workspace_settings_low_balance_threshold_nonnegative" CHECK (low_balance_email_threshold_nanos >= 0),
	CONSTRAINT "workspace_settings_model_restriction_mode_valid" CHECK (model_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])),
	CONSTRAINT "workspace_settings_provider_restriction_mode_check" CHECK (provider_restriction_mode = ANY (ARRAY['none'::text, 'allowlist'::text, 'blocklist'::text])),
	CONSTRAINT "workspace_settings_response_healing_mode_check" CHECK (response_healing_mode = ANY (ARRAY['safe'::text, 'strict'::text])),
	CONSTRAINT "workspace_settings_sso_mode_check" CHECK (sso_mode = ANY (ARRAY['none'::text, 'saml'::text, 'custom_oidc'::text]))
);
--> statement-breakpoint
ALTER TABLE "workspace_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_user_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"tier" text DEFAULT 'basic',
	"billing_mode" text DEFAULT 'wallet' NOT NULL,
	"publisher_handle" text NOT NULL,
	CONSTRAINT "workspaces_slug_key" UNIQUE("slug"),
	CONSTRAINT "workspaces_billing_mode_check" CHECK (billing_mode = ANY (ARRAY['wallet'::text, 'invoice'::text])),
	CONSTRAINT "workspaces_publisher_handle_format" CHECK (publisher_handle ~ '^[a-z0-9][a-z0-9_-]{2,39}$'::text)
);
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "key_guardrails" (
	"key_id" uuid NOT NULL,
	"guardrail_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "key_guardrails_pkey" PRIMARY KEY("guardrail_id","key_id")
);
--> statement-breakpoint
ALTER TABLE "key_guardrails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "preset_lineage" (
	"ancestor_preset_id" uuid NOT NULL,
	"descendant_preset_id" uuid NOT NULL,
	"depth" integer NOT NULL,
	CONSTRAINT "preset_lineage_pkey" PRIMARY KEY("ancestor_preset_id","descendant_preset_id"),
	CONSTRAINT "preset_lineage_depth_check" CHECK (depth >= 0)
);
--> statement-breakpoint
ALTER TABLE "preset_lineage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_dynamic_route_keys" (
	"route_id" uuid NOT NULL,
	"key_id" uuid NOT NULL,
	"attached_by" uuid,
	"attached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_dynamic_route_keys_pkey" PRIMARY KEY("key_id","route_id"),
	CONSTRAINT "gateway_dynamic_route_keys_one_route_per_key" UNIQUE("key_id")
);
--> statement-breakpoint
ALTER TABLE "gateway_dynamic_route_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "model_discovery_hf_seen_models" (
	"org_id" text NOT NULL,
	"model_id" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "model_discovery_hf_seen_models_pkey" PRIMARY KEY("model_id","org_id")
);
--> statement-breakpoint
ALTER TABLE "model_discovery_hf_seen_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_capability_parameters" (
	"capability_id" text NOT NULL,
	"parameter_key" text NOT NULL,
	"value_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	CONSTRAINT "v2_capability_parameters_pkey" PRIMARY KEY("capability_id","parameter_key"),
	CONSTRAINT "v2_capability_parameters_key_check" CHECK (parameter_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]*$'::text),
	CONSTRAINT "v2_capability_parameters_schema_check" CHECK (jsonb_typeof(value_schema) = 'object'::text)
);
--> statement-breakpoint
ALTER TABLE "v2_capability_parameters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "broadcast_destination_keys" (
	"destination_id" uuid NOT NULL,
	"key_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"filter_mode" text DEFAULT 'include' NOT NULL,
	CONSTRAINT "broadcast_destination_keys_pkey" PRIMARY KEY("destination_id","key_id"),
	CONSTRAINT "broadcast_destination_keys_filter_mode_check" CHECK (filter_mode = ANY (ARRAY['include'::text, 'exclude'::text]))
);
--> statement-breakpoint
ALTER TABLE "broadcast_destination_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_member_guardrails" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"guardrail_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_member_guardrails_pkey" PRIMARY KEY("guardrail_id","user_id","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_member_guardrails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	CONSTRAINT "workspace_members_pkey" PRIMARY KEY("user_id","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_subscription_plan_features" (
	"plan_uuid" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"feature_value" text,
	"feature_description" text,
	"other_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "v2_subscription_plan_features_pkey" PRIMARY KEY("feature_name","plan_uuid")
);
--> statement-breakpoint
ALTER TABLE "v2_subscription_plan_features" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_lab_links" (
	"lab_slug" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_lab_links_pkey" PRIMARY KEY("lab_slug","platform","url")
);
--> statement-breakpoint
ALTER TABLE "v2_lab_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_subscription_plan_models" (
	"plan_uuid" uuid NOT NULL,
	"model_slug" text NOT NULL,
	"model_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rate_limit" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"other_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "v2_subscription_plan_models_pkey" PRIMARY KEY("model_slug","plan_uuid")
);
--> statement-breakpoint
ALTER TABLE "v2_subscription_plan_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_byok_monthly_usage" (
	"workspace_id" uuid NOT NULL,
	"month_start" timestamp with time zone NOT NULL,
	"request_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_byok_monthly_usage_pkey" PRIMARY KEY("month_start","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_byok_monthly_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_catalogue_source_overrides" (
	"source_type" text NOT NULL,
	"source_key" text NOT NULL,
	"disposition" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"resource_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_catalogue_source_overrides_pkey" PRIMARY KEY("source_key","source_type"),
	CONSTRAINT "v2_catalogue_source_overrides_disposition_check" CHECK (disposition = ANY (ARRAY['database_managed'::text, 'database'::text, 'suppressed'::text])),
	CONSTRAINT "v2_catalogue_source_overrides_type_check" CHECK (source_type = ANY (ARRAY['pricing_rule'::text, 'organisations'::text, 'providers'::text, 'benchmarks'::text, 'subscription-plans'::text, 'models'::text, 'model'::text, 'provider_route'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_catalogue_source_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_model_details" (
	"model_slug" text NOT NULL,
	"detail_name" text NOT NULL,
	"detail_value" jsonb DEFAULT 'null'::jsonb NOT NULL,
	"detail_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_model_details_pkey" PRIMARY KEY("detail_name","model_slug")
);
--> statement-breakpoint
ALTER TABLE "v2_model_details" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_batch_file_uploads" (
	"workspace_id" uuid NOT NULL,
	"upload_id" text NOT NULL,
	"bytes" bigint NOT NULL,
	"status" text NOT NULL,
	"provider_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_batch_file_uploads_pkey" PRIMARY KEY("upload_id","workspace_id"),
	CONSTRAINT "gateway_batch_file_uploads_bytes_check" CHECK (bytes > 0),
	CONSTRAINT "gateway_batch_file_uploads_status_check" CHECK (status = ANY (ARRAY['claimed'::text, 'completed'::text, 'failed'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_batch_file_uploads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "public_model_user_usage_daily" (
	"day_bucket" date NOT NULL,
	"model_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"actor_hash" text NOT NULL,
	"requests" bigint DEFAULT 0 NOT NULL,
	"tokens" bigint DEFAULT 0 NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_model_user_usage_daily_pkey" PRIMARY KEY("actor_hash","day_bucket","model_id","provider_id")
);
--> statement-breakpoint
ALTER TABLE "public_model_user_usage_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_model_links" (
	"model_slug" text NOT NULL,
	"link_kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_model_links_pkey" PRIMARY KEY("link_kind","model_slug","url")
);
--> statement-breakpoint
ALTER TABLE "v2_model_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_private_usage_daily_meters" (
	"rollup_id" uuid NOT NULL,
	"meter_key" text NOT NULL,
	"modality" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(30, 12) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_private_usage_daily_meters_pkey" PRIMARY KEY("meter_key","modality","rollup_id","unit"),
	CONSTRAINT "v2_private_usage_daily_meters_quantity_check" CHECK (quantity >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "v2_private_usage_daily_meters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_public_usage_daily_meters" (
	"rollup_id" uuid NOT NULL,
	"meter_key" text NOT NULL,
	"modality" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(30, 12) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_public_usage_daily_meters_pkey" PRIMARY KEY("meter_key","modality","rollup_id","unit"),
	CONSTRAINT "v2_public_usage_daily_meters_quantity_check" CHECK (quantity >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "v2_public_usage_daily_meters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_public_usage_hourly_meters" (
	"rollup_id" uuid NOT NULL,
	"meter_key" text NOT NULL,
	"modality" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(30, 12) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_public_usage_hourly_meters_pkey" PRIMARY KEY("meter_key","modality","rollup_id","unit"),
	CONSTRAINT "v2_public_usage_hourly_meters_quantity_check" CHECK (quantity >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "v2_public_usage_hourly_meters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_rollup_refresh_state" (
	"rollup_name" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_completed_at" timestamp with time zone,
	"source_watermark" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_rollup_refresh_state_pkey" PRIMARY KEY("bucket_start","rollup_name"),
	CONSTRAINT "v2_rollup_refresh_state_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'complete'::text, 'failed'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_rollup_refresh_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_route_parameter_support" (
	"provider_model_id" text NOT NULL,
	"capability_id" text NOT NULL,
	"parameter_key" text NOT NULL,
	"support_level" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_route_parameter_support_pkey" PRIMARY KEY("capability_id","parameter_key","provider_model_id"),
	CONSTRAINT "v2_route_parameter_support_config_check" CHECK (jsonb_typeof(config) = 'object'::text),
	CONSTRAINT "v2_route_parameter_support_level_check" CHECK (support_level = ANY (ARRAY['native'::text, 'emulated'::text, 'ignored'::text, 'unsupported'::text, 'unknown'::text]))
);
--> statement-breakpoint
ALTER TABLE "v2_route_parameter_support" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_request_charges" (
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"cost_nanos" bigint NOT NULL,
	"status" text DEFAULT 'applying' NOT NULL,
	"deducted_status" text,
	"auto_top_up_required" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_request_charges_pkey" PRIMARY KEY("request_id","workspace_id"),
	CONSTRAINT "gateway_request_charges_cost_nanos_check" CHECK (cost_nanos > 0),
	CONSTRAINT "gateway_request_charges_status_check" CHECK (status = ANY (ARRAY['applying'::text, 'applied'::text, 'failed'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_request_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "model_discovery_seen_models" (
	"provider_id" text NOT NULL,
	"model_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"last_run_id" uuid,
	"model_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pricing_details" jsonb,
	"removal_pending" boolean DEFAULT false NOT NULL,
	CONSTRAINT "model_discovery_seen_models_pkey" PRIMARY KEY("model_id","provider_id")
);
--> statement-breakpoint
ALTER TABLE "model_discovery_seen_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "catalogue_game_results" (
	"user_id" uuid NOT NULL,
	"game_key" text NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"puzzle_date" date NOT NULL,
	"won" boolean NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"attempts" integer,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalogue_game_results_pkey" PRIMARY KEY("game_key","puzzle_date","user_id"),
	CONSTRAINT "catalogue_game_results_attempts_check" CHECK ((attempts IS NULL) OR (attempts >= 0)),
	CONSTRAINT "catalogue_game_results_check" CHECK ((max_score > 0) AND (score <= max_score)),
	CONSTRAINT "catalogue_game_results_game_key_check" CHECK (game_key = ANY (ARRAY['modele'::text, 'timeline'::text, 'pricele'::text, 'head-to-head'::text, 'sprint'::text])),
	CONSTRAINT "catalogue_game_results_score_check" CHECK (score >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalogue_game_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_provider_health_states" (
	"provider_id" text NOT NULL,
	"model_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"breaker_state" text DEFAULT 'closed' NOT NULL,
	"is_deranked" boolean DEFAULT false NOT NULL,
	"open_until_ms" bigint DEFAULT 0 NOT NULL,
	"open_until" timestamp with time zone,
	"last_transition_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reason" text,
	CONSTRAINT "gateway_provider_health_states_pkey" PRIMARY KEY("endpoint","model_id","provider_id"),
	CONSTRAINT "gateway_provider_health_states_breaker_state_chk" CHECK (breaker_state = ANY (ARRAY['closed'::text, 'open'::text, 'half_open'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_provider_health_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "model_discovery_issue_signals" (
	"source" text NOT NULL,
	"provider_id" text NOT NULL,
	"action" text NOT NULL,
	"model_id" text NOT NULL,
	"entry" jsonb NOT NULL,
	"consecutive_sweeps" integer DEFAULT 1 NOT NULL,
	"first_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_run_id" uuid,
	"emitted_at" timestamp with time zone,
	CONSTRAINT "model_discovery_issue_signals_pkey" PRIMARY KEY("action","model_id","provider_id","source"),
	CONSTRAINT "model_discovery_issue_signals_action_check" CHECK (action = 'delete'::text),
	CONSTRAINT "model_discovery_issue_signals_consecutive_sweeps_check" CHECK (consecutive_sweeps > 0)
);
--> statement-breakpoint
ALTER TABLE "model_discovery_issue_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "public_model_task_daily" (
	"usage_date" date NOT NULL,
	"taxonomy_slug" text NOT NULL,
	"primary_category" text NOT NULL,
	"model_slug" text NOT NULL,
	"provider_slug" text DEFAULT '' NOT NULL,
	"workspace_count" bigint DEFAULT 0 NOT NULL,
	"request_count" bigint DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_model_task_daily_pkey" PRIMARY KEY("model_slug","primary_category","provider_slug","taxonomy_slug","usage_date"),
	CONSTRAINT "public_model_task_daily_input_tokens_check" CHECK (input_tokens >= 0),
	CONSTRAINT "public_model_task_daily_output_tokens_check" CHECK (output_tokens >= 0),
	CONSTRAINT "public_model_task_daily_request_count_check" CHECK (request_count >= 0),
	CONSTRAINT "public_model_task_daily_workspace_count_check" CHECK (workspace_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "public_model_task_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "request_classification_daily" (
	"usage_date" date NOT NULL,
	"workspace_id" uuid NOT NULL,
	"classifier_id" uuid NOT NULL,
	"primary_category" text NOT NULL,
	"model_slug" text NOT NULL,
	"provider_slug" text DEFAULT '' NOT NULL,
	"request_count" bigint DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_classification_daily_pkey" PRIMARY KEY("classifier_id","model_slug","primary_category","provider_slug","usage_date","workspace_id"),
	CONSTRAINT "request_classification_daily_input_tokens_check" CHECK (input_tokens >= 0),
	CONSTRAINT "request_classification_daily_output_tokens_check" CHECK (output_tokens >= 0),
	CONSTRAINT "request_classification_daily_request_count_check" CHECK (request_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "request_classification_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_batch_key_usage_records" (
	"workspace_id" uuid NOT NULL,
	"batch_id" text NOT NULL,
	"custom_id" text NOT NULL,
	"key_id" uuid NOT NULL,
	"provider" text,
	"endpoint" text NOT NULL,
	"model" text NOT NULL,
	"cost_nanos" bigint NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_batch_key_usage_records_pkey" PRIMARY KEY("batch_id","custom_id","workspace_id"),
	CONSTRAINT "gateway_batch_key_usage_records_cost_nanos_check" CHECK (cost_nanos >= 0)
);
--> statement-breakpoint
ALTER TABLE "gateway_batch_key_usage_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_route_capabilities" (
	"provider_model_id" text NOT NULL,
	"capability_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"max_input_tokens" integer,
	"max_output_tokens" integer,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_route_capabilities_pkey" PRIMARY KEY("capability_id","provider_model_id"),
	CONSTRAINT "v2_route_capabilities_status_check" CHECK (status = ANY (ARRAY['active'::text, 'degraded'::text, 'disabled'::text, 'internal_testing'::text])),
	CONSTRAINT "v2_route_capabilities_window_check" CHECK ((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to > effective_from))
);
--> statement-breakpoint
ALTER TABLE "v2_route_capabilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v2_public_provider_health_daily" (
	"usage_date" date NOT NULL,
	"model_slug" text NOT NULL,
	"provider_model_id" text NOT NULL,
	"provider_slug" text NOT NULL,
	"request_count" bigint DEFAULT 0 NOT NULL,
	"successful_request_count" bigint DEFAULT 0 NOT NULL,
	"attempt_count" bigint DEFAULT 0 NOT NULL,
	"successful_attempts" bigint DEFAULT 0 NOT NULL,
	"failed_attempts" bigint DEFAULT 0 NOT NULL,
	"fallback_attempts" bigint DEFAULT 0 NOT NULL,
	"latency_sum_ms" bigint DEFAULT 0 NOT NULL,
	"latency_count" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_public_provider_health_daily_pkey" PRIMARY KEY("model_slug","provider_model_id","provider_slug","usage_date")
);
--> statement-breakpoint
ALTER TABLE "v2_public_provider_health_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_async_webhook_deliveries" (
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"internal_id" text NOT NULL,
	"delivery_key" text NOT NULL,
	"status" text DEFAULT 'claimed' NOT NULL,
	"claim_token" text,
	"claimed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text,
	"phase" text,
	"progress" double precision,
	"previous_status" text,
	"current_status" text,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "gateway_async_webhook_deliveries_pkey" PRIMARY KEY("delivery_key","internal_id","kind","workspace_id"),
	CONSTRAINT "gateway_async_webhook_delivery_status_check" CHECK (status = ANY (ARRAY['claimed'::text, 'pending'::text, 'delivered'::text, 'failed'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_async_webhook_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_wallet_reservations" (
	"workspace_id" uuid NOT NULL,
	"reservation_id" text NOT NULL,
	"amount_nanos" bigint NOT NULL,
	"status" text NOT NULL,
	"hold_ref_id" text,
	"capture_ref_id" text,
	"release_ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_amount_nanos" bigint,
	"captured_nanos" bigint DEFAULT 0 NOT NULL,
	"released_nanos" bigint DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"key_id" uuid,
	"request_count" integer,
	"key_usage_recorded_at" timestamp with time zone,
	CONSTRAINT "gateway_wallet_reservations_pkey" PRIMARY KEY("reservation_id","workspace_id"),
	CONSTRAINT "gateway_wallet_reservations_amount_nanos_check" CHECK (amount_nanos > 0),
	CONSTRAINT "gateway_wallet_reservations_capture_amount_check" CHECK ((captured_nanos >= 0) AND (released_nanos >= 0) AND ((captured_nanos + released_nanos) <= amount_nanos)),
	CONSTRAINT "gateway_wallet_reservations_request_count_check" CHECK ((request_count IS NULL) OR (request_count > 0)),
	CONSTRAINT "gateway_wallet_reservations_status_check" CHECK (status = ANY (ARRAY['held'::text, 'reserved'::text, 'captured'::text, 'released'::text]))
);
--> statement-breakpoint
ALTER TABLE "gateway_wallet_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_upstream_requests_2026_07" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"gateway_request_id" uuid NOT NULL,
	"gateway_request_created_at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid,
	"key_id" uuid,
	"sequence" integer NOT NULL,
	"round_number" integer DEFAULT 1 NOT NULL,
	"attempt_number" integer,
	"internal_attempt_number" integer,
	"stage" text DEFAULT 'upstream' NOT NULL,
	"endpoint" text NOT NULL,
	"model_id" text NOT NULL,
	"provider" text,
	"api_model_id" text,
	"provider_model_slug" text,
	"upstream_route" text,
	"upstream_url" text,
	"status_code" integer,
	"status_text" text,
	"success" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"retryable" boolean,
	"fallback_attempted" boolean DEFAULT false NOT NULL,
	"was_probe" boolean DEFAULT false NOT NULL,
	"key_source" text,
	"native_response_id" text,
	"provider_finish_reason" text,
	"finish_reason" text,
	"duration_ms" integer,
	"latency_ms" integer,
	"generation_ms" integer,
	"total_ms" integer,
	"request_build_ms" integer,
	"upstream_headers_ms" integer,
	"retry_delay_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint DEFAULT 0 NOT NULL,
	"currency" text,
	"error_code" text,
	"error_type" text,
	"error_message" text,
	"error_description" text,
	"error_param" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "gateway_upstream_requests_2026_07_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_upstream_requests_202_gateway_request_id_gateway_re_key" UNIQUE("created_at","gateway_request_created_at","gateway_request_id","sequence"),
	CONSTRAINT "gateway_upstream_requests_attempt_ck" CHECK ((attempt_number IS NULL) OR (attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_internal_attempt_ck" CHECK ((internal_attempt_number IS NULL) OR (internal_attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_key_source_ck" CHECK ((key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))),
	CONSTRAINT "gateway_upstream_requests_round_ck" CHECK (round_number > 0),
	CONSTRAINT "gateway_upstream_requests_sequence_ck" CHECK (sequence > 0),
	CONSTRAINT "gateway_upstream_requests_stage_ck" CHECK (stage = ANY (ARRAY['routing'::text, 'upstream'::text])),
	CONSTRAINT "gateway_upstream_requests_status_ck" CHECK ((status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599)))
);
--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_07" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_upstream_requests_2026_08" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"gateway_request_id" uuid NOT NULL,
	"gateway_request_created_at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid,
	"key_id" uuid,
	"sequence" integer NOT NULL,
	"round_number" integer DEFAULT 1 NOT NULL,
	"attempt_number" integer,
	"internal_attempt_number" integer,
	"stage" text DEFAULT 'upstream' NOT NULL,
	"endpoint" text NOT NULL,
	"model_id" text NOT NULL,
	"provider" text,
	"api_model_id" text,
	"provider_model_slug" text,
	"upstream_route" text,
	"upstream_url" text,
	"status_code" integer,
	"status_text" text,
	"success" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"retryable" boolean,
	"fallback_attempted" boolean DEFAULT false NOT NULL,
	"was_probe" boolean DEFAULT false NOT NULL,
	"key_source" text,
	"native_response_id" text,
	"provider_finish_reason" text,
	"finish_reason" text,
	"duration_ms" integer,
	"latency_ms" integer,
	"generation_ms" integer,
	"total_ms" integer,
	"request_build_ms" integer,
	"upstream_headers_ms" integer,
	"retry_delay_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint DEFAULT 0 NOT NULL,
	"currency" text,
	"error_code" text,
	"error_type" text,
	"error_message" text,
	"error_description" text,
	"error_param" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "gateway_upstream_requests_2026_08_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_upstream_requests_202_gateway_request_id_gateway_r_key1" UNIQUE("created_at","gateway_request_created_at","gateway_request_id","sequence"),
	CONSTRAINT "gateway_upstream_requests_attempt_ck" CHECK ((attempt_number IS NULL) OR (attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_internal_attempt_ck" CHECK ((internal_attempt_number IS NULL) OR (internal_attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_key_source_ck" CHECK ((key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))),
	CONSTRAINT "gateway_upstream_requests_round_ck" CHECK (round_number > 0),
	CONSTRAINT "gateway_upstream_requests_sequence_ck" CHECK (sequence > 0),
	CONSTRAINT "gateway_upstream_requests_stage_ck" CHECK (stage = ANY (ARRAY['routing'::text, 'upstream'::text])),
	CONSTRAINT "gateway_upstream_requests_status_ck" CHECK ((status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599)))
);
--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_08" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_upstream_requests_2026_09" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"gateway_request_id" uuid NOT NULL,
	"gateway_request_created_at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid,
	"key_id" uuid,
	"sequence" integer NOT NULL,
	"round_number" integer DEFAULT 1 NOT NULL,
	"attempt_number" integer,
	"internal_attempt_number" integer,
	"stage" text DEFAULT 'upstream' NOT NULL,
	"endpoint" text NOT NULL,
	"model_id" text NOT NULL,
	"provider" text,
	"api_model_id" text,
	"provider_model_slug" text,
	"upstream_route" text,
	"upstream_url" text,
	"status_code" integer,
	"status_text" text,
	"success" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"retryable" boolean,
	"fallback_attempted" boolean DEFAULT false NOT NULL,
	"was_probe" boolean DEFAULT false NOT NULL,
	"key_source" text,
	"native_response_id" text,
	"provider_finish_reason" text,
	"finish_reason" text,
	"duration_ms" integer,
	"latency_ms" integer,
	"generation_ms" integer,
	"total_ms" integer,
	"request_build_ms" integer,
	"upstream_headers_ms" integer,
	"retry_delay_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint DEFAULT 0 NOT NULL,
	"currency" text,
	"error_code" text,
	"error_type" text,
	"error_message" text,
	"error_description" text,
	"error_param" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "gateway_upstream_requests_2026_09_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_upstream_requests_202_gateway_request_id_gateway_r_key2" UNIQUE("created_at","gateway_request_created_at","gateway_request_id","sequence"),
	CONSTRAINT "gateway_upstream_requests_attempt_ck" CHECK ((attempt_number IS NULL) OR (attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_internal_attempt_ck" CHECK ((internal_attempt_number IS NULL) OR (internal_attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_key_source_ck" CHECK ((key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))),
	CONSTRAINT "gateway_upstream_requests_round_ck" CHECK (round_number > 0),
	CONSTRAINT "gateway_upstream_requests_sequence_ck" CHECK (sequence > 0),
	CONSTRAINT "gateway_upstream_requests_stage_ck" CHECK (stage = ANY (ARRAY['routing'::text, 'upstream'::text])),
	CONSTRAINT "gateway_upstream_requests_status_ck" CHECK ((status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599)))
);
--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_09" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_upstream_requests_default" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"gateway_request_id" uuid NOT NULL,
	"gateway_request_created_at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid,
	"key_id" uuid,
	"sequence" integer NOT NULL,
	"round_number" integer DEFAULT 1 NOT NULL,
	"attempt_number" integer,
	"internal_attempt_number" integer,
	"stage" text DEFAULT 'upstream' NOT NULL,
	"endpoint" text NOT NULL,
	"model_id" text NOT NULL,
	"provider" text,
	"api_model_id" text,
	"provider_model_slug" text,
	"upstream_route" text,
	"upstream_url" text,
	"status_code" integer,
	"status_text" text,
	"success" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"retryable" boolean,
	"fallback_attempted" boolean DEFAULT false NOT NULL,
	"was_probe" boolean DEFAULT false NOT NULL,
	"key_source" text,
	"native_response_id" text,
	"provider_finish_reason" text,
	"finish_reason" text,
	"duration_ms" integer,
	"latency_ms" integer,
	"generation_ms" integer,
	"total_ms" integer,
	"request_build_ms" integer,
	"upstream_headers_ms" integer,
	"retry_delay_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint DEFAULT 0 NOT NULL,
	"currency" text,
	"error_code" text,
	"error_type" text,
	"error_message" text,
	"error_description" text,
	"error_param" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "gateway_upstream_requests_default_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_upstream_requests_def_gateway_request_id_gateway_re_key" UNIQUE("created_at","gateway_request_created_at","gateway_request_id","sequence"),
	CONSTRAINT "gateway_upstream_requests_attempt_ck" CHECK ((attempt_number IS NULL) OR (attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_internal_attempt_ck" CHECK ((internal_attempt_number IS NULL) OR (internal_attempt_number > 0)),
	CONSTRAINT "gateway_upstream_requests_key_source_ck" CHECK ((key_source IS NULL) OR (key_source = ANY (ARRAY['gateway'::text, 'byok'::text]))),
	CONSTRAINT "gateway_upstream_requests_round_ck" CHECK (round_number > 0),
	CONSTRAINT "gateway_upstream_requests_sequence_ck" CHECK (sequence > 0),
	CONSTRAINT "gateway_upstream_requests_stage_ck" CHECK (stage = ANY (ARRAY['routing'::text, 'upstream'::text])),
	CONSTRAINT "gateway_upstream_requests_status_ck" CHECK ((status_code IS NULL) OR ((status_code >= 100) AND (status_code <= 599)))
);
--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_default" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_2026_03" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_2026_03_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_03" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_2026_04" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_2026_04_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_04" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_2026_05" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_2026_05_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_05" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_2026_06" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_2026_06_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_06" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_2026_07" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_2026_07_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_07" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_2026_08" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_2026_08_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_08" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_2026_09" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_2026_09_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_09" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_requests_default" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"app_id" uuid,
	"endpoint" text NOT NULL,
	"model_id" text,
	"provider" text,
	"native_response_id" text,
	"stream" boolean DEFAULT false NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"generation_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_nanos" bigint,
	"currency" text,
	"pricing_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_id" uuid,
	"throughput" numeric,
	"location" text,
	"auth_method" text DEFAULT 'api_key',
	"oauth_client_id" text,
	"oauth_user_id" uuid,
	"finish_reason" text,
	"end_user_id" text,
	"session_id" text,
	"trace_data" jsonb,
	"canonical_model_id" text,
	"provider_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_payload" jsonb,
	"requested_model_id" text,
	"routed_model_id" text,
	"usage_total_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_image_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_audio_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_inputs" bigint DEFAULT 0 NOT NULL,
	"usage_video_outputs" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_5m" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_text_tokens_1h" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_image_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_audio_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_read_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_cached_write_video_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_input_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_output_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_total_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_text_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_rerank_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_embedding_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_moderation_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_ocr_quad_tokens" bigint DEFAULT 0 NOT NULL,
	"usage_image_megapixels" numeric DEFAULT '0' NOT NULL,
	"usage_audio_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_video_pixel_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_input_characters" bigint DEFAULT 0 NOT NULL,
	"usage_output_characters" bigint DEFAULT 0 NOT NULL,
	"usage_total_characters" bigint DEFAULT 0 NOT NULL,
	"usage_normalized_at" timestamp with time zone,
	"detail_metadata" jsonb,
	"usage_video_seconds" numeric DEFAULT '0' NOT NULL,
	"usage_embedding_tokens" bigint DEFAULT 0 NOT NULL,
	"api_model_id" text,
	"pricing_plan" text,
	"is_free_variant" boolean DEFAULT false NOT NULL,
	"realtime_session_id" text,
	"provider_ttft_ms" integer,
	"gateway_ttft_ms" integer,
	"output_speed_tps" numeric(30, 12),
	"tpot_ms" numeric(30, 12),
	"itl_ms" numeric(30, 12),
	"phaseo_overhead_ms" integer,
	"client_source_id" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,id}'::text[]), ''::text)) STORED,
	"client_source_name" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,name}'::text[]), ''::text)) STORED,
	"client_source_kind" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,kind}'::text[]), ''::text)) STORED,
	"client_source_version" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,version}'::text[]), ''::text)) STORED,
	"client_source_detection" text GENERATED ALWAYS AS (NULLIF((detail_metadata #>> '{client_source,detection}'::text[]), ''::text)) STORED,
	CONSTRAINT "gateway_requests_default_pkey" PRIMARY KEY("created_at","id"),
	CONSTRAINT "gateway_requests_auth_method_check" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_auth_method_ck" CHECK (auth_method = ANY (ARRAY['api_key'::text, 'oauth'::text])),
	CONSTRAINT "gateway_requests_model_id_present_ck" CHECK (NULLIF(btrim(model_id), ''::text) IS NOT NULL),
	CONSTRAINT "gateway_requests_performance_metrics_nonnegative" CHECK (((provider_ttft_ms IS NULL) OR (provider_ttft_ms >= 0)) AND ((gateway_ttft_ms IS NULL) OR (gateway_ttft_ms >= 0)) AND ((output_speed_tps IS NULL) OR (output_speed_tps >= (0)::numeric)) AND ((tpot_ms IS NULL) OR (tpot_ms >= (0)::numeric)) AND ((itl_ms IS NULL) OR (itl_ms >= (0)::numeric)) AND ((phaseo_overhead_ms IS NULL) OR (phaseo_overhead_ms >= 0)))
);
--> statement-breakpoint
ALTER TABLE "gateway_requests_default" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "byok_keys" ADD CONSTRAINT "byok_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_keys" ADD CONSTRAINT "byok_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grant_redemptions" ADD CONSTRAINT "credit_grant_redemptions_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grant_redemptions" ADD CONSTRAINT "credit_grant_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grant_redemptions" ADD CONSTRAINT "credit_grant_redemptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_contribution_consent_events" ADD CONSTRAINT "data_contribution_consent_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_contribution_consent_events" ADD CONSTRAINT "data_contribution_consent_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_contributions" ADD CONSTRAINT "data_contributions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_async_operations" ADD CONSTRAINT "gateway_async_operations_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_async_operations" ADD CONSTRAINT "gateway_async_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_batch_requests" ADD CONSTRAINT "gateway_batch_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_dynamic_route_versions" ADD CONSTRAINT "gateway_dynamic_route_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_dynamic_route_versions" ADD CONSTRAINT "gateway_dynamic_route_versions_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."gateway_dynamic_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_dynamic_routes" ADD CONSTRAINT "gateway_dynamic_routes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_dynamic_routes" ADD CONSTRAINT "gateway_dynamic_routes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_io_logs" ADD CONSTRAINT "gateway_io_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_observability_events" ADD CONSTRAINT "gateway_observability_events_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_observability_events" ADD CONSTRAINT "gateway_observability_events_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "public"."gateway_preset_test_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_observability_events" ADD CONSTRAINT "gateway_observability_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_preset_test_run_items" ADD CONSTRAINT "gateway_preset_test_run_items_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."gateway_feedback"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_preset_test_run_items" ADD CONSTRAINT "gateway_preset_test_run_items_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_preset_test_run_items" ADD CONSTRAINT "gateway_preset_test_run_items_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "public"."gateway_preset_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_preset_test_run_items" ADD CONSTRAINT "gateway_preset_test_run_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_preset_test_runs" ADD CONSTRAINT "gateway_preset_test_runs_baseline_preset_id_fkey" FOREIGN KEY ("baseline_preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_preset_test_runs" ADD CONSTRAINT "gateway_preset_test_runs_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_preset_test_runs" ADD CONSTRAINT "gateway_preset_test_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_provider_events" ADD CONSTRAINT "gateway_provider_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_realtime_sessions" ADD CONSTRAINT "gateway_realtime_sessions_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_realtime_sessions" ADD CONSTRAINT "gateway_realtime_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_models" ADD CONSTRAINT "v2_models_base_model_slug_fkey" FOREIGN KEY ("base_model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_models" ADD CONSTRAINT "v2_models_lab_slug_fkey" FOREIGN KEY ("lab_slug") REFERENCES "public"."v2_labs"("lab_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_apps" ADD CONSTRAINT "api_apps_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_destination_rules" ADD CONSTRAINT "broadcast_destination_rules_rule_group_id_fkey" FOREIGN KEY ("rule_group_id") REFERENCES "public"."broadcast_destination_rule_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_webhook_endpoints" ADD CONSTRAINT "gateway_webhook_endpoints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_webhook_endpoints" ADD CONSTRAINT "gateway_webhook_endpoints_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keys" ADD CONSTRAINT "keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keys" ADD CONSTRAINT "keys_oauth_user_id_fkey" FOREIGN KEY ("oauth_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keys" ADD CONSTRAINT "keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_keys" ADD CONSTRAINT "management_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_keys" ADD CONSTRAINT "management_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_history_events" ADD CONSTRAINT "monitor_history_events_commit_sha_fkey" FOREIGN KEY ("commit_sha") REFERENCES "public"."monitor_history_commits"("commit_sha") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_app_metadata" ADD CONSTRAINT "oauth_app_metadata_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_app_metadata" ADD CONSTRAINT "oauth_app_metadata_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_feedback" ADD CONSTRAINT "gateway_feedback_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_feedback" ADD CONSTRAINT "gateway_feedback_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "public"."gateway_preset_test_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_feedback" ADD CONSTRAINT "gateway_feedback_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorizations" ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorizations" ADD CONSTRAINT "oauth_authorizations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_device_codes" ADD CONSTRAINT "oauth_device_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_device_codes" ADD CONSTRAINT "oauth_device_codes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_rotated_from_fkey" FOREIGN KEY ("rotated_from") REFERENCES "public"."oauth_refresh_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otel_export_outbox" ADD CONSTRAINT "otel_export_outbox_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "public"."workspace_broadcast_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otel_export_outbox" ADD CONSTRAINT "otel_export_outbox_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preset_versions" ADD CONSTRAINT "preset_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preset_versions" ADD CONSTRAINT "preset_versions_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_active_version_fkey" FOREIGN KEY ("active_version_id") REFERENCES "public"."preset_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_root_preset_fkey" FOREIGN KEY ("root_preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_source_preset_id_fkey" FOREIGN KEY ("source_preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_source_version_fkey" FOREIGN KEY ("source_preset_version_id") REFERENCES "public"."preset_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_upstream_version_fkey" FOREIGN KEY ("upstream_version_id") REFERENCES "public"."preset_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_classifications" ADD CONSTRAINT "request_classifications_classifier_id_fkey" FOREIGN KEY ("classifier_id") REFERENCES "public"."workspace_classifiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_classifications" ADD CONSTRAINT "request_classifications_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "public"."data_contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_classifications" ADD CONSTRAINT "request_classifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_key_reports" ADD CONSTRAINT "security_key_reports_action_taken_by_fkey" FOREIGN KEY ("action_taken_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_key_reports" ADD CONSTRAINT "security_key_reports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_workspace_id_fkey" FOREIGN KEY ("default_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_analytics_outbox" ADD CONSTRAINT "v2_analytics_outbox_request_event_id_fkey" FOREIGN KEY ("request_event_id") REFERENCES "public"."v2_request_facts"("request_event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_analytics_outbox" ADD CONSTRAINT "v2_analytics_outbox_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_benchmark_results" ADD CONSTRAINT "v2_benchmark_results_benchmark_id_fkey" FOREIGN KEY ("benchmark_id") REFERENCES "public"."v2_benchmarks"("benchmark_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_benchmark_results" ADD CONSTRAINT "v2_benchmark_results_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_capability_constraints" ADD CONSTRAINT "v2_capability_constraints_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_capability_constraints" ADD CONSTRAINT "v2_capability_constraints_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_capability_constraints" ADD CONSTRAINT "v2_capability_constraints_provider_slug_provider_model_id_fkey" FOREIGN KEY ("provider_slug","provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id","provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_capability_evidence" ADD CONSTRAINT "v2_capability_evidence_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_capability_evidence" ADD CONSTRAINT "v2_capability_evidence_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_capability_evidence" ADD CONSTRAINT "v2_capability_evidence_provider_slug_provider_model_id_fkey" FOREIGN KEY ("provider_slug","provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id","provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_catalogue_admin_changes" ADD CONSTRAINT "v2_catalogue_admin_changes_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_control_plane_releases" ADD CONSTRAINT "v2_control_plane_releases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_control_plane_releases" ADD CONSTRAINT "v2_control_plane_releases_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_control_plane_releases" ADD CONSTRAINT "v2_control_plane_releases_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_credit_reservations" ADD CONSTRAINT "v2_credit_reservations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_execution_plans" ADD CONSTRAINT "v2_execution_plans_provider_model_id_capability_id_fkey" FOREIGN KEY ("provider_model_id","capability_id") REFERENCES "public"."v2_route_capabilities"("provider_model_id","capability_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_execution_plans" ADD CONSTRAINT "v2_execution_plans_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_execution_plans" ADD CONSTRAINT "v2_execution_plans_provider_model_id_route_variant_id_fkey" FOREIGN KEY ("provider_model_id","route_variant_id") REFERENCES "public"."v2_route_variants"("variant_id","provider_model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_execution_plans" ADD CONSTRAINT "v2_execution_plans_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."v2_control_plane_releases"("release_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_model_aliases" ADD CONSTRAINT "v2_model_aliases_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_model_families" ADD CONSTRAINT "v2_model_families_lab_slug_fkey" FOREIGN KEY ("lab_slug") REFERENCES "public"."v2_labs"("lab_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_model_page_notices" ADD CONSTRAINT "v2_model_page_notices_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_model_provider_routes" ADD CONSTRAINT "v2_model_provider_routes_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_model_provider_routes" ADD CONSTRAINT "v2_model_provider_routes_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_pricing_sku_meters" ADD CONSTRAINT "v2_pricing_sku_meters_meter_key_fkey" FOREIGN KEY ("meter_key") REFERENCES "public"."v2_meter_definitions"("meter_key") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "v2_pricing_sku_meters" ADD CONSTRAINT "v2_pricing_sku_meters_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."v2_pricing_skus"("sku_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_pricing_skus" ADD CONSTRAINT "v2_pricing_skus_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_pricing_skus" ADD CONSTRAINT "v2_pricing_skus_route_variant_fkey" FOREIGN KEY ("route_variant_id") REFERENCES "public"."v2_route_variants"("variant_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_pricing_skus" ADD CONSTRAINT "v2_pricing_skus_service_tier_fkey" FOREIGN KEY ("service_tier_slug") REFERENCES "public"."v2_service_tiers"("service_tier_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_private_usage_daily" ADD CONSTRAINT "v2_private_usage_daily_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_private_usage_daily" ADD CONSTRAINT "v2_private_usage_daily_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_private_usage_daily" ADD CONSTRAINT "v2_private_usage_daily_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_private_usage_daily" ADD CONSTRAINT "v2_private_usage_daily_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_auth_profiles" ADD CONSTRAINT "v2_provider_auth_profiles_auth_primitive_key_fkey" FOREIGN KEY ("auth_primitive_key") REFERENCES "public"."v2_adapter_primitives"("primitive_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_auth_profiles" ADD CONSTRAINT "v2_provider_auth_profiles_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_capability_adapters" ADD CONSTRAINT "v2_provider_capability_adapte_capability_id_capability_ada_fkey" FOREIGN KEY ("capability_id","capability_adapter_id") REFERENCES "public"."v2_capability_adapters"("capability_adapter_id","capability_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_capability_adapters" ADD CONSTRAINT "v2_provider_capability_adapte_provider_slug_capability_id__fkey" FOREIGN KEY ("provider_slug","capability_id","provider_endpoint_id") REFERENCES "public"."v2_provider_endpoints"("provider_endpoint_id","provider_slug","capability_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_capability_adapters" ADD CONSTRAINT "v2_provider_capability_adapters_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_country_restrictions" ADD CONSTRAINT "v2_provider_country_restrictions_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_endpoints" ADD CONSTRAINT "v2_provider_endpoints_provider_slug_auth_profile_id_fkey" FOREIGN KEY ("provider_slug","auth_profile_id") REFERENCES "public"."v2_provider_auth_profiles"("auth_profile_id","provider_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_endpoints" ADD CONSTRAINT "v2_provider_endpoints_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_endpoints" ADD CONSTRAINT "v2_provider_endpoints_service_tier_slug_fkey" FOREIGN KEY ("service_tier_slug") REFERENCES "public"."v2_service_tiers"("service_tier_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_provider_regions" ADD CONSTRAINT "v2_provider_regions_provider_slug_fkey" FOREIGN KEY ("provider_slug") REFERENCES "public"."v2_providers"("provider_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_providers" ADD CONSTRAINT "v2_providers_lab_slug_fkey" FOREIGN KEY ("lab_slug") REFERENCES "public"."v2_labs"("lab_slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_route_variants" ADD CONSTRAINT "v2_route_variants_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_route_variants" ADD CONSTRAINT "v2_route_variants_provider_region_id_fkey" FOREIGN KEY ("provider_region_id") REFERENCES "public"."v2_provider_regions"("provider_region_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_route_variants" ADD CONSTRAINT "v2_route_variants_service_tier_slug_fkey" FOREIGN KEY ("service_tier_slug") REFERENCES "public"."v2_service_tiers"("service_tier_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_cache_generations" ADD CONSTRAINT "web_cache_generations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_cache_purge_events" ADD CONSTRAINT "web_cache_purge_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_broadcast_destinations" ADD CONSTRAINT "workspace_broadcast_destinations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_classifiers" ADD CONSTRAINT "workspace_classifiers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_classifiers" ADD CONSTRAINT "workspace_classifiers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_guardrails" ADD CONSTRAINT "workspace_guardrails_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_inviter_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_join_requests" ADD CONSTRAINT "workspace_join_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_join_requests" ADD CONSTRAINT "workspace_join_requests_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "public"."workspace_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_join_requests" ADD CONSTRAINT "workspace_join_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_join_requests" ADD CONSTRAINT "workspace_join_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ssoProvider" ADD CONSTRAINT "ssoProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_credit_ledger" ADD CONSTRAINT "v2_credit_ledger_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_daily" ADD CONSTRAINT "v2_public_usage_daily_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_daily" ADD CONSTRAINT "v2_public_usage_daily_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_daily" ADD CONSTRAINT "v2_public_usage_daily_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_hourly" ADD CONSTRAINT "v2_public_usage_hourly_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_hourly" ADD CONSTRAINT "v2_public_usage_hourly_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_hourly" ADD CONSTRAINT "v2_public_usage_hourly_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_artifacts" ADD CONSTRAINT "v2_request_artifacts_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."v2_request_attempts"("attempt_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_artifacts" ADD CONSTRAINT "v2_request_artifacts_request_event_id_fkey" FOREIGN KEY ("request_event_id") REFERENCES "public"."v2_request_facts"("request_event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_attempts" ADD CONSTRAINT "v2_request_attempts_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_attempts" ADD CONSTRAINT "v2_request_attempts_request_event_id_fkey" FOREIGN KEY ("request_event_id") REFERENCES "public"."v2_request_facts"("request_event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_1" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_2026_03"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_2" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_2026_04"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_3" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_2026_05"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_4" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_2026_06"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_5" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_2026_07"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_6" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_2026_08"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_7" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_2026_09"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_gateway_request_fkey_8" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests_default"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_requested_model_slug_fkey" FOREIGN KEY ("requested_model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_routed_model_slug_fkey" FOREIGN KEY ("routed_model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_facts" ADD CONSTRAINT "v2_request_facts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_feedback" ADD CONSTRAINT "v2_request_feedback_request_event_id_fkey" FOREIGN KEY ("request_event_id") REFERENCES "public"."v2_request_facts"("request_event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_feedback" ADD CONSTRAINT "v2_request_feedback_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_pricing_lines" ADD CONSTRAINT "v2_request_pricing_lines_request_event_id_fkey" FOREIGN KEY ("request_event_id") REFERENCES "public"."v2_request_facts"("request_event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_pricing_lines" ADD CONSTRAINT "v2_request_pricing_lines_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."v2_pricing_skus"("sku_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_pricing_lines" ADD CONSTRAINT "v2_request_pricing_lines_sku_meter_id_fkey" FOREIGN KEY ("sku_meter_id") REFERENCES "public"."v2_pricing_sku_meters"("sku_meter_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_routing_decisions" ADD CONSTRAINT "v2_request_routing_decisions_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_routing_decisions" ADD CONSTRAINT "v2_request_routing_decisions_request_event_id_fkey" FOREIGN KEY ("request_event_id") REFERENCES "public"."v2_request_facts"("request_event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_usage" ADD CONSTRAINT "v2_request_usage_request_event_id_fkey" FOREIGN KEY ("request_event_id") REFERENCES "public"."v2_request_facts"("request_event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_request_usage" ADD CONSTRAINT "v2_request_usage_sku_meter_id_fkey" FOREIGN KEY ("sku_meter_id") REFERENCES "public"."v2_pricing_sku_meters"("sku_meter_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_guardrail_settings" ADD CONSTRAINT "account_guardrail_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_destination_rule_groups" ADD CONSTRAINT "broadcast_destination_rule_groups_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "public"."workspace_broadcast_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_publisher_handle_aliases" ADD CONSTRAINT "workspace_publisher_handle_aliases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_data_contribution_consented_by_fkey" FOREIGN KEY ("data_contribution_consented_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_guardrails" ADD CONSTRAINT "key_guardrails_guardrail_id_fkey" FOREIGN KEY ("guardrail_id") REFERENCES "public"."workspace_guardrails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_guardrails" ADD CONSTRAINT "key_guardrails_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preset_lineage" ADD CONSTRAINT "preset_lineage_ancestor_preset_id_fkey" FOREIGN KEY ("ancestor_preset_id") REFERENCES "public"."presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preset_lineage" ADD CONSTRAINT "preset_lineage_descendant_preset_id_fkey" FOREIGN KEY ("descendant_preset_id") REFERENCES "public"."presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_dynamic_route_keys" ADD CONSTRAINT "gateway_dynamic_route_keys_attached_by_fkey" FOREIGN KEY ("attached_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_dynamic_route_keys" ADD CONSTRAINT "gateway_dynamic_route_keys_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_dynamic_route_keys" ADD CONSTRAINT "gateway_dynamic_route_keys_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."gateway_dynamic_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_destination_keys" ADD CONSTRAINT "broadcast_destination_keys_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "public"."workspace_broadcast_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_destination_keys" ADD CONSTRAINT "broadcast_destination_keys_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member_guardrails" ADD CONSTRAINT "workspace_member_guardrails_guardrail_id_fkey" FOREIGN KEY ("guardrail_id") REFERENCES "public"."workspace_guardrails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member_guardrails" ADD CONSTRAINT "workspace_member_guardrails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member_guardrails" ADD CONSTRAINT "workspace_member_guardrails_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_subscription_plan_features" ADD CONSTRAINT "v2_subscription_plan_features_plan_uuid_fkey" FOREIGN KEY ("plan_uuid") REFERENCES "public"."v2_subscription_plans"("plan_uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_lab_links" ADD CONSTRAINT "v2_lab_links_lab_slug_fkey" FOREIGN KEY ("lab_slug") REFERENCES "public"."v2_labs"("lab_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_subscription_plan_models" ADD CONSTRAINT "v2_subscription_plan_models_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_subscription_plan_models" ADD CONSTRAINT "v2_subscription_plan_models_plan_uuid_fkey" FOREIGN KEY ("plan_uuid") REFERENCES "public"."v2_subscription_plans"("plan_uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_byok_monthly_usage" ADD CONSTRAINT "workspace_byok_monthly_usage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_catalogue_source_overrides" ADD CONSTRAINT "v2_catalogue_source_overrides_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_model_details" ADD CONSTRAINT "v2_model_details_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_batch_file_uploads" ADD CONSTRAINT "gateway_batch_file_uploads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_model_links" ADD CONSTRAINT "v2_model_links_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_private_usage_daily_meters" ADD CONSTRAINT "v2_private_usage_daily_meters_rollup_id_fkey" FOREIGN KEY ("rollup_id") REFERENCES "public"."v2_private_usage_daily"("rollup_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_daily_meters" ADD CONSTRAINT "v2_public_usage_daily_meters_rollup_id_fkey" FOREIGN KEY ("rollup_id") REFERENCES "public"."v2_public_usage_daily"("rollup_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_usage_hourly_meters" ADD CONSTRAINT "v2_public_usage_hourly_meters_rollup_id_fkey" FOREIGN KEY ("rollup_id") REFERENCES "public"."v2_public_usage_hourly"("rollup_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_route_parameter_support" ADD CONSTRAINT "v2_route_parameter_support_capability_id_parameter_key_fkey" FOREIGN KEY ("capability_id","parameter_key") REFERENCES "public"."v2_capability_parameters"("capability_id","parameter_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_route_parameter_support" ADD CONSTRAINT "v2_route_parameter_support_provider_model_id_capability_id_fkey" FOREIGN KEY ("provider_model_id","capability_id") REFERENCES "public"."v2_route_capabilities"("provider_model_id","capability_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_request_charges" ADD CONSTRAINT "gateway_request_charges_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_discovery_seen_models" ADD CONSTRAINT "model_discovery_seen_models_last_run_id_fkey" FOREIGN KEY ("last_run_id") REFERENCES "public"."model_discovery_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_game_results" ADD CONSTRAINT "catalogue_game_results_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "public"."catalogue_interaction_puzzles"("puzzle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_game_results" ADD CONSTRAINT "catalogue_game_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_classification_daily" ADD CONSTRAINT "request_classification_daily_classifier_id_fkey" FOREIGN KEY ("classifier_id") REFERENCES "public"."workspace_classifiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_classification_daily" ADD CONSTRAINT "request_classification_daily_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_batch_key_usage_records" ADD CONSTRAINT "gateway_batch_key_usage_records_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_batch_key_usage_records" ADD CONSTRAINT "gateway_batch_key_usage_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_route_capabilities" ADD CONSTRAINT "v2_route_capabilities_provider_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "public"."v2_model_provider_routes"("provider_model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v2_public_provider_health_daily" ADD CONSTRAINT "v2_public_provider_health_daily_model_slug_fkey" FOREIGN KEY ("model_slug") REFERENCES "public"."v2_models"("model_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_wallet_reservations" ADD CONSTRAINT "gateway_wallet_reservations_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_wallet_reservations" ADD CONSTRAINT "gateway_wallet_reservations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_07" ADD CONSTRAINT "gateway_upstream_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_07" ADD CONSTRAINT "gateway_upstream_requests_gateway_request_fkey" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_07" ADD CONSTRAINT "gateway_upstream_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_07" ADD CONSTRAINT "gateway_upstream_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_08" ADD CONSTRAINT "gateway_upstream_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_08" ADD CONSTRAINT "gateway_upstream_requests_gateway_request_fkey" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_08" ADD CONSTRAINT "gateway_upstream_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_08" ADD CONSTRAINT "gateway_upstream_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_09" ADD CONSTRAINT "gateway_upstream_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_09" ADD CONSTRAINT "gateway_upstream_requests_gateway_request_fkey" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_09" ADD CONSTRAINT "gateway_upstream_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_2026_09" ADD CONSTRAINT "gateway_upstream_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_default" ADD CONSTRAINT "gateway_upstream_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_default" ADD CONSTRAINT "gateway_upstream_requests_gateway_request_fkey" FOREIGN KEY ("gateway_request_id","gateway_request_created_at") REFERENCES "public"."gateway_requests"("id","created_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_default" ADD CONSTRAINT "gateway_upstream_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_upstream_requests_default" ADD CONSTRAINT "gateway_upstream_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_03" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_03" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_03" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_04" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_04" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_04" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_05" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_05" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_05" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_06" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_06" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_06" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_07" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_07" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_07" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_08" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_08" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_08" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_09" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_09" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_2026_09" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_default" ADD CONSTRAINT "gateway_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."api_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_default" ADD CONSTRAINT "gateway_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_requests_default" ADD CONSTRAINT "gateway_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "byok_keys_always_use_idx" ON "byok_keys" USING btree ("workspace_id" text_ops,"provider_id" text_ops,"always_use" uuid_ops) WHERE (always_use = true);--> statement-breakpoint
CREATE INDEX "byok_keys_enabled_idx" ON "byok_keys" USING btree ("workspace_id" bool_ops,"enabled" bool_ops) WHERE (enabled = true);--> statement-breakpoint
CREATE INDEX "byok_keys_gateway_lookup_idx" ON "byok_keys" USING btree ("workspace_id" int4_ops,"provider_id" text_ops,"routing_mode" uuid_ops,"sort_order" timestamptz_ops,"created_at" uuid_ops) WHERE (enabled = true);--> statement-breakpoint
CREATE INDEX "byok_keys_workspace_provider_idx" ON "byok_keys" USING btree ("workspace_id" text_ops,"provider_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "catalogue_interaction_puzzles_date_idx" ON "catalogue_interaction_puzzles" USING btree ("puzzle_date" date_ops,"game_key" date_ops);--> statement-breakpoint
CREATE INDEX "credit_grant_redemptions_user_created_idx" ON "credit_grant_redemptions" USING btree ("user_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "credit_grant_redemptions_workspace_created_idx" ON "credit_grant_redemptions" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "credit_grants_active_expiry_idx" ON "credit_grants" USING btree ("is_active" text_ops,"expires_at" bool_ops,"code_normalized" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "credit_grants_code_normalized_key" ON "credit_grants" USING btree ("code_normalized" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_ref_type_ref_id_key" ON "credit_ledger" USING btree ("ref_type" text_ops,"ref_id" text_ops);--> statement-breakpoint
CREATE INDEX "credit_ledger_refund_claim_state_idx" ON "credit_ledger" USING btree ("refund_claim_state" text_ops) WHERE (ref_type = 'Stripe_Payment_Intent'::text);--> statement-breakpoint
CREATE INDEX "credit_ledger_source_ref_idx" ON "credit_ledger" USING btree ("source_ref_type" text_ops,"source_ref_id" text_ops);--> statement-breakpoint
CREATE INDEX "credit_ledger_workspace_id_idx" ON "credit_ledger" USING btree ("workspace_id" uuid_ops) WHERE (workspace_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "data_contribution_consent_actor_user_idx" ON "data_contribution_consent_events" USING btree ("actor_user_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (actor_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "data_contribution_consent_workspace_created_idx" ON "data_contribution_consent_events" USING btree ("workspace_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "data_contributions_claim_idx" ON "data_contributions" USING btree ("available_at" timestamptz_ops,"occurred_at" timestamptz_ops,"id" timestamptz_ops) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));--> statement-breakpoint
CREATE INDEX "data_contributions_claimable_idx" ON "data_contributions" USING btree ((
CASE
    WHEN (status = 'processing'::text) THEN lease_expire timestamptz_ops,occurred_at timestamptz_ops,id timestamptz_ops) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text, 'processing'::text]));--> statement-breakpoint
CREATE INDEX "data_contributions_retention_idx" ON "data_contributions" USING btree ("retention_until" timestamptz_ops) WHERE (status <> 'deleted'::text);--> statement-breakpoint
CREATE INDEX "data_contributions_stale_lease_idx" ON "data_contributions" USING btree ("lease_expires_at" timestamptz_ops,"occurred_at" timestamptz_ops,"id" uuid_ops) WHERE (status = 'processing'::text);--> statement-breakpoint
CREATE INDEX "data_contributions_workspace_created_idx" ON "data_contributions" USING btree ("workspace_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_dedupe_key_unique" ON "email_outbox" USING btree ("dedupe_key" text_ops);--> statement-breakpoint
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" USING btree ("sent_at" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "email_outbox_user_id_idx" ON "email_outbox" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "email_outbox_workspace_id_idx" ON "email_outbox" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_app_id_idx" ON "gateway_async_operations" USING btree ("app_id" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_kind_provider_native_created_idx" ON "gateway_async_operations" USING btree ("kind" timestamptz_ops,"provider" text_ops,"native_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((provider IS NOT NULL) AND (native_id IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_async_operations_kind_status_updated_idx" ON "gateway_async_operations" USING btree ("kind" timestamptz_ops,"status" timestamptz_ops,"updated_at" text_ops) WHERE (status IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_kind_unbilled_updated_idx" ON "gateway_async_operations" USING btree ("kind" timestamptz_ops,"updated_at" timestamptz_ops) WHERE (billed_at IS NULL);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_reconcile_due_idx" ON "gateway_async_operations" USING btree ("kind" timestamptz_ops,"next_reconcile_at" timestamptz_ops,"updated_at" text_ops) WHERE (billed_at IS NULL);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_reconcile_lock_idx" ON "gateway_async_operations" USING btree ("kind" text_ops,"reconcile_locked_at" timestamptz_ops) WHERE ((billed_at IS NULL) AND (reconcile_locked_at IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_async_operations_workspace_app_updated_idx" ON "gateway_async_operations" USING btree ("workspace_id" timestamptz_ops,"app_id" timestamptz_ops,"updated_at" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_workspace_kind_created_idx" ON "gateway_async_operations" USING btree ("workspace_id" uuid_ops,"kind" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_workspace_kind_native_idx" ON "gateway_async_operations" USING btree ("workspace_id" uuid_ops,"kind" text_ops,"native_id" text_ops) WHERE (native_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_workspace_kind_status_updated_idx" ON "gateway_async_operations" USING btree ("workspace_id" uuid_ops,"kind" uuid_ops,"status" text_ops,"updated_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_workspace_kind_updated_idx" ON "gateway_async_operations" USING btree ("workspace_id" text_ops,"kind" uuid_ops,"updated_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_workspace_request_updated_idx" ON "gateway_async_operations" USING btree ("workspace_id" text_ops,"request_id" timestamptz_ops,"updated_at" text_ops) WHERE (request_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_async_operations_workspace_session_updated_idx" ON "gateway_async_operations" USING btree ("workspace_id" text_ops,"session_id" uuid_ops,"updated_at" text_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_batch_requests_provider_native_idx" ON "gateway_batch_requests" USING btree ("provider" text_ops,"native_batch_id" text_ops) WHERE (native_batch_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_batch_requests_workspace_batch_custom_idx" ON "gateway_batch_requests" USING btree ("workspace_id" text_ops,"batch_id" text_ops,"custom_id" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_batch_requests_workspace_batch_status_idx" ON "gateway_batch_requests" USING btree ("workspace_id" uuid_ops,"batch_id" uuid_ops,"status" uuid_ops,"request_index" int4_ops);--> statement-breakpoint
CREATE INDEX "gateway_dynamic_route_versions_route_idx" ON "gateway_dynamic_route_versions" USING btree ("route_id" int4_ops,"version" int4_ops);--> statement-breakpoint
CREATE INDEX "gateway_dynamic_routes_workspace_idx" ON "gateway_dynamic_routes" USING btree ("workspace_id" uuid_ops,"updated_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_io_logs_object_key_idx" ON "gateway_io_logs" USING btree ("io_log_object_key" text_ops) WHERE (io_log_object_key IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_io_logs_workspace_created_idx" ON "gateway_io_logs" USING btree ("workspace_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_observability_events_metadata_dimensions_idx" ON "gateway_observability_events" USING gin ("metadata_dimensions" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "gateway_observability_events_preset_occurred_idx" ON "gateway_observability_events" USING btree ("workspace_id" uuid_ops,"preset_id" uuid_ops,"occurred_at" timestamptz_ops) WHERE (preset_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_observability_events_request_occurred_idx" ON "gateway_observability_events" USING btree ("workspace_id" timestamptz_ops,"request_id" text_ops,"occurred_at" text_ops) WHERE (request_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_observability_events_session_occurred_idx" ON "gateway_observability_events" USING btree ("workspace_id" uuid_ops,"session_id" text_ops,"occurred_at" uuid_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_observability_events_workspace_created_preset_idx" ON "gateway_observability_events" USING btree ("workspace_id" timestamptz_ops,"occurred_at" uuid_ops,"preset_id" uuid_ops) WHERE (preset_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_observability_events_workspace_occurred_idx" ON "gateway_observability_events" USING btree ("workspace_id" uuid_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_preset_test_run_items_run_created_idx" ON "gateway_preset_test_run_items" USING btree ("workspace_id" timestamptz_ops,"test_run_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_preset_test_runs_preset_created_idx" ON "gateway_preset_test_runs" USING btree ("workspace_id" timestamptz_ops,"preset_id" uuid_ops,"created_at" uuid_ops) WHERE (preset_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_preset_test_runs_workspace_created_idx" ON "gateway_preset_test_runs" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_provider_events_provider_created_idx" ON "gateway_provider_events" USING btree ("provider" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_provider_events_replay_due_idx" ON "gateway_provider_events" USING btree ("next_attempt_at" timestamptz_ops,"created_at" timestamptz_ops) WHERE (processed_at IS NULL);--> statement-breakpoint
CREATE INDEX "gateway_provider_events_workspace_created_idx" ON "gateway_provider_events" USING btree ("workspace_id" timestamptz_ops,"created_at" uuid_ops) WHERE (workspace_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_gateway_realtime_sessions_active_provider" ON "gateway_realtime_sessions" USING btree (lower(provider) text_ops) WHERE (status = ANY (ARRAY['created'::text, 'connecting'::text, 'connected'::text, 'ending'::text]));--> statement-breakpoint
CREATE INDEX "idx_gateway_realtime_sessions_key_created" ON "gateway_realtime_sessions" USING btree ("key_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_gateway_realtime_sessions_status_updated" ON "gateway_realtime_sessions" USING btree ("status" timestamptz_ops,"updated_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_gateway_realtime_sessions_workspace_created" ON "gateway_realtime_sessions" USING btree ("workspace_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_models_catalogue_status_idx" ON "v2_models" USING btree ("catalogue_status" text_ops,"hidden" text_ops,"model_slug" text_ops);--> statement-breakpoint
CREATE INDEX "v2_models_input_modalities_idx" ON "v2_models" USING gin ("input_modalities" array_ops);--> statement-breakpoint
CREATE INDEX "v2_models_lab_idx" ON "v2_models" USING btree ("lab_slug" text_ops);--> statement-breakpoint
CREATE INDEX "v2_models_license_idx" ON "v2_models" USING btree ("license" text_ops) WHERE (license IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_models_one_free_variant_per_base_idx" ON "v2_models" USING btree ("base_model_slug" text_ops) WHERE (variant_kind = 'free'::text);--> statement-breakpoint
CREATE INDEX "v2_models_output_modalities_idx" ON "v2_models" USING gin ("output_modalities" array_ops);--> statement-breakpoint
CREATE INDEX "v2_models_previous_idx" ON "v2_models" USING btree ("previous_model_slug" text_ops) WHERE (previous_model_slug IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_models_status_idx" ON "v2_models" USING btree ("status" text_ops,"hidden" bool_ops,"model_slug" text_ops);--> statement-breakpoint
CREATE INDEX "v2_models_variant_lookup_idx" ON "v2_models" USING btree ("variant_kind" text_ops,"base_model_slug" text_ops,"model_slug" text_ops);--> statement-breakpoint
CREATE INDEX "api_apps_last_seen_idx" ON "api_apps" USING btree ("last_seen" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "api_apps_workspace_id_idx" ON "api_apps" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "api_apps_workspace_id_url_key" ON "api_apps" USING btree ("workspace_id" text_ops,"url" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_apps_public_active" ON "api_apps" USING btree ("is_public" bool_ops,"is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "broadcast_destination_rules_group_id_idx" ON "broadcast_destination_rules" USING btree ("rule_group_id" int4_ops,"position" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_webhook_endpoints_workspace_secret_hash_idx" ON "gateway_webhook_endpoints" USING btree ("workspace_id" text_ops,"secret_hash" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_webhook_endpoints_workspace_status_idx" ON "gateway_webhook_endpoints" USING btree ("workspace_id" timestamptz_ops,"status" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "keys_created_by_idx" ON "keys" USING btree ("created_by" uuid_ops) WHERE (created_by IS NOT NULL);--> statement-breakpoint
CREATE INDEX "keys_expires_at_idx" ON "keys" USING btree ("expires_at" timestamptz_ops) WHERE (expires_at IS NOT NULL);--> statement-breakpoint
CREATE INDEX "keys_hash_idx" ON "keys" USING btree ("hash" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "keys_kid_uidx" ON "keys" USING btree ("kid" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "keys_oauth_delegated_active_idx" ON "keys" USING btree ("oauth_user_id" uuid_ops,"workspace_id" uuid_ops,"oauth_client_id" text_ops) WHERE ((key_kind = 'oauth_delegated'::text) AND (status = 'active'::text));--> statement-breakpoint
CREATE INDEX "keys_workspace_id_idx" ON "keys" USING btree ("workspace_id" uuid_ops) WHERE (workspace_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "management_keys_expires_at_idx" ON "management_keys" USING btree ("expires_at" timestamptz_ops) WHERE (expires_at IS NOT NULL);--> statement-breakpoint
CREATE INDEX "management_keys_hash_idx" ON "management_keys" USING btree ("hash" text_ops);--> statement-breakpoint
CREATE INDEX "management_keys_prefix_idx" ON "management_keys" USING btree ("prefix" text_ops);--> statement-breakpoint
CREATE INDEX "management_keys_workspace_id_idx" ON "management_keys" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "monitor_history_commits_committed_at_idx" ON "monitor_history_commits" USING btree ("committed_at" text_ops,"commit_sha" text_ops);--> statement-breakpoint
CREATE INDEX "monitor_history_events_change_kind_idx" ON "monitor_history_events" USING btree ("change_kind" text_ops,"committed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "monitor_history_events_commit_idx" ON "monitor_history_events" USING btree ("commit_sha" timestamptz_ops,"committed_at" text_ops);--> statement-breakpoint
CREATE INDEX "monitor_history_events_committed_at_idx" ON "monitor_history_events" USING btree ("committed_at" timestamptz_ops,"event_id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "monitor_history_events_model_id_idx" ON "monitor_history_events" USING btree ("model_id" text_ops,"committed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "monitor_history_events_provider_slug_idx" ON "monitor_history_events" USING btree ("provider_slug" timestamptz_ops,"committed_at" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_app_metadata_created_by_idx" ON "oauth_app_metadata" USING btree ("created_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "oauth_app_metadata_redirect_uris_gin_idx" ON "oauth_app_metadata" USING gin ("redirect_uris" array_ops);--> statement-breakpoint
CREATE INDEX "oauth_app_metadata_status_idx" ON "oauth_app_metadata" USING btree ("status" text_ops) WHERE (status = 'active'::text);--> statement-breakpoint
CREATE INDEX "oauth_app_metadata_workspace_id_idx" ON "oauth_app_metadata" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_client_idx" ON "oauth_authorization_codes" USING btree ("client_id" timestamptz_ops,"expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_user_idx" ON "oauth_authorization_codes" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_feedback_metadata_dimensions_idx" ON "gateway_feedback" USING gin ("metadata_dimensions" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "gateway_feedback_preset_created_idx" ON "gateway_feedback" USING btree ("workspace_id" uuid_ops,"preset_id" uuid_ops,"created_at" timestamptz_ops) WHERE (preset_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_feedback_request_created_idx" ON "gateway_feedback" USING btree ("workspace_id" text_ops,"request_id" text_ops,"created_at" timestamptz_ops) WHERE (request_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_feedback_session_created_idx" ON "gateway_feedback" USING btree ("workspace_id" text_ops,"session_id" text_ops,"created_at" uuid_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_feedback_test_run_created_idx" ON "gateway_feedback" USING btree ("workspace_id" uuid_ops,"test_run_id" timestamptz_ops,"created_at" uuid_ops) WHERE (test_run_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_feedback_workspace_created_idx" ON "gateway_feedback" USING btree ("workspace_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_feedback_workspace_created_preset_idx" ON "gateway_feedback" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops,"preset_id" timestamptz_ops) WHERE (preset_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_feedback_workspace_preset_rating_created_idx" ON "gateway_feedback" USING btree ("workspace_id" timestamptz_ops,"preset_id" timestamptz_ops,"rating" timestamptz_ops,"created_at" text_ops) WHERE (preset_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "oauth_authorizations_client_id_idx" ON "oauth_authorizations" USING btree ("client_id" text_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "oauth_authorizations_last_used_idx" ON "oauth_authorizations" USING btree ("last_used_at" timestamptz_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "oauth_authorizations_user_id_idx" ON "oauth_authorizations" USING btree ("user_id" uuid_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "oauth_authorizations_validation_idx" ON "oauth_authorizations" USING btree ("user_id" text_ops,"client_id" text_ops,"workspace_id" uuid_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "oauth_authorizations_workspace_id_idx" ON "oauth_authorizations" USING btree ("workspace_id" uuid_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "oauth_device_codes_client_status_idx" ON "oauth_device_codes" USING btree ("client_id" timestamptz_ops,"status" text_ops,"expires_at" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_device_codes_user_idx" ON "oauth_device_codes" USING btree ("user_id" uuid_ops) WHERE (user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_family_idx" ON "oauth_refresh_tokens" USING btree ("family_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_rotated_from_idx" ON "oauth_refresh_tokens" USING btree ("rotated_from" uuid_ops) WHERE (rotated_from IS NOT NULL);--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_user_client_idx" ON "oauth_refresh_tokens" USING btree ("user_id" text_ops,"client_id" text_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_workspace_idx" ON "oauth_refresh_tokens" USING btree ("workspace_id" uuid_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "otel_export_outbox_pending_idx" ON "otel_export_outbox" USING btree ("next_attempt_at" timestamptz_ops,"created_at" timestamptz_ops) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credentialID" text_ops);--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "preset_versions_preset_created_idx" ON "preset_versions" USING btree ("preset_id" uuid_ops,"version_number" uuid_ops);--> statement-breakpoint
CREATE INDEX "presets_config_gin_idx" ON "presets" USING gin ("config" jsonb_ops);--> statement-breakpoint
CREATE INDEX "presets_created_by_idx" ON "presets" USING btree ("created_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "presets_name_workspace_id_idx" ON "presets" USING btree ("name" text_ops,"workspace_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "presets_public_workspace_slug_key" ON "presets" USING btree (workspace_id uuid_ops,lower(slug) text_ops) WHERE (visibility = 'public'::text);--> statement-breakpoint
CREATE INDEX "presets_slug_idx" ON "presets" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "presets_source_preset_id_idx" ON "presets" USING btree ("source_preset_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "presets_visibility_idx" ON "presets" USING btree ("visibility" text_ops);--> statement-breakpoint
CREATE INDEX "presets_workspace_id_idx" ON "presets" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "presets_workspace_id_slug_idx" ON "presets" USING btree ("workspace_id" uuid_ops,"slug" text_ops);--> statement-breakpoint
CREATE INDEX "presets_workspace_slug_ci_idx" ON "presets" USING btree (workspace_id uuid_ops,lower(slug) uuid_ops);--> statement-breakpoint
CREATE INDEX "request_classifications_classifier_category_idx" ON "request_classifications" USING btree ("classifier_id" timestamptz_ops,"primary_category" text_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "request_classifications_workspace_created_idx" ON "request_classifications" USING btree ("workspace_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "security_key_reports_matched_idx" ON "security_key_reports" USING btree ("matched" timestamptz_ops,"received_at" bool_ops);--> statement-breakpoint
CREATE INDEX "security_key_reports_received_at_idx" ON "security_key_reports" USING btree ("received_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "security_key_reports_status_received_idx" ON "security_key_reports" USING btree ("status" timestamptz_ops,"received_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "security_key_reports_token_fingerprint_idx" ON "security_key_reports" USING btree ("token_fingerprint" text_ops);--> statement-breakpoint
CREATE INDEX "security_key_reports_workspace_id_idx" ON "security_key_reports" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" USING btree ("secret" text_ops);--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "user_mfaReenrollmentRequired_idx" ON "user" USING btree ("mfaReenrollmentRequired" bool_ops) WHERE ("mfaReenrollmentRequired" IS TRUE);--> statement-breakpoint
CREATE INDEX "users_declared_country_code_idx" ON "users" USING btree ("declared_country_code" text_ops) WHERE (declared_country_code IS NOT NULL);--> statement-breakpoint
CREATE INDEX "users_default_workspace_id_idx" ON "users" USING btree ("default_workspace_id" uuid_ops) WHERE (default_workspace_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "users_onboarding_completed_at_idx" ON "users" USING btree ("onboarding_completed_at" timestamptz_ops) WHERE (onboarding_completed_at IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_profile_slug_key" ON "users" USING btree ("public_profile_slug" text_ops) WHERE (public_profile_slug IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_analytics_outbox_pending_idx" ON "v2_analytics_outbox" USING btree ("status" text_ops,"available_at" text_ops,"occurred_at" timestamptz_ops) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));--> statement-breakpoint
CREATE INDEX "v2_analytics_outbox_workspace_time_idx" ON "v2_analytics_outbox" USING btree ("workspace_id" timestamptz_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_benchmark_results_model_idx" ON "v2_benchmark_results" USING btree ("model_slug" text_ops,"benchmark_id" text_ops);--> statement-breakpoint
CREATE INDEX "v2_benchmark_results_rank_idx" ON "v2_benchmark_results" USING btree ("benchmark_id" int4_ops,"rank" int4_ops,"model_slug" int4_ops);--> statement-breakpoint
CREATE INDEX "v2_capability_adapters_lookup_idx" ON "v2_capability_adapters" USING btree ("capability_id" int4_ops,"status" int4_ops,"adapter_key" int4_ops,"adapter_version" int4_ops);--> statement-breakpoint
CREATE INDEX "v2_capability_constraints_lookup_idx" ON "v2_capability_constraints" USING btree ("provider_slug" int4_ops,"provider_model_id" int4_ops,"capability_id" int4_ops,"status" int4_ops,"priority" int4_ops);--> statement-breakpoint
CREATE INDEX "v2_capability_evidence_lookup_idx" ON "v2_capability_evidence" USING btree ("provider_slug" text_ops,"provider_model_id" text_ops,"capability_id" text_ops,"checked_at" text_ops);--> statement-breakpoint
CREATE INDEX "v2_catalogue_admin_changes_actor_idx" ON "v2_catalogue_admin_changes" USING btree ("actor_user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_catalogue_admin_changes_resource_idx" ON "v2_catalogue_admin_changes" USING btree ("resource_type" text_ops,"resource_id" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "v2_catalogue_backfill_issues_type_idx" ON "v2_catalogue_backfill_issues" USING btree ("source_type" timestamptz_ops,"issue_code" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_control_plane_single_published_idx" ON "v2_control_plane_releases" USING btree ("status" text_ops) WHERE (status = 'published'::text);--> statement-breakpoint
CREATE INDEX "v2_credit_reservations_expiry_idx" ON "v2_credit_reservations" USING btree ("expires_at" timestamptz_ops) WHERE (status = ANY (ARRAY['held'::text, 'partially_captured'::text, 'partially_released'::text]));--> statement-breakpoint
CREATE INDEX "v2_credit_reservations_external_ref_idx" ON "v2_credit_reservations" USING btree ("external_ref" text_ops) WHERE (external_ref IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_credit_reservations_workspace_status_idx" ON "v2_credit_reservations" USING btree ("workspace_id" timestamptz_ops,"status" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "v2_execution_plans_runtime_lookup_idx" ON "v2_execution_plans" USING btree ("release_id" text_ops,"provider_model_id" text_ops,"capability_id" text_ops,"route_variant_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_labs_name_key" ON "v2_labs" USING btree (lower(name) text_ops);--> statement-breakpoint
CREATE INDEX "v2_labs_status_idx" ON "v2_labs" USING btree ("status" text_ops) WHERE (status <> 'disabled'::text);--> statement-breakpoint
CREATE INDEX "v2_meter_definitions_active_idx" ON "v2_meter_definitions" USING btree ("modality" text_ops,"direction" text_ops,"meter_key" text_ops) WHERE (status = 'active'::text);--> statement-breakpoint
CREATE INDEX "v2_model_aliases_active_idx" ON "v2_model_aliases" USING btree ("alias_slug" text_ops,"effective_from" text_ops,"effective_to" timestamptz_ops) WHERE enabled;--> statement-breakpoint
CREATE INDEX "v2_model_aliases_model_idx" ON "v2_model_aliases" USING btree ("model_slug" text_ops) WHERE enabled;--> statement-breakpoint
CREATE INDEX "v2_model_provider_routes_active_idx" ON "v2_model_provider_routes" USING btree ("model_slug" text_ops,"provider_slug" text_ops) WHERE ((status = ANY (ARRAY['active'::text, 'degraded'::text])) AND (routing_enabled = true));--> statement-breakpoint
CREATE INDEX "v2_model_provider_routes_explicit_status_idx" ON "v2_model_provider_routes" USING btree ("model_slug" text_ops,"provider_availability_status" bool_ops,"phaseo_status" bool_ops,"access_scope" text_ops,"routing_enabled" text_ops);--> statement-breakpoint
CREATE INDEX "v2_model_provider_routes_model_idx" ON "v2_model_provider_routes" USING btree ("model_slug" text_ops,"status" bool_ops,"routing_enabled" text_ops);--> statement-breakpoint
CREATE INDEX "v2_model_provider_routes_provider_idx" ON "v2_model_provider_routes" USING btree ("provider_slug" bool_ops,"status" bool_ops,"routing_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "v2_pricing_sku_meters_lookup_idx" ON "v2_pricing_sku_meters" USING btree ("meter_key" text_ops,"modality" text_ops,"direction" text_ops);--> statement-breakpoint
CREATE INDEX "v2_pricing_sku_meters_sku_idx" ON "v2_pricing_sku_meters" USING btree ("sku_id" text_ops,"meter_order" text_ops,"meter_key" int4_ops);--> statement-breakpoint
CREATE INDEX "v2_pricing_skus_active_idx" ON "v2_pricing_skus" USING btree ("provider_model_id" text_ops,"operation" text_ops,"region" text_ops) WHERE (status = 'active'::text);--> statement-breakpoint
CREATE INDEX "v2_pricing_skus_route_idx" ON "v2_pricing_skus" USING btree ("provider_model_id" text_ops,"status" text_ops,"effective_from" text_ops);--> statement-breakpoint
CREATE INDEX "v2_pricing_skus_route_variant_id_idx" ON "v2_pricing_skus" USING btree ("route_variant_id" uuid_ops) WHERE (route_variant_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_pricing_skus_service_tier_slug_idx" ON "v2_pricing_skus" USING btree ("service_tier_slug" text_ops) WHERE (service_tier_slug IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_private_usage_daily_app_date_idx" ON "v2_private_usage_daily" USING btree ("app_id" date_ops,"usage_date" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_private_usage_daily_key" ON "v2_private_usage_daily" USING btree (workspace_id date_ops,usage_date date_ops,COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid) date_ops,model_slug date_ops,COALESCE(provider_model_id, ''::text) text_ops,COALESCE(cloudflare_colo, ''::text) text_ops);--> statement-breakpoint
CREATE INDEX "v2_private_usage_daily_model_date_idx" ON "v2_private_usage_daily" USING btree ("model_slug" date_ops,"usage_date" text_ops);--> statement-breakpoint
CREATE INDEX "v2_private_usage_daily_provider_model_id_idx" ON "v2_private_usage_daily" USING btree ("provider_model_id" text_ops) WHERE (provider_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_private_usage_daily_workspace_date_idx" ON "v2_private_usage_daily" USING btree ("workspace_id" uuid_ops,"usage_date" date_ops);--> statement-breakpoint
CREATE INDEX "v2_provider_capability_adapters_lookup_idx" ON "v2_provider_capability_adapters" USING btree ("provider_slug" text_ops,"capability_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "v2_provider_country_restrictions_lookup_idx" ON "v2_provider_country_restrictions" USING btree ("provider_slug" text_ops,"country_code" timestamptz_ops,"effective_at" timestamptz_ops) WHERE enabled;--> statement-breakpoint
CREATE INDEX "v2_provider_endpoints_lookup_idx" ON "v2_provider_endpoints" USING btree ("provider_slug" text_ops,"capability_id" text_ops,"region_code" text_ops,"service_tier_slug" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "v2_provider_regions_lookup_idx" ON "v2_provider_regions" USING btree ("region_code" text_ops,"status" bool_ops,"routing_enabled" text_ops,"provider_slug" bool_ops);--> statement-breakpoint
CREATE INDEX "v2_providers_lab_idx" ON "v2_providers" USING btree ("lab_slug" text_ops);--> statement-breakpoint
CREATE INDEX "v2_providers_policy_variant_idx" ON "v2_providers" USING btree ("provider_family_slug" text_ops,"data_policy_variant" text_ops,"offer_scope" text_ops) WHERE (status <> ALL (ARRAY['disabled'::text, 'deprecated'::text]));--> statement-breakpoint
CREATE INDEX "v2_providers_routing_idx" ON "v2_providers" USING btree ("status" bool_ops,"routing_enabled" text_ops,"routable" text_ops) WHERE (status <> ALL (ARRAY['disabled'::text, 'deprecated'::text]));--> statement-breakpoint
CREATE INDEX "model_discovery_runs_started_at_idx" ON "model_discovery_runs" USING btree ("started_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_route_variants_lookup_idx" ON "v2_route_variants" USING btree ("provider_model_id" text_ops,"service_tier_slug" text_ops,"execution_region" text_ops,"data_region" text_ops,"status" text_ops,"routing_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "v2_route_variants_provider_region_id_idx" ON "v2_route_variants" USING btree ("provider_region_id" uuid_ops) WHERE (provider_region_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_route_variants_region_idx" ON "v2_route_variants" USING btree ("execution_region" text_ops,"data_region" text_ops,"service_tier_slug" text_ops) WHERE ((status = ANY (ARRAY['active'::text, 'degraded'::text])) AND (routing_enabled = true));--> statement-breakpoint
CREATE INDEX "v2_route_variants_service_tier_slug_idx" ON "v2_route_variants" USING btree ("service_tier_slug" text_ops);--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier" text_ops);--> statement-breakpoint
CREATE INDEX "wallets_stripe_customer_id_idx" ON "wallets" USING btree ("stripe_customer_id" text_ops);--> statement-breakpoint
CREATE INDEX "web_cache_purge_events_created_at_idx" ON "web_cache_purge_events" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "workspace_broadcast_destinations_workspace_enabled_idx" ON "workspace_broadcast_destinations" USING btree ("workspace_id" bool_ops,"enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "workspace_broadcast_destinations_workspace_id_idx" ON "workspace_broadcast_destinations" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_classifiers_created_by_idx" ON "workspace_classifiers" USING btree ("created_by" uuid_ops) WHERE (created_by IS NOT NULL);--> statement-breakpoint
CREATE INDEX "workspace_classifiers_workspace_enabled_idx" ON "workspace_classifiers" USING btree ("workspace_id" uuid_ops,"enabled" uuid_ops,"created_at" bool_ops);--> statement-breakpoint
CREATE INDEX "workspace_guardrails_workspace_id_idx" ON "workspace_guardrails" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspace_invites_token_fingerprint" ON "workspace_invites" USING btree ("token_fingerprint" text_ops);--> statement-breakpoint
CREATE INDEX "workspace_invites_active_idx" ON "workspace_invites" USING btree ("workspace_id" timestamptz_ops,"expires_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_invites_preview_idx" ON "workspace_invites" USING btree ("token_preview" text_ops);--> statement-breakpoint
CREATE INDEX "workspace_join_requests_pending_idx" ON "workspace_join_requests" USING btree ("status" enum_ops) WHERE (status = 'pending'::join_request_status);--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_join_requests_pending_unique" ON "workspace_join_requests" USING btree ("workspace_id" uuid_ops,"requester_user_id" uuid_ops) WHERE (status = 'pending'::join_request_status);--> statement-breakpoint
CREATE INDEX "workspace_join_requests_requester_idx" ON "workspace_join_requests" USING btree ("requester_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_join_requests_workspace_idx" ON "workspace_join_requests" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ssoProvider_userId_idx" ON "ssoProvider" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_credit_ledger_idempotency_key" ON "v2_credit_ledger" USING btree ("workspace_id" text_ops,"idempotency_key" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_credit_ledger_source_idx" ON "v2_credit_ledger" USING btree ("source_type" text_ops,"source_id" text_ops) WHERE (source_type IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_credit_ledger_workspace_time_idx" ON "v2_credit_ledger" USING btree ("workspace_id" timestamptz_ops,"event_time" timestamptz_ops,"entry_id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_public_usage_daily_app_date_idx" ON "v2_public_usage_daily" USING btree ("app_id" date_ops,"usage_date" date_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_public_usage_daily_key" ON "v2_public_usage_daily" USING btree (usage_date text_ops,COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid) text_ops,model_slug text_ops,COALESCE(provider_model_id, ''::text) text_ops,COALESCE(cloudflare_colo, ''::text) uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_public_usage_daily_model_colo_date_idx" ON "v2_public_usage_daily" USING btree ("model_slug" text_ops,"cloudflare_colo" date_ops,"usage_date" date_ops) WHERE (cloudflare_colo IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_public_usage_daily_model_date_idx" ON "v2_public_usage_daily" USING btree ("model_slug" date_ops,"usage_date" text_ops);--> statement-breakpoint
CREATE INDEX "v2_public_usage_daily_provider_date_idx" ON "v2_public_usage_daily" USING btree ("provider_model_id" date_ops,"usage_date" date_ops) WHERE (provider_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_public_usage_hourly_app_id_idx" ON "v2_public_usage_hourly" USING btree ("app_id" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_public_usage_hourly_key" ON "v2_public_usage_hourly" USING btree (bucket_start text_ops,COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid) uuid_ops,model_slug timestamptz_ops,COALESCE(provider_model_id, ''::text) timestamptz_ops,COALESCE(cloudflare_colo, ''::text) timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_public_usage_hourly_model_bucket_idx" ON "v2_public_usage_hourly" USING btree ("model_slug" text_ops,"bucket_start" text_ops);--> statement-breakpoint
CREATE INDEX "v2_public_usage_hourly_model_colo_bucket_idx" ON "v2_public_usage_hourly" USING btree ("model_slug" timestamptz_ops,"cloudflare_colo" timestamptz_ops,"bucket_start" timestamptz_ops) WHERE (cloudflare_colo IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_public_usage_hourly_provider_bucket_idx" ON "v2_public_usage_hourly" USING btree ("provider_model_id" text_ops,"bucket_start" text_ops) WHERE (provider_model_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_request_artifacts_attempt_kind_key" ON "v2_request_artifacts" USING btree ("attempt_id" text_ops,"artifact_kind" text_ops) WHERE (attempt_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_artifacts_request_idx" ON "v2_request_artifacts" USING btree ("request_event_id" uuid_ops,"artifact_kind" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_request_artifacts_request_kind_key" ON "v2_request_artifacts" USING btree ("request_event_id" text_ops,"artifact_kind" uuid_ops) WHERE (attempt_id IS NULL);--> statement-breakpoint
CREATE INDEX "v2_request_artifacts_retention_idx" ON "v2_request_artifacts" USING btree ("retention_until" timestamptz_ops) WHERE (retention_until IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_attempts_request_idx" ON "v2_request_attempts" USING btree ("request_event_id" uuid_ops,"attempt_number" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_request_attempts_route_time_idx" ON "v2_request_attempts" USING btree ("provider_model_id" timestamptz_ops,"started_at" text_ops) WHERE (provider_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_app_time_idx" ON "v2_request_facts" USING btree ("app_id" timestamptz_ops,"occurred_at" timestamptz_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_country_time_idx" ON "v2_request_facts" USING btree ("edge_country" text_ops,"occurred_at" text_ops) WHERE (edge_country IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "v2_request_facts_gateway_request_key" ON "v2_request_facts" USING btree ("gateway_request_id" timestamptz_ops,"gateway_request_created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_request_facts_key_id_idx" ON "v2_request_facts" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_model_colo_time_idx" ON "v2_request_facts" USING btree ("requested_model_slug" timestamptz_ops,"cloudflare_colo" timestamptz_ops,"occurred_at" text_ops) WHERE (cloudflare_colo IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_model_stream_context_time_idx" ON "v2_request_facts" USING btree (COALESCE(routed_model_slug, requested_model_slug) timestamptz_ops,stream bool_ops,occurred_at timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_request_facts_model_time_idx" ON "v2_request_facts" USING btree ("requested_model_slug" text_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_request_facts_occurred_brin_idx" ON "v2_request_facts" USING brin ("occurred_at" timestamptz_minmax_ops);--> statement-breakpoint
CREATE INDEX "v2_request_facts_provider_route_time_idx" ON "v2_request_facts" USING btree ("provider_model_id" text_ops,"occurred_at" text_ops);--> statement-breakpoint
CREATE INDEX "v2_request_facts_routed_colo_time_idx" ON "v2_request_facts" USING btree ("routed_model_slug" timestamptz_ops,"cloudflare_colo" timestamptz_ops,"occurred_at" text_ops) WHERE (cloudflare_colo IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_routed_model_time_idx" ON "v2_request_facts" USING btree ("routed_model_slug" text_ops,"occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_request_facts_workspace_client_source_time_idx" ON "v2_request_facts" USING btree ("workspace_id" text_ops,"client_source_id" timestamptz_ops,"occurred_at" timestamptz_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_workspace_country_time_idx" ON "v2_request_facts" USING btree ("workspace_id" timestamptz_ops,"edge_country" timestamptz_ops,"occurred_at" timestamptz_ops) WHERE (edge_country IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_workspace_end_user_time_idx" ON "v2_request_facts" USING btree ("workspace_id" text_ops,"end_user_id" timestamptz_ops,"occurred_at" text_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_workspace_provider_time_idx" ON "v2_request_facts" USING btree ("workspace_id" text_ops,"provider_model_id" timestamptz_ops,"occurred_at" timestamptz_ops) WHERE (provider_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_workspace_session_time_idx" ON "v2_request_facts" USING btree ("workspace_id" text_ops,"session_id" uuid_ops,"occurred_at" uuid_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_facts_workspace_status_time_idx" ON "v2_request_facts" USING btree ("workspace_id" timestamptz_ops,"success" timestamptz_ops,"occurred_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_request_facts_workspace_time_idx" ON "v2_request_facts" USING btree ("workspace_id" uuid_ops,"occurred_at" timestamptz_ops,"request_event_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_request_feedback_request_idx" ON "v2_request_feedback" USING btree ("request_event_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_request_feedback_workspace_time_idx" ON "v2_request_feedback" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_request_pricing_lines_request_idx" ON "v2_request_pricing_lines" USING btree ("request_event_id" text_ops,"meter_key" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_request_pricing_lines_sku_meter_id_idx" ON "v2_request_pricing_lines" USING btree ("sku_meter_id" uuid_ops) WHERE (sku_meter_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_pricing_lines_sku_time_idx" ON "v2_request_pricing_lines" USING btree ("sku_id" uuid_ops,"created_at" uuid_ops) WHERE (sku_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_routing_decisions_excluded_idx" ON "v2_request_routing_decisions" USING btree ("exclusion_reason" timestamptz_ops,"created_at" text_ops) WHERE (decision = 'excluded'::text);--> statement-breakpoint
CREATE INDEX "v2_request_routing_decisions_request_idx" ON "v2_request_routing_decisions" USING btree ("request_event_id" uuid_ops,"decision_order" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_request_routing_decisions_route_idx" ON "v2_request_routing_decisions" USING btree ("provider_model_id" text_ops,"created_at" text_ops) WHERE (provider_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "v2_request_usage_meter_time_idx" ON "v2_request_usage" USING btree ("meter_key" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "v2_request_usage_modality_time_idx" ON "v2_request_usage" USING btree ("modality" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "v2_request_usage_request_idx" ON "v2_request_usage" USING btree ("request_event_id" text_ops,"meter_key" text_ops);--> statement-breakpoint
CREATE INDEX "v2_request_usage_sku_meter_id_idx" ON "v2_request_usage" USING btree ("sku_meter_id" uuid_ops) WHERE (sku_meter_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "broadcast_destination_rule_groups_destination_id_idx" ON "broadcast_destination_rule_groups" USING btree ("destination_id" int4_ops,"position" int4_ops);--> statement-breakpoint
CREATE INDEX "workspace_publisher_handle_aliases_workspace_idx" ON "workspace_publisher_handle_aliases" USING btree ("workspace_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "workspace_settings_data_contribution_actor_idx" ON "workspace_settings" USING btree ("data_contribution_consented_by" uuid_ops) WHERE (data_contribution_consented_by IS NOT NULL);--> statement-breakpoint
CREATE INDEX "workspaces_owner_user_id_idx" ON "workspaces" USING btree ("owner_user_id" uuid_ops) WHERE (owner_user_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_publisher_handle_key" ON "workspaces" USING btree (lower(publisher_handle) text_ops);--> statement-breakpoint
CREATE INDEX "key_guardrails_guardrail_id_idx" ON "key_guardrails" USING btree ("guardrail_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "preset_lineage_descendant_idx" ON "preset_lineage" USING btree ("descendant_preset_id" int4_ops,"depth" int4_ops);--> statement-breakpoint
CREATE INDEX "gateway_dynamic_route_keys_route_idx" ON "gateway_dynamic_route_keys" USING btree ("route_id" uuid_ops,"key_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "model_discovery_hf_seen_models_last_seen_at_idx" ON "model_discovery_hf_seen_models" USING btree ("last_seen_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "broadcast_destination_keys_key_id_idx" ON "broadcast_destination_keys" USING btree ("key_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_member_guardrails_guardrail_id_idx" ON "workspace_member_guardrails" USING btree ("guardrail_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_member_guardrails_user_id_idx" ON "workspace_member_guardrails" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_subscription_plan_models_model_idx" ON "v2_subscription_plan_models" USING btree ("model_slug" text_ops,"plan_uuid" uuid_ops);--> statement-breakpoint
CREATE INDEX "workspace_byok_monthly_usage_month_start_idx" ON "workspace_byok_monthly_usage" USING btree ("month_start" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "public_model_user_usage_daily_day_idx" ON "public_model_user_usage_daily" USING btree ("day_bucket" date_ops);--> statement-breakpoint
CREATE INDEX "public_model_user_usage_daily_model_day_idx" ON "public_model_user_usage_daily" USING btree ("model_id" text_ops,"day_bucket" text_ops);--> statement-breakpoint
CREATE INDEX "v2_private_usage_daily_meters_lookup_idx" ON "v2_private_usage_daily_meters" USING btree ("meter_key" text_ops,"modality" text_ops,"unit" text_ops,"rollup_id" text_ops);--> statement-breakpoint
CREATE INDEX "v2_public_usage_daily_meters_lookup_idx" ON "v2_public_usage_daily_meters" USING btree ("meter_key" text_ops,"modality" text_ops,"unit" text_ops,"rollup_id" text_ops);--> statement-breakpoint
CREATE INDEX "v2_public_usage_hourly_meters_lookup_idx" ON "v2_public_usage_hourly_meters" USING btree ("meter_key" text_ops,"modality" text_ops,"unit" text_ops,"rollup_id" text_ops);--> statement-breakpoint
CREATE INDEX "v2_rollup_refresh_state_status_idx" ON "v2_rollup_refresh_state" USING btree ("status" text_ops,"bucket_start" text_ops);--> statement-breakpoint
CREATE INDEX "v2_route_parameter_support_lookup_idx" ON "v2_route_parameter_support" USING btree ("capability_id" text_ops,"parameter_key" text_ops,"support_level" text_ops,"provider_model_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_gateway_request_charges_created_at" ON "gateway_request_charges" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "model_discovery_seen_models_last_run_id_idx" ON "model_discovery_seen_models" USING btree ("last_run_id" uuid_ops) WHERE (last_run_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "model_discovery_seen_models_last_seen_at_idx" ON "model_discovery_seen_models" USING btree ("last_seen_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "catalogue_game_results_user_date_idx" ON "catalogue_game_results" USING btree ("user_id" uuid_ops,"puzzle_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_provider_health_states_deranked_idx" ON "gateway_provider_health_states" USING btree ("provider_id" timestamptz_ops,"is_deranked" text_ops,"updated_at" bool_ops);--> statement-breakpoint
CREATE INDEX "gateway_provider_health_states_provider_updated_idx" ON "gateway_provider_health_states" USING btree ("provider_id" timestamptz_ops,"updated_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "model_discovery_issue_signals_pending_idx" ON "model_discovery_issue_signals" USING btree ("provider_id" text_ops,"emitted_at" text_ops) WHERE (emitted_at IS NULL);--> statement-breakpoint
CREATE INDEX "public_model_task_daily_model_date_idx" ON "public_model_task_daily" USING btree ("model_slug" date_ops,"usage_date" date_ops);--> statement-breakpoint
CREATE INDEX "request_classification_daily_classifier_idx" ON "request_classification_daily" USING btree ("classifier_id" date_ops,"usage_date" date_ops);--> statement-breakpoint
CREATE INDEX "request_classification_daily_public_rollup_idx" ON "request_classification_daily" USING btree ("usage_date" date_ops,"classifier_id" text_ops,"primary_category" date_ops,"model_slug" date_ops,"provider_slug" date_ops,"workspace_id" date_ops,"request_count" date_ops,"input_tokens" text_ops,"output_tokens" uuid_ops);--> statement-breakpoint
CREATE INDEX "request_classification_daily_workspace_date_idx" ON "request_classification_daily" USING btree ("workspace_id" date_ops,"usage_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "v2_route_capabilities_capability_idx" ON "v2_route_capabilities" USING btree ("capability_id" text_ops,"status" text_ops,"provider_model_id" text_ops);--> statement-breakpoint
CREATE INDEX "v2_public_provider_health_model_idx" ON "v2_public_provider_health_daily" USING btree ("model_slug" date_ops,"usage_date" date_ops,"provider_slug" date_ops);--> statement-breakpoint
CREATE INDEX "gateway_async_webhook_deliveries_pending_idx" ON "gateway_async_webhook_deliveries" USING btree ("next_attempt_at" timestamptz_ops,"updated_at" timestamptz_ops) WHERE (status = 'pending'::text);--> statement-breakpoint
CREATE INDEX "gateway_wallet_reservations_key_pending_idx" ON "gateway_wallet_reservations" USING btree ("key_id" text_ops,"status" uuid_ops,"created_at" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_gateway_wallet_reservations_status_updated" ON "gateway_wallet_reservations" USING btree ("status" timestamptz_ops,"updated_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_07_app_id_idx" ON "gateway_upstream_requests_2026_07" USING btree ("app_id" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_07_key_id_created_at_idx" ON "gateway_upstream_requests_2026_07" USING btree ("key_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_07_workspace_id_created_at_idx" ON "gateway_upstream_requests_2026_07" USING btree ("workspace_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_gateway_request_id_gateway_re_idx" ON "gateway_upstream_requests_2026_07" USING btree ("gateway_request_id" timestamptz_ops,"gateway_request_created_at" uuid_ops,"sequence" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_workspace_id_provider_created_idx" ON "gateway_upstream_requests_2026_07" USING btree ("workspace_id" text_ops,"provider" text_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_workspace_id_request_id_gatew_idx" ON "gateway_upstream_requests_2026_07" USING btree ("workspace_id" text_ops,"request_id" text_ops,"gateway_request_created_at" timestamptz_ops,"sequence" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_08_app_id_idx" ON "gateway_upstream_requests_2026_08" USING btree ("app_id" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_08_key_id_created_at_idx" ON "gateway_upstream_requests_2026_08" USING btree ("key_id" timestamptz_ops,"created_at" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_08_workspace_id_created_at_idx" ON "gateway_upstream_requests_2026_08" USING btree ("workspace_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_gateway_request_id_gateway_r_idx1" ON "gateway_upstream_requests_2026_08" USING btree ("gateway_request_id" int4_ops,"gateway_request_created_at" uuid_ops,"sequence" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_workspace_id_provider_create_idx1" ON "gateway_upstream_requests_2026_08" USING btree ("workspace_id" text_ops,"provider" uuid_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_workspace_id_request_id_gate_idx1" ON "gateway_upstream_requests_2026_08" USING btree ("workspace_id" uuid_ops,"request_id" int4_ops,"gateway_request_created_at" text_ops,"sequence" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_09_app_id_idx" ON "gateway_upstream_requests_2026_09" USING btree ("app_id" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_09_key_id_created_at_idx" ON "gateway_upstream_requests_2026_09" USING btree ("key_id" uuid_ops,"created_at" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_2026_09_workspace_id_created_at_idx" ON "gateway_upstream_requests_2026_09" USING btree ("workspace_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_gateway_request_id_gateway_r_idx2" ON "gateway_upstream_requests_2026_09" USING btree ("gateway_request_id" timestamptz_ops,"gateway_request_created_at" int4_ops,"sequence" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_workspace_id_provider_create_idx2" ON "gateway_upstream_requests_2026_09" USING btree ("workspace_id" timestamptz_ops,"provider" uuid_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_202_workspace_id_request_id_gate_idx2" ON "gateway_upstream_requests_2026_09" USING btree ("workspace_id" int4_ops,"request_id" text_ops,"gateway_request_created_at" int4_ops,"sequence" int4_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_def_gateway_request_id_gateway_re_idx" ON "gateway_upstream_requests_default" USING btree ("gateway_request_id" uuid_ops,"gateway_request_created_at" int4_ops,"sequence" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_def_workspace_id_provider_created_idx" ON "gateway_upstream_requests_default" USING btree ("workspace_id" text_ops,"provider" uuid_ops,"created_at" text_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_def_workspace_id_request_id_gatew_idx" ON "gateway_upstream_requests_default" USING btree ("workspace_id" int4_ops,"request_id" timestamptz_ops,"gateway_request_created_at" timestamptz_ops,"sequence" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_default_app_id_idx" ON "gateway_upstream_requests_default" USING btree ("app_id" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_default_key_id_created_at_idx" ON "gateway_upstream_requests_default" USING btree ("key_id" timestamptz_ops,"created_at" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_upstream_requests_default_workspace_id_created_at_idx" ON "gateway_upstream_requests_default" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_api_model_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("api_model_id" text_ops,"created_at" timestamptz_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_app_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("app_id" timestamptz_ops,"created_at" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_auth_method_idx" ON "gateway_requests_2026_03" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_created_at_idx1" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_created_at_idx2" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_created_at_idx3" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_created_at_idx4" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_created_at_idx5" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_created_at_prov_idx" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops,"provider" text_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_canonical_model_id_provider_create_idx" ON "gateway_requests_2026_03" USING btree ("canonical_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_2026_03" USING btree ("created_at" text_ops,"routed_model_id" timestamptz_ops,"cost_nanos" text_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_finish_reason_created_at_idx" ON "gateway_requests_2026_03" USING btree ("finish_reason" timestamptz_ops,"created_at" timestamptz_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_key_id_idx" ON "gateway_requests_2026_03" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_model_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("model_id" text_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_model_id_created_at_provider_idx" ON "gateway_requests_2026_03" USING btree ("model_id" timestamptz_ops,"created_at" timestamptz_ops,"provider" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_oauth_client_id_idx" ON "gateway_requests_2026_03" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_oauth_user_id_idx" ON "gateway_requests_2026_03" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_pricing_plan_created_at_idx" ON "gateway_requests_2026_03" USING btree ("pricing_plan" timestamptz_ops,"created_at" text_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_provider_created_at_idx" ON "gateway_requests_2026_03" USING btree ("provider" text_ops,"created_at" text_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_provider_model_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("provider" timestamptz_ops,"model_id" timestamptz_ops,"created_at" text_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_2026_03_realtime_session_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("realtime_session_id" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_requested_model_id_provider_create_idx" ON "gateway_requests_2026_03" USING btree ("requested_model_id" text_ops,"provider" timestamptz_ops,"created_at" text_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_routed_model_id_provider_created_a_idx" ON "gateway_requests_2026_03" USING btree ("routed_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_success_created_at_idx" ON "gateway_requests_2026_03" USING btree ("success" bool_ops,"created_at" bool_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_trace_data_idx" ON "gateway_requests_2026_03" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_auth_method_created_at_id" ON "gateway_requests_2026_03" USING btree ("workspace_id" timestamptz_ops,"auth_method" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_client_source_id_crea_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" uuid_ops,"client_source_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_created_at_id_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" timestamptz_ops,"created_at" timestamptz_ops,"id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_end_user_id_created_at_id" ON "gateway_requests_2026_03" USING btree ("workspace_id" text_ops,"end_user_id" timestamptz_ops,"created_at" text_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_finish_reason_created_at_" ON "gateway_requests_2026_03" USING btree ("workspace_id" text_ops,"finish_reason" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_model_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" text_ops,"model_id" timestamptz_ops,"created_at" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_oauth_client_id_created_a" ON "gateway_requests_2026_03" USING btree ("workspace_id" uuid_ops,"oauth_client_id" text_ops,"created_at" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_provider_created_at_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" text_ops,"provider" text_ops,"created_at" uuid_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_request_id_create_2cece09" ON "gateway_requests_2026_03" USING btree ("workspace_id" text_ops,"request_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" text_ops,"requested_model_id" text_ops,"created_at" timestamptz_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" timestamptz_ops,"routed_model_id" timestamptz_ops,"created_at" text_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_session_id_created_at_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" timestamptz_ops,"session_id" uuid_ops,"created_at" uuid_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_03_workspace_id_success_created_at_idx" ON "gateway_requests_2026_03" USING btree ("workspace_id" timestamptz_ops,"success" timestamptz_ops,"created_at" timestamptz_ops) WHERE (success = true);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_api_model_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("api_model_id" text_ops,"created_at" timestamptz_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_app_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("app_id" uuid_ops,"created_at" timestamptz_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_auth_method_idx" ON "gateway_requests_2026_04" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_created_at_idx1" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_created_at_idx2" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_created_at_idx3" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_created_at_idx4" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_created_at_idx5" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_created_at_prov_idx" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops,"provider" text_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_canonical_model_id_provider_create_idx" ON "gateway_requests_2026_04" USING btree ("canonical_model_id" timestamptz_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_2026_04" USING btree ("created_at" text_ops,"routed_model_id" text_ops,"cost_nanos" timestamptz_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_finish_reason_created_at_idx" ON "gateway_requests_2026_04" USING btree ("finish_reason" text_ops,"created_at" timestamptz_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_key_id_idx" ON "gateway_requests_2026_04" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_model_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_model_id_created_at_provider_idx" ON "gateway_requests_2026_04" USING btree ("model_id" timestamptz_ops,"created_at" text_ops,"provider" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_oauth_client_id_idx" ON "gateway_requests_2026_04" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_oauth_user_id_idx" ON "gateway_requests_2026_04" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_pricing_plan_created_at_idx" ON "gateway_requests_2026_04" USING btree ("pricing_plan" text_ops,"created_at" timestamptz_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_provider_created_at_idx" ON "gateway_requests_2026_04" USING btree ("provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_provider_model_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("provider" timestamptz_ops,"model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_2026_04_realtime_session_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("realtime_session_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_requested_model_id_provider_create_idx" ON "gateway_requests_2026_04" USING btree ("requested_model_id" timestamptz_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_routed_model_id_provider_created_a_idx" ON "gateway_requests_2026_04" USING btree ("routed_model_id" text_ops,"provider" text_ops,"created_at" text_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_success_created_at_idx" ON "gateway_requests_2026_04" USING btree ("success" timestamptz_ops,"created_at" bool_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_trace_data_idx" ON "gateway_requests_2026_04" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_auth_method_created_at_id" ON "gateway_requests_2026_04" USING btree ("workspace_id" timestamptz_ops,"auth_method" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_client_source_id_crea_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" text_ops,"client_source_id" text_ops,"created_at" timestamptz_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_created_at_id_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" timestamptz_ops,"created_at" timestamptz_ops,"id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_end_user_id_created_at_id" ON "gateway_requests_2026_04" USING btree ("workspace_id" timestamptz_ops,"end_user_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_finish_reason_created_at_" ON "gateway_requests_2026_04" USING btree ("workspace_id" uuid_ops,"finish_reason" uuid_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_model_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" text_ops,"model_id" text_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_oauth_client_id_created_a" ON "gateway_requests_2026_04" USING btree ("workspace_id" text_ops,"oauth_client_id" text_ops,"created_at" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_provider_created_at_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_request_id_create_cefa2f4" ON "gateway_requests_2026_04" USING btree ("workspace_id" uuid_ops,"request_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" timestamptz_ops,"requested_model_id" uuid_ops,"created_at" uuid_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" text_ops,"routed_model_id" text_ops,"created_at" text_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_session_id_created_at_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" text_ops,"session_id" text_ops,"created_at" text_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_04_workspace_id_success_created_at_idx" ON "gateway_requests_2026_04" USING btree ("workspace_id" timestamptz_ops,"success" timestamptz_ops,"created_at" timestamptz_ops) WHERE (success = true);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_api_model_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("api_model_id" timestamptz_ops,"created_at" text_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_app_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("app_id" uuid_ops,"created_at" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_auth_method_idx" ON "gateway_requests_2026_05" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_created_at_idx1" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_created_at_idx2" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_created_at_idx3" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_created_at_idx4" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_created_at_idx5" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_created_at_prov_idx" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops,"provider" timestamptz_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_canonical_model_id_provider_create_idx" ON "gateway_requests_2026_05" USING btree ("canonical_model_id" timestamptz_ops,"provider" text_ops,"created_at" text_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_2026_05" USING btree ("created_at" text_ops,"routed_model_id" text_ops,"cost_nanos" timestamptz_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_finish_reason_created_at_idx" ON "gateway_requests_2026_05" USING btree ("finish_reason" text_ops,"created_at" text_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_key_id_idx" ON "gateway_requests_2026_05" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_model_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("model_id" text_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_model_id_created_at_provider_idx" ON "gateway_requests_2026_05" USING btree ("model_id" timestamptz_ops,"created_at" text_ops,"provider" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_oauth_client_id_idx" ON "gateway_requests_2026_05" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_oauth_user_id_idx" ON "gateway_requests_2026_05" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_pricing_plan_created_at_idx" ON "gateway_requests_2026_05" USING btree ("pricing_plan" text_ops,"created_at" text_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_provider_created_at_idx" ON "gateway_requests_2026_05" USING btree ("provider" timestamptz_ops,"created_at" text_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_provider_model_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("provider" text_ops,"model_id" text_ops,"created_at" text_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_2026_05_realtime_session_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("realtime_session_id" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_requested_model_id_provider_create_idx" ON "gateway_requests_2026_05" USING btree ("requested_model_id" timestamptz_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_routed_model_id_provider_created_a_idx" ON "gateway_requests_2026_05" USING btree ("routed_model_id" text_ops,"provider" text_ops,"created_at" timestamptz_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_success_created_at_idx" ON "gateway_requests_2026_05" USING btree ("success" bool_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_trace_data_idx" ON "gateway_requests_2026_05" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_auth_method_created_at_id" ON "gateway_requests_2026_05" USING btree ("workspace_id" uuid_ops,"auth_method" text_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_client_source_id_crea_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" uuid_ops,"client_source_id" uuid_ops,"created_at" timestamptz_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_created_at_id_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops,"id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_end_user_id_created_at_id" ON "gateway_requests_2026_05" USING btree ("workspace_id" uuid_ops,"end_user_id" text_ops,"created_at" timestamptz_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_finish_reason_created_at_" ON "gateway_requests_2026_05" USING btree ("workspace_id" uuid_ops,"finish_reason" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_model_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" text_ops,"model_id" text_ops,"created_at" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_oauth_client_id_created_a" ON "gateway_requests_2026_05" USING btree ("workspace_id" uuid_ops,"oauth_client_id" uuid_ops,"created_at" timestamptz_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_provider_created_at_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" timestamptz_ops,"provider" text_ops,"created_at" text_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_request_id_create_ca18a44" ON "gateway_requests_2026_05" USING btree ("workspace_id" text_ops,"request_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" timestamptz_ops,"requested_model_id" text_ops,"created_at" timestamptz_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" timestamptz_ops,"routed_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_session_id_created_at_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" uuid_ops,"session_id" uuid_ops,"created_at" uuid_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_05_workspace_id_success_created_at_idx" ON "gateway_requests_2026_05" USING btree ("workspace_id" timestamptz_ops,"success" timestamptz_ops,"created_at" timestamptz_ops) WHERE (success = true);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_api_model_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("api_model_id" timestamptz_ops,"created_at" text_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_app_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("app_id" uuid_ops,"created_at" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_auth_method_idx" ON "gateway_requests_2026_06" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_created_at_idx1" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_created_at_idx2" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_created_at_idx3" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_created_at_idx4" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_created_at_idx5" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_created_at_prov_idx" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops,"provider" timestamptz_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_canonical_model_id_provider_create_idx" ON "gateway_requests_2026_06" USING btree ("canonical_model_id" text_ops,"provider" timestamptz_ops,"created_at" text_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_2026_06" USING btree ("created_at" timestamptz_ops,"routed_model_id" text_ops,"cost_nanos" timestamptz_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_finish_reason_created_at_idx" ON "gateway_requests_2026_06" USING btree ("finish_reason" timestamptz_ops,"created_at" timestamptz_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_key_id_idx" ON "gateway_requests_2026_06" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_model_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("model_id" text_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_model_id_created_at_provider_idx" ON "gateway_requests_2026_06" USING btree ("model_id" text_ops,"created_at" text_ops,"provider" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_oauth_client_id_idx" ON "gateway_requests_2026_06" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_oauth_user_id_idx" ON "gateway_requests_2026_06" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_pricing_plan_created_at_idx" ON "gateway_requests_2026_06" USING btree ("pricing_plan" timestamptz_ops,"created_at" text_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_provider_created_at_idx" ON "gateway_requests_2026_06" USING btree ("provider" text_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_provider_model_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("provider" timestamptz_ops,"model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_2026_06_realtime_session_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("realtime_session_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_requested_model_id_provider_create_idx" ON "gateway_requests_2026_06" USING btree ("requested_model_id" text_ops,"provider" text_ops,"created_at" timestamptz_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_routed_model_id_provider_created_a_idx" ON "gateway_requests_2026_06" USING btree ("routed_model_id" timestamptz_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_success_created_at_idx" ON "gateway_requests_2026_06" USING btree ("success" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_auth_method_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" timestamptz_ops,"auth_method" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_end_user_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"end_user_id" uuid_ops,"created_at" uuid_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_finish_reason_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"finish_reason" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_model_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" text_ops,"model_id" uuid_ops,"created_at" uuid_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_oauth_client_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"oauth_client_id" text_ops,"created_at" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_provider_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"provider" text_ops,"created_at" text_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_request_id_created_at_idx1" ON "gateway_requests_2026_06" USING btree ("workspace_id" text_ops,"request_id" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_session_id_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" text_ops,"session_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_team_id_success_created_at_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"success" uuid_ops,"created_at" uuid_ops) WHERE (success = true);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_trace_data_idx" ON "gateway_requests_2026_06" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_workspace_id_client_source_id_crea_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"client_source_id" timestamptz_ops,"created_at" text_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_workspace_id_created_at_id_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops,"id" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" timestamptz_ops,"requested_model_id" text_ops,"created_at" uuid_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_06_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_2026_06" USING btree ("workspace_id" uuid_ops,"routed_model_id" uuid_ops,"created_at" text_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_api_model_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("api_model_id" timestamptz_ops,"created_at" text_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_app_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("app_id" timestamptz_ops,"created_at" uuid_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_auth_method_idx" ON "gateway_requests_2026_07" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_created_at_idx1" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_created_at_idx2" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_created_at_idx3" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_created_at_idx4" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_created_at_idx5" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_created_at_prov_idx" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops,"provider" timestamptz_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_canonical_model_id_provider_create_idx" ON "gateway_requests_2026_07" USING btree ("canonical_model_id" text_ops,"provider" text_ops,"created_at" timestamptz_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_2026_07" USING btree ("created_at" timestamptz_ops,"routed_model_id" timestamptz_ops,"cost_nanos" timestamptz_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_finish_reason_created_at_idx" ON "gateway_requests_2026_07" USING btree ("finish_reason" text_ops,"created_at" text_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_key_id_idx" ON "gateway_requests_2026_07" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_model_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("model_id" timestamptz_ops,"created_at" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_model_id_created_at_provider_idx" ON "gateway_requests_2026_07" USING btree ("model_id" text_ops,"created_at" timestamptz_ops,"provider" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_oauth_client_id_idx" ON "gateway_requests_2026_07" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_oauth_user_id_idx" ON "gateway_requests_2026_07" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_pricing_plan_created_at_idx" ON "gateway_requests_2026_07" USING btree ("pricing_plan" timestamptz_ops,"created_at" text_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_provider_created_at_idx" ON "gateway_requests_2026_07" USING btree ("provider" text_ops,"created_at" text_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_provider_model_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("provider" timestamptz_ops,"model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_2026_07_realtime_session_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("realtime_session_id" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_requested_model_id_provider_create_idx" ON "gateway_requests_2026_07" USING btree ("requested_model_id" timestamptz_ops,"provider" text_ops,"created_at" text_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_routed_model_id_provider_created_a_idx" ON "gateway_requests_2026_07" USING btree ("routed_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_success_created_at_idx" ON "gateway_requests_2026_07" USING btree ("success" bool_ops,"created_at" bool_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_auth_method_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" timestamptz_ops,"auth_method" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_end_user_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" text_ops,"end_user_id" text_ops,"created_at" uuid_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_finish_reason_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" text_ops,"finish_reason" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_model_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" timestamptz_ops,"model_id" uuid_ops,"created_at" uuid_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_oauth_client_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" uuid_ops,"oauth_client_id" text_ops,"created_at" uuid_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_provider_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" uuid_ops,"provider" uuid_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_request_id_created_at_idx1" ON "gateway_requests_2026_07" USING btree ("workspace_id" uuid_ops,"request_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_session_id_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" uuid_ops,"session_id" text_ops,"created_at" text_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_team_id_success_created_at_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" uuid_ops,"success" uuid_ops,"created_at" bool_ops) WHERE (success = true);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_trace_data_idx" ON "gateway_requests_2026_07" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_workspace_id_client_source_id_crea_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" text_ops,"client_source_id" timestamptz_ops,"created_at" uuid_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_workspace_id_created_at_id_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" uuid_ops,"created_at" uuid_ops,"id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" timestamptz_ops,"requested_model_id" text_ops,"created_at" text_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_07_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_2026_07" USING btree ("workspace_id" text_ops,"routed_model_id" uuid_ops,"created_at" text_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_api_model_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("api_model_id" text_ops,"created_at" text_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_app_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("app_id" uuid_ops,"created_at" timestamptz_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_auth_method_idx" ON "gateway_requests_2026_08" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_created_at_idx1" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_created_at_idx2" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_created_at_idx3" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_created_at_idx4" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_created_at_idx5" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_created_at_prov_idx" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" text_ops,"created_at" text_ops,"provider" text_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_canonical_model_id_provider_create_idx" ON "gateway_requests_2026_08" USING btree ("canonical_model_id" timestamptz_ops,"provider" timestamptz_ops,"created_at" text_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_2026_08" USING btree ("created_at" timestamptz_ops,"routed_model_id" text_ops,"cost_nanos" text_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_finish_reason_created_at_idx" ON "gateway_requests_2026_08" USING btree ("finish_reason" timestamptz_ops,"created_at" text_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_key_id_idx" ON "gateway_requests_2026_08" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_model_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_model_id_created_at_provider_idx" ON "gateway_requests_2026_08" USING btree ("model_id" timestamptz_ops,"created_at" text_ops,"provider" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_oauth_client_id_idx" ON "gateway_requests_2026_08" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_oauth_user_id_idx" ON "gateway_requests_2026_08" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_pricing_plan_created_at_idx" ON "gateway_requests_2026_08" USING btree ("pricing_plan" timestamptz_ops,"created_at" text_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_provider_created_at_idx" ON "gateway_requests_2026_08" USING btree ("provider" text_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_provider_model_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("provider" text_ops,"model_id" text_ops,"created_at" timestamptz_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_2026_08_realtime_session_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("realtime_session_id" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_requested_model_id_provider_create_idx" ON "gateway_requests_2026_08" USING btree ("requested_model_id" timestamptz_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_routed_model_id_provider_created_a_idx" ON "gateway_requests_2026_08" USING btree ("routed_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_success_created_at_idx" ON "gateway_requests_2026_08" USING btree ("success" bool_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_auth_method_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" timestamptz_ops,"auth_method" text_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_end_user_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" uuid_ops,"end_user_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_finish_reason_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" timestamptz_ops,"finish_reason" uuid_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_model_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" timestamptz_ops,"model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_oauth_client_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" uuid_ops,"oauth_client_id" uuid_ops,"created_at" uuid_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_provider_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" text_ops,"provider" uuid_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_request_id_created_at_idx1" ON "gateway_requests_2026_08" USING btree ("workspace_id" timestamptz_ops,"request_id" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_session_id_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" text_ops,"session_id" text_ops,"created_at" uuid_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_team_id_success_created_at_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" bool_ops,"success" bool_ops,"created_at" uuid_ops) WHERE (success = true);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_trace_data_idx" ON "gateway_requests_2026_08" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_workspace_id_client_source_id_crea_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" text_ops,"client_source_id" timestamptz_ops,"created_at" text_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_workspace_id_created_at_id_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" timestamptz_ops,"created_at" uuid_ops,"id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" timestamptz_ops,"requested_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_08_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_2026_08" USING btree ("workspace_id" uuid_ops,"routed_model_id" uuid_ops,"created_at" text_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_api_model_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("api_model_id" text_ops,"created_at" text_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_app_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("app_id" uuid_ops,"created_at" timestamptz_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_auth_method_idx" ON "gateway_requests_2026_09" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_created_at_idx1" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_created_at_idx2" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_created_at_idx3" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_created_at_idx4" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_created_at_idx5" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_created_at_prov_idx" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops,"provider" text_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_canonical_model_id_provider_create_idx" ON "gateway_requests_2026_09" USING btree ("canonical_model_id" text_ops,"provider" timestamptz_ops,"created_at" text_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_2026_09" USING btree ("created_at" timestamptz_ops,"routed_model_id" text_ops,"cost_nanos" text_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_finish_reason_created_at_idx" ON "gateway_requests_2026_09" USING btree ("finish_reason" text_ops,"created_at" timestamptz_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_key_id_idx" ON "gateway_requests_2026_09" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_model_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("model_id" timestamptz_ops,"created_at" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_model_id_created_at_provider_idx" ON "gateway_requests_2026_09" USING btree ("model_id" text_ops,"created_at" timestamptz_ops,"provider" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_oauth_client_id_idx" ON "gateway_requests_2026_09" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_oauth_user_id_idx" ON "gateway_requests_2026_09" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_pricing_plan_created_at_idx" ON "gateway_requests_2026_09" USING btree ("pricing_plan" text_ops,"created_at" text_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_provider_created_at_idx" ON "gateway_requests_2026_09" USING btree ("provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_provider_model_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("provider" text_ops,"model_id" timestamptz_ops,"created_at" text_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_2026_09_realtime_session_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("realtime_session_id" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_requested_model_id_provider_create_idx" ON "gateway_requests_2026_09" USING btree ("requested_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_routed_model_id_provider_created_a_idx" ON "gateway_requests_2026_09" USING btree ("routed_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_success_created_at_idx" ON "gateway_requests_2026_09" USING btree ("success" bool_ops,"created_at" bool_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_auth_method_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" timestamptz_ops,"auth_method" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_end_user_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" timestamptz_ops,"end_user_id" text_ops,"created_at" uuid_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_finish_reason_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" timestamptz_ops,"finish_reason" uuid_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_model_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" text_ops,"model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_oauth_client_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" text_ops,"oauth_client_id" text_ops,"created_at" timestamptz_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_provider_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" uuid_ops,"provider" uuid_ops,"created_at" text_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_request_id_created_at_idx1" ON "gateway_requests_2026_09" USING btree ("workspace_id" uuid_ops,"request_id" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_session_id_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" text_ops,"session_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_team_id_success_created_at_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" timestamptz_ops,"success" uuid_ops,"created_at" bool_ops) WHERE (success = true);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_trace_data_idx" ON "gateway_requests_2026_09" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_workspace_id_client_source_id_crea_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" text_ops,"client_source_id" uuid_ops,"created_at" timestamptz_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_workspace_id_created_at_id_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" uuid_ops,"created_at" timestamptz_ops,"id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" text_ops,"requested_model_id" text_ops,"created_at" text_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_2026_09_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_2026_09" USING btree ("workspace_id" uuid_ops,"routed_model_id" timestamptz_ops,"created_at" text_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_api_model_id_created_at_idx" ON "gateway_requests_default" USING btree ("api_model_id" text_ops,"created_at" text_ops) WHERE (api_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_app_id_created_at_idx" ON "gateway_requests_default" USING btree ("app_id" uuid_ops,"created_at" timestamptz_ops) WHERE (app_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_auth_method_idx" ON "gateway_requests_default" USING btree ("auth_method" text_ops) WHERE (auth_method = 'oauth'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_created_at_idx" ON "gateway_requests_default" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE (usage_total_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_created_at_idx1" ON "gateway_requests_default" USING btree ("canonical_model_id" text_ops,"created_at" text_ops) WHERE ((usage_input_image_tokens > 0) OR (usage_output_image_tokens > 0) OR (usage_image_inputs > 0) OR (usage_image_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_created_at_idx2" ON "gateway_requests_default" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_input_audio_tokens > 0) OR (usage_output_audio_tokens > 0) OR (usage_audio_inputs > 0) OR (usage_audio_outputs > 0));--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_created_at_idx3" ON "gateway_requests_default" USING btree ("canonical_model_id" timestamptz_ops,"created_at" text_ops) WHERE (usage_reasoning_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_created_at_idx4" ON "gateway_requests_default" USING btree ("canonical_model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (usage_total_quad_tokens > 0);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_created_at_idx5" ON "gateway_requests_default" USING btree ("canonical_model_id" text_ops,"created_at" timestamptz_ops) WHERE ((usage_text_quad_tokens > 0) OR (usage_image_megapixels > (0)::numeric) OR (usage_audio_seconds > (0)::numeric) OR (usage_video_pixel_seconds > (0)::numeric));--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_created_at_prov_idx" ON "gateway_requests_default" USING btree ("canonical_model_id" text_ops,"created_at" text_ops,"provider" timestamptz_ops) WHERE (canonical_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_canonical_model_id_provider_create_idx" ON "gateway_requests_default" USING btree ("canonical_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((canonical_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_default_created_at_routed_model_id_cost_na_idx" ON "gateway_requests_default" USING btree ("created_at" text_ops,"routed_model_id" timestamptz_ops,"cost_nanos" timestamptz_ops) WHERE (requested_model_id = 'phaseo/free'::text);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_finish_reason_created_at_idx" ON "gateway_requests_default" USING btree ("finish_reason" timestamptz_ops,"created_at" text_ops) WHERE (finish_reason IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_key_id_idx" ON "gateway_requests_default" USING btree ("key_id" uuid_ops) WHERE (key_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_model_id_created_at_idx" ON "gateway_requests_default" USING btree ("model_id" text_ops,"created_at" text_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_model_id_created_at_provider_idx" ON "gateway_requests_default" USING btree ("model_id" text_ops,"created_at" text_ops,"provider" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_oauth_client_id_idx" ON "gateway_requests_default" USING btree ("oauth_client_id" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_oauth_user_id_idx" ON "gateway_requests_default" USING btree ("oauth_user_id" uuid_ops) WHERE (oauth_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_pricing_plan_created_at_idx" ON "gateway_requests_default" USING btree ("pricing_plan" text_ops,"created_at" timestamptz_ops) WHERE (pricing_plan IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_provider_created_at_idx" ON "gateway_requests_default" USING btree ("provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_provider_model_id_created_at_idx" ON "gateway_requests_default" USING btree ("provider" text_ops,"model_id" timestamptz_ops,"created_at" text_ops) WHERE ((provider IS NOT NULL) AND (model_id IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_requests_default_realtime_session_id_created_at_idx" ON "gateway_requests_default" USING btree ("realtime_session_id" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_requested_model_id_provider_create_idx" ON "gateway_requests_default" USING btree ("requested_model_id" text_ops,"provider" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((requested_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_default_routed_model_id_provider_created_a_idx" ON "gateway_requests_default" USING btree ("routed_model_id" timestamptz_ops,"provider" text_ops,"created_at" timestamptz_ops) WHERE ((routed_model_id IS NOT NULL) AND (provider IS NOT NULL));--> statement-breakpoint
CREATE INDEX "gateway_requests_default_success_created_at_idx" ON "gateway_requests_default" USING btree ("success" timestamptz_ops,"created_at" bool_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_trace_data_idx" ON "gateway_requests_default" USING gin ("trace_data" jsonb_path_ops) WHERE (trace_data IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_auth_method_created_at_id" ON "gateway_requests_default" USING btree ("workspace_id" uuid_ops,"auth_method" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_client_source_id_crea_idx" ON "gateway_requests_default" USING btree ("workspace_id" text_ops,"client_source_id" uuid_ops,"created_at" text_ops) WHERE (client_source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_created_at_id_idx" ON "gateway_requests_default" USING btree ("workspace_id" timestamptz_ops,"created_at" uuid_ops,"id" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_end_user_id_created_at_id" ON "gateway_requests_default" USING btree ("workspace_id" uuid_ops,"end_user_id" uuid_ops,"created_at" text_ops) WHERE (end_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_finish_reason_created_at_" ON "gateway_requests_default" USING btree ("workspace_id" timestamptz_ops,"finish_reason" text_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_model_id_created_at_idx" ON "gateway_requests_default" USING btree ("workspace_id" text_ops,"model_id" timestamptz_ops,"created_at" timestamptz_ops) WHERE (model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_oauth_client_id_created_a" ON "gateway_requests_default" USING btree ("workspace_id" uuid_ops,"oauth_client_id" timestamptz_ops,"created_at" text_ops) WHERE (oauth_client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_provider_created_at_idx" ON "gateway_requests_default" USING btree ("workspace_id" text_ops,"provider" text_ops,"created_at" timestamptz_ops) WHERE (provider IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_request_id_create_50040d5" ON "gateway_requests_default" USING btree ("workspace_id" text_ops,"request_id" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_requested_model_id_cr_idx" ON "gateway_requests_default" USING btree ("workspace_id" timestamptz_ops,"requested_model_id" uuid_ops,"created_at" uuid_ops) WHERE (requested_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_routed_model_id_creat_idx" ON "gateway_requests_default" USING btree ("workspace_id" timestamptz_ops,"routed_model_id" timestamptz_ops,"created_at" uuid_ops) WHERE (routed_model_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_session_id_created_at_idx" ON "gateway_requests_default" USING btree ("workspace_id" timestamptz_ops,"session_id" text_ops,"created_at" timestamptz_ops) WHERE (session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "gateway_requests_default_workspace_id_success_created_at_idx" ON "gateway_requests_default" USING btree ("workspace_id" bool_ops,"success" timestamptz_ops,"created_at" timestamptz_ops) WHERE (success = true);--> statement-breakpoint
CREATE VIEW "public"."oauth_apps_with_stats" WITH (security_invoker = true) AS (SELECT oam.id, oam.client_id, oam.workspace_id, oam.name, oam.description, oam.homepage_url, oam.logo_url, oam.privacy_policy_url, oam.terms_of_service_url, oam.created_by, oam.created_at, oam.updated_at, oam.status, oam.redirect_uris, count(DISTINCT oa.id) FILTER (WHERE oa.revoked_at IS NULL) AS active_authorizations, count(DISTINCT oa.id) AS total_authorizations, max(oa.last_used_at) AS last_used_at, count(DISTINCT gr.id) AS requests_last_30d FROM oauth_app_metadata oam LEFT JOIN oauth_authorizations oa ON oa.client_id = oam.client_id LEFT JOIN gateway_requests gr ON gr.oauth_client_id = oam.client_id AND gr.created_at > (now() - '30 days'::interval) WHERE oam.status = 'active'::text GROUP BY oam.id);--> statement-breakpoint
CREATE VIEW "public"."v2_rpc_gateway_activity_rollup_daily" WITH (security_invoker = true) AS (SELECT usage.usage_date AS day_bucket, usage.workspace_id AS team_id, usage.model_slug AS model_id, 'unknown'::text AS endpoint, route.provider_slug AS provider, 0::bigint AS usage_nanos, 0::bigint AS byok_usage_nanos, usage.requests, 0::bigint AS prompt_tokens, 0::bigint AS completion_tokens, 0::bigint AS reasoning_tokens, usage.updated_at FROM v2_private_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id);--> statement-breakpoint
CREATE VIEW "public"."v2_rpc_gateway_model_usage_daily" WITH (security_invoker = true) AS (WITH meters AS ( SELECT meter.rollup_id, jsonb_object_agg(meter.meter_key, meter.quantity) AS "values" FROM v2_public_usage_daily_meters meter GROUP BY meter.rollup_id ) SELECT usage.usage_date AS day_bucket, usage.model_slug AS model_id, route.provider_slug AS provider_id, 'unknown'::text AS endpoint, usage.requests, usage.successful_requests AS success_requests, usage.failed_requests, 0::bigint AS neutral_requests, usage.rate_limited_requests, COALESCE((meters."values" ->> 'total_tokens'::text)::numeric, ((meters."values" ->> 'input_tokens'::text)::numeric) + ((meters."values" ->> 'output_tokens'::text)::numeric), ((meters."values" ->> 'input_text_tokens'::text)::numeric) + ((meters."values" ->> 'output_text_tokens'::text)::numeric), 0::numeric)::bigint AS total_tokens, COALESCE((meters."values" ->> 'input_tokens'::text)::numeric, (meters."values" ->> 'input_text_tokens'::text)::numeric, 0::numeric)::bigint AS input_tokens, COALESCE((meters."values" ->> 'output_tokens'::text)::numeric, (meters."values" ->> 'output_text_tokens'::text)::numeric, 0::numeric)::bigint AS output_tokens, COALESCE((meters."values" ->> 'reasoning_tokens'::text)::numeric, 0::numeric)::bigint AS reasoning_tokens, COALESCE((meters."values" ->> 'input_text_tokens'::text)::numeric, 0::numeric)::bigint AS input_text_tokens, COALESCE((meters."values" ->> 'output_text_tokens'::text)::numeric, 0::numeric)::bigint AS output_text_tokens, COALESCE((meters."values" ->> 'input_image_tokens'::text)::numeric, 0::numeric)::bigint AS input_image_tokens, COALESCE((meters."values" ->> 'output_image_tokens'::text)::numeric, 0::numeric)::bigint AS output_image_tokens, COALESCE((meters."values" ->> 'input_audio_tokens'::text)::numeric, 0::numeric)::bigint AS input_audio_tokens, COALESCE((meters."values" ->> 'output_audio_tokens'::text)::numeric, 0::numeric)::bigint AS output_audio_tokens, COALESCE((meters."values" ->> 'input_video_tokens'::text)::numeric, 0::numeric)::bigint AS input_video_tokens, COALESCE((meters."values" ->> 'output_video_tokens'::text)::numeric, 0::numeric)::bigint AS output_video_tokens, COALESCE((meters."values" ->> 'image_inputs'::text)::numeric, (meters."values" ->> 'input_images'::text)::numeric, 0::numeric)::bigint AS image_inputs, COALESCE((meters."values" ->> 'image_outputs'::text)::numeric, (meters."values" ->> 'output_images'::text)::numeric, 0::numeric)::bigint AS image_outputs, COALESCE((meters."values" ->> 'audio_inputs'::text)::numeric, 0::numeric)::bigint AS audio_inputs, COALESCE((meters."values" ->> 'audio_outputs'::text)::numeric, 0::numeric)::bigint AS audio_outputs, COALESCE((meters."values" ->> 'video_inputs'::text)::numeric, 0::numeric)::bigint AS video_inputs, COALESCE((meters."values" ->> 'video_outputs'::text)::numeric, 0::numeric)::bigint AS video_outputs, COALESCE((meters."values" ->> 'cached_read_tokens'::text)::numeric, (meters."values" ->> 'cached_input_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_tokens, COALESCE((meters."values" ->> 'cached_write_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_tokens, COALESCE((meters."values" ->> 'cached_read_text_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_text_tokens, COALESCE((meters."values" ->> 'cached_write_text_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_text_tokens, COALESCE((meters."values" ->> 'cached_read_image_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_image_tokens, COALESCE((meters."values" ->> 'cached_write_image_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_image_tokens, COALESCE((meters."values" ->> 'cached_read_audio_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_audio_tokens, COALESCE((meters."values" ->> 'cached_write_audio_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_audio_tokens, COALESCE((meters."values" ->> 'cached_read_video_tokens'::text)::numeric, 0::numeric)::bigint AS cached_read_video_tokens, COALESCE((meters."values" ->> 'cached_write_video_tokens'::text)::numeric, 0::numeric)::bigint AS cached_write_video_tokens, 0::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.generation_sum_ms, usage.generation_count AS generation_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, usage.updated_at AS last_request_at, usage.updated_at AS refreshed_at, COALESCE((meters."values" ->> 'input_quad_tokens'::text)::numeric, 0::numeric)::bigint AS input_quad_tokens, COALESCE((meters."values" ->> 'output_quad_tokens'::text)::numeric, 0::numeric)::bigint AS output_quad_tokens, COALESCE((meters."values" ->> 'total_quad_tokens'::text)::numeric, 0::numeric)::bigint AS total_quad_tokens, COALESCE((meters."values" ->> 'cached_write_text_tokens_5m'::text)::numeric, 0::numeric)::bigint AS cached_write_text_tokens_5m, COALESCE((meters."values" ->> 'cached_write_text_tokens_1h'::text)::numeric, 0::numeric)::bigint AS cached_write_text_tokens_1h, COALESCE((meters."values" ->> 'text_quad_tokens'::text)::numeric, 0::numeric)::bigint AS text_quad_tokens, COALESCE((meters."values" ->> 'rerank_quad_tokens'::text)::numeric, 0::numeric)::bigint AS rerank_quad_tokens, COALESCE((meters."values" ->> 'embedding_quad_tokens'::text)::numeric, 0::numeric)::bigint AS embedding_quad_tokens, COALESCE((meters."values" ->> 'moderation_quad_tokens'::text)::numeric, 0::numeric)::bigint AS moderation_quad_tokens, COALESCE((meters."values" ->> 'ocr_quad_tokens'::text)::numeric, 0::numeric)::bigint AS ocr_quad_tokens, COALESCE((meters."values" ->> 'image_megapixels'::text)::numeric, 0::numeric) AS image_megapixels, COALESCE((meters."values" ->> 'audio_seconds'::text)::numeric, 0::numeric) AS audio_seconds, COALESCE((meters."values" ->> 'video_pixel_seconds'::text)::numeric, 0::numeric) AS video_pixel_seconds, COALESCE((meters."values" ->> 'input_characters'::text)::numeric, 0::numeric)::bigint AS input_characters, COALESCE((meters."values" ->> 'output_characters'::text)::numeric, 0::numeric)::bigint AS output_characters, COALESCE((meters."values" ->> 'total_characters'::text)::numeric, 0::numeric)::bigint AS total_characters, COALESCE((meters."values" ->> 'embedding_tokens'::text)::numeric, 0::numeric)::bigint AS embedding_tokens, COALESCE((meters."values" ->> 'video_seconds'::text)::numeric, 0::numeric) AS video_seconds FROM v2_public_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id);--> statement-breakpoint
CREATE VIEW "public"."v2_web_public_usage_daily" WITH (security_invoker = true) AS (WITH meters AS ( SELECT meter.rollup_id, COALESCE(max(meter.quantity) FILTER (WHERE meter.meter_key = 'total_tokens'::text), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_tokens'::text, 'output_tokens'::text])), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_text_tokens'::text, 'output_text_tokens'::text])), 0::numeric) AS total_tokens FROM v2_public_usage_daily_meters meter GROUP BY meter.rollup_id ) SELECT usage.usage_date AS day_bucket, usage.model_slug AS canonical_model_id, route.provider_slug AS provider, usage.app_id, usage.requests, usage.successful_requests AS success_requests, COALESCE(meters.total_tokens, 0::numeric) AS total_tokens, usage.cost_nanos::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, usage.generation_sum_ms, usage.generation_count AS generation_samples FROM v2_public_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id);--> statement-breakpoint
CREATE VIEW "public"."v2_rpc_gateway_usage_rollup_daily_app" WITH (security_invoker = true) AS (SELECT day_bucket::timestamp with time zone AS day_bucket, app_id, sum(requests)::bigint AS requests, sum(success_requests)::bigint AS success_requests, sum(total_tokens)::bigint AS total_tokens, sum(total_cost_nanos)::bigint AS total_cost_nanos, count(DISTINCT canonical_model_id)::integer AS unique_models FROM v2_web_public_usage_daily usage WHERE app_id IS NOT NULL GROUP BY day_bucket, app_id);--> statement-breakpoint
CREATE VIEW "public"."v2_rpc_public_app_model_usage_daily" WITH (security_invoker = true) AS (SELECT usage.day_bucket, usage.app_id::text AS app_id, usage.canonical_model_id AS model_id, usage.requests, usage.total_tokens::bigint AS tokens, now() AS refreshed_at FROM v2_web_public_usage_daily usage JOIN api_apps app ON app.id = usage.app_id AND app.is_public = true);--> statement-breakpoint
CREATE VIEW "public"."v2_web_gateway_requests" WITH (security_invoker = true) AS (SELECT request_row.id, request_row.created_at, request_row.team_id, request_row.workspace_id, request_row.request_id, request_row.app_id, request_row.endpoint, request_row.model_id, request_row.requested_model_id, request_row.routed_model_id, request_row.canonical_model_id, request_row.provider, request_row.native_response_id, request_row.stream, request_row.byok, request_row.status_code, request_row.success, request_row.error_code, request_row.error_message, request_row.latency_ms, request_row.generation_ms, request_row.e2e_latency_ms, request_row.usage, request_row.usage_total_tokens, request_row.usage_input_tokens, request_row.usage_output_tokens, request_row.usage_reasoning_tokens, request_row.usage_input_text_tokens, request_row.usage_output_text_tokens, request_row.usage_input_image_tokens, request_row.usage_output_image_tokens, request_row.usage_input_audio_tokens, request_row.usage_output_audio_tokens, request_row.usage_input_video_tokens, request_row.usage_output_video_tokens, request_row.usage_image_inputs, request_row.usage_image_outputs, request_row.usage_audio_inputs, request_row.usage_audio_outputs, request_row.usage_video_inputs, request_row.usage_video_outputs, request_row.usage_cached_read_tokens, request_row.usage_cached_write_tokens, request_row.usage_cached_read_text_tokens, request_row.usage_cached_write_text_tokens, request_row.usage_cached_write_text_tokens_5m, request_row.usage_cached_write_text_tokens_1h, request_row.usage_cached_read_image_tokens, request_row.usage_cached_write_image_tokens, request_row.usage_cached_read_audio_tokens, request_row.usage_cached_write_audio_tokens, request_row.usage_cached_read_video_tokens, request_row.usage_cached_write_video_tokens, request_row.usage_input_quad_tokens, request_row.usage_output_quad_tokens, request_row.usage_total_quad_tokens, request_row.usage_text_quad_tokens, request_row.usage_rerank_quad_tokens, request_row.usage_embedding_quad_tokens, request_row.usage_moderation_quad_tokens, request_row.usage_ocr_quad_tokens, request_row.usage_image_megapixels, request_row.usage_audio_seconds, request_row.usage_video_pixel_seconds, request_row.usage_input_characters, request_row.usage_output_characters, request_row.usage_total_characters, request_row.usage_normalized_at, request_row.cost_nanos, request_row.currency, request_row.pricing_lines, request_row.key_id, request_row.throughput, request_row.location, request_row.auth_method, request_row.oauth_client_id, request_row.oauth_user_id, request_row.end_user_id, request_row.session_id, request_row.trace_data, request_row.provider_attempts, request_row.stop_reason, request_row.finish_reason, request_row.tool_call_count, request_row.structured_output_attempted, request_row.structured_output_succeeded, request_row.cloudflare_colo, fact.safe_metadata -> 'error_payload'::text AS error_payload, fact.safe_metadata AS detail_metadata, fact.client_source_id, fact.client_source_name, fact.client_source_kind, fact.client_source_version, fact.client_source_detection FROM private.v2_rpc_gateway_requests_compat request_row JOIN v2_request_facts fact ON fact.request_event_id = request_row.id);--> statement-breakpoint
CREATE VIEW "public"."v2_web_private_usage_daily" WITH (security_invoker = true) AS (WITH meters AS ( SELECT meter.rollup_id, COALESCE(max(meter.quantity) FILTER (WHERE meter.meter_key = 'total_tokens'::text), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_tokens'::text, 'output_tokens'::text, 'input_text_tokens'::text, 'output_text_tokens'::text])), 0::numeric) AS total_tokens FROM v2_private_usage_daily_meters meter GROUP BY meter.rollup_id ) SELECT usage.usage_date::timestamp with time zone AS bucket_15m, usage.workspace_id, usage.model_slug AS canonical_model_id, route.provider_slug AS provider, usage.app_id, usage.requests, usage.successful_requests AS success_requests, usage.cost_nanos::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, COALESCE(meters.total_tokens, 0::numeric) AS total_tokens FROM v2_private_usage_daily usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id);--> statement-breakpoint
CREATE VIEW "public"."v2_web_public_usage_hourly" WITH (security_invoker = true) AS (WITH meters AS ( SELECT meter.rollup_id, COALESCE(max(meter.quantity) FILTER (WHERE meter.meter_key = 'total_tokens'::text), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_tokens'::text, 'output_tokens'::text])), sum(meter.quantity) FILTER (WHERE meter.meter_key = ANY (ARRAY['input_text_tokens'::text, 'output_text_tokens'::text])), 0::numeric) AS total_tokens FROM v2_public_usage_hourly_meters meter GROUP BY meter.rollup_id ) SELECT usage.bucket_start AS bucket_15m, usage.model_slug AS canonical_model_id, route.provider_slug AS provider, usage.app_id, usage.requests, usage.successful_requests AS success_requests, COALESCE(meters.total_tokens, 0::numeric) AS total_tokens, usage.cost_nanos::bigint AS total_cost_nanos, usage.latency_sum_ms, usage.latency_count AS latency_samples, usage.throughput_sum, usage.throughput_count AS throughput_samples, usage.generation_sum_ms, usage.generation_count AS generation_samples FROM v2_public_usage_hourly usage LEFT JOIN v2_model_provider_routes route ON route.provider_model_id = usage.provider_model_id LEFT JOIN meters ON meters.rollup_id = usage.rollup_id);--> statement-breakpoint
CREATE POLICY "byok_keys_delete_workspace_admin" ON "byok_keys" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "byok_keys_insert_workspace_admin" ON "byok_keys" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "byok_keys_select_workspace_member" ON "byok_keys" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "byok_keys_update_workspace_admin" ON "byok_keys" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "catalogue_interaction_puzzles" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "credit_grant_redemptions_admin_all" ON "credit_grant_redemptions" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT is_admin_user() AS is_admin_user)) WITH CHECK (( SELECT is_admin_user() AS is_admin_user));--> statement-breakpoint
CREATE POLICY "credit_grant_redemptions_service_all" ON "credit_grant_redemptions" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "credit_grants_admin_all" ON "credit_grants" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT is_admin_user() AS is_admin_user)) WITH CHECK (( SELECT is_admin_user() AS is_admin_user));--> statement-breakpoint
CREATE POLICY "credit_grants_service_all" ON "credit_grants" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "Enable insert for users based on user_id" ON "credit_ledger" AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_workspace_member(workspace_id));--> statement-breakpoint
CREATE POLICY "credit_ledger_select_own_team" ON "credit_ledger" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "data_contribution_consent_events" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "data_contributions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "email_outbox_insert_service" ON "email_outbox" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "email_outbox_select_service" ON "email_outbox" AS PERMISSIVE FOR SELECT TO "service_role";--> statement-breakpoint
CREATE POLICY "email_outbox_update_service" ON "email_outbox" AS PERMISSIVE FOR UPDATE TO "service_role";--> statement-breakpoint
CREATE POLICY "gateway_async_operations_insert_service" ON "gateway_async_operations" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_async_operations_select_own_team" ON "gateway_async_operations" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_async_operations_update_service" ON "gateway_async_operations" AS PERMISSIVE FOR UPDATE TO "service_role";--> statement-breakpoint
CREATE POLICY "gateway_batch_requests_select_workspace_members" ON "gateway_batch_requests" AS PERMISSIVE FOR SELECT TO public USING (((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = gateway_batch_requests.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid))))) OR is_workspace_admin(workspace_id)));--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_versions_workspace_delete" ON "gateway_dynamic_route_versions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM gateway_dynamic_routes route
  WHERE ((route.id = gateway_dynamic_route_versions.route_id) AND ( SELECT is_workspace_admin(route.workspace_id) AS is_workspace_admin)))));--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_versions_workspace_insert" ON "gateway_dynamic_route_versions" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_versions_workspace_select" ON "gateway_dynamic_route_versions" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_versions_workspace_update" ON "gateway_dynamic_route_versions" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_dynamic_routes_workspace_delete" ON "gateway_dynamic_routes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (( SELECT is_workspace_admin(gateway_dynamic_routes.workspace_id) AS is_workspace_admin));--> statement-breakpoint
CREATE POLICY "gateway_dynamic_routes_workspace_insert" ON "gateway_dynamic_routes" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_dynamic_routes_workspace_select" ON "gateway_dynamic_routes" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_dynamic_routes_workspace_update" ON "gateway_dynamic_routes" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_io_logs" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_observability_events_all_service" ON "gateway_observability_events" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_observability_events_select_workspace" ON "gateway_observability_events" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_preset_test_run_items_all_service" ON "gateway_preset_test_run_items" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_preset_test_run_items_select_workspace" ON "gateway_preset_test_run_items" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_preset_test_runs_all_service" ON "gateway_preset_test_runs" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_preset_test_runs_select_workspace" ON "gateway_preset_test_runs" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_provider_events_insert_service" ON "gateway_provider_events" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_provider_events_select_service" ON "gateway_provider_events" AS PERMISSIVE FOR SELECT TO "service_role";--> statement-breakpoint
CREATE POLICY "gateway_provider_events_update_service" ON "gateway_provider_events" AS PERMISSIVE FOR UPDATE TO "service_role";--> statement-breakpoint
CREATE POLICY "gateway_realtime_sessions_service_all" ON "gateway_realtime_sessions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_models_public_select" ON "v2_models" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((hidden = false) AND (status <> 'disabled'::text)));--> statement-breakpoint
CREATE POLICY "api_apps_delete_own_team" ON "api_apps" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_member(workspace_id));--> statement-breakpoint
CREATE POLICY "api_apps_insert_own_team" ON "api_apps" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "api_apps_select_own_team" ON "api_apps" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "api_apps_update_own_team" ON "api_apps" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "broadcast_destination_rules_delete_own_team" ON "broadcast_destination_rules" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (broadcast_destination_rule_groups g
     JOIN workspace_broadcast_destinations d ON ((d.id = g.destination_id)))
  WHERE ((g.id = broadcast_destination_rules.rule_group_id) AND is_workspace_admin(d.workspace_id)))));--> statement-breakpoint
CREATE POLICY "broadcast_destination_rules_insert_own_team" ON "broadcast_destination_rules" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "broadcast_destination_rules_select_own_team" ON "broadcast_destination_rules" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "broadcast_destination_rules_update_own_team" ON "broadcast_destination_rules" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_webhook_endpoints_insert_workspace_admins" ON "gateway_webhook_endpoints" AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "gateway_webhook_endpoints_select_workspace_members" ON "gateway_webhook_endpoints" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "gateway_webhook_endpoints_update_workspace_admins" ON "gateway_webhook_endpoints" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "keys_delete_own_team" ON "keys" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "keys_insert_own_team" ON "keys" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "keys_select_own_team" ON "keys" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "keys_update_own_team" ON "keys" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "management_keys_delete_own_team" ON "management_keys" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "management_keys_insert_own_team" ON "management_keys" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "management_keys_select_own_team" ON "management_keys" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "management_keys_update_own_team" ON "management_keys" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "monitor_history_commits" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "monitor_history_events" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "monitor_history_sync_state" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "oauth_app_metadata_delete_own_team" ON "oauth_app_metadata" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_member(workspace_id));--> statement-breakpoint
CREATE POLICY "oauth_app_metadata_insert_own_team" ON "oauth_app_metadata" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "oauth_app_metadata_select_own_team" ON "oauth_app_metadata" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "oauth_app_metadata_update_own_team" ON "oauth_app_metadata" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "oauth_authorization_codes" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_feedback_all_service" ON "gateway_feedback" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_feedback_select_workspace" ON "gateway_feedback" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "oauth_authorizations_delete_own" ON "oauth_authorizations" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));--> statement-breakpoint
CREATE POLICY "oauth_authorizations_select_authorized" ON "oauth_authorizations" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "oauth_authorizations_update_own" ON "oauth_authorizations" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "oauth_clients" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "oauth_device_codes" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "oauth_refresh_tokens" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "otel_export_outbox" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "preset_versions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "presets_delete_owned" ON "presets" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((created_by = ( SELECT auth.uid() AS uid)));--> statement-breakpoint
CREATE POLICY "presets_insert_owned" ON "presets" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "presets_select_public_anon" ON "presets" AS PERMISSIVE FOR SELECT TO "anon";--> statement-breakpoint
CREATE POLICY "presets_select_visible" ON "presets" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "presets_update_owned" ON "presets" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "request_classifications" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "security_key_reports" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON "updates" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "users: delete self" ON "users" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));--> statement-breakpoint
CREATE POLICY "users: insert self" ON "users" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "users_select_authorized_context" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "users_update_self" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_adapter_primitives" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_analytics_outbox" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_benchmark_results_public_select" ON "v2_benchmark_results" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "v2_benchmarks_public_select" ON "v2_benchmarks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_capability_adapters" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_capability_constraints" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_capability_evidence" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_catalogue_admin_changes" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_catalogue_backfill_issues" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_control_plane_releases" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_credit_reservations_workspace_select" ON "v2_credit_reservations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (( SELECT is_workspace_member(v2_credit_reservations.workspace_id) AS is_workspace_member));--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_execution_plans" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_labs_public_select" ON "v2_labs" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((status <> 'disabled'::text));--> statement-breakpoint
CREATE POLICY "v2_meter_definitions_public_select" ON "v2_meter_definitions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((status <> 'disabled'::text));--> statement-breakpoint
CREATE POLICY "v2_model_aliases_public_select" ON "v2_model_aliases" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((enabled = true) AND ((effective_from IS NULL) OR (effective_from <= now())) AND ((effective_to IS NULL) OR (effective_to > now()))));--> statement-breakpoint
CREATE POLICY "v2_model_families_public_select" ON "v2_model_families" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "v2_model_page_notices_public_select" ON "v2_model_page_notices" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "v2_model_provider_routes_public_select" ON "v2_model_provider_routes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((status <> 'disabled'::text) AND ((effective_from IS NULL) OR (effective_from <= now())) AND ((effective_to IS NULL) OR (effective_to > now()))));--> statement-breakpoint
CREATE POLICY "v2_pricing_sku_meters_public_select" ON "v2_pricing_sku_meters" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_pricing_skus sku
  WHERE ((sku.sku_id = v2_pricing_sku_meters.sku_id) AND (sku.status <> 'disabled'::text) AND (sku.effective_from <= now()) AND ((sku.effective_to IS NULL) OR (sku.effective_to > now()))))));--> statement-breakpoint
CREATE POLICY "v2_pricing_skus_public_select" ON "v2_pricing_skus" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((status <> 'disabled'::text) AND (effective_from <= now()) AND ((effective_to IS NULL) OR (effective_to > now()))));--> statement-breakpoint
CREATE POLICY "v2_private_usage_daily_workspace_select" ON "v2_private_usage_daily" AS PERMISSIVE FOR SELECT TO "authenticated" USING (( SELECT is_workspace_member(v2_private_usage_daily.workspace_id) AS is_workspace_member));--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_provider_auth_profiles" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_provider_capability_adapters" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_provider_country_restrictions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_provider_endpoints" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_provider_regions_public_select" ON "v2_provider_regions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((status <> 'disabled'::text) AND (routing_enabled = true)));--> statement-breakpoint
CREATE POLICY "v2_providers_public_select" ON "v2_providers" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((status <> 'disabled'::text));--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "model_discovery_runs" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_route_variants_public_select" ON "v2_route_variants" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((status <> 'disabled'::text) AND (routing_enabled = true)));--> statement-breakpoint
CREATE POLICY "v2_service_tiers_public_select" ON "v2_service_tiers" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((status <> 'disabled'::text));--> statement-breakpoint
CREATE POLICY "v2_subscription_plans_public_select" ON "v2_subscription_plans" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "wallets: insert by owner once" ON "wallets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_team_owner(workspace_id) AND (NOT (EXISTS ( SELECT 1
   FROM wallets w
  WHERE (w.workspace_id = wallets.workspace_id))))));--> statement-breakpoint
CREATE POLICY "wallets: update settings if owner" ON "wallets" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "wallets_select_own_team" ON "wallets" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "web_cache_generations" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "web_cache_purge_events" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "team_broadcast_destinations_delete_own_team" ON "workspace_broadcast_destinations" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "team_broadcast_destinations_insert_own_team" ON "workspace_broadcast_destinations" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_broadcast_destinations_update_own_team" ON "workspace_broadcast_destinations" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "workspace_broadcast_destinations_select_own_workspace" ON "workspace_broadcast_destinations" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "workspace_classifiers" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "team_guardrails_delete_own_team" ON "workspace_guardrails" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "team_guardrails_insert_own_team" ON "workspace_guardrails" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_guardrails_select_own_team" ON "workspace_guardrails" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_guardrails_update_own_team" ON "workspace_guardrails" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_invites_delete_own_team" ON "workspace_invites" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "team_invites_insert_own_team" ON "workspace_invites" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_invites_select_own_team" ON "workspace_invites" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_invites_update_own_team" ON "workspace_invites" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "join_requests: delete by owner" ON "workspace_join_requests" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_team_owner(workspace_id));--> statement-breakpoint
CREATE POLICY "team_join_requests_insert" ON "workspace_join_requests" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_join_requests_select" ON "workspace_join_requests" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_join_requests_update" ON "workspace_join_requests" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "v2_credit_ledger_workspace_select" ON "v2_credit_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING (( SELECT is_workspace_member(v2_credit_ledger.workspace_id) AS is_workspace_member));--> statement-breakpoint
CREATE POLICY "v2_public_usage_daily_public_select" ON "v2_public_usage_daily" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((app_id IS NULL) OR ( SELECT is_public_api_app(v2_public_usage_daily.app_id) AS is_public_api_app)));--> statement-breakpoint
CREATE POLICY "v2_public_usage_hourly_public_select" ON "v2_public_usage_hourly" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((app_id IS NULL) OR ( SELECT is_public_api_app(v2_public_usage_hourly.app_id) AS is_public_api_app)));--> statement-breakpoint
CREATE POLICY "v2_request_artifacts_workspace_select" ON "v2_request_artifacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_request_facts request
  WHERE ((request.request_event_id = v2_request_artifacts.request_event_id) AND ( SELECT is_workspace_member(request.workspace_id) AS is_workspace_member)))));--> statement-breakpoint
CREATE POLICY "v2_request_attempts_workspace_select" ON "v2_request_attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_request_facts request
  WHERE ((request.request_event_id = v2_request_attempts.request_event_id) AND ( SELECT is_workspace_member(request.workspace_id) AS is_workspace_member)))));--> statement-breakpoint
CREATE POLICY "v2_request_facts_workspace_select" ON "v2_request_facts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (( SELECT is_workspace_member(v2_request_facts.workspace_id) AS is_workspace_member));--> statement-breakpoint
CREATE POLICY "v2_request_feedback_workspace_select" ON "v2_request_feedback" AS PERMISSIVE FOR SELECT TO "authenticated" USING (( SELECT is_workspace_member(v2_request_feedback.workspace_id) AS is_workspace_member));--> statement-breakpoint
CREATE POLICY "v2_request_pricing_lines_workspace_select" ON "v2_request_pricing_lines" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_request_facts request
  WHERE ((request.request_event_id = v2_request_pricing_lines.request_event_id) AND ( SELECT is_workspace_member(request.workspace_id) AS is_workspace_member)))));--> statement-breakpoint
CREATE POLICY "v2_request_routing_decisions_workspace_select" ON "v2_request_routing_decisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_request_facts request
  WHERE ((request.request_event_id = v2_request_routing_decisions.request_event_id) AND ( SELECT is_workspace_member(request.workspace_id) AS is_workspace_member)))));--> statement-breakpoint
CREATE POLICY "v2_request_usage_workspace_select" ON "v2_request_usage" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_request_facts request
  WHERE ((request.request_event_id = v2_request_usage.request_event_id) AND ( SELECT is_workspace_member(request.workspace_id) AS is_workspace_member)))));--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "account_guardrail_settings" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "broadcast_destination_rule_groups_delete_own_team" ON "broadcast_destination_rule_groups" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM workspace_broadcast_destinations d
  WHERE ((d.id = broadcast_destination_rule_groups.destination_id) AND is_workspace_admin(d.workspace_id)))));--> statement-breakpoint
CREATE POLICY "broadcast_destination_rule_groups_insert_own_team" ON "broadcast_destination_rule_groups" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "broadcast_destination_rule_groups_select_own_team" ON "broadcast_destination_rule_groups" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "broadcast_destination_rule_groups_update_own_team" ON "broadcast_destination_rule_groups" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "workspace_publisher_handle_aliases" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "team_settings_insert_own_team" ON "workspace_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "team_settings_select_own_team" ON "workspace_settings" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_settings_update_own_team" ON "workspace_settings" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "teams: delete if owner" ON "workspaces" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_team_owner(id));--> statement-breakpoint
CREATE POLICY "teams: insert self-owned" ON "workspaces" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "teams_select_own_team" ON "workspaces" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "teams_update_member" ON "workspaces" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "key_guardrails_delete_own_team" ON "key_guardrails" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (keys k
     JOIN workspace_guardrails g ON ((g.id = key_guardrails.guardrail_id)))
  WHERE ((k.id = key_guardrails.key_id) AND (k.workspace_id = g.workspace_id) AND is_workspace_admin(k.workspace_id)))));--> statement-breakpoint
CREATE POLICY "key_guardrails_insert_own_team" ON "key_guardrails" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "key_guardrails_select_own_team" ON "key_guardrails" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "key_guardrails_update_own_team" ON "key_guardrails" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "preset_lineage" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_keys_workspace_delete" ON "gateway_dynamic_route_keys" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM gateway_dynamic_routes route
  WHERE ((route.id = gateway_dynamic_route_keys.route_id) AND ( SELECT is_workspace_admin(route.workspace_id) AS is_workspace_admin)))));--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_keys_workspace_insert" ON "gateway_dynamic_route_keys" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_keys_workspace_select" ON "gateway_dynamic_route_keys" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "gateway_dynamic_route_keys_workspace_update" ON "gateway_dynamic_route_keys" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "model_discovery_hf_seen_models" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_capability_parameters" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "broadcast_destination_keys_delete_own_team" ON "broadcast_destination_keys" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM workspace_broadcast_destinations d
  WHERE ((d.id = broadcast_destination_keys.destination_id) AND is_workspace_admin(d.workspace_id)))));--> statement-breakpoint
CREATE POLICY "broadcast_destination_keys_insert_own_team" ON "broadcast_destination_keys" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "broadcast_destination_keys_select_own_team" ON "broadcast_destination_keys" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "broadcast_destination_keys_update_own_team" ON "broadcast_destination_keys" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "workspace_member_guardrails_delete_admin" ON "workspace_member_guardrails" AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = workspace_member_guardrails.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)) AND (wm.role = ANY (ARRAY['owner'::workspace_role, 'admin'::workspace_role]))))));--> statement-breakpoint
CREATE POLICY "workspace_member_guardrails_insert_admin" ON "workspace_member_guardrails" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "workspace_member_guardrails_select_own_workspace" ON "workspace_member_guardrails" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "team_members_insert_admin" ON "workspace_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_workspace_admin(workspace_id));--> statement-breakpoint
CREATE POLICY "team_members_select_own_team" ON "workspace_members" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "team_members_update_admin" ON "workspace_members" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "workspace_members_delete_authorized" ON "workspace_members" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "v2_subscription_plan_features_public_select" ON "v2_subscription_plan_features" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "v2_lab_links_public_select" ON "v2_lab_links" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "v2_subscription_plan_models_public_select" ON "v2_subscription_plan_models" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "workspace_byok_monthly_usage" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_catalogue_source_overrides" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_model_details_public_select" ON "v2_model_details" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_batch_file_uploads" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "public_model_user_usage_daily" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_model_links_public_select" ON "v2_model_links" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "v2_private_usage_daily_meters_workspace_select" ON "v2_private_usage_daily_meters" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_private_usage_daily rollup
  WHERE ((rollup.rollup_id = v2_private_usage_daily_meters.rollup_id) AND ( SELECT is_workspace_member(rollup.workspace_id) AS is_workspace_member)))));--> statement-breakpoint
CREATE POLICY "v2_public_usage_daily_meters_public_select" ON "v2_public_usage_daily_meters" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_public_usage_daily rollup
  WHERE (rollup.rollup_id = v2_public_usage_daily_meters.rollup_id))));--> statement-breakpoint
CREATE POLICY "v2_public_usage_hourly_meters_public_select" ON "v2_public_usage_hourly_meters" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((EXISTS ( SELECT 1
   FROM v2_public_usage_hourly rollup
  WHERE (rollup.rollup_id = v2_public_usage_hourly_meters.rollup_id))));--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_rollup_refresh_state" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "v2_route_parameter_support" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_request_charges" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "model_discovery_seen_models" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "catalogue_game_results" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_provider_health_states" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "model_discovery_issue_signals" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "public_model_task_daily_cohort_read" ON "public_model_task_daily" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((workspace_count >= 5) AND (request_count >= 100)));--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "request_classification_daily" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_batch_key_usage_records" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "v2_route_capabilities_public_select" ON "v2_route_capabilities" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((status <> 'disabled'::text));--> statement-breakpoint
CREATE POLICY "v2_public_provider_health_daily_public_select" ON "v2_public_provider_health_daily" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_async_webhook_deliveries" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gateway_wallet_reservations_select_own_team" ON "gateway_wallet_reservations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_workspace_member(workspace_id));--> statement-breakpoint
CREATE POLICY "gateway_wallet_reservations_service_all" ON "gateway_wallet_reservations" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_upstream_requests_2026_07" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_upstream_requests_2026_08" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_upstream_requests_2026_09" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_upstream_requests_default" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_2026_03" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_2026_04" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_2026_05" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_2026_06" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_2026_07" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_2026_08" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_2026_09" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "gateway_requests_default" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
*/