import { oauthAppMetadata, oauthAuthorizations, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, isNull, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function findOAuthApp(env: Env, clientId: string) { const {db,client}=createDatabase(env); try { const [row]=await db.select().from(oauthAppMetadata).where(eq(oauthAppMetadata.clientId,clientId)).limit(1); return row??null; } finally {await client.end({timeout:1});} }
export async function createOAuthApp(env: Env, values: typeof oauthAppMetadata.$inferInsert) { const {db,client}=createDatabase(env); try { const [row]=await db.insert(oauthAppMetadata).values(values).returning(); return row; } finally {await client.end({timeout:1});} }
export async function updateOAuthApp(env: Env, clientId: string, workspaceId: string, values: Partial<typeof oauthAppMetadata.$inferInsert>) { const {db,client}=createDatabase(env); try { const [row]=await db.update(oauthAppMetadata).set({...values,updatedAt:new Date().toISOString()}).where(and(eq(oauthAppMetadata.clientId,clientId),eq(oauthAppMetadata.workspaceId,workspaceId))).returning(); return row??null; } finally {await client.end({timeout:1});} }
export async function deleteOAuthApp(env: Env, clientId: string, workspaceId: string) { const {db,client}=createDatabase(env); try { await db.delete(oauthAppMetadata).where(and(eq(oauthAppMetadata.clientId,clientId),eq(oauthAppMetadata.workspaceId,workspaceId))); } finally {await client.end({timeout:1});} }

export async function listUserOAuthAuthorizations(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			id: oauthAuthorizations.id,
			clientId: oauthAuthorizations.clientId,
			workspaceId: oauthAuthorizations.workspaceId,
			scopes: oauthAuthorizations.scopes,
			createdAt: oauthAuthorizations.createdAt,
			lastUsedAt: oauthAuthorizations.lastUsedAt,
			appName: oauthAppMetadata.name,
			appDescription: oauthAppMetadata.description,
			appLogoUrl: oauthAppMetadata.logoUrl,
			appHomepageUrl: oauthAppMetadata.homepageUrl,
			allowedScopes: oauthAppMetadata.allowedScopes,
			workspaceName: workspaces.name,
		}).from(oauthAuthorizations)
			.leftJoin(oauthAppMetadata, eq(oauthAppMetadata.clientId, oauthAuthorizations.clientId))
			.leftJoin(workspaces, eq(workspaces.id, oauthAuthorizations.workspaceId))
			.where(and(eq(oauthAuthorizations.userId, userId), isNull(oauthAuthorizations.revokedAt)))
			.orderBy(desc(oauthAuthorizations.lastUsedAt));
	} finally { await client.end({ timeout: 1 }); }
}

export async function findUserOAuthAuthorization(env: Env, authorizationId: string, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({
			id: oauthAuthorizations.id,
			clientId: oauthAuthorizations.clientId,
			workspaceId: oauthAuthorizations.workspaceId,
			scopes: oauthAuthorizations.scopes,
			createdAt: oauthAuthorizations.createdAt,
			lastUsedAt: oauthAuthorizations.lastUsedAt,
		}).from(oauthAuthorizations).where(and(
			eq(oauthAuthorizations.id, authorizationId),
			eq(oauthAuthorizations.userId, userId),
		)).limit(1);
		return row ?? null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function revokeUserOAuthAuthorization(env: Env, authorizationId: string, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.update(oauthAuthorizations)
			.set({ revokedAt: new Date().toISOString() })
			.where(and(eq(oauthAuthorizations.id, authorizationId), eq(oauthAuthorizations.userId, userId)))
			.returning({ id: oauthAuthorizations.id });
		return Boolean(row);
	} finally { await client.end({ timeout: 1 }); }
}

type OAuthAppSummaryRow = {
	id: string;
	client_id: string;
	workspace_id: string;
	name: string;
	description: string | null;
	homepage_url: string | null;
	logo_url: string | null;
	privacy_policy_url: string | null;
	terms_of_service_url: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
	status: string;
	redirect_uris: string[];
	active_authorizations: number | string;
	total_authorizations: number | string;
	last_used_at: string | null;
	requests_last_30d: number | string;
};

