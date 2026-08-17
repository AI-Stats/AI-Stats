"use client";

import useSWR from "swr";
import type { SettingsKeysInitialData } from "@/lib/fetchers/internal/settingsTypes";
import { accountSWRFetcher } from "@/lib/swr/accountFetcher";

export function settingsKeysSWRKey(workspaceId?: string | null) {
	const query = workspaceId
		? `?workspaceId=${encodeURIComponent(workspaceId)}`
		: "";
	return `/api/account/settings/keys${query}`;
}

export function useSettingsKeys(
	workspaceId: string | null | undefined,
	fallbackData: SettingsKeysInitialData,
) {
	return useSWR<SettingsKeysInitialData>(
		settingsKeysSWRKey(workspaceId),
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
