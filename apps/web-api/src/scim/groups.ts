import type { SupabaseClient } from "@supabase/supabase-js";
import { ScimProtocolError } from "./errors";
import type { ScimFilter } from "./filter";
import { parseScimGroupInput, toScimGroup, type ScimGroupMember, type ScimGroupRow } from "./group";
import { parseGroupPatch } from "./group-patch";

const GROUP_COLUMNS = "id,external_id,display_name,version,created_at,updated_at";
const FILTER_COLUMNS: Record<string, string> = { displayName: "display_name_normalized", externalId: "external_id", id: "id" };

function databaseError(error: { code?: string } | null, fallback: string): never {
	if (error?.code === "23505") throw new ScimProtocolError(409, "A Group with the same unique attribute already exists.", "uniqueness");
	if (error?.code === "23503") throw new ScimProtocolError(400, "A referenced User does not exist in this workspace.", "invalidValue");
	throw new ScimProtocolError(500, fallback);
}

export class ScimGroupService {
	constructor(private readonly client: SupabaseClient, private readonly workspaceId: string, private readonly baseUrl: string) {}

	private async members(groupId: string): Promise<ScimGroupMember[]> {
		const result = await this.client.from("scim_group_members").select("user_id,user:scim_users!inner(display_name,workspace_id)").eq("workspace_id", this.workspaceId).eq("group_id", groupId).eq("user.workspace_id", this.workspaceId);
		if (result.error) databaseError(result.error, "Unable to retrieve Group members.");
		return (result.data ?? []).map((row) => { const userValue = row.user as unknown; const user = (Array.isArray(userValue) ? userValue[0] : userValue) as { display_name?: string } | null; return { value: String(row.user_id), display: user?.display_name ?? undefined }; });
	}

	private async representation(row: ScimGroupRow) { return toScimGroup(row, await this.members(row.id), this.baseUrl); }

	private async replaceMembers(groupId: string, userIds: string[]) {
		const result = await this.client.rpc("replace_scim_group_members", { p_workspace_id: this.workspaceId, p_group_id: groupId, p_user_ids: [...new Set(userIds)] });
		if (result.error) databaseError(result.error, "Unable to replace Group members.");
	}

	async create(value: unknown) {
		const input = parseScimGroupInput(value);
		const result = await this.client.from("scim_groups").insert({ workspace_id: this.workspaceId, external_id: input.externalId ?? null, display_name: input.displayName }).select(GROUP_COLUMNS).single();
		if (result.error) databaseError(result.error, "Unable to create Group.");
		try { await this.replaceMembers(result.data.id, input.members.map((member) => member.value)); }
		catch (error) { await this.client.from("scim_groups").delete().eq("workspace_id", this.workspaceId).eq("id", result.data.id); throw error; }
		return this.representation(result.data as ScimGroupRow);
	}

	async get(id: string) {
		const result = await this.client.from("scim_groups").select(GROUP_COLUMNS).eq("workspace_id", this.workspaceId).eq("id", id).maybeSingle();
		if (result.error) databaseError(result.error, "Unable to retrieve Group.");
		if (!result.data) throw new ScimProtocolError(404, "Group not found.", "noTarget");
		return this.representation(result.data as ScimGroupRow);
	}

	async list(filter: ScimFilter | null, startIndex: number, count: number) {
		let query = this.client.from("scim_groups").select(GROUP_COLUMNS, { count: "exact" }).eq("workspace_id", this.workspaceId);
		if (filter) for (const condition of filter.conditions) { const column = FILTER_COLUMNS[condition.attribute]; if (!column) throw new ScimProtocolError(400, `Filtering by ${condition.attribute} is not supported for Groups.`, "invalidFilter"); query = query.eq(column, condition.attribute === "displayName" ? condition.value.toLowerCase() : condition.value); }
		const result = count === 0 ? await query.limit(0) : await query.order("created_at").range(startIndex - 1, startIndex + count - 2);
		if (result.error) databaseError(result.error, "Unable to list Groups.");
		return { resources: await Promise.all((result.data ?? []).map((row) => this.representation(row as ScimGroupRow))), totalResults: result.count ?? 0 };
	}

	async replace(id: string, value: unknown) {
		const input = parseScimGroupInput(value);
		const result = await this.client.from("scim_groups").update({ external_id: input.externalId ?? null, display_name: input.displayName }).eq("workspace_id", this.workspaceId).eq("id", id).select(GROUP_COLUMNS).maybeSingle();
		if (result.error) databaseError(result.error, "Unable to replace Group."); if (!result.data) throw new ScimProtocolError(404, "Group not found.", "noTarget");
		await this.replaceMembers(id, input.members.map((member) => member.value)); return this.representation(result.data as ScimGroupRow);
	}

	async patch(id: string, value: unknown) {
		await this.get(id);
		for (const change of parseGroupPatch(value)) {
			if (change.kind === "attributes") { const result = await this.client.from("scim_groups").update(change.values).eq("workspace_id", this.workspaceId).eq("id", id); if (result.error) databaseError(result.error, "Unable to patch Group."); }
			else if (change.kind === "members-replace") await this.replaceMembers(id, change.userIds);
			else if (change.kind === "members-add") { const result = await this.client.from("scim_group_members").upsert(change.userIds.map((userId) => ({ workspace_id: this.workspaceId, group_id: id, user_id: userId })), { onConflict: "group_id,user_id", ignoreDuplicates: true }); if (result.error) databaseError(result.error, "Unable to add Group members."); }
			else { const result = await this.client.from("scim_group_members").delete().eq("workspace_id", this.workspaceId).eq("group_id", id).in("user_id", change.userIds); if (result.error) databaseError(result.error, "Unable to remove Group members."); }
		}
		return this.get(id);
	}

	async delete(id: string) { const result = await this.client.from("scim_groups").delete().eq("workspace_id", this.workspaceId).eq("id", id).select("id").maybeSingle(); if (result.error) databaseError(result.error, "Unable to delete Group."); if (!result.data) throw new ScimProtocolError(404, "Group not found.", "noTarget"); }
}
