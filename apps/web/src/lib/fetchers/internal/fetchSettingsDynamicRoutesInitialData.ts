import type { SettingsDynamicRoutesInitialData } from "@/lib/fetchers/internal/settingsTypes";
import { getServerAccountContext } from "@/lib/fetchers/internal/serverAccountContext";
import { fetchAccountWebApi } from "@/lib/web-api/client";

export async function fetchSettingsDynamicRoutesInitialData(): Promise<SettingsDynamicRoutesInitialData> {
	const context = await getServerAccountContext();
	const query = context.workspaceId ? `?workspaceId=${encodeURIComponent(context.workspaceId)}` : "";
	return fetchAccountWebApi<SettingsDynamicRoutesInitialData>(`/api/account/settings/dynamic-routes${query}`, context.accessToken);
}
