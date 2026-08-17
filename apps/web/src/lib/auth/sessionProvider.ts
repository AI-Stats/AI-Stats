import "server-only";

import { getServerIdentity } from "@/lib/auth/serverIdentity";

export type PhaseoAuthSession = {
	accessToken: string | null;
	userId: string;
};

export async function getPhaseoAuthSession(): Promise<PhaseoAuthSession | null> {
	const identity = await getServerIdentity();
	return identity ? { accessToken: identity.session.token, userId: identity.user.id } : null;
}
