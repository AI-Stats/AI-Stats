import {
	keys,
	oauthAuthorizationCodes,
	oauthAppMetadata,
	oauthAuthorizations,
	oauthClients,
	oauthDeviceCodes,
	oauthRefreshTokens,
	workspaceMembers,
} from "@phaseo/db/schema";
import { and, eq, inArray, isNull, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try {
		return await operation(db);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export type StoredOAuthClient = {
	id: string;
	name: string;
	description: string | null;
	logoUrl: string | null;
	homepageUrl: string | null;
	clientType: string;
	clientSecretHash: string | null;
	redirectUris: string[];
	allowedScopes: string[];
	isFirstParty: boolean;
	betaStatus: string;
	status: string;
};

export type OAuthAppRecord = {
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
	client_type: string;
	client_secret_hash: string | null;
	allowed_scopes: string[];
	is_first_party: boolean;
	beta_status: string;
};

export async function cleanupExpiredOAuthArtifacts(): Promise<void> {
	await withDatabase((db) => db.transaction(async (tx) => {
		await tx.delete(oauthAuthorizationCodes)
			.where(sql`${oauthAuthorizationCodes.expiresAt} < now() - interval '1 hour'`);
		await tx.delete(oauthDeviceCodes)
			.where(sql`${oauthDeviceCodes.expiresAt} < now() - interval '1 hour'`);
		await tx.execute(sql`
			delete from gateway.oauth_refresh_tokens token
			where token.expires_at < now() - interval '1 day'
				and not exists (
					select 1 from gateway.oauth_refresh_tokens child
					where child.rotated_from = token.id
				)
		`);
	}));
}

function toOAuthAppRecord(row: typeof oauthAppMetadata.$inferSelect): OAuthAppRecord {
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

export async function resolveWorkspaceOwnerUserId(workspaceId: string): Promise<string | null> {
	return withDatabase(async (db) => {
		const row = await db.query.workspaces.findFirst({
			columns: { ownerUserId: true },
			where: (workspace, { eq }) => eq(workspace.id, workspaceId),
		});
		return row?.ownerUserId ?? null;
	});
}

export async function createOAuthAppMetadata(input: typeof oauthAppMetadata.$inferInsert): Promise<OAuthAppRecord> {
	return withDatabase(async (db) => {
		const [row] = await db.insert(oauthAppMetadata).values(input).returning();
		return toOAuthAppRecord(row);
	});
}

type OAuthAppStats = {
	active_authorizations: number;
	total_authorizations: number;
	last_used_at: string | null;
	requests_last_30d: number;
};

async function loadOAuthAppStats(db: ReturnType<typeof createDatabase>["db"], clientIds: string[]): Promise<Map<string, OAuthAppStats>> {
	const stats = new Map(clientIds.map((clientId) => [clientId, {
		active_authorizations: 0,
		total_authorizations: 0,
		last_used_at: null,
		requests_last_30d: 0,
	}]));
	if (!clientIds.length) return stats;
	const authorizationRows = await db.select({
		clientId: oauthAuthorizations.clientId,
		revokedAt: oauthAuthorizations.revokedAt,
		lastUsedAt: oauthAuthorizations.lastUsedAt,
	}).from(oauthAuthorizations).where(inArray(oauthAuthorizations.clientId, clientIds));
	for (const row of authorizationRows) {
		const value = stats.get(row.clientId);
		if (!value) continue;
		value.total_authorizations += 1;
		if (row.revokedAt === null) value.active_authorizations += 1;
		if (row.lastUsedAt && (!value.last_used_at || row.lastUsedAt > value.last_used_at)) value.last_used_at = row.lastUsedAt;
	}
	const clientIdValues = sql.join(clientIds.map((clientId) => sql`${clientId}`), sql`, `);
	const requestRows = await db.execute<{ oauth_client_id: string; request_count: number }>(sql`
		select oauth_client_id, count(*)::int as request_count
		from observability.gateway_requests
		where oauth_client_id in (${clientIdValues}) and created_at >= now() - interval '30 days'
		group by oauth_client_id
	`);
	for (const row of requestRows) {
		const value = stats.get(row.oauth_client_id);
		if (value) value.requests_last_30d = Number(row.request_count);
	}
	return stats;
}

export async function listOAuthAppsWithStats(workspaceId: string): Promise<Array<OAuthAppRecord & OAuthAppStats>> {
	return withDatabase(async (db) => {
		const rows = await db.query.oauthAppMetadata.findMany({
			where: (app, { and, eq }) => and(eq(app.workspaceId, workspaceId), eq(app.status, "active")),
			orderBy: (app, { desc }) => [desc(app.createdAt)],
		});
		const stats = await loadOAuthAppStats(db, rows.map((row) => row.clientId));
		return rows.map((row) => ({ ...toOAuthAppRecord(row), ...stats.get(row.clientId)! }));
	});
}

export async function findOAuthAppWithStats(clientId: string, workspaceId: string): Promise<(OAuthAppRecord & OAuthAppStats) | null> {
	return withDatabase(async (db) => {
		const row = await db.query.oauthAppMetadata.findFirst({
			where: (app, { and, eq }) => and(eq(app.clientId, clientId), eq(app.workspaceId, workspaceId), eq(app.status, "active")),
		});
		if (!row) return null;
		const stats = await loadOAuthAppStats(db, [clientId]);
		return { ...toOAuthAppRecord(row), ...stats.get(clientId)! };
	});
}

export async function findOwnedOAuthApp(clientId: string, workspaceId: string): Promise<OAuthAppRecord | null> {
	return withDatabase(async (db) => {
		const row = await db.query.oauthAppMetadata.findFirst({
			where: (app, { and, eq }) => and(eq(app.clientId, clientId), eq(app.workspaceId, workspaceId)),
		});
		return row ? toOAuthAppRecord(row) : null;
	});
}

export async function updateOAuthAppMetadata(
	clientId: string,
	workspaceId: string,
	updates: Partial<typeof oauthAppMetadata.$inferInsert>,
): Promise<OAuthAppRecord | null> {
	return withDatabase(async (db) => {
		const [row] = await db.update(oauthAppMetadata).set({ ...updates, updatedAt: new Date().toISOString() })
			.where(and(eq(oauthAppMetadata.clientId, clientId), eq(oauthAppMetadata.workspaceId, workspaceId)))
			.returning();
		return row ? toOAuthAppRecord(row) : null;
	});
}

export async function deleteOAuthAppAndRevokeAuthorizations(clientId: string, workspaceId: string): Promise<boolean> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const [owned] = await tx.select({ id: oauthAppMetadata.id }).from(oauthAppMetadata)
			.where(and(eq(oauthAppMetadata.clientId, clientId), eq(oauthAppMetadata.workspaceId, workspaceId)))
			.limit(1);
		if (!owned) return false;
		await tx.update(oauthAuthorizations).set({ revokedAt: new Date().toISOString() })
			.where(and(eq(oauthAuthorizations.clientId, clientId), isNull(oauthAuthorizations.revokedAt)));
		await tx.delete(oauthAppMetadata).where(eq(oauthAppMetadata.id, owned.id));
		return true;
	}));
}

