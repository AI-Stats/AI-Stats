import { z } from "zod";
import { SCIM_BULK_LIMITS, SCIM_URNS } from "./constants";
import { ScimProtocolError } from "./errors";

const operationSchema = z.object({
	method: z.preprocess((value) => String(value).toUpperCase(), z.enum(["POST", "PUT", "PATCH", "DELETE"])), bulkId: z.string().max(128).optional(),
	path: z.string().max(1_024), data: z.unknown().optional(), version: z.string().max(256).optional(),
}).strict();
const bulkSchema = z.object({
	schemas: z.array(z.string()).refine((schemas) => schemas.includes(SCIM_URNS.bulkRequest)),
	failOnErrors: z.number().int().min(0).max(SCIM_BULK_LIMITS.maxOperations).optional(),
	Operations: z.array(operationSchema).min(1).max(SCIM_BULK_LIMITS.maxOperations),
}).strict();

type Resource = { id: unknown; meta: { location: unknown; version?: unknown } };
export type BulkResourceService = {
	create(value: unknown): Promise<Resource>; replace(id: string, value: unknown): Promise<Resource>;
	patch(id: string, value: unknown): Promise<Resource>; delete?(id: string): Promise<void>; deactivate?(id: string): Promise<Resource>;
};
export type BulkAudit = (input: { action: string; outcome: "success" | "failure"; status: number; resourceType: string; resourceId?: string; scimType?: string; detail?: string; correlationId: string }) => Promise<void>;

function resolveBulkIds(value: unknown, ids: Map<string, string>): unknown {
	if (typeof value === "string" && value.startsWith("bulkId:")) {
		const resolved = ids.get(value.slice(7));
		if (!resolved) throw new ScimProtocolError(400, `Unresolved bulkId reference ${value}.`, "invalidValue");
		return resolved;
	}
	if (Array.isArray(value)) return value.map((item) => resolveBulkIds(item, ids));
	if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveBulkIds(item, ids)]));
	return value;
}

function errorBody(error: ScimProtocolError) { return { schemas: [SCIM_URNS.error], status: String(error.status), ...(error.scimType ? { scimType: error.scimType } : {}), detail: error.message }; }

export async function executeBulk(value: unknown, services: { User: BulkResourceService; Group: BulkResourceService }, audit: BulkAudit) {
	const parsed = bulkSchema.safeParse(value);
	if (!parsed.success) throw new ScimProtocolError(400, parsed.error.issues[0]?.message ?? "Invalid Bulk request.", "invalidSyntax");
	const ids = new Map<string, string>(); const responses: unknown[] = []; let failures = 0;
	const correlationId = crypto.randomUUID();
	for (const operation of parsed.data.Operations) {
		const path = /^\/(Users|Groups)(?:\/([0-9a-f-]{36}))?$/i.exec(operation.path);
		if (!path) { const error = new ScimProtocolError(400, `Unsupported Bulk path ${operation.path}.`, "invalidPath"); responses.push({ method: operation.method, bulkId: operation.bulkId, status: String(error.status), response: errorBody(error) }); failures += 1; if (parsed.data.failOnErrors && failures >= parsed.data.failOnErrors) break; continue; }
		const resourceType = path[1].toLowerCase() === "users" ? "User" : "Group"; const id = path[2]; const service = services[resourceType];
		let action = `scim.${resourceType.toLowerCase()}.${operation.method.toLowerCase()}`;
		try {
			let resource: Resource | undefined; let status: number;
			const data = resolveBulkIds(operation.data, ids);
			if (operation.method === "POST") { if (id) throw new ScimProtocolError(400, "Bulk POST paths cannot contain an ID.", "invalidPath"); if (!operation.bulkId) throw new ScimProtocolError(400, "Bulk POST operations require bulkId.", "invalidValue"); resource = await service.create(data); status = 201; ids.set(operation.bulkId, String(resource.id)); }
			else { if (!id) throw new ScimProtocolError(400, `Bulk ${operation.method} paths require an ID.`, "invalidPath"); if (operation.method === "PUT") { resource = await service.replace(id, data); status = 200; } else if (operation.method === "PATCH") { resource = await service.patch(id, data); status = 200; } else { if (service.delete) await service.delete(id); else if (service.deactivate) await service.deactivate(id); else throw new ScimProtocolError(405, "Delete is not supported."); status = 204; } }
			const resourceId = resource ? String(resource.id) : id; await audit({ action, outcome: "success", status, resourceType, resourceId, correlationId });
			responses.push({ method: operation.method, bulkId: operation.bulkId, status: String(status), ...(resource ? { location: String(resource.meta.location), version: resource.meta.version ? String(resource.meta.version) : undefined, response: resource } : {}) });
		} catch (caught) {
			const error = caught instanceof ScimProtocolError ? caught : new ScimProtocolError(500, "The Bulk operation could not be completed."); failures += 1;
			await audit({ action, outcome: "failure", status: error.status, resourceType, resourceId: id, scimType: error.scimType, detail: error.message, correlationId });
			responses.push({ method: operation.method, bulkId: operation.bulkId, status: String(error.status), response: errorBody(error) });
			if (parsed.data.failOnErrors && failures >= parsed.data.failOnErrors) break;
		}
	}
	return { schemas: [SCIM_URNS.bulkResponse], Operations: responses };
}
