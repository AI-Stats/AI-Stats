import type { Env } from "@/env";
import { deleteIdentity, updateIdentity } from "@/repositories/identity";

export async function deleteIdentityUser(env: Env, userId: string) {
	try {
		await deleteIdentity(env, userId);
		return { data: { user: null }, error: null };
	} catch (error) {
		return {
			data: null,
			error: { message: error instanceof Error ? error.message : String(error) },
		};
	}
}

export async function updateIdentityUser(
	env: Env,
	userId: string,
	attributes: { displayName?: string | null; image?: string | null; userMetadata?: Record<string, unknown> },
) {
	try {
		const updated = await updateIdentity(env, userId, attributes);
		return { data: updated ? { user: updated } : null, error: null };
	} catch (error) {
		return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
	}
}
