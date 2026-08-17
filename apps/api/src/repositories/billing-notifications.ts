import { emailOutbox, wallets, workspaces, workspaceSettings } from "@phaseo/db/schema";
import { and, asc, eq, isNotNull, isNull, lt } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function getWorkspaceOwner(workspaceId: string) {
	return withDatabase(async (db) => (await db.select({ name: workspaces.name, owner_user_id: workspaces.ownerUserId })
		.from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0] ?? null);
}

export async function autoTopUpFailureEmailEnabled(workspaceId: string): Promise<boolean> {
	return withDatabase(async (db) => {
		const [row] = await db.select({ enabled: workspaceSettings.autoTopUpFailureEmailEnabled }).from(workspaceSettings)
			.where(eq(workspaceSettings.workspaceId, workspaceId)).limit(1);
		return row?.enabled !== false;
	});
}

export async function enqueueUnique(values: typeof emailOutbox.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(emailOutbox).values(values).onConflictDoNothing({ target: emailOutbox.dedupeKey }); });
}

export async function markLowBalanceEmailSent(args: { workspaceId: string; balanceNanos: number; sentAt: string }): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(workspaceSettings).set({
			lowBalanceEmailLastSentAt: args.sentAt,
			lowBalanceEmailLastSentBalanceNanos: args.balanceNanos,
			updatedAt: args.sentAt,
		}).where(eq(workspaceSettings.workspaceId, args.workspaceId));
	});
}

const outboxSelection = {
	id: emailOutbox.id,
	created_at: emailOutbox.createdAt,
	dedupe_key: emailOutbox.dedupeKey,
	kind: emailOutbox.kind,
	template: emailOutbox.template,
	to_email: emailOutbox.toEmail,
	subject: emailOutbox.subject,
	workspace_id: emailOutbox.workspaceId,
	user_id: emailOutbox.userId,
	payload: emailOutbox.payload,
	attempts: emailOutbox.attempts,
	last_error: emailOutbox.lastError,
	sent_at: emailOutbox.sentAt,
};

export async function listPendingEmails(limit: number) {
	return withDatabase((db) => db.select(outboxSelection).from(emailOutbox)
		.where(and(isNull(emailOutbox.sentAt), lt(emailOutbox.attempts, 5)))
		.orderBy(asc(emailOutbox.createdAt)).limit(limit));
}

export async function markEmailSent(id: string, sentAt: string): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(emailOutbox).set({ sentAt, lastError: null }).where(eq(emailOutbox.id, id));
	});
}

export async function markEmailFailed(id: string, attempts: number, lastError: string): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(emailOutbox).set({ attempts, lastError }).where(eq(emailOutbox.id, id));
	});
}

export async function listPaymentMethodWallets(limit: number, offset: number) {
	return withDatabase((db) => db.select({
		workspace_id: wallets.workspaceId,
		stripe_customer_id: wallets.stripeCustomerId,
		payment_method_expiring_email_enabled: workspaceSettings.paymentMethodExpiringEmailEnabled,
	}).from(wallets).leftJoin(workspaceSettings, eq(workspaceSettings.workspaceId, wallets.workspaceId))
		.where(isNotNull(wallets.stripeCustomerId)).orderBy(asc(wallets.workspaceId)).limit(limit).offset(offset));
}
