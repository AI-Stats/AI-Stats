import {
	creditLedger,
	emailOutbox,
	gatewayIoLogs,
	gatewayIoRetentionBillingRuns,
	wallets,
	workspaces,
	workspaceSettings,
} from "@phaseo/db/schema";
import { and, asc, eq, inArray, isNotNull, lt, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function listExtendedRetentionWorkspaces(limit: number) {
	return withDatabase((db) => db.select({
		workspace_id: workspaceSettings.workspaceId,
		io_logging_enabled: workspaceSettings.ioLoggingEnabled,
		io_logging_retention_days: workspaceSettings.ioLoggingRetentionDays,
		io_logging_billing_status: workspaceSettings.ioLoggingBillingStatus,
		io_logging_grace_until: workspaceSettings.ioLoggingGraceUntil,
		io_logging_last_billing_warning_at: workspaceSettings.ioLoggingLastBillingWarningAt,
		io_logging_last_billing_warning_kind: workspaceSettings.ioLoggingLastBillingWarningKind,
		io_logging_price_per_million_units_nanos: workspaceSettings.ioLoggingPricePerMillionUnitsNanos,
	}).from(workspaceSettings).where(and(
		eq(workspaceSettings.ioLoggingEnabled, true),
		sql`${workspaceSettings.ioLoggingRetentionDays} > 90`,
	)).orderBy(sql`${workspaceSettings.ioLoggingLastBilledAt} asc nulls first`).limit(limit));
}

export async function getWorkspace(id: string) {
	return withDatabase(async (db) => (await db.select({ id: workspaces.id, name: workspaces.name, owner_user_id: workspaces.ownerUserId })
		.from(workspaces).where(eq(workspaces.id, id)).limit(1))[0] ?? null);
}

export async function enqueueWarning(args: {
	kind: string; template: string; toEmail: string; subject: string; workspaceId: string;
	userId: string; payload: Record<string, unknown>; warningKind: string; warnedAt: string;
}): Promise<void> {
	await withDatabase((db) => db.transaction(async (tx) => {
		await tx.insert(emailOutbox).values({
			kind: args.kind, template: args.template, toEmail: args.toEmail, subject: args.subject,
			workspaceId: args.workspaceId, userId: args.userId, payload: args.payload,
		});
		await tx.update(workspaceSettings).set({
			ioLoggingLastBillingWarningAt: args.warnedAt,
			ioLoggingLastBillingWarningKind: args.warningKind,
			updatedAt: args.warnedAt,
		}).where(eq(workspaceSettings.workspaceId, args.workspaceId));
	}));
}

export async function usageSnapshot(workspaceId: string, asOf: string, includedDays: number, eventUnitBytes: number) {
	return withDatabase(async (db) => (await db.execute<Record<string, unknown>>(sql`
		select
			coalesce(sum(ceil(greatest(coalesce(${gatewayIoLogs.ioLogBytes}, 0), 0)::numeric / ${Math.max(eventUnitBytes, 1)})::bigint), 0)::bigint as event_units,
			coalesce(sum(greatest(coalesce(${gatewayIoLogs.ioLogBytes}, 0), 0)), 0)::bigint as billable_bytes,
			count(*)::bigint as object_count
		from ${gatewayIoLogs}
		where ${gatewayIoLogs.workspaceId} = ${workspaceId}::uuid
			and ${gatewayIoLogs.ioLogStatus} = 'stored'
			and ${gatewayIoLogs.ioLogObjectKey} is not null
			and ${gatewayIoLogs.ioLogRetentionUntil} > ${asOf}::timestamptz
			and ${gatewayIoLogs.createdAt} < ${asOf}::timestamptz - (${Math.max(includedDays, 0)} * interval '1 day')
	`))[0] ?? { event_units: 0, billable_bytes: 0, object_count: 0 });
}

type ChargeArgs = {
	workspaceId: string; billingDate: string; amountNanos: number; eventUnits: number;
	billableBytes: number; objectCount: number; graceDays: number;
};

export async function chargeOnce(args: ChargeArgs) {
	return withDatabase((db) => db.transaction(async (tx) => {
		const refId = `io_retention:${args.workspaceId}:${args.billingDate}`;
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${refId}, 0))`);
		await tx.insert(workspaceSettings).values({ workspaceId: args.workspaceId }).onConflictDoNothing();
		const [settings] = await tx.select().from(workspaceSettings)
			.where(eq(workspaceSettings.workspaceId, args.workspaceId)).limit(1).for("update");
		if (!settings) throw new Error("io_retention_settings_missing");

		const normalized = {
			eventUnits: Math.max(0, Math.trunc(args.eventUnits)),
			billableBytes: Math.max(0, Math.trunc(args.billableBytes)),
			objectCount: Math.max(0, Math.trunc(args.objectCount)),
			amountNanos: Math.max(0, Math.trunc(args.amountNanos)),
		};
		const writeRun = async (values: Partial<typeof gatewayIoRetentionBillingRuns.$inferInsert> & { status: string }) => {
			await tx.insert(gatewayIoRetentionBillingRuns).values({
				workspaceId: args.workspaceId, billingDate: args.billingDate, processedAt: new Date().toISOString(),
				...normalized, ...values,
			}).onConflictDoUpdate({
				target: [gatewayIoRetentionBillingRuns.workspaceId, gatewayIoRetentionBillingRuns.billingDate],
				set: { processedAt: new Date().toISOString(), ...normalized, ...values },
			});
		};

		const [existing] = await tx.select({
			amountNanos: creditLedger.amountNanos,
			beforeBalanceNanos: creditLedger.beforeBalanceNanos,
			afterBalanceNanos: creditLedger.afterBalanceNanos,
		}).from(creditLedger).where(and(eq(creditLedger.refType, "gateway_io_retention"), eq(creditLedger.refId, refId))).limit(1);
		if (existing) {
			await writeRun({ status: "already_charged", amountNanos: normalized.amountNanos,
				beforeBalanceNanos: existing.beforeBalanceNanos, afterBalanceNanos: existing.afterBalanceNanos,
				graceUntil: null, error: null });
			return { status: "already_charged", amount_nanos: existing.amountNanos,
				before_balance_nanos: existing.beforeBalanceNanos, after_balance_nanos: existing.afterBalanceNanos, grace_until: null };
		}

		if (normalized.amountNanos === 0) {
			await tx.update(workspaceSettings).set({
				ioLoggingBillingStatus: settings.ioLoggingEnabled ? "active" : settings.ioLoggingBillingStatus,
				ioLoggingGraceUntil: null, ioLoggingLastBilledAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
			}).where(eq(workspaceSettings.workspaceId, args.workspaceId));
			await writeRun({ status: "skipped", amountNanos: 0, graceUntil: null, error: null });
			return { status: "skipped", amount_nanos: 0, before_balance_nanos: null, after_balance_nanos: null, grace_until: null };
		}

		const [wallet] = await tx.select().from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1).for("update");
		if (!wallet || wallet.balanceNanos < normalized.amountNanos) {
			const expiredGrace = settings.ioLoggingBillingStatus === "grace" && settings.ioLoggingGraceUntil != null
				&& Date.parse(settings.ioLoggingGraceUntil) <= Date.now();
			const suspended = settings.ioLoggingBillingStatus === "suspended" || expiredGrace;
			const status = suspended ? "suspended" : "grace";
			const graceUntil = suspended ? (expiredGrace ? settings.ioLoggingGraceUntil : null)
				: settings.ioLoggingGraceUntil ?? new Date(Date.now() + Math.max(args.graceDays, 1) * 86_400_000).toISOString();
			await tx.update(workspaceSettings).set({
				ioLoggingBillingStatus: status,
				ioLoggingGraceUntil: suspended ? null : graceUntil,
				updatedAt: new Date().toISOString(),
			}).where(eq(workspaceSettings.workspaceId, args.workspaceId));
			await writeRun({ status, beforeBalanceNanos: wallet?.balanceNanos ?? null,
				afterBalanceNanos: wallet?.balanceNanos ?? null, graceUntil,
				error: wallet ? "insufficient_credits" : "wallet_not_found" });
			return { status, amount_nanos: normalized.amountNanos,
				before_balance_nanos: wallet?.balanceNanos ?? null, after_balance_nanos: wallet?.balanceNanos ?? null, grace_until: graceUntil };
		}

		const before = wallet.balanceNanos;
		const after = before - normalized.amountNanos;
		const now = new Date().toISOString();
		await tx.update(wallets).set({ balanceNanos: after, updatedAt: now }).where(eq(wallets.workspaceId, args.workspaceId));
		await tx.insert(creditLedger).values({
			workspaceId: args.workspaceId, eventTime: now, kind: "io_retention",
			amountNanos: -normalized.amountNanos, beforeBalanceNanos: before, afterBalanceNanos: after,
			refType: "gateway_io_retention", refId, createdAt: now, status: "charged",
		});
		await tx.update(workspaceSettings).set({
			ioLoggingBillingStatus: "active", ioLoggingGraceUntil: null, ioLoggingLastBilledAt: now, updatedAt: now,
		}).where(eq(workspaceSettings.workspaceId, args.workspaceId));
		await writeRun({ status: "charged", beforeBalanceNanos: before, afterBalanceNanos: after, graceUntil: null, error: null });
		return { status: "charged", amount_nanos: normalized.amountNanos,
			before_balance_nanos: before, after_balance_nanos: after, grace_until: null };
	}));
}

export async function listPrunableLogs(workspaceId: string, cutoff: string, limit: number) {
	return withDatabase((db) => db.select({ id: gatewayIoLogs.id, io_log_object_key: gatewayIoLogs.ioLogObjectKey })
		.from(gatewayIoLogs).where(and(
			eq(gatewayIoLogs.workspaceId, workspaceId), eq(gatewayIoLogs.ioLogStatus, "stored"),
			isNotNull(gatewayIoLogs.ioLogObjectKey), lt(gatewayIoLogs.createdAt, cutoff),
		)).orderBy(asc(gatewayIoLogs.createdAt)).limit(limit));
}

export async function markLogsDeleted(ids: string[], retentionUntil: string): Promise<void> {
	if (!ids.length) return;
	await withDatabase(async (db) => { await db.update(gatewayIoLogs).set({
		ioLogStatus: "deleted", ioLogError: "extended_retention_suspended", ioLogRetentionUntil: retentionUntil,
	}).where(inArray(gatewayIoLogs.id, ids)); });
}
