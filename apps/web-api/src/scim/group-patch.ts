import { z } from "zod";
import { SCIM_URNS } from "./constants";
import { ScimProtocolError } from "./errors";

const patchSchema = z.object({
	schemas: z.array(z.string()).refine((schemas) => schemas.includes(SCIM_URNS.patch)),
	Operations: z.array(z.object({ op: z.preprocess((value) => String(value).toLowerCase(), z.enum(["add", "remove", "replace"])), path: z.string().max(512).optional(), value: z.unknown().optional() })).min(1).max(100),
}).strict();
const memberSchema = z.object({ value: z.string().uuid() }).passthrough();
const filteredMemberPath = /^members\[value\s+eq\s+"([0-9a-f-]{36})"\]$/i;

export type GroupPatchChange =
	| { kind: "attributes"; values: { display_name?: string; external_id?: string | null } }
	| { kind: "members-add"; userIds: string[] }
	| { kind: "members-remove"; userIds: string[] }
	| { kind: "members-replace"; userIds: string[] };

export function parseGroupPatch(value: unknown): GroupPatchChange[] {
	const parsed = patchSchema.safeParse(value);
	if (!parsed.success) throw new ScimProtocolError(400, parsed.error.issues[0]?.message ?? "Invalid Group PATCH request.", "invalidSyntax");
	const changes: GroupPatchChange[] = [];
	for (const operation of parsed.data.Operations) {
		const path = operation.path;
		if (path === "displayName" || path === "externalId") {
			if (operation.op === "remove" && path === "displayName") throw new ScimProtocolError(400, "displayName is required.", "mutability");
			if (operation.op !== "remove" && typeof operation.value !== "string") throw new ScimProtocolError(400, `${path} must be a string.`, "invalidValue");
			changes.push({ kind: "attributes", values: path === "displayName" ? { display_name: operation.value as string } : { external_id: operation.op === "remove" ? null : operation.value as string } });
			continue;
		}
		const filtered = path ? filteredMemberPath.exec(path) : null;
		if (filtered) {
			if (operation.op !== "remove") throw new ScimProtocolError(400, "Filtered member paths only support remove.", "invalidPath");
			changes.push({ kind: "members-remove", userIds: [filtered[1]] }); continue;
		}
		if (path === "members" || (!path && operation.value && typeof operation.value === "object" && "members" in operation.value)) {
			const rawMembers = path === "members" ? operation.value : (operation.value as { members: unknown }).members;
			const members = z.array(memberSchema).max(10_000).safeParse(rawMembers);
			if (!members.success) throw new ScimProtocolError(400, "members must contain valid User identifiers.", "invalidValue");
			changes.push({ kind: operation.op === "add" ? "members-add" : operation.op === "remove" ? "members-remove" : "members-replace", userIds: members.data.map((member) => member.value) });
			continue;
		}
		throw new ScimProtocolError(400, `PATCH path ${path ?? "<none>"} is not supported for Groups.`, "invalidPath");
	}
	return changes;
}
