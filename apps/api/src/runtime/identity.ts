import { user } from "@phaseo/db/schema";

import { getBindings } from "./env";
import { createDatabase } from "./db";

export type IdentityUser = {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
};

export async function getIdentityUserById(userId: string): Promise<{
	data: { user: IdentityUser | null };
	error: any | null;
}> {
	const { db, client } = createDatabase(getBindings());
	try {
		const row = await db.query.user.findFirst({
			columns: { id: true, email: true, name: true, image: true },
			where: (identity, { eq }) => eq(identity.id, userId),
		});
		return {
			data: {
				user: row ? {
					id: row.id,
					email: row.email,
					name: row.name,
					image: row.image,
				} : null,
			},
			error: null,
		};
	} catch (error) {
		return { data: { user: null }, error };
	} finally {
		await client.end({ timeout: 1 });
	}
}