export async function findActiveOAuthClient(clientId: string): Promise<StoredOAuthClient | null> {
	return withDatabase(async (db) => {
		const firstParty = await db.query.oauthClients.findFirst({
			where: (client, { and, eq }) => and(eq(client.id, clientId), eq(client.status, "active")),
		});
		if (firstParty) return firstParty;
		const app = await db.query.oauthAppMetadata.findFirst({
			where: (metadata, { and, eq }) => and(eq(metadata.clientId, clientId), eq(metadata.status, "active")),
		});
		return app ? { id: app.clientId, ...app } : null;
	});
}

export async function createOAuthClient(input: typeof oauthClients.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(oauthClients).values(input); });
}

export async function createOAuthDeviceCode(input: typeof oauthDeviceCodes.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(oauthDeviceCodes).values(input); });
}

export async function findWorkspaceMemberships(userId: string, workspaceIds: string[]): Promise<string[]> {
	if (!workspaceIds.length) return [];
	return withDatabase(async (db) => {
		const rows = await db.select({ workspaceId: workspaceMembers.workspaceId })
			.from(workspaceMembers)
			.where(and(eq(workspaceMembers.userId, userId), inArray(workspaceMembers.workspaceId, workspaceIds)));
		return rows.map((row) => row.workspaceId);
	});
}

