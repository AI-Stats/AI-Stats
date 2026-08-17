import "server-only";

import { gatewayFeedback, presets } from "@phaseo/db/preset-schema";
import { and, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "@phaseo/db/query";

import { getDatabase } from "../drizzle";

export async function listWorkspacePresets(workspaceId: string) {
	return getDatabase().select({
		id: presets.id,
		name: presets.name,
		slug: presets.slug,
		description: presets.description,
		config: presets.config,
	}).from(presets).where(eq(presets.workspaceId, workspaceId)).orderBy(presets.name);
}

export async function listPresetFeedbackPage(args: {
	workspaceId: string;
	presetIds: string[];
	fromIso: string;
	toIso: string;
	rating: string;
	metadataKey: string;
	metadataValue: string;
	offset: number;
	limit: number;
}) {
	const filters: SQL[] = [
		eq(gatewayFeedback.workspaceId, args.workspaceId),
		inArray(gatewayFeedback.presetId, args.presetIds),
		gte(gatewayFeedback.createdAt, args.fromIso),
		lte(gatewayFeedback.createdAt, args.toIso),
	];
	if (args.rating === "unrated") filters.push(isNull(gatewayFeedback.rating));
	else if (args.rating !== "all") filters.push(eq(gatewayFeedback.rating, args.rating));
	if (args.metadataKey && args.metadataValue) {
		filters.push(sql`${gatewayFeedback.metadataDimensions} @> ${JSON.stringify({ [args.metadataKey]: args.metadataValue })}::jsonb`);
	}

	return getDatabase().select({
		id: gatewayFeedback.id,
		request_id: gatewayFeedback.requestId,
		session_id: gatewayFeedback.sessionId,
		preset_id: gatewayFeedback.presetId,
		rating: gatewayFeedback.rating,
		score: gatewayFeedback.score,
		reason: gatewayFeedback.reason,
		reason_tags: gatewayFeedback.reasonTags,
		comment: gatewayFeedback.comment,
		metadata_dimensions: gatewayFeedback.metadataDimensions,
		end_user_id: gatewayFeedback.endUserId,
		created_at: gatewayFeedback.createdAt,
	}).from(gatewayFeedback).where(and(...filters))
		.orderBy(desc(gatewayFeedback.createdAt), desc(gatewayFeedback.id))
		.limit(args.limit).offset(args.offset);
}
