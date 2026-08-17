import { gatewaySchema } from "./namespaces";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const oauthAppMetadata = gatewaySchema.table("oauth_app_metadata", {
	id: uuid().primaryKey().notNull(),
	clientId: text("client_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	description: text(),
	homepageUrl: text("homepage_url"),
	logoUrl: text("logo_url"),
	privacyPolicyUrl: text("privacy_policy_url"),
	termsOfServiceUrl: text("terms_of_service_url"),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
	status: text().notNull(),
	redirectUris: text("redirect_uris").array().notNull(),
	clientType: text("client_type").notNull(),
	clientSecretHash: text("client_secret_hash"),
	allowedScopes: text("allowed_scopes").array().notNull(),
	isFirstParty: boolean("is_first_party").notNull(),
	betaStatus: text("beta_status").notNull(),
});

export const oauthAuthorizations = gatewaySchema.table("oauth_authorizations", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
});
