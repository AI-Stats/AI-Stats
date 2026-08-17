import {
	gatewayFeedback,
	gatewayObservabilityEvents,
	gatewayPresetTestRuns,
	gatewayRequests,
	presets,
} from "@phaseo/db/schema";
import { and, desc, eq, inArray, isNull, ne, or, sql, type SQL, type SQLWrapper } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const feedbackSelection = {
	id: gatewayFeedback.id,
	workspace_id: gatewayFeedback.workspaceId,
	request_id: gatewayFeedback.requestId,
	session_id: gatewayFeedback.sessionId,
	preset_id: gatewayFeedback.presetId,
	test_run_id: gatewayFeedback.testRunId,
	source: gatewayFeedback.source,
	rating: gatewayFeedback.rating,
	score: gatewayFeedback.score,
	reason: gatewayFeedback.reason,
	reason_tags: gatewayFeedback.reasonTags,
	comment: gatewayFeedback.comment,
	metadata: gatewayFeedback.metadata,
	metadata_dimensions: gatewayFeedback.metadataDimensions,
	end_user_id: gatewayFeedback.endUserId,
	created_by_user_id: gatewayFeedback.createdByUserId,
	created_at: gatewayFeedback.createdAt,
};

const eventSelection = {
	id: gatewayObservabilityEvents.id,
	workspace_id: gatewayObservabilityEvents.workspaceId,
	request_id: gatewayObservabilityEvents.requestId,
	session_id: gatewayObservabilityEvents.sessionId,
	preset_id: gatewayObservabilityEvents.presetId,
	test_run_id: gatewayObservabilityEvents.testRunId,
	category: gatewayObservabilityEvents.category,
	event_name: gatewayObservabilityEvents.eventName,
	value: gatewayObservabilityEvents.value,
	numeric_value: gatewayObservabilityEvents.numericValue,
	metadata: gatewayObservabilityEvents.metadata,
	metadata_dimensions: gatewayObservabilityEvents.metadataDimensions,
	end_user_id: gatewayObservabilityEvents.endUserId,
	source: gatewayObservabilityEvents.source,
	occurred_at: gatewayObservabilityEvents.occurredAt,
	created_by_user_id: gatewayObservabilityEvents.createdByUserId,
	created_at: gatewayObservabilityEvents.createdAt,
};

const testRunSelection = {
	id: gatewayPresetTestRuns.id,
	workspace_id: gatewayPresetTestRuns.workspaceId,
	preset_id: gatewayPresetTestRuns.presetId,
	baseline_preset_id: gatewayPresetTestRuns.baselinePresetId,
	name: gatewayPresetTestRuns.name,
	description: gatewayPresetTestRuns.description,
	status: gatewayPresetTestRuns.status,
	dataset_name: gatewayPresetTestRuns.datasetName,
	config: gatewayPresetTestRuns.config,
	summary: gatewayPresetTestRuns.summary,
	started_at: gatewayPresetTestRuns.startedAt,
	completed_at: gatewayPresetTestRuns.completedAt,
	created_by_user_id: gatewayPresetTestRuns.createdByUserId,
	created_at: gatewayPresetTestRuns.createdAt,
	updated_at: gatewayPresetTestRuns.updatedAt,
};

export type FeedbackInsert = typeof gatewayFeedback.$inferInsert;
export type EventInsert = typeof gatewayObservabilityEvents.$inferInsert;
export type TestRunInsert = typeof gatewayPresetTestRuns.$inferInsert;
export type TestRunPatch = Partial<Pick<TestRunInsert, "status" | "summary" | "completedAt" | "startedAt" | "name" | "description">>;

export type FeedbackFilters = {
	workspaceId: string;
	visiblePresetIds: string[];
	requestId?: string | null;
	sessionId?: string | null;
	presetId?: string | null;
	testRunId?: string | null;
	since?: string | null;
	until?: string | null;
	metadata: Record<string, string>;
};

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try {
		return await operation(db);
	} finally {
		await client.end({ timeout: 1 });
	}
}

function presetVisibility(column: SQLWrapper, visiblePresetIds: string[]): SQL {
	return visiblePresetIds.length
		? or(isNull(column), inArray(column, visiblePresetIds))!
		: isNull(column);
}

function metadataConditions(column: SQLWrapper, values: Record<string, string>): SQL[] {
	return Object.entries(values).map(([key, value]) => sql`${column} @> ${JSON.stringify({ [key]: value })}::jsonb`);
}

