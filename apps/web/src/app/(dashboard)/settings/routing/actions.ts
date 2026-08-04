"use server";

import { revalidatePath } from "next/cache";
import { fetchAccountWebApi } from "@/lib/web-api/client";
import { getServerAccountContext } from "@/lib/fetchers/internal/serverAccountContext";
import type { DynamicRouteConfig } from "@/lib/fetchers/internal/settingsTypes";

export type RoutingMode = "balanced" | "price" | "latency" | "throughput";

type UpdateRoutingSettingsInput = {
	mode: RoutingMode;
	betaChannelEnabled?: boolean;
	alphaChannelEnabled?: boolean;
	responseHealingEnabled?: boolean;
	responseHealingLocked?: boolean;
	responseHealingMode?: "safe" | "strict";
};

export async function updateRoutingSettings({
	mode,
	betaChannelEnabled,
	alphaChannelEnabled,
	responseHealingEnabled,
	responseHealingLocked,
	responseHealingMode,
}: UpdateRoutingSettingsInput) {
	const context = await getServerAccountContext();
	if (!context.accessToken || !context.workspaceId) throw new Error("Missing workspace id");
	await fetchAccountWebApi("/api/account/settings/routing", context.accessToken, {
		method: "PUT",
		body: JSON.stringify({ workspaceId: context.workspaceId, mode, betaChannelEnabled, alphaChannelEnabled, responseHealingEnabled, responseHealingLocked, responseHealingMode }),
	});

	revalidatePath("/settings/routing");
}

export async function updateRoutingMode(mode: RoutingMode) {
	return updateRoutingSettings({ mode });
}

async function routingContext() {
	const context = await getServerAccountContext();
	if (!context.accessToken || !context.workspaceId) throw new Error("Missing workspace id");
	return context;
}

export async function createDynamicRouteAction(input: {
	name: string;
	description?: string | null;
	config: DynamicRouteConfig;
}) {
	const context = await routingContext();
	const result = await fetchAccountWebApi<{ route: { id: string; version: number } }>("/api/account/settings/dynamic-routes", context.accessToken, {
		method: "POST",
		body: JSON.stringify({ ...input, workspaceId: context.workspaceId }),
	});
	revalidatePath("/settings/routing");
	return result.route;
}

export async function updateDynamicRouteAction(routeId: string, input: {
	name?: string;
	description?: string | null;
	status?: "active" | "paused";
	config?: DynamicRouteConfig;
}) {
	const context = await routingContext();
	const result = await fetchAccountWebApi<{ success: true; version: number }>(`/api/account/settings/dynamic-routes/${encodeURIComponent(routeId)}`, context.accessToken, {
		method: "PUT",
		body: JSON.stringify(input),
	});
	revalidatePath("/settings/routing");
	return result;
}

export async function attachDynamicRouteKeysAction(routeId: string, keyIds: string[]) {
	const context = await routingContext();
	await fetchAccountWebApi(`/api/account/settings/dynamic-routes/${encodeURIComponent(routeId)}/keys`, context.accessToken, {
		method: "PUT",
		body: JSON.stringify({ keyIds }),
	});
	revalidatePath("/settings/routing");
}

export async function deployDynamicRouteVersionAction(routeId: string, version: number) {
	const context = await routingContext();
	await fetchAccountWebApi(`/api/account/settings/dynamic-routes/${encodeURIComponent(routeId)}/versions/${version}/deploy`, context.accessToken, { method: "POST" });
	revalidatePath("/settings/routing");
}

export async function deleteDynamicRouteAction(routeId: string, confirmName: string) {
	const context = await routingContext();
	await fetchAccountWebApi(`/api/account/settings/dynamic-routes/${encodeURIComponent(routeId)}?confirmName=${encodeURIComponent(confirmName)}`, context.accessToken, {
		method: "DELETE",
	});
	revalidatePath("/settings/routing");
}
