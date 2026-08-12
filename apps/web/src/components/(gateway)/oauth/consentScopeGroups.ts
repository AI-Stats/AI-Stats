export type ConsentScopeGroupKey =
	| "identity"
	| "gateway"
	| "catalog"
	| "data"
	| "workspaces"
	| "keys"
	| "presets"
	| "settings"
	| "guardrails"
	| "management-keys"
	| "oauth-apps"
	| `other:${string}`;

export type ConsentScopeGroup = {
	key: ConsentScopeGroupKey;
	label: string;
	description: string;
	scopes: string[];
};

const GROUP_META: Record<
	Exclude<ConsentScopeGroupKey, `other:${string}`>,
	Pick<ConsentScopeGroup, "label" | "description">
> = {
	identity: {
		label: "Account & identity",
		description: "Your sign-in identity and basic account details.",
	},
	gateway: {
		label: "Gateway",
		description: "Model requests made through your Phaseo account.",
	},
	catalog: {
		label: "Models & pricing",
		description: "Model, provider, availability, and pricing reference data.",
	},
	data: {
		label: "Usage & data",
		description: "Credits, activity, analytics, generations, and feedback.",
	},
	workspaces: {
		label: "Workspaces",
		description: "Workspace membership, metadata, and lifecycle.",
	},
	keys: {
		label: "API keys",
		description: "API key metadata and key lifecycle operations.",
	},
	presets: {
		label: "Presets",
		description: "Saved routing and prompt presets.",
	},
	settings: {
		label: "Settings",
		description: "Workspace settings and configuration.",
	},
	guardrails: {
		label: "Guardrails",
		description: "Safety policies and guardrail configuration.",
	},
	"management-keys": {
		label: "Management keys",
		description: "Machine-level management credentials.",
	},
	"oauth-apps": {
		label: "OAuth apps",
		description: "OAuth client and integration configuration.",
	},
};

function groupKeyForScope(scope: string): ConsentScopeGroupKey {
	if (["openid", "profile", "email", "me:read"].includes(scope)) return "identity";
	if (scope.startsWith("gateway:")) return "gateway";
	if (/^(models|providers|pricing):/.test(scope)) return "catalog";
	if (/^(credits|activity|analytics|generations|feedback):/.test(scope)) return "data";
	if (scope.startsWith("workspaces:")) return "workspaces";
	if (scope.startsWith("keys:")) return "keys";
	if (scope.startsWith("presets:")) return "presets";
	if (scope.startsWith("settings:")) return "settings";
	if (scope.startsWith("guardrails:")) return "guardrails";
	if (scope.startsWith("management_keys:")) return "management-keys";
	if (scope.startsWith("oauth_clients:")) return "oauth-apps";
	return `other:${scope.split(":")[0] || "other"}`;
}

function fallbackGroupMeta(key: `other:${string}`) {
	const rawLabel = key.slice("other:".length).replaceAll("_", " ").trim() || "Other";
	const label = rawLabel.replace(/\b\w/g, (character) => character.toUpperCase());
	return {
		label,
		description: `Permissions related to ${rawLabel}.`,
	};
}

export function groupConsentScopes(requestedScopes: string[]): ConsentScopeGroup[] {
	const groups = new Map<ConsentScopeGroupKey, ConsentScopeGroup>();
	const uniqueScopes = Array.from(
		new Set(requestedScopes.map((scope) => scope.trim()).filter(Boolean)),
	);

	for (const scope of uniqueScopes) {
		const key = groupKeyForScope(scope);
		const existing = groups.get(key);
		if (existing) {
			existing.scopes.push(scope);
			continue;
		}

		const meta = key.startsWith("other:")
			? fallbackGroupMeta(key as `other:${string}`)
			: GROUP_META[key as Exclude<ConsentScopeGroupKey, `other:${string}`>];
		groups.set(key, { key, ...meta, scopes: [scope] });
	}

	return Array.from(groups.values());
}
