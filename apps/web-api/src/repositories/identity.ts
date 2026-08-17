import { session, user, users } from "@phaseo/db/schema";
import { and, eq, gt } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function findIdentityBySessionToken(env: Env, token: string) {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select({
			id: user.id, email: user.email, createdAt: user.createdAt, appMetadata: user.appMetadata,
			userMetadata: user.userMetadata, twoFactorEnabled: user.twoFactorEnabled,
			mfaReenrollmentRequired: user.mfaReenrollmentRequired,
		}).from(session).innerJoin(user, eq(user.id, session.userId))
			.where(and(eq(session.token, token), gt(session.expiresAt, new Date().toISOString()))).limit(1);
		return row ?? null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function deleteIdentity(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		await db.transaction(async (tx) => {
			await tx.delete(users).where(eq(users.userId, userId));
			await tx.delete(user).where(eq(user.id, userId));
		});
	} finally { await client.end({ timeout: 1 }); }
}

export async function updateIdentity(env: Env, userId: string, attributes: { displayName?: string | null; image?: string | null; userMetadata?: Record<string, unknown> }) {
	const { db, client } = createDatabase(env);
	try {
		const [current] = await db.select({ userMetadata: user.userMetadata }).from(user).where(eq(user.id, userId)).limit(1);
		const [updated] = await db.update(user).set({
			...(attributes.displayName !== undefined ? { name: attributes.displayName ?? "" } : {}),
			...(attributes.image !== undefined ? { image: attributes.image } : {}),
			...(attributes.userMetadata ? { userMetadata: { ...((current?.userMetadata && typeof current.userMetadata === "object" && !Array.isArray(current.userMetadata)) ? current.userMetadata as Record<string, unknown> : {}), ...attributes.userMetadata } } : {}),
			updatedAt: new Date().toISOString(),
		}).where(eq(user.id, userId)).returning({ id: user.id, email: user.email, name: user.name, image: user.image });
		return updated ?? null;
	} finally { await client.end({ timeout: 1 }); }
}
