export const trustStates = [
	{ id: "available", label: "Available", description: "In the product today." },
	{ id: "gated", label: "Gated", description: "Available only to eligible workspaces or configurations." },
	{ id: "self-attested", label: "Self-attested", description: "Described from Phaseo's own code, policy, and operations; not independently audited." },
	{ id: "planned", label: "Planned", description: "Intended work, with no delivery date promised." },
	{ id: "independently-certified", label: "Independently certified", description: "Verified by an external certification body. Phaseo has none today." },
] as const;

export type TrustState = (typeof trustStates)[number]["id"];

export const trustPractices: Array<{
	title: string;
	description: string;
	state: TrustState;
}> = [
	{
		title: "Encrypted transport",
		description: "Phaseo's public service is delivered over HTTPS. Requests are forwarded to model providers over encrypted HTTPS connections.",
		state: "self-attested",
	},
	{
		title: "Provider key protection",
		description: "Bring-your-own provider credentials are encrypted with AES-256-GCM before storage. OAuth client secrets are stored as salted, memory-hard hashes.",
		state: "self-attested",
	},
	{
		title: "Scoped access and OAuth",
		description: "Workspace roles and scoped API or OAuth permissions limit access. OAuth connections expose their requested permissions through a consent flow and can be revoked.",
		state: "available",
	},
	{
		title: "Enterprise identity",
		description: "SAML single sign-on and SCIM user and group provisioning exist behind workspace entitlement and feature gates; they are not baseline features for every account.",
		state: "gated",
	},
	{
		title: "Private vulnerability reporting",
		description: "Reports can be submitted through GitHub Security Advisories or security@phaseo.app. Phaseo targets acknowledgement within three business days.",
		state: "available",
	},
];

export const dataPractices: Array<{
	title: string;
	description: string;
	state: TrustState;
}> = [
	{
		title: "Gateway content by default",
		description: "Raw prompt and full model-output text is not persistently stored in Phaseo's primary database or analytics tools. Content passes through transient processing buffers and the selected model provider.",
		state: "self-attested",
	},
	{
		title: "Optional data contribution",
		description: "This is opt-in. Eligible prompts and completions may be redacted and retained for no more than 30 days; revoking consent stops new capture and queues prior captures for deletion.",
		state: "available",
	},
	{
		title: "Provider retention and training",
		description: "Phaseo cannot promise zero data retention across every model provider. Downstream handling follows the provider and route you use; review that provider's policy before sending sensitive data.",
		state: "self-attested",
	},
	{
		title: "Regional routing",
		description: "Provider and geography controls can constrain eligible routes, but Phaseo does not currently promise end-to-end data residency for every request.",
		state: "gated",
	},
];

export const disclosedServiceProviders = [
	{ name: "Supabase", purpose: "Database and account infrastructure", data: "Account, workspace, configuration, and request metadata" },
	{ name: "Stripe", purpose: "Payments and billing", data: "Billing identity and transaction records; Phaseo does not store full card details" },
	{ name: "Analytics providers", purpose: "Product analytics and error diagnosis", data: "Page, device, and usage telemetry; configured to exclude raw gateway prompts and outputs" },
	{ name: "Model providers", purpose: "Process the inference request you route", data: "Inputs, outputs, and necessary request metadata; provider terms and retention apply" },
	{ name: "Connected assistant providers", purpose: "Return authorised OAuth tool results", data: "Only the read-only result and scopes approved through the consent flow" },
] as const;

export const deliberatelyUnclaimed = [
	"SOC 2, ISO 27001, PCI DSS, HIPAA, or another independent Phaseo certification",
	"A completed independent penetration test or published audit report",
	"A contractual uptime SLA for the public service",
	"Universal zero data retention or a guarantee that providers do not train on request data",
	"Guaranteed regional data residency for every provider and route",
	"A downloadable DPA, security whitepaper, or compliance report",
] as const;
