import { apiFetch, getSessionAccessToken } from "../api.js";
import { readSession, writeSession, type Session } from "../session.js";
import type { IntegrationId } from "./types.js";

const KEY_NAMES: Record<IntegrationId, string> = {
	codex: "Phaseo CLI: Codex API Key",
	"claude-code": "Phaseo CLI: Claude Code API Key",
	opencode: "Phaseo CLI: OpenCode API Key",
	"deepseek-harness": "Phaseo CLI: DeepSeek Harness API Key",
	pi: "Phaseo CLI: Pi API Key",
	hermes: "Phaseo CLI: Hermes Agent API Key",
	aider: "Phaseo CLI: Aider API Key",
	cline: "Phaseo CLI: Cline API Key",
	"roo-code": "Phaseo CLI: Roo Code API Key",
	"kilo-code": "Phaseo CLI: Kilo Code API Key",
	continue: "Phaseo CLI: Continue API Key",
	cursor: "Phaseo CLI: Cursor API Key",
	zed: "Phaseo CLI: Zed API Key",
	openclaw: "Phaseo CLI: OpenClaw API Key",
};

function withoutCredential(session: Session, integration: IntegrationId): Session {
	const credentials = { ...(session.integrationGatewayCredentials ?? {}) };
	delete credentials[integration];
	return { ...session, integrationGatewayCredentials: credentials };
}

export async function getIntegrationGatewayCredential(integration: IntegrationId): Promise<string> {
	if (process.env.PHASEO_API_KEY) return process.env.PHASEO_API_KEY;
	const session = await getSessionAccessToken();
	const existing = session.integrationGatewayCredentials?.[integration];
	if (existing) return existing.key;
	const body = await apiFetch(session.apiUrl, "/keys", {
		method: "POST",
		accessToken: session.accessToken,
		body: JSON.stringify({ name: KEY_NAMES[integration] }),
	});
	const key = body?.data?.key;
	const keyId = body?.data?.id;
	if (typeof key !== "string" || !key || typeof keyId !== "string" || !keyId) throw new Error("Phaseo did not return a gateway credential");
	const next = {
		...session,
		integrationGatewayCredentials: { ...(session.integrationGatewayCredentials ?? {}), [integration]: { key, keyId } },
	};
	try {
		await writeSession(next);
	} catch (error) {
		await apiFetch(session.apiUrl, `/keys/${encodeURIComponent(keyId)}`, { method: "DELETE", accessToken: session.accessToken }).catch(() => undefined);
		throw error;
	}
	return key;
}

export async function revokeIntegrationGatewayCredential(integration?: IntegrationId): Promise<boolean> {
	const stored = await readSession();
	if (!stored) return false;
	const targets = integration
		? [[integration, stored.integrationGatewayCredentials?.[integration]] as const]
		: Object.entries(stored.integrationGatewayCredentials ?? {});
	const active = targets.filter((entry): entry is [string, { key: string; keyId: string }] => Boolean(entry[1]));
	if (active.length === 0) return false;
	let session = await getSessionAccessToken();
	for (const [id, credential] of active) {
		await apiFetch(session.apiUrl, `/keys/${encodeURIComponent(credential.keyId)}`, { method: "DELETE", accessToken: session.accessToken });
		session = withoutCredential(session, id as IntegrationId);
	}
	await writeSession(session);
	return true;
}
