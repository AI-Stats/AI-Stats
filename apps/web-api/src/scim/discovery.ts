import { SCIM_BULK_LIMITS, SCIM_URNS } from "./constants";
import { scimListResponse } from "./http";

export const serviceProviderConfig = {
	schemas: [SCIM_URNS.serviceProviderConfig],
	documentationUri: "https://docs.phaseo.app/v1/security/scim",
	patch: { supported: true },
	bulk: { supported: true, ...SCIM_BULK_LIMITS },
	filter: { supported: true, maxResults: 100 },
	changePassword: { supported: false },
	sort: { supported: false },
	etag: { supported: false },
	authenticationSchemes: [{
		type: "oauthbearertoken",
		name: "Bearer token",
		description: "Workspace-scoped SCIM bearer token.",
		specUri: "https://www.rfc-editor.org/rfc/rfc6750",
		primary: true,
	}],
};

export const resourceTypes = scimListResponse([
	{
		schemas: [SCIM_URNS.resourceType],
		id: "User",
		name: "User",
		endpoint: "/Users",
		schema: SCIM_URNS.user,
		schemaExtensions: [{ schema: SCIM_URNS.enterpriseUser, required: false }],
	},
	{
		schemas: [SCIM_URNS.resourceType],
		id: "Group",
		name: "Group",
		endpoint: "/Groups",
		schema: SCIM_URNS.group,
		schemaExtensions: [],
	},
]);

const commonAttributes = [
	{ name: "id", type: "string", multiValued: false, required: false, caseExact: true, mutability: "readOnly", returned: "always", uniqueness: "server" },
	{ name: "externalId", type: "string", multiValued: false, required: false, caseExact: true, mutability: "readWrite", returned: "default", uniqueness: "none" },
];

export const schemas = scimListResponse([
	{
		schemas: [SCIM_URNS.schema], id: SCIM_URNS.user, name: "User", description: "Phaseo SCIM user",
		attributes: [...commonAttributes,
			{ name: "userName", type: "string", multiValued: false, required: true, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "server" },
			{ name: "displayName", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" },
			{ name: "active", type: "boolean", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
			{ name: "name", type: "complex", multiValued: false, required: false, mutability: "readWrite", returned: "default", subAttributes: [
				{ name: "givenName", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" },
				{ name: "familyName", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" },
			] },
			{ name: "emails", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default", subAttributes: [
				{ name: "value", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" },
				{ name: "type", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none", canonicalValues: ["work", "home", "other"] },
				{ name: "primary", type: "boolean", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
			] },
			{ name: "phoneNumbers", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default", subAttributes: [
				{ name: "value", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" },
				{ name: "type", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" },
				{ name: "primary", type: "boolean", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
			] },
			{ name: "addresses", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default", subAttributes: ["formatted", "streetAddress", "locality", "region", "postalCode", "country", "type"].map((name) => ({ name, type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" })) },
			...["title", "userType", "preferredLanguage", "locale", "timezone"].map((name) => ({ name, type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" })),
		],
	},
	{
		schemas: [SCIM_URNS.schema], id: SCIM_URNS.enterpriseUser, name: "EnterpriseUser", description: "Enterprise user attributes",
		attributes: [
			...["employeeNumber", "costCenter", "organization", "division", "department"].map((name) => ({ name, type: "string", multiValued: false, required: false, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "none" })),
			{ name: "manager", type: "complex", multiValued: false, required: false, mutability: "readWrite", returned: "default", subAttributes: [
				{ name: "value", type: "string", multiValued: false, required: false, caseExact: true, mutability: "readWrite", returned: "default", uniqueness: "none", referenceTypes: ["User"] },
				{ name: "$ref", type: "reference", multiValued: false, required: false, caseExact: true, mutability: "readOnly", returned: "default", uniqueness: "none", referenceTypes: ["User"] },
				{ name: "displayName", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readOnly", returned: "default", uniqueness: "none" },
			] },
		],
	},
	{
		schemas: [SCIM_URNS.schema], id: SCIM_URNS.group, name: "Group", description: "Phaseo SCIM group",
		attributes: [...commonAttributes,
			{ name: "displayName", type: "string", multiValued: false, required: true, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "server" },
			{ name: "members", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default", subAttributes: [
				{ name: "value", type: "string", multiValued: false, required: false, caseExact: true, mutability: "immutable", returned: "default", uniqueness: "none", referenceTypes: ["User"] },
				{ name: "$ref", type: "reference", multiValued: false, required: false, caseExact: true, mutability: "immutable", returned: "default", uniqueness: "none", referenceTypes: ["User"] },
				{ name: "display", type: "string", multiValued: false, required: false, caseExact: false, mutability: "readOnly", returned: "default", uniqueness: "none" },
			] },
		],
	},
]);