function feedbackConditions(filters: FeedbackFilters): SQL[] {
	const conditions: SQL[] = [
		eq(gatewayFeedback.workspaceId, filters.workspaceId),
		presetVisibility(gatewayFeedback.presetId, filters.visiblePresetIds),
		...metadataConditions(gatewayFeedback.metadataDimensions, filters.metadata),
	];
	if (filters.requestId) conditions.push(eq(gatewayFeedback.requestId, filters.requestId));
	if (filters.sessionId) conditions.push(eq(gatewayFeedback.sessionId, filters.sessionId));
	if (filters.presetId) conditions.push(eq(gatewayFeedback.presetId, filters.presetId));
	if (filters.testRunId) conditions.push(eq(gatewayFeedback.testRunId, filters.testRunId));
	if (filters.since) conditions.push(sql`${gatewayFeedback.createdAt} >= ${filters.since}::timestamptz`);
	if (filters.until) conditions.push(sql`${gatewayFeedback.createdAt} <= ${filters.until}::timestamptz`);
	return conditions;
}

export async function listVisiblePresetIds(workspaceId: string, userId: string | null): Promise<string[]> {
	return withDatabase(async (db) => {
		const visibility = userId
			? or(ne(presets.visibility, "private"), eq(presets.createdBy, userId))
			: ne(presets.visibility, "private");
		return (await db.select({ id: presets.id }).from(presets)
			.where(and(eq(presets.workspaceId, workspaceId), isNull(presets.archivedAt), visibility)))
			.map(({ id }) => id);
	});
}

export async function requestExists(workspaceId: string, requestId: string): Promise<boolean> {
	return withDatabase(async (db) => Boolean(await db.$count(
		gatewayRequests,
		and(eq(gatewayRequests.workspaceId, workspaceId), eq(gatewayRequests.requestId, requestId)),
	)));
}

export async function findTestRunAccess(workspaceId: string, id: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select({
			id: gatewayPresetTestRuns.id,
			preset_id: gatewayPresetTestRuns.presetId,
			baseline_preset_id: gatewayPresetTestRuns.baselinePresetId,
		}).from(gatewayPresetTestRuns).where(and(
			eq(gatewayPresetTestRuns.workspaceId, workspaceId),
			eq(gatewayPresetTestRuns.id, id),
		)).limit(1);
		return row ?? null;
	});
}

export async function insertFeedback(values: FeedbackInsert) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(gatewayFeedback).values(values).returning(feedbackSelection);
		if (!row) throw new Error("Feedback was not persisted");
		return row;
	});
}

export async function listFeedback(filters: FeedbackFilters & { rating?: string | null; unrated?: boolean; limit: number; offset: number }) {
	return withDatabase((db) => {
		const conditions = feedbackConditions(filters);
		if (filters.unrated) conditions.push(isNull(gatewayFeedback.rating));
		else if (filters.rating) conditions.push(eq(gatewayFeedback.rating, filters.rating));
		return db.select(feedbackSelection).from(gatewayFeedback).where(and(...conditions))
			.orderBy(desc(gatewayFeedback.createdAt), desc(gatewayFeedback.id)).limit(filters.limit).offset(filters.offset);
	});
}

export type FeedbackSummaryRow = {
	group_value: string;
	count: number | string;
	positive: number | string;
	negative: number | string;
	partial: number | string;
	average_score: number | string | null;
	ratings: Record<string, number | string> | null;
	last_feedback_at: string | null;
};

export async function summarizeFeedback(filters: FeedbackFilters & {
	groupBy: "preset_id" | "test_run_id" | "metadata";
	metadataKey?: string | null;
	limit: number;
}): Promise<FeedbackSummaryRow[]> {
	return withDatabase(async (db) => {
		const groupExpression = filters.groupBy === "preset_id"
			? sql`${gatewayFeedback.presetId}::text`
			: filters.groupBy === "test_run_id"
				? sql`${gatewayFeedback.testRunId}::text`
				: sql`${gatewayFeedback.metadataDimensions} ->> ${filters.metadataKey ?? ""}`;
		const where = and(...feedbackConditions(filters), sql`${groupExpression} is not null`)!;
		const rows = await db.execute<FeedbackSummaryRow>(sql`
			with filtered as (
				select ${groupExpression} as group_value, rating, score, created_at
				from ${gatewayFeedback}
				where ${where}
			), rating_counts as (
				select group_value, rating, count(*)::bigint as rating_count
				from filtered where rating is not null group by group_value, rating
			), ratings as (
				select group_value, jsonb_object_agg(rating, rating_count) as ratings
				from rating_counts group by group_value
			)
			select filtered.group_value,
				count(*)::bigint as count,
				count(*) filter (where filtered.rating in ('thumbs_up', 'correct'))::bigint as positive,
				count(*) filter (where filtered.rating in ('thumbs_down', 'incorrect', 'bad_format', 'too_slow', 'too_expensive', 'unsafe', 'refused_incorrectly', 'not_helpful'))::bigint as negative,
				count(*) filter (where filtered.rating = 'partly_correct')::bigint as partial,
				avg(filtered.score) as average_score,
				coalesce(ratings.ratings, '{}'::jsonb) as ratings,
				max(filtered.created_at) as last_feedback_at
			from filtered left join ratings using (group_value)
			group by filtered.group_value, ratings.ratings
			order by count desc, last_feedback_at desc, filtered.group_value
			limit ${filters.limit}
		`);
		return [...rows];
	});
}