const oauthAppSummarySql = sql`
	select app.id, app.client_id, app.workspace_id, app.name, app.description,
		app.homepage_url, app.logo_url, app.privacy_policy_url, app.terms_of_service_url,
		app.created_by, app.created_at, app.updated_at, app.status, app.redirect_uris,
		(select count(*) from oauth_authorizations authorization
			where authorization.client_id=app.client_id and authorization.revoked_at is null)::integer as active_authorizations,
		(select count(*) from oauth_authorizations authorization
			where authorization.client_id=app.client_id)::integer as total_authorizations,
		(select max(authorization.last_used_at) from oauth_authorizations authorization
			where authorization.client_id=app.client_id) as last_used_at,
		(select count(*) from gateway_requests request
			where request.oauth_client_id=app.client_id and request.auth_method='oauth'
				and request.created_at >= now() - interval '30 days')::integer as requests_last_30d
	from oauth_app_metadata app
`;

export async function listWorkspaceOAuthApps(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.execute<OAuthAppSummaryRow>(sql`${oauthAppSummarySql}
			where app.workspace_id=${workspaceId}::uuid and app.status='active'
			order by app.created_at desc`);
		return [...rows];
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadOAuthAppDetails(env: Env, clientId: string) {
	const { db, client } = createDatabase(env);
	try {
		const apps = await db.execute<OAuthAppSummaryRow>(sql`${oauthAppSummarySql}
			where app.client_id=${clientId} and app.status='active' limit 1`);
		const app = apps[0] ?? null;
		if (!app) return null;
		const [authorizationRows, usageStats, recentRequests, directoryRows] = await Promise.all([
			db.execute<{
				id: string; user_id: string; client_id: string; workspace_id: string; scopes: string[];
				created_at: string; last_used_at: string | null; revoked_at: string | null;
				user_name: string | null; user_email: string | null; workspace_name: string | null;
			}>(sql`select authorization.*, identity.name as user_name, identity.email as user_email,
				workspace.name as workspace_name
				from oauth_authorizations authorization
				left join "user" identity on identity.id=authorization.user_id::text
				left join workspaces workspace on workspace.id=authorization.workspace_id
				where authorization.client_id=${clientId} and authorization.revoked_at is null
				order by authorization.last_used_at desc nulls last limit 10`),
			db.execute<{ created_at: string; success: boolean; cost_nanos: number | string | null }>(sql`
				select created_at, success, cost_nanos from gateway_requests
				where oauth_client_id=${clientId} and auth_method='oauth'
					and created_at >= now() - interval '30 days' order by created_at asc`),
			db.execute<{ request_id: string; created_at: string; oauth_user_id: string | null; endpoint: string; model_id: string | null; provider: string | null; success: boolean; status_code: number | null; error_code: string | null; cost_nanos: number | string | null; latency_ms: number | null }>(sql`
				select request_id, created_at, oauth_user_id, endpoint, model_id, provider, success,
					status_code, error_code, cost_nanos, latency_ms from gateway_requests
				where oauth_client_id=${clientId} and auth_method='oauth'
				order by created_at desc limit 250`),
			db.execute<{ user_id: string; full_name: string | null; email: string | null }>(sql`
				select distinct on (authorization.user_id) authorization.user_id,
					identity.name as full_name, identity.email
				from oauth_authorizations authorization
				left join "user" identity on identity.id=authorization.user_id::text
				where authorization.client_id=${clientId}
				order by authorization.user_id, authorization.last_used_at desc nulls last`),
		]);
		return {
			oauthApp: app,
			authorizations: [...authorizationRows].map((row) => ({
				id: row.id, user_id: row.user_id, client_id: row.client_id, workspace_id: row.workspace_id,
				scopes: row.scopes, created_at: row.created_at, last_used_at: row.last_used_at, revoked_at: row.revoked_at,
				users: { user_id: row.user_id, full_name: row.user_name, email: row.user_email },
				teams: { id: row.workspace_id, name: row.workspace_name },
			})),
			usageStats: [...usageStats],
			recentRequests: [...recentRequests],
			userDirectory: [...directoryRows],
		};
	} finally { await client.end({ timeout: 1 }); }
}
