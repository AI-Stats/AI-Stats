import {
	countWorkspaceKeys,
	getWorkspaceTier,
	hasPaidWorkspaceAccess,
} from "@/lib/database/repositories/billing";
import { CHAT_MANAGED_KEY_NAME } from "@/lib/gateway/managed-chat-key";

const DEFAULT_NON_ENTERPRISE_KEY_LIMIT = 100;

export function getNonEnterpriseKeyLimit(): number {
	const raw = Number.parseInt(process.env.NON_ENTERPRISE_KEY_LIMIT ?? "", 10);
	if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_NON_ENTERPRISE_KEY_LIMIT;
	return raw;
}

export async function userHasPaidTeamAccess(
	_database: unknown,
	userId: string
): Promise<boolean> {
	return hasPaidWorkspaceAccess(userId);
}

export async function enforceTeamKeyLimit(
	_database: unknown,
	workspaceId: string
): Promise<void> {
	if ((await getWorkspaceTier(workspaceId)) === "enterprise") return;

	const keyLimit = getNonEnterpriseKeyLimit();
	const totalKeys = await countWorkspaceKeys(workspaceId, CHAT_MANAGED_KEY_NAME);

	if (totalKeys >= keyLimit) {
		throw new Error(
			`Key limit reached (${keyLimit}) for this team. Delete an existing key or upgrade to Enterprise for unlimited keys.`
		);
	}
}
