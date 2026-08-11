import type { SettingsAccountPrivacyInitialData } from "./settingsTypes";
import { getServerAccountContext } from "./serverAccountContext";
import { fetchAccountWebApi } from "@/lib/web-api/client";

export async function fetchAccountPrivacyPolicy() {
	const context = await getServerAccountContext();
	if (!context.accessToken) return null;
	const data = await fetchAccountWebApi<SettingsAccountPrivacyInitialData>(
		"/api/account/settings/account/privacy?compact=1",
		context.accessToken,
	);
	return data.signedIn ? data.policy : null;
}
