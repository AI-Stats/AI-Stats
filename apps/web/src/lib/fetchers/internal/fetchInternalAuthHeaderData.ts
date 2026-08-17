import type { InternalAuthHeaderData } from "@/lib/fetchers/internal/authTypes";
import { fetchAccountWebApi } from "@/lib/web-api/client";
import { getServerIdentity } from "@/lib/auth/serverIdentity";

export async function fetchInternalAuthHeaderData(): Promise<InternalAuthHeaderData> {
	const identity = await getServerIdentity();
	return fetchAccountWebApi<InternalAuthHeaderData>(
		"/api/account/auth/header",
		identity?.session.token,
	);
}
