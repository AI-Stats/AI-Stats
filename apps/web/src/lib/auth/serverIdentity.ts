import "server-only";

import { headers } from "next/headers";

import { getBetterAuth } from "./betterAuth";

export async function getServerIdentity() {
	return getBetterAuth().api.getSession({ headers: await headers() });
}

export async function requireServerIdentity() {
	const identity = await getServerIdentity();
	if (!identity?.user?.id) throw new Error("Unauthorized");
	if (identity.user.mfaReenrollmentRequired === true) {
		throw new Error("MFA re-enrollment required");
	}
	return identity;
}
