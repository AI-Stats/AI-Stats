export const SCIM_CONTENT_TYPE = "application/scim+json";

export const SCIM_URNS = {
	error: "urn:ietf:params:scim:api:messages:2.0:Error",
	listResponse: "urn:ietf:params:scim:api:messages:2.0:ListResponse",
	bulkRequest: "urn:ietf:params:scim:api:messages:2.0:BulkRequest",
	bulkResponse: "urn:ietf:params:scim:api:messages:2.0:BulkResponse",
	patch: "urn:ietf:params:scim:api:messages:2.0:PatchOp",
	user: "urn:ietf:params:scim:schemas:core:2.0:User",
	enterpriseUser: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
	group: "urn:ietf:params:scim:schemas:core:2.0:Group",
	serviceProviderConfig: "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig",
	resourceType: "urn:ietf:params:scim:schemas:core:2.0:ResourceType",
	schema: "urn:ietf:params:scim:schemas:core:2.0:Schema",
} as const;

export const SCIM_BULK_LIMITS = {
	maxOperations: 100,
	maxPayloadSize: 1_048_576,
} as const;