export async function hasWorkspaceMembership(userId: string, workspaceId: string): Promise<boolean> {
	return withDatabase(async (db) => Boolean(await db.query.workspaceMembers.findFirst({
		columns: { workspaceId: true },
		where: (row, { and, eq }) => and(eq(row.userId, userId), eq(row.workspaceId, workspaceId)),
	})));
}

export async function createOAuthAuthorizationCode(input: typeof oauthAuthorizationCodes.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(oauthAuthorizationCodes).values(input); });
}

export async function findOAuthDeviceByUserCode(userCodeHashes: string[]) {
	return withDatabase((db) => db.query.oauthDeviceCodes.findFirst({
		where: (row, { inArray }) => inArray(row.userCodeHash, userCodeHashes),
	}));
}

export async function findOAuthDeviceByDeviceCode(deviceCodeHashes: string[], clientId: string) {
	return withDatabase((db) => db.query.oauthDeviceCodes.findFirst({
		where: (row, { and, eq, inArray }) => and(inArray(row.deviceCodeHash, deviceCodeHashes), eq(row.clientId, clientId)),
	}));
}

export async function transitionPendingOAuthDevice(
	id: string,
	values: Partial<Pick<typeof oauthDeviceCodes.$inferInsert, "status" | "deniedAt" | "approvedAt" | "userId" | "workspaceId">>,
): Promise<boolean> {
	return withDatabase(async (db) => {
		const [row] = await db.update(oauthDeviceCodes).set(values)
			.where(and(eq(oauthDeviceCodes.id, id), eq(oauthDeviceCodes.status, "pending")))
			.returning({ id: oauthDeviceCodes.id });
		return Boolean(row);
	});
}

export async function findOAuthAuthorizationCode(codeHashes: string[], clientId: string) {
	return withDatabase((db) => db.query.oauthAuthorizationCodes.findFirst({
		where: (row, { and, eq, inArray }) => and(inArray(row.codeHash, codeHashes), eq(row.clientId, clientId)),
	}));
}

export async function enforceOAuthDevicePollInterval(deviceId: string): Promise<"ok" | "slow_down" | "invalid"> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const rows = await tx.execute<{ last_polled_at: string | null; interval_seconds: number }>(sql`
			select last_polled_at, interval_seconds
			from gateway.oauth_device_codes
			where id = ${deviceId}
			for update
		`);
		const device = rows[0];
		if (!device) return "invalid";
		const now = new Date();
		const tooSoon = device.last_polled_at !== null
			&& Date.parse(device.last_polled_at) + device.interval_seconds * 1_000 > now.getTime();
		await tx.update(oauthDeviceCodes).set({
			lastPolledAt: now.toISOString(),
			...(tooSoon ? { intervalSeconds: device.interval_seconds + 5 } : {}),
		}).where(eq(oauthDeviceCodes.id, deviceId));
		return tooSoon ? "slow_down" : "ok";
	}));
}

