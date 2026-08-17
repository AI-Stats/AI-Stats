import "server-only";

import { authUsers } from "@phaseo/db/account-schema";
import { eq } from "@phaseo/db/query";

import { getDatabase } from "@/lib/database/drizzle";


export async function getIdentityUserById(userId: string) {
	let row: Record<string, unknown> | null = null;
	try {
		row = (await getDatabase().select({
			id: authUsers.id,
			email: authUsers.email,
			name: authUsers.name,
			image: authUsers.image,
		}).from(authUsers).where(eq(authUsers.id, userId)).limit(1))[0] ?? null;
	} catch (error) {
		return { data: { user: null }, error };
	}
	return {
		data: { user: row ? {
			id: String(row.id),
			email: typeof row.email === "string" ? row.email : null,
			phone: null,
			user_metadata: { display_name: row.name ?? null, avatar_url: row.image ?? null },
		} : null },
		error: null,
	};
}
