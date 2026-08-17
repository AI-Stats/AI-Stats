import type { CLIOptions, Combo } from "./pricing-simulator-types";
import { selectImportRows } from "@phaseo/db/import-service";

export async function loadCombos(options: CLIOptions): Promise<Combo[]> {
	const providerModelRows = await selectImportRows({
		table: "v2_model_provider_routes",
		columns: "provider_model_id,provider_slug,model_slug,routing_enabled,effective_from,effective_to",
	});

    const providerModels = providerModelRows
		.filter((row) => !options.provider?.length || options.provider.includes(String(row.provider_slug)))
		.filter((row) => !options.model?.length || options.model.includes(String(row.model_slug)))
		.map((row) => ({
        provider_api_model_id: row.provider_model_id,
        provider_id: row.provider_slug,
        api_model_id: row.model_slug,
        is_active_gateway: row.routing_enabled,
        effective_from: row.effective_from,
        effective_to: row.effective_to,
    }));
    const providerModelIds = providerModels
        .map((row) => row.provider_api_model_id)
        .filter((id): id is string => Boolean(id));
    if (!providerModelIds.length) return [];

	const capabilities = await selectImportRows({
		table: "v2_route_capabilities",
		columns: "provider_model_id,capability_id",
		filters: options.endpoint ? [{ column: "capability_id", value: options.endpoint }] : [],
		inFilter: { column: "provider_model_id", values: providerModelIds },
	});

    const providerById = new Map<string, any>();
    for (const row of providerModels ?? []) {
        if (row.provider_api_model_id) providerById.set(row.provider_api_model_id, row);
    }

    const uniqueKeys = new Set<string>();
    const combos: Combo[] = [];

    for (const cap of capabilities ?? []) {
        const pm = providerById.get(cap.provider_model_id);
        if (!pm || !cap.capability_id) continue;
        if (!options.includeInactive) {
            if (pm.is_active_gateway !== true) continue;
        }

        const key = `${pm.provider_id}:${pm.api_model_id}:${cap.capability_id}`;
        if (uniqueKeys.has(key)) continue;
        uniqueKeys.add(key);
        combos.push({
            provider: pm.provider_id,
            model: pm.api_model_id,
            endpoint: cap.capability_id,
        });
    }

    return combos;
}