export async function consumeOAuthGrantAndIssueRefreshToken(input: {
	grantType: "device_code" | "authorization_code";
	grantId: string;
	tokenHash: string;
	userId: string;
	workspaceId: string;
	clientId: string;
	scopes: string[];
	expiresAt: string;
	familyId: string;
}): Promise<"issued" | "invalid"> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const membership = await tx.execute<{ workspace_id: string }>(sql`
			select workspace_id from app.workspace_members
			where user_id = ${input.userId} and workspace_id = ${input.workspaceId}
			for key share
		`);
		if (!membership.length) return "invalid";
		const authorization = await tx.execute<{ id: string }>(sql`
			select id from gateway.oauth_authorizations
			where user_id = ${input.userId} and workspace_id = ${input.workspaceId}
				and client_id = ${input.clientId} and revoked_at is null
			for update
		`);
		if (!authorization.length) return "invalid";

		const now = new Date().toISOString();
		let consumed: Array<{ id: string }>;
		if (input.grantType === "device_code") {
			consumed = await tx.update(oauthDeviceCodes).set({ consumedAt: now }).where(and(
				eq(oauthDeviceCodes.id, input.grantId),
				isNull(oauthDeviceCodes.consumedAt),
				eq(oauthDeviceCodes.status, "approved"),
				eq(oauthDeviceCodes.userId, input.userId),
				eq(oauthDeviceCodes.workspaceId, input.workspaceId),
				eq(oauthDeviceCodes.clientId, input.clientId),
				sql`${oauthDeviceCodes.expiresAt} > now()`,
			)).returning({ id: oauthDeviceCodes.id });
		} else {
			consumed = await tx.update(oauthAuthorizationCodes).set({ usedAt: now }).where(and(
				eq(oauthAuthorizationCodes.id, input.grantId),
				isNull(oauthAuthorizationCodes.usedAt),
				eq(oauthAuthorizationCodes.userId, input.userId),
				eq(oauthAuthorizationCodes.workspaceId, input.workspaceId),
				eq(oauthAuthorizationCodes.clientId, input.clientId),
				sql`${oauthAuthorizationCodes.expiresAt} > now()`,
			)).returning({ id: oauthAuthorizationCodes.id });
		}
		if (!consumed.length) return "invalid";
		await tx.insert(oauthRefreshTokens).values({
			tokenHash: input.tokenHash,
			userId: input.userId,
			workspaceId: input.workspaceId,
			clientId: input.clientId,
			scopes: input.scopes,
			expiresAt: input.expiresAt,
			familyId: input.familyId,
		});
		return "issued";
	}));
}

export async function rotateOAuthRefreshToken(input: {
	currentTokenHash: string;
	nextTokenHash: string;
	nextExpiresAt: string;
}): Promise<"rotated" | "reused" | "invalid"> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const identities = await tx.execute<{
			id: string;
			user_id: string;
			workspace_id: string;
			client_id: string;
		}>(sql`
			select id, user_id, workspace_id, client_id
			from gateway.oauth_refresh_tokens where token_hash = ${input.currentTokenHash}
		`);
		const identity = identities[0];
		if (!identity) return "invalid";

		const membership = await tx.execute<{ workspace_id: string }>(sql`
			select workspace_id from app.workspace_members
			where user_id = ${identity.user_id} and workspace_id = ${identity.workspace_id}
			for key share
		`);
		if (!membership.length) return "invalid";
		const authorizations = await tx.execute<{ scopes: string[] }>(sql`
			select scopes from gateway.oauth_authorizations
			where user_id = ${identity.user_id} and workspace_id = ${identity.workspace_id}
				and client_id = ${identity.client_id} and revoked_at is null
			for update
		`);
		const authorization = authorizations[0];
		if (!authorization) return "invalid";

		const tokens = await tx.execute<{
			id: string;
			user_id: string;
			workspace_id: string;
			client_id: string;
			expires_at: string | null;
			revoked_at: string | null;
			family_id: string;
		}>(sql`
			select id, user_id, workspace_id, client_id, expires_at, revoked_at, family_id
			from gateway.oauth_refresh_tokens where token_hash = ${input.currentTokenHash}
			for update
		`);
		const current = tokens[0];
		if (!current || current.user_id !== identity.user_id || current.workspace_id !== identity.workspace_id || current.client_id !== identity.client_id) {
			return "invalid";
		}
		const now = new Date().toISOString();
		if (current.revoked_at) {
			await tx.update(oauthRefreshTokens).set({ revokedAt: now })
				.where(and(eq(oauthRefreshTokens.familyId, current.family_id), isNull(oauthRefreshTokens.revokedAt)));
			return "reused";
		}
		if (current.expires_at && Date.parse(current.expires_at) <= Date.now()) {
			await tx.update(oauthRefreshTokens).set({ revokedAt: now }).where(eq(oauthRefreshTokens.id, current.id));
			return "invalid";
		}
		await tx.update(oauthRefreshTokens).set({ revokedAt: now, lastUsedAt: now }).where(eq(oauthRefreshTokens.id, current.id));
		await tx.insert(oauthRefreshTokens).values({
			tokenHash: input.nextTokenHash,
			userId: current.user_id,
			workspaceId: current.workspace_id,
			clientId: current.client_id,
			scopes: authorization.scopes,
			expiresAt: input.nextExpiresAt,
			rotatedFrom: current.id,
			familyId: current.family_id,
		});
		return "rotated";
	}));
}

