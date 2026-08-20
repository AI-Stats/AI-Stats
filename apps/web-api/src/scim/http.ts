import { SCIM_CONTENT_TYPE, SCIM_URNS } from "./constants";

export type ScimErrorType =
	| "invalidFilter"
	| "tooMany"
	| "uniqueness"
	| "mutability"
	| "invalidSyntax"
	| "invalidPath"
	| "noTarget"
	| "invalidValue"
	| "invalidVers"
	| "sensitive";

export function scimJson(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": SCIM_CONTENT_TYPE,
			"cache-control": "no-store",
		},
	});
}

export function scimError(status: number, detail: string, scimType?: ScimErrorType): Response {
	return scimJson({
		schemas: [SCIM_URNS.error],
		status: String(status),
		...(scimType ? { scimType } : {}),
		detail,
	}, status);
}

export function scimListResponse<T>(Resources: T[], startIndex = 1, totalResults = Resources.length) {
	return {
		schemas: [SCIM_URNS.listResponse],
		totalResults,
		startIndex,
		itemsPerPage: Resources.length,
		Resources,
	};
}
