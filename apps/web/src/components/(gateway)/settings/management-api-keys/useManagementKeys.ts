"use client";

import useSWR from "swr";
import type { SettingsManagementApiKeysInitialData } from "@/lib/fetchers/internal/settingsTypes";
import { accountSWRFetcher } from "@/lib/swr/accountFetcher";

export function managementKeysSWRKey(workspaceId?: string | null) {
	return `/api/account/settings/management-api-keys${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`;
}

export function useManagementKeys(
	workspaceId: string | null | undefined,
	fallbackData: SettingsManagementApiKeysInitialData,
) {
	return useSWR<SettingsManagementApiKeysInitialData>(
		managementKeysSWRKey(workspaceId),
		accountSWRFetcher,
		{
			fallbackData,
			keepPreviousData: true,
			revalidateOnMount: false,
			revalidateOnFocus: false,
			dedupingInterval: 0,
		},
	);
}
