import { headers } from "next/headers";

import type { InternalAuthStatus } from "@/lib/fetchers/internal/authTypes";
import { getPhaseoAuthSession } from "@/lib/auth/sessionProvider";
import { fetchAccountWebApi } from "@/lib/web-api/client";

export async function fetchInternalAuthStatus(): Promise<InternalAuthStatus> {
	const session = await getPhaseoAuthSession();
	const requestHeaders = await headers();
	const cookie = requestHeaders.get("cookie");
	return fetchAccountWebApi<InternalAuthStatus>(
		"/api/account/auth/status",
		session?.accessToken ?? undefined,
		cookie ? { headers: { Cookie: cookie } } : undefined,
	);
}
