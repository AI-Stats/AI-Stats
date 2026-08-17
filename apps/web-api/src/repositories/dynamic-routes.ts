import { gatewayDynamicRouteKeys, gatewayDynamicRoutes, gatewayDynamicRouteVersions, keys, v2Providers } from "@phaseo/db/schema";
import { and, asc, desc, eq, inArray, ne, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listDynamicRouteSettings(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [routes, availableKeys, providers] = await Promise.all([
			db.select().from(gatewayDynamicRoutes).where(eq(gatewayDynamicRoutes.workspaceId, workspaceId)).orderBy(desc(gatewayDynamicRoutes.updatedAt)),
			db.select({ id: keys.id, name: keys.name, prefix: keys.prefix, status: keys.status }).from(keys).where(and(eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted"), ne(keys.name, "__chat_route_managed_key__"))).orderBy(desc(keys.createdAt)),
			db.select({ id: v2Providers.providerSlug, name: v2Providers.name, status: v2Providers.status, routingEnabled: v2Providers.routingEnabled }).from(v2Providers).where(and(eq(v2Providers.routable, true), eq(v2Providers.routingEnabled, true), inArray(v2Providers.status, ["active", "degraded"]))).orderBy(asc(v2Providers.name)),
		]);
		const routeIds = routes.map((route) => String(route.id));
		const [links, versions] = routeIds.length ? await Promise.all([
			db.select().from(gatewayDynamicRouteKeys).where(inArray(gatewayDynamicRouteKeys.routeId, routeIds)),
			db.select().from(gatewayDynamicRouteVersions).where(inArray(gatewayDynamicRouteVersions.routeId, routeIds)).orderBy(desc(gatewayDynamicRouteVersions.version)),
		]) : [[], []];
		return { routes, availableKeys, providers, links, versions };
	} finally { await client.end({ timeout: 1 }); }
}

export async function findDynamicRoute(env: Env, routeId: string) {
	const { db, client } = createDatabase(env);
	try { const [route] = await db.select().from(gatewayDynamicRoutes).where(eq(gatewayDynamicRoutes.id, routeId)).limit(1); return route ?? null; }
	finally { await client.end({ timeout: 1 }); }
}

export async function createDynamicRoute(env: Env, input: { workspaceId: string; name: string; slug: string; description: string | null; status: string; config: Record<string, unknown>; userId: string }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const [route] = await tx.insert(gatewayDynamicRoutes).values({ workspaceId: input.workspaceId, name: input.name, slug: input.slug, description: input.description, status: input.status, config: {}, createdBy: input.userId }).returning();
		if (!route) throw new Error("route_write_failed");
		await tx.insert(gatewayDynamicRouteVersions).values({ routeId: route.id, version: 1, config: input.config, createdBy: input.userId });
		return route;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function updateDynamicRoute(env: Env, routeId: string, workspaceId: string, userId: string, config: Record<string, unknown>, values: Partial<typeof gatewayDynamicRoutes.$inferInsert>) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		await tx.execute(sql`select id from ${gatewayDynamicRoutes} where id=${routeId}::uuid and workspace_id=${workspaceId}::uuid for update`);
		const [route] = await tx.select().from(gatewayDynamicRoutes).where(and(eq(gatewayDynamicRoutes.id, routeId), eq(gatewayDynamicRoutes.workspaceId, workspaceId))).limit(1);
		if (!route) return null;
		const version = route.version + 1;
		await tx.insert(gatewayDynamicRouteVersions).values({ routeId, version, config, createdBy: userId });
		await tx.update(gatewayDynamicRoutes).set({ ...values, version, updatedAt: new Date().toISOString() }).where(eq(gatewayDynamicRoutes.id, routeId));
		return version;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function deployDynamicRouteVersion(env: Env, routeId: string, workspaceId: string, version: number) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const [selected] = await tx.select({ config: gatewayDynamicRouteVersions.config }).from(gatewayDynamicRouteVersions).where(and(eq(gatewayDynamicRouteVersions.routeId, routeId), eq(gatewayDynamicRouteVersions.version, version))).limit(1);
		if (!selected) return null;
		await tx.update(gatewayDynamicRoutes).set({ config: selected.config, deployedVersion: version, updatedAt: new Date().toISOString() }).where(and(eq(gatewayDynamicRoutes.id, routeId), eq(gatewayDynamicRoutes.workspaceId, workspaceId)));
		return (await tx.select({ keyId: gatewayDynamicRouteKeys.keyId }).from(gatewayDynamicRouteKeys).where(eq(gatewayDynamicRouteKeys.routeId, routeId))).map((row) => String(row.keyId));
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function replaceDynamicRouteKeys(env: Env, input: { routeId: string; workspaceId: string; keyIds: string[]; userId: string }) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const previous = (await tx.select({ keyId: gatewayDynamicRouteKeys.keyId }).from(gatewayDynamicRouteKeys).where(eq(gatewayDynamicRouteKeys.routeId, input.routeId))).map((row) => String(row.keyId));
		if (input.keyIds.length) {
			const valid = await tx.select({ id: keys.id }).from(keys).where(and(eq(keys.workspaceId, input.workspaceId), ne(keys.status, "deleted"), inArray(keys.id, input.keyIds)));
			if (valid.length !== input.keyIds.length) return { status: "invalid_keys" as const, previous };
		}
		await tx.delete(gatewayDynamicRouteKeys).where(eq(gatewayDynamicRouteKeys.routeId, input.routeId));
		if (input.keyIds.length) await tx.insert(gatewayDynamicRouteKeys).values(input.keyIds.map((keyId) => ({ routeId: input.routeId, keyId, attachedBy: input.userId })));
		return { status: "ok" as const, previous };
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function deleteDynamicRoute(env: Env, routeId: string, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const keyIds = (await tx.select({ keyId: gatewayDynamicRouteKeys.keyId }).from(gatewayDynamicRouteKeys).where(eq(gatewayDynamicRouteKeys.routeId, routeId))).map((row) => String(row.keyId));
		await tx.delete(gatewayDynamicRoutes).where(and(eq(gatewayDynamicRoutes.id, routeId), eq(gatewayDynamicRoutes.workspaceId, workspaceId)));
		return keyIds;
	}); } finally { await client.end({ timeout: 1 }); }
}