function containsAll(values: string[], required: string[]): boolean {
	const available = new Set(values);
	return required.every((value) => available.has(value));
}

export async function consumeOAuthCodeAndIssueDelegatedKey(input: {
	codeId: string;
	keyHash: string;
	keyKid: string;
	keyPrefix: string;
	keyName: string;
	userId: string;
	workspaceId: string;
	clientId: string;
	scopes: string[];
	resource: string | null;
}): Promise<"issued" | "invalid"> {
	const resource = input.resource?.trim() || null;
	const isGatewayResource = resource !== null && /^https:\/\/api\.phaseo\.app(?::443)?\/v1\/*$/i.test(resource);
	if ((!resource || isGatewayResource) && !input.scopes.includes("gateway:access")) return "invalid";

	return withDatabase((db) => db.transaction(async (tx) => {
		const membership = await tx.execute<{ workspace_id: string }>(sql`
			select workspace_id from app.workspace_members
			where user_id = ${input.userId} and workspace_id = ${input.workspaceId}
			for key share
		`);
		if (!membership.length) return "invalid";
		const authorizations = await tx.execute<{ scopes: string[] }>(sql`
			select scopes from gateway.oauth_authorizations
			where user_id = ${input.userId} and workspace_id = ${input.workspaceId}
				and client_id = ${input.clientId} and revoked_at is null
			for update
		`);
		const authorization = authorizations[0];
		if (!authorization || !containsAll(authorization.scopes, input.scopes)) return "invalid";
		if ((!resource || isGatewayResource) && !authorization.scopes.includes("gateway:access")) return "invalid";

		const codes = await tx.execute<{ id: string; scopes: string[]; resource: string | null }>(sql`
			select id, scopes, resource from gateway.oauth_authorization_codes
			where id = ${input.codeId} and used_at is null and expires_at > now()
				and user_id = ${input.userId} and workspace_id = ${input.workspaceId}
				and client_id = ${input.clientId}
			for update
		`);
		const code = codes[0];
		if (!code || (code.resource?.trim() || null) !== resource) return "invalid";
		if (!containsAll(code.scopes, input.scopes) || !containsAll(input.scopes, code.scopes)) return "invalid";
		if ((!resource || isGatewayResource) && !code.scopes.includes("gateway:access")) return "invalid";

		const [consumed] = await tx.update(oauthAuthorizationCodes).set({ usedAt: new Date().toISOString() })
			.where(and(eq(oauthAuthorizationCodes.id, code.id), isNull(oauthAuthorizationCodes.usedAt)))
			.returning({ id: oauthAuthorizationCodes.id });
		if (!consumed) return "invalid";

		await tx.execute(sql`
			update gateway.keys set status = 'revoked'
			where key_kind = 'oauth_delegated' and oauth_user_id = ${input.userId}
				and workspace_id = ${input.workspaceId} and oauth_client_id = ${input.clientId}
				and oauth_resource is not distinct from ${resource} and status = 'active'
		`);
		await tx.insert(keys).values({
			workspaceId: input.workspaceId,
			name: input.keyName,
			hash: input.keyHash,
			prefix: input.keyPrefix,
			status: "active",
			scopes: "[]",
			createdBy: input.userId,
			kid: input.keyKid,
			keyKind: "oauth_delegated",
			oauthClientId: input.clientId,
			oauthUserId: input.userId,
			oauthScopes: code.scopes,
			oauthResource: code.resource,
			issuedVia: "oauth_pkce",
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
		});
		return "issued";
	}));
}

export async function upsertOAuthAuthorization(input: {
	userId: string;
	workspaceId: string;
	clientId: string;
	scopes: string[];
}): Promise<void> {
	await withDatabase(async (db) => {
		await db.insert(oauthAuthorizations).values(input).onConflictDoUpdate({
			target: [oauthAuthorizations.clientId, oauthAuthorizations.userId, oauthAuthorizations.workspaceId],
			set: { scopes: input.scopes, revokedAt: null },
		});
	});
}

export async function findActiveAuthorizationWithMembership(input: {
	userId: string;
	workspaceId: string;
	clientId: string;
}): Promise<{ scopes: string[] } | null> {
	return withDatabase(async (db) => {
		const [authorization, membership] = await Promise.all([
			db.query.oauthAuthorizations.findFirst({
				columns: { scopes: true },
				where: (row, { and, eq, isNull }) => and(
					eq(row.userId, input.userId),
					eq(row.workspaceId, input.workspaceId),
					eq(row.clientId, input.clientId),
					isNull(row.revokedAt),
				),
			}),
			db.query.workspaceMembers.findFirst({
				columns: { workspaceId: true },
				where: (row, { and, eq }) => and(eq(row.userId, input.userId), eq(row.workspaceId, input.workspaceId)),
			}),
		]);
		return authorization && membership ? { scopes: authorization.scopes } : null;
	});
}

export async function touchOAuthAuthorization(input: {
	userId: string;
	workspaceId: string;
	clientId: string;
}): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(oauthAuthorizations)
			.set({ lastUsedAt: new Date().toISOString() })
			.where(and(
				eq(oauthAuthorizations.userId, input.userId),
				eq(oauthAuthorizations.workspaceId, input.workspaceId),
				eq(oauthAuthorizations.clientId, input.clientId),
				isNull(oauthAuthorizations.revokedAt),
			));
	});
}

export async function insertOAuthRefreshToken(input: typeof oauthRefreshTokens.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(oauthRefreshTokens).values(input); });
}

export async function findOAuthRefreshToken(tokenHashes: string[]) {
	return withDatabase((db) => db.query.oauthRefreshTokens.findFirst({
		where: (token, { inArray }) => inArray(token.tokenHash, tokenHashes),
	}));
}

export async function revokeOAuthRefreshTokens(tokenHashes: string[]): Promise<void> {
	if (!tokenHashes.length) return;
	await withDatabase(async (db) => {
		await db.update(oauthRefreshTokens)
			.set({ revokedAt: new Date().toISOString() })
			.where(and(inArray(oauthRefreshTokens.tokenHash, tokenHashes), isNull(oauthRefreshTokens.revokedAt)));
	});
}

export async function findActiveDelegatedKeyByKid(kid: string) {
	return withDatabase((db) => db.query.keys.findFirst({
		columns: { id: true, hash: true, keyKind: true, status: true },
		where: (key, { and, eq }) => and(eq(key.kid, kid), eq(key.keyKind, "oauth_delegated"), eq(key.status, "active")),
	}));
}

export async function revokeDelegatedKey(id: string): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(keys).set({ status: "revoked" }).where(and(eq(keys.id, id), eq(keys.status, "active"), eq(keys.keyKind, "oauth_delegated")));
	});
}
