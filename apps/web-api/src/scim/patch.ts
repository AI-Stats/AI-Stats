import { z } from "zod";
import { SCIM_URNS } from "./constants";
import { ScimProtocolError } from "./errors";

const patchSchema = z.object({
	schemas: z.array(z.string()).refine((schemas) => schemas.includes(SCIM_URNS.patch)),
	Operations: z.array(z.object({ op: z.preprocess((value) => String(value).toLowerCase(), z.enum(["add", "remove", "replace"])), path: z.string().max(512).optional(), value: z.unknown().optional() })).min(1).max(100),
}).strict();

const SIMPLE_PATHS: Record<string, string> = {
	userName: "user_name", displayName: "display_name", active: "active", title: "title", userType: "user_type",
	locale: "locale", preferredLanguage: "preferred_language", timezone: "timezone", externalId: "external_id",
	"name.givenName": "given_name", "name.familyName": "family_name",
	[`${SCIM_URNS.enterpriseUser}:employeeNumber`]: "employee_number",
	[`${SCIM_URNS.enterpriseUser}:costCenter`]: "cost_center",
	[`${SCIM_URNS.enterpriseUser}:organization`]: "organization",
	[`${SCIM_URNS.enterpriseUser}:division`]: "division",
	[`${SCIM_URNS.enterpriseUser}:department`]: "department",
	emails: "emails", phoneNumbers: "phone_numbers", addresses: "addresses",
};

export function parseUserPatch(value: unknown): Record<string, unknown> {
	const parsed = patchSchema.safeParse(value);
	if (!parsed.success) throw new ScimProtocolError(400, parsed.error.issues[0]?.message ?? "Invalid PATCH request.", "invalidSyntax");
	const changes: Record<string, unknown> = {};
	for (const operation of parsed.data.Operations) {
		if (!operation.path) {
			if ((operation.op === "add" || operation.op === "replace") && operation.value && typeof operation.value === "object" && !Array.isArray(operation.value)) {
				for (const [path, item] of Object.entries(operation.value)) {
					const column = SIMPLE_PATHS[path];
					if (!column) throw new ScimProtocolError(400, `PATCH path ${path} is not supported.`, "invalidPath");
					changes[column] = item;
				}
				continue;
			}
			throw new ScimProtocolError(400, "A PATCH operation without a path requires an object value.", "invalidValue");
		}
		const column = SIMPLE_PATHS[operation.path];
		if (operation.path === `${SCIM_URNS.enterpriseUser}:manager`) {
			if (operation.op === "remove") { changes.manager_scim_user_id = null; continue; }
			const manager = z.object({ value: z.string().uuid() }).safeParse(operation.value);
			if (!manager.success) throw new ScimProtocolError(400, "manager must reference a valid User ID.", "invalidValue");
			changes.manager_scim_user_id = manager.data.value; continue;
		}
		if (!column) throw new ScimProtocolError(400, `PATCH path ${operation.path} is not supported.`, "invalidPath");
		if (["emails", "phone_numbers", "addresses"].includes(column) && operation.op !== "remove" && (!Array.isArray(operation.value) || operation.value.length > 20)) throw new ScimProtocolError(400, `${operation.path} must be an array with at most 20 values.`, "invalidValue");
		changes[column] = operation.op === "remove" ? (["emails", "phone_numbers", "addresses"].includes(column) ? [] : null) : operation.value;
	}
	if (typeof changes.user_name === "string" && !changes.user_name.trim()) throw new ScimProtocolError(400, "userName cannot be empty.", "invalidValue");
	if (changes.active !== undefined && typeof changes.active !== "boolean") throw new ScimProtocolError(400, "active must be a boolean.", "invalidValue");
	return changes;
}
