import type { SettingsAccountPrivacyInitialData } from "@/lib/fetchers/internal/settingsTypes";
import { getServerAccountContext } from "@/lib/fetchers/internal/serverAccountContext";
import { fetchAccountWebApi } from "@/lib/web-api/client";

export async function fetchSettingsAccountPrivacyInitialData(): Promise<SettingsAccountPrivacyInitialData> {
	const context = await getServerAccountContext();
	return fetchAccountWebApi<SettingsAccountPrivacyInitialData>(
		"/api/account/settings/account/privacy",
		context.accessToken,
	);
}
