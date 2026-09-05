import { z } from "zod";
import { SCIM_URNS } from "./constants";
import { ScimProtocolError } from "./errors";

const memberSchema = z.object({ value: z.string().uuid(), display: z.string().max(512).optional(), $ref: z.string().max(2_048).optional() }).passthrough();
export const scimGroupInputSchema = z.object({
	schemas: z.array(z.string()).max(2).optional(), externalId: z.string().trim().max(512).optional(),
	displayName: z.string().trim().min(1).max(512), members: z.array(memberSchema).max(10_000).optional().default([]),
}).strict();

export type ScimGroupInput = z.infer<typeof scimGroupInputSchema>;
export type ScimGroupRow = { id: string; external_id: string | null; display_name: string; version: number; created_at: string; updated_at: string };
export type ScimGroupMember = { value: string; display?: string };

export function parseScimGroupInput(value: unknown): ScimGroupInput {
	const result = scimGroupInputSchema.safeParse(value);
	if (!result.success) throw new ScimProtocolError(400, result.error.issues[0]?.message ?? "Invalid Group resource.", "invalidValue");
	return result.data;
}

export function toScimGroup(row: ScimGroupRow, members: ScimGroupMember[], baseUrl: string) {
	return {
		schemas: [SCIM_URNS.group], id: row.id, externalId: row.external_id ?? undefined, displayName: row.display_name,
		members: members.map((member) => ({ value: member.value, display: member.display, $ref: `${baseUrl}/Users/${member.value}` })),
		meta: { resourceType: "Group", created: row.created_at, lastModified: row.updated_at, version: `W/\"${row.version}\"`, location: `${baseUrl}/Groups/${row.id}` },
	};
}
