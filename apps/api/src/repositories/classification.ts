import {
	dataContributions,
	publicModelTaskDaily,
	requestClassificationDaily,
	requestClassifications,
	workspaceClassifiers,
} from "@phaseo/db/schema";
import { and, asc, eq, inArray, lt, ne, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function ensureClassifier(values: typeof workspaceClassifiers.$inferInsert): Promise<void> {
	await withDatabase(async (db) => {
		await db.insert(workspaceClassifiers).values(values).onConflictDoNothing({
			target: [workspaceClassifiers.workspaceId, workspaceClassifiers.slug],
		});
	});
}

export async function listExpiredContributions(limit: number) {
	return withDatabase((db) => db.select({ id: dataContributions.id, objectKey: dataContributions.objectKey })
		.from(dataContributions).where(and(
			lt(dataContributions.retentionUntil, new Date().toISOString()),
			ne(dataContributions.status, "deleted"),
		)).orderBy(asc(dataContributions.retentionUntil)).limit(Math.max(1, Math.min(5000, Math.trunc(limit)))));
}

export async function markContributionsDeleted(ids: string[], updatedAt: string): Promise<void> {
	if (ids.length === 0) return;
	await withDatabase(async (db) => { await db.update(dataContributions).set({
		status: "deleted", leaseExpiresAt: null, updatedAt,
	}).where(inArray(dataContributions.id, ids)); });
}

export async function insertContribution(values: typeof dataContributions.$inferInsert): Promise<boolean> {
	return withDatabase(async (db) => {
		const rows = await db.insert(dataContributions).values(values).onConflictDoNothing({
			target: [dataContributions.workspaceId, dataContributions.requestId],
		}).returning({ id: dataContributions.id });
		return rows.length > 0;
	});
}

export async function claimContributions(limit: number, leaseSeconds: number) {
	return withDatabase(async (db) => [...await db.execute<Record<string, unknown>>(sql`
		with candidates as (
			select ${dataContributions.id}
			from ${dataContributions}
			where ${dataContributions.status} in ('pending', 'failed', 'processing')
				and case when ${dataContributions.status} = 'processing'
					then ${dataContributions.leaseExpiresAt} else ${dataContributions.availableAt} end <= now()
				and ${dataContributions.retentionUntil} > now()
			order by case when ${dataContributions.status} = 'processing'
				then ${dataContributions.leaseExpiresAt} else ${dataContributions.availableAt} end,
				${dataContributions.occurredAt}, ${dataContributions.id}
			for update skip locked
			limit ${Math.max(1, Math.min(limit, 250))}
		), claimed as (
			update ${dataContributions} contribution
			set status = 'processing', attempt_count = contribution.attempt_count + 1,
				lease_expires_at = now() + (${Math.max(30, Math.min(leaseSeconds, 3600))} * interval '1 second'),
				updated_at = now()
			from candidates where contribution.id = candidates.id
			returning contribution.*
		)
		select id::text, workspace_id::text, request_id, occurred_at::text, model_slug,
			provider_slug, object_key, input_tokens, output_tokens, attempt_count
		from claimed
	`)]);
}

export async function listEnabledClassifiers(workspaceId: string) {
	return withDatabase((db) => db.select({
		id: workspaceClassifiers.id,
		workspace_id: workspaceClassifiers.workspaceId,
		slug: workspaceClassifiers.slug,
		name: workspaceClassifiers.name,
		instructions: workspaceClassifiers.instructions,
		categories: workspaceClassifiers.categories,
		model: workspaceClassifiers.model,
		service_tier: workspaceClassifiers.serviceTier,
		sample_rate_bps: workspaceClassifiers.sampleRateBps,
	}).from(workspaceClassifiers).where(and(
		eq(workspaceClassifiers.workspaceId, workspaceId),
		eq(workspaceClassifiers.enabled, true),
	)));
}

export async function listCompletedClassifierIds(contributionId: string): Promise<string[]> {
	return withDatabase(async (db) => (await db.select({ classifierId: requestClassifications.classifierId })
		.from(requestClassifications).where(eq(requestClassifications.contributionId, contributionId)))
		.map((row) => row.classifierId));
}

export async function upsertClassification(values: typeof requestClassifications.$inferInsert): Promise<void> {
	await withDatabase(async (db) => {
		await db.insert(requestClassifications).values(values).onConflictDoUpdate({
			target: [requestClassifications.contributionId, requestClassifications.classifierId],
			set: {
				primaryCategory: values.primaryCategory,
				labels: values.labels,
				confidence: values.confidence,
				model: values.model,
				serviceTier: values.serviceTier,
				latencyMs: values.latencyMs,
			},
		});
	});
}

export async function refreshClassificationRollup(contributionId: string, classifierId: string): Promise<void> {
	await withDatabase(async (db) => {
		await db.execute(sql`
			insert into ${requestClassificationDaily} (
				usage_date, workspace_id, classifier_id, primary_category, model_slug,
				provider_slug, request_count, input_tokens, output_tokens, updated_at
			)
			select contribution.occurred_at::date, contribution.workspace_id,
				classification.classifier_id, classification.primary_category,
				contribution.model_slug, coalesce(contribution.provider_slug, ''),
				count(*), coalesce(sum(contribution.input_tokens), 0),
				coalesce(sum(contribution.output_tokens), 0), now()
			from ${requestClassifications} classification
			join ${dataContributions} contribution on contribution.id = classification.contribution_id
			where contribution.workspace_id = (select workspace_id from ${dataContributions} where id = ${contributionId}::uuid)
				and contribution.occurred_at::date = (select occurred_at::date from ${dataContributions} where id = ${contributionId}::uuid)
				and classification.classifier_id = ${classifierId}::uuid
				and classification.primary_category = (select primary_category from ${requestClassifications}
					where contribution_id = ${contributionId}::uuid and classifier_id = ${classifierId}::uuid)
				and contribution.model_slug = (select model_slug from ${dataContributions} where id = ${contributionId}::uuid)
				and coalesce(contribution.provider_slug, '') = coalesce((select provider_slug from ${dataContributions} where id = ${contributionId}::uuid), '')
				and exists (select 1 from ${workspaceClassifiers} where id = ${classifierId}::uuid)
			group by contribution.occurred_at::date, contribution.workspace_id,
				classification.classifier_id, classification.primary_category,
				contribution.model_slug, coalesce(contribution.provider_slug, '')
			on conflict (usage_date, workspace_id, classifier_id, primary_category, model_slug, provider_slug)
			do update set request_count = excluded.request_count, input_tokens = excluded.input_tokens,
				output_tokens = excluded.output_tokens, updated_at = excluded.updated_at
		`);
	});
}

export async function completeContribution(id: string, completedAt: string): Promise<void> {
	await withDatabase(async (db) => { await db.update(dataContributions).set({
		status: "complete", completedAt, leaseExpiresAt: null, lastError: null, updatedAt: completedAt,
	}).where(and(eq(dataContributions.id, id), eq(dataContributions.status, "processing"))); });
}

export async function failContribution(id: string, availableAt: string, message: string, updatedAt: string): Promise<void> {
	await withDatabase(async (db) => { await db.update(dataContributions).set({
		status: "failed", availableAt, leaseExpiresAt: null, lastError: message, updatedAt,
	}).where(and(eq(dataContributions.id, id), eq(dataContributions.status, "processing"))); });
}

export async function refreshPublicModelTaskDaily(since: string): Promise<void> {
	await withDatabase((db) => db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('refresh_public_model_task_daily'))`);
		await tx.delete(publicModelTaskDaily).where(sql`${publicModelTaskDaily.usageDate} >= ${since}::date`);
		await tx.execute(sql`
			insert into ${publicModelTaskDaily} (
				usage_date, taxonomy_slug, primary_category, model_slug, provider_slug,
				workspace_count, request_count, input_tokens, output_tokens, updated_at
			)
			select daily.usage_date, classifier.slug, daily.primary_category, daily.model_slug,
				daily.provider_slug, count(*), sum(daily.request_count), sum(daily.input_tokens),
				sum(daily.output_tokens), now()
			from ${requestClassificationDaily} daily
			join ${workspaceClassifiers} classifier on classifier.id = daily.classifier_id
			where daily.usage_date >= ${since}::date and classifier.kind = 'phaseo_task'
			group by daily.usage_date, classifier.slug, daily.primary_category, daily.model_slug, daily.provider_slug
			on conflict (usage_date, taxonomy_slug, primary_category, model_slug, provider_slug)
			do update set workspace_count = excluded.workspace_count,
				request_count = excluded.request_count, input_tokens = excluded.input_tokens,
				output_tokens = excluded.output_tokens, updated_at = excluded.updated_at
		`);
	}));
}
