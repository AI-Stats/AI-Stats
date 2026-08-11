import { apiFetch, getSessionAccessToken } from "../api.js";
import { readSession, writeSession, type Session } from "../session.js";

const INTEGRATION_KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const INTEGRATION_KEY_REFRESH_WINDOW_MS = 5 * 60 * 1000;

function withoutIntegrationCredential(session: Session): Session {
	const {
		integrationGatewayKey: _key,
		integrationGatewayKeyId: _keyId,
		integrationGatewayKeyExpiresAt: _expiresAt,
		...rest
	} = session;
	return rest;
}

async function createIntegrationCredential(session: Session): Promise<Session> {
	const expiresAt = Date.now() + INTEGRATION_KEY_LIFETIME_MS;
	const body = await apiFetch(session.apiUrl, "/keys", {
		method: "POST",
		accessToken: session.accessToken,
		body: JSON.stringify({
			name: "Phaseo coding-agent integration",
			expires_at: new Date(expiresAt).toISOString(),
		}),
	});
	const key = body?.data?.key;
	const keyId = body?.data?.id;
	if (typeof key !== "string" || !key || typeof keyId !== "string" || !keyId) {
		throw new Error("Phaseo did not return a gateway credential");
	}
	const next: Session = {
		...session,
		integrationGatewayKey: key,
		integrationGatewayKeyId: keyId,
		integrationGatewayKeyExpiresAt: expiresAt,
	};
	try {
		await writeSession(next);
	} catch (error) {
		await apiFetch(session.apiUrl, `/keys/${encodeURIComponent(keyId)}`, {
			method: "DELETE",
			accessToken: session.accessToken,
		}).catch(() => undefined);
		throw error;
	}
	return next;
}

export async function getIntegrationGatewayCredential(): Promise<string> {
	if (process.env.PHASEO_API_KEY) return process.env.PHASEO_API_KEY;
	let session = await getSessionAccessToken();
	if (
		session.integrationGatewayKey &&
		session.integrationGatewayKeyId &&
		(session.integrationGatewayKeyExpiresAt ?? 0) - Date.now() > INTEGRATION_KEY_REFRESH_WINDOW_MS
	) {
		return session.integrationGatewayKey;
	}
	if (session.integrationGatewayKeyId) {
		await apiFetch(session.apiUrl, `/keys/${encodeURIComponent(session.integrationGatewayKeyId)}`, {
			method: "DELETE",
			accessToken: session.accessToken,
		}).catch(() => undefined);
		session = withoutIntegrationCredential(session);
		await writeSession(session);
	}
	return (await createIntegrationCredential(session)).integrationGatewayKey!;
}

export async function revokeIntegrationGatewayCredential(): Promise<boolean> {
	const stored = await readSession();
	if (!stored?.integrationGatewayKeyId) return false;
	const session = await getSessionAccessToken();
	await apiFetch(session.apiUrl, `/keys/${encodeURIComponent(stored.integrationGatewayKeyId)}`, {
		method: "DELETE",
		accessToken: session.accessToken,
	});
	await writeSession(withoutIntegrationCredential(session));
	return true;
}
