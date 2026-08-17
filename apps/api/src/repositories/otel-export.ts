import {
	broadcastDestinationKeys,
	broadcastDestinationRuleGroups,
	broadcastDestinationRules,
	otelExportOutbox,
	workspaceBroadcastDestinations,
} from "@phaseo/db/schema";
import { and, eq, inArray, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

const destinationSelection = {
	id: workspaceBroadcastDestinations.id,
	destination_id: workspaceBroadcastDestinations.destinationId,
	destination_config: workspaceBroadcastDestinations.destinationConfig,
	destination_config_ciphertext: workspaceBroadcastDestinations.destinationConfigCiphertext,
	destination_config_iv: workspaceBroadcastDestinations.destinationConfigIv,
	destination_config_key_version: workspaceBroadcastDestinations.destinationConfigKeyVersion,
	privacy_exclude_prompts_and_outputs: workspaceBroadcastDestinations.privacyExcludePromptsAndOutputs,
	sampling_rate: workspaceBroadcastDestinations.samplingRate,
	group_join_operator: workspaceBroadcastDestinations.groupJoinOperator,
	include_generation_metadata: workspaceBroadcastDestinations.includeGenerationMetadata,
	include_cost_metadata: workspaceBroadcastDestinations.includeCostMetadata,
	include_identity_metadata: workspaceBroadcastDestinations.includeIdentityMetadata,
	include_request_context: workspaceBroadcastDestinations.includeRequestContext,
	enabled: workspaceBroadcastDestinations.enabled,
};

export async function listDestinations(workspaceId: string) {
	return withDatabase(async (db) => {
		const destinations = await db.select(destinationSelection).from(workspaceBroadcastDestinations).where(and(
			eq(workspaceBroadcastDestinations.workspaceId, workspaceId),
			eq(workspaceBroadcastDestinations.enabled, true),
			inArray(workspaceBroadcastDestinations.destinationId, ["otel_collector", "webhook"]),
		));
		if (!destinations.length) return [];
		const ids = destinations.map((destination) => destination.id);
		const [keys, groups] = await Promise.all([
			db.select({ destination_id: broadcastDestinationKeys.destinationId, key_id: broadcastDestinationKeys.keyId, filter_mode: broadcastDestinationKeys.filterMode })
				.from(broadcastDestinationKeys).where(inArray(broadcastDestinationKeys.destinationId, ids)),
			db.select({ id: broadcastDestinationRuleGroups.id, destination_id: broadcastDestinationRuleGroups.destinationId, match_operator: broadcastDestinationRuleGroups.matchOperator })
				.from(broadcastDestinationRuleGroups).where(inArray(broadcastDestinationRuleGroups.destinationId, ids)),
		]);
		const rules = groups.length ? await db.select({ rule_group_id: broadcastDestinationRules.ruleGroupId, field: broadcastDestinationRules.field, condition: broadcastDestinationRules.condition, value: broadcastDestinationRules.value })
			.from(broadcastDestinationRules).where(inArray(broadcastDestinationRules.ruleGroupId, groups.map((group) => group.id))) : [];
		return destinations.map((destination) => ({
			...destination,
			broadcast_destination_keys: keys.filter((key) => key.destination_id === destination.id).map(({ key_id, filter_mode }) => ({ key_id, filter_mode })),
			broadcast_destination_rule_groups: groups.filter((group) => group.destination_id === destination.id).map((group) => ({
				match_operator: group.match_operator,
				broadcast_destination_rules: rules.filter((rule) => rule.rule_group_id === group.id).map(({ field, condition, value }) => ({ field, condition, value })),
			})),
		}));
	});
}

export async function enqueue(rows: Array<typeof otelExportOutbox.$inferInsert>): Promise<void> {
	if (!rows.length) return;
	await withDatabase(async (db) => { await db.insert(otelExportOutbox).values(rows).onConflictDoNothing({
		target: [otelExportOutbox.destinationId, otelExportOutbox.eventId],
	}); });
}

export async function claim(limit: number) {
	return withDatabase(async (db) => [...await db.execute<Record<string, unknown>>(sql`
		with candidates as (
			select id from ${otelExportOutbox}
			where (status = 'pending' or (status = 'processing' and lease_expires_at < now()))
				and next_attempt_at <= now()
			order by next_attempt_at, created_at
			for update skip locked limit ${Math.max(1, Math.min(limit, 500))}
		), claimed as (
			update ${otelExportOutbox} outbox set status = 'processing', attempts = attempts + 1,
				lease_expires_at = now() + interval '15 minutes', updated_at = now()
			from candidates where outbox.id = candidates.id returning outbox.*
		)
		select id::text, destination_id::text, payload, attempts from claimed
	`)]);
}

export async function getDestination(id: string) {
	return withDatabase(async (db) => (await db.select(destinationSelection).from(workspaceBroadcastDestinations)
		.where(eq(workspaceBroadcastDestinations.id, id)).limit(1))[0] ?? null);
}

export async function updateOutbox(id: string, patch: Partial<typeof otelExportOutbox.$inferInsert>): Promise<void> {
	await withDatabase(async (db) => { await db.update(otelExportOutbox).set(patch).where(eq(otelExportOutbox.id, id)); });
}
