// Purpose: Provider adapter module.
// Why: Encapsulates provider-specific configuration and endpoint mapping.
// How: Exposes provider-specific helpers for routing and execution.

import { dispatchBackground, getBindings, configureRuntime, clearRuntime } from "@/runtime/env";
import { findEnabledByokKey, touchByokKeyLastUsed } from "@/repositories/gateway-context";
import { decryptBYOK, bytesToString } from "@pipeline/byok/decrypt";
import type { ByokKeyMeta } from "@pipeline/before/types";

export type ByokResolution = {
    key: string;
    keyId: string;
    meta: ByokKeyMeta;
};

function orderedMetas(meta: ByokKeyMeta[]): ByokKeyMeta[] {
    return [...meta].sort((a, b) => {
		const aMode = a.routingMode ?? (a.alwaysUse ? "priority" : "fallback");
		const bMode = b.routingMode ?? (b.alwaysUse ? "priority" : "fallback");
		if (aMode !== bMode) return aMode === "priority" ? -1 : 1;
		return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
}

export async function loadByokKey(options: {
    workspaceId: string;
    providerId: string;
    metaList: ByokKeyMeta[];
}): Promise<ByokResolution | null> {
    const { workspaceId, providerId, metaList } = options;
    if (!metaList.length) {
        // console.log(`[DEBUG BYOK] No byokMeta provided for team ${workspaceId}, provider ${providerId}`);
        return null;
    }

    // console.log(`[DEBUG BYOK] Loading BYOK for team ${workspaceId}, provider ${providerId}, meta count: ${metaList.length}`);

    const ordered = orderedMetas(metaList);

    for (const meta of ordered) {
        try {
            // console.log(`[DEBUG BYOK] Trying meta ID ${meta.id}, alwaysUse: ${meta.alwaysUse}`);
            const data = await findEnabledByokKey({ id: meta.id, workspaceId, providerId });
            if (!data) {
                // console.log(`[DEBUG BYOK] No key found for meta ID ${meta.id}: ${error?.message || 'not found'}`);
                continue;
            }

            // console.log(`[DEBUG BYOK] Found and decrypting key for meta ID ${meta.id}`);
            const decrypted = await decryptBYOK({
                key_version: data.key_version,
                enc_iv: data.enc_iv,
                enc_value: data.enc_value,
                enc_tag: data.enc_tag,
                workspace_id: workspaceId,
                provider_id: providerId,
            });

            const key = bytesToString(decrypted);
            decrypted.fill(0);

            dispatchBackground(
                (async () => {
                    configureRuntime(getBindings());
                    try {
						await touchByokKeyLastUsed({ id: data.id, workspaceId });
                    } finally {
                        clearRuntime();
                    }
                })()
            );

            // console.log(`[DEBUG BYOK] Successfully loaded BYOK for meta ID ${meta.id}`);
            return { key, keyId: data.id, meta };
        } catch (err) {
            console.error(`[DEBUG BYOK] Failed to load BYOK key for meta ID ${meta.id}:`, err);
        }
    }

    // console.log(`[DEBUG BYOK] No BYOK keys found for team ${workspaceId}, provider ${providerId}`);
    return null;
}
