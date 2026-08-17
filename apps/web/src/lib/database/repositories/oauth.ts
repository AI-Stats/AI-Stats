import "server-only";

import { oauthAppMetadata, oauthAuthorizations } from "@phaseo/db/oauth-schema";
import { workspaceMembers, workspaces } from "@phaseo/db/billing-schema";
import { and, eq, inArray } from "@phaseo/db/query";

import { getDatabase } from "../drizzle";

export async function findActiveOAuthAppMetadata(clientId: string) {
	const row = (await getDatabase().select().from(oauthAppMetadata).where(and(
		eq(oauthAppMetadata.clientId, clientId),
		eq(oauthAppMetadata.status, "active"),
	)).limit(1))[0];
	if (!row) return null;
	return {
		id: row.id,
		client_id: row.clientId,
		workspace_id: row.workspaceId,
		name: row.name,
		description: row.description,
		homepage_url: row.homepageUrl,
		logo_url: row.logoUrl,
		privacy_policy_url: row.privacyPolicyUrl,
		terms_of_service_url: row.termsOfServiceUrl,
		created_by: row.createdBy,
		created_at: row.createdAt,
		updated_at: row.updatedAt,
		status: row.status,
		redirect_uris: row.redirectUris,
		client_type: row.clientType,
		client_secret_hash: row.clientSecretHash,
		allowed_scopes: row.allowedScopes,
		is_first_party: row.isFirstParty,
		beta_status: row.betaStatus,
	};
}

export async function listUserWorkspaceIds(userId: string, workspaceIds?: string[]) {
	return (await getDatabase().select({ workspaceId: workspaceMembers.workspaceId })
		.from(workspaceMembers).where(and(
			eq(workspaceMembers.userId, userId),
			workspaceIds?.length ? inArray(workspaceMembers.workspaceId, workspaceIds) : undefined,
		))).map((row) => row.workspaceId);
}

export async function listUserWorkspaces(userId: string) {
	return getDatabase().select({ id: workspaces.id, name: workspaces.name })
		.from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
		.where(eq(workspaceMembers.userId, userId));
}

export async function revokeUserAuthorization(authorizationId: string, userId: string) {
	await getDatabase().update(oauthAuthorizations).set({ revokedAt: new Date().toISOString() }).where(and(
		eq(oauthAuthorizations.id, authorizationId),
		eq(oauthAuthorizations.userId, userId),
	));
}