export async function insertEvent(values: EventInsert) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(gatewayObservabilityEvents).values(values).returning(eventSelection);
		if (!row) throw new Error("Event was not persisted");
		return row;
	});
}

export async function listEvents(filters: FeedbackFilters & { category?: string | null; eventName?: string | null; limit: number; offset: number }) {
	return withDatabase((db) => {
		const conditions: SQL[] = [
			eq(gatewayObservabilityEvents.workspaceId, filters.workspaceId),
			presetVisibility(gatewayObservabilityEvents.presetId, filters.visiblePresetIds),
			...metadataConditions(gatewayObservabilityEvents.metadataDimensions, filters.metadata),
		];
		if (filters.requestId) conditions.push(eq(gatewayObservabilityEvents.requestId, filters.requestId));
		if (filters.sessionId) conditions.push(eq(gatewayObservabilityEvents.sessionId, filters.sessionId));
		if (filters.presetId) conditions.push(eq(gatewayObservabilityEvents.presetId, filters.presetId));
		if (filters.testRunId) conditions.push(eq(gatewayObservabilityEvents.testRunId, filters.testRunId));
		if (filters.since) conditions.push(sql`${gatewayObservabilityEvents.occurredAt} >= ${filters.since}::timestamptz`);
		if (filters.until) conditions.push(sql`${gatewayObservabilityEvents.occurredAt} <= ${filters.until}::timestamptz`);
		if (filters.category) conditions.push(eq(gatewayObservabilityEvents.category, filters.category));
		if (filters.eventName) conditions.push(eq(gatewayObservabilityEvents.eventName, filters.eventName));
		return db.select(eventSelection).from(gatewayObservabilityEvents).where(and(...conditions))
			.orderBy(desc(gatewayObservabilityEvents.occurredAt), desc(gatewayObservabilityEvents.id)).limit(filters.limit).offset(filters.offset);
	});
}

export async function insertTestRun(values: TestRunInsert) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(gatewayPresetTestRuns).values(values).returning(testRunSelection);
		if (!row) throw new Error("Test run was not persisted");
		return row;
	});
}

function testRunVisibility(visiblePresetIds: string[]): SQL {
	const visible = (column: SQLWrapper) => visiblePresetIds.length
		? or(isNull(column), inArray(column, visiblePresetIds))!
		: isNull(column);
	return and(visible(gatewayPresetTestRuns.presetId), visible(gatewayPresetTestRuns.baselinePresetId))!;
}

export async function listTestRuns(args: { workspaceId: string; visiblePresetIds: string[]; presetId?: string | null; limit: number; offset: number }) {
	return withDatabase((db) => {
		const conditions: SQL[] = [eq(gatewayPresetTestRuns.workspaceId, args.workspaceId), testRunVisibility(args.visiblePresetIds)];
		if (args.presetId) conditions.push(eq(gatewayPresetTestRuns.presetId, args.presetId));
		return db.select(testRunSelection).from(gatewayPresetTestRuns).where(and(...conditions))
			.orderBy(desc(gatewayPresetTestRuns.createdAt), desc(gatewayPresetTestRuns.id)).limit(args.limit).offset(args.offset);
	});
}

export async function findVisibleTestRun(workspaceId: string, id: string, visiblePresetIds: string[]) {
	return withDatabase(async (db) => {
		const [row] = await db.select(testRunSelection).from(gatewayPresetTestRuns).where(and(
			eq(gatewayPresetTestRuns.workspaceId, workspaceId),
			eq(gatewayPresetTestRuns.id, id),
			testRunVisibility(visiblePresetIds),
		)).limit(1);
		return row ?? null;
	});
}

export async function updateTestRun(workspaceId: string, id: string, patch: TestRunPatch) {
	return withDatabase(async (db) => {
		const [row] = await db.update(gatewayPresetTestRuns).set({ ...patch, updatedAt: new Date().toISOString() })
			.where(and(eq(gatewayPresetTestRuns.workspaceId, workspaceId), eq(gatewayPresetTestRuns.id, id)))
			.returning(testRunSelection);
		return row ?? null;
	});
}
