import { selectImportRows } from "@phaseo/db/import-service";
import type { PriceCard, PriceRule } from "../../src/pipeline/pricing/types";
import type { Combo } from "./pricing-simulator-types";

type RawPricingRow = {
    rule_id: string;
    provider_id: string;
    api_model_id: string;
    capability_id: string;
    pricing_plan?: string | null;
    meter: string;
    unit?: string | null;
    unit_size?: number | null;
    price_per_unit?: string | number | null;
    currency?: string | null;
    priority?: number | null;
    effective_from: string;
    effective_to?: string | null;
    updated_at: string;
    match?: any[] | null;
};

const KEY_SEPARATOR = ":";

export function makeComboKey(combo: Combo): string {
    return [combo.provider, combo.model, combo.endpoint].join(KEY_SEPARATOR);
}

function parseComboKey(key: string): { provider: string; model: string; endpoint: string } {
    const [provider = "", model = "", endpoint = ""] = key.split(KEY_SEPARATOR);
    return { provider, model, endpoint };
}

function rowsToPriceCard(
    key: string,
    rows: RawPricingRow[],
    conditionMap: Map<string, any[]>
): PriceCard | null {
    if (!rows.length) return null;

    const rules: PriceRule[] = rows.map((row) => ({
        id: String(row.rule_id),
        pricing_plan: row.pricing_plan ?? "standard",
        meter: row.meter,
        unit: row.unit ?? "unit",
        unit_size: Number(row.unit_size ?? 1),
        price_per_unit: row.price_per_unit === null || row.price_per_unit === undefined ? "0" : String(row.price_per_unit),
        currency: row.currency ?? "USD",
        match: conditionMap.get(row.rule_id) ?? [],
        priority: Number(row.priority ?? 100),
    }));

    const version = new Date(Math.max(...rows.map((row) => new Date(row.updated_at).getTime()))).toISOString();
    const effectiveFrom = new Date(Math.min(...rows.map((row) => new Date(row.effective_from).getTime()))).toISOString();
    const effToCandidates = rows.map((row) => row.effective_to).filter(Boolean) as string[];
    const effectiveTo = effToCandidates.length
        ? new Date(Math.min(...effToCandidates.map((value) => new Date(value).getTime()))).toISOString()
        : null;

    const meta = parseComboKey(key);
    return {
        provider: meta.provider,
        model: meta.model,
        endpoint: meta.endpoint,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        currency: "USD",
        version,
        rules,
    };
}

export async function loadPriceCardsForCombos(combos: Combo[]): Promise<Map<string, PriceCard>> {
    const keys = Array.from(new Set(combos.map(makeComboKey)));
    const cards = new Map<string, PriceCard>();
    if (!keys.length) return cards;

    const nowIso = new Date().toISOString();

    const providers = Array.from(new Set(combos.map((combo) => combo.provider)));
    const models = Array.from(new Set(combos.map((combo) => combo.model)));
    const endpoints = Array.from(new Set(combos.map((combo) => combo.endpoint)));

    const routeRows = await selectImportRows({
		table: "v2_model_provider_routes",
		columns: "provider_model_id,provider_slug,model_slug",
		inFilter: { column: "provider_slug", values: providers },
	});
    const routes = routeRows.filter((row) => providers.includes(row.provider_slug) && models.includes(row.model_slug));
    const routeIds = routes.map((row) => row.provider_model_id).filter(Boolean);
    if (!routeIds.length) return cards;

    const skuRows = (await selectImportRows({
		table: "v2_pricing_skus",
		columns: "sku_id,provider_model_id,operation,service_tier_slug,currency,effective_from,effective_to,metadata,updated_at",
		inFilter: { column: "provider_model_id", values: routeIds },
	})).filter((row) => endpoints.includes(row.operation));
    const skuIds = skuRows.map((row) => row.sku_id).filter(Boolean);
    if (!skuIds.length) return cards;
    const meterRows = await selectImportRows({
		table: "v2_pricing_sku_meters",
		columns: "sku_meter_id,sku_id,meter_key,unit,unit_quantity,price_nanos,meter_order,metadata,updated_at,created_at",
		filters: [{ column: "billable", value: true }],
		inFilter: { column: "sku_id", values: skuIds },
	});
    const routeById = new Map(routes.map((row) => [row.provider_model_id, row]));
    const skuById = new Map((skuRows ?? []).map((row) => [row.sku_id, row]));
    const data = (meterRows ?? []).flatMap((meter) => {
        const sku = skuById.get(meter.sku_id);
        const route = sku ? routeById.get(sku.provider_model_id) : null;
        if (!sku || !route) return [];
        const from = sku.effective_from ? new Date(sku.effective_from) : null;
        const to = sku.effective_to ? new Date(sku.effective_to) : null;
        if (from && from > new Date(nowIso)) return [];
        if (to && to <= new Date(nowIso)) return [];
        const skuMetadata = sku.metadata && typeof sku.metadata === "object" ? sku.metadata as Record<string, any> : {};
        const meterMetadata = meter.metadata && typeof meter.metadata === "object" ? meter.metadata as Record<string, any> : {};
        return [{
            rule_id: String(meter.sku_meter_id),
            provider_id: route.provider_slug,
            api_model_id: route.model_slug,
            capability_id: sku.operation,
            pricing_plan: sku.service_tier_slug ?? "standard",
            meter: meter.meter_key,
            unit: meter.unit,
            unit_size: meter.unit_quantity,
            price_per_unit: Number(meter.price_nanos) / 1_000_000_000,
            currency: sku.currency,
            priority: meter.meter_order,
            effective_from: sku.effective_from ?? new Date(0).toISOString(),
            effective_to: sku.effective_to ?? null,
            updated_at: sku.updated_at ?? meter.updated_at ?? meter.created_at ?? nowIso,
            match: skuMetadata.match ?? meterMetadata.match ?? [],
        } satisfies RawPricingRow];
    });

    const conditionMap = new Map<string, any[]>((data ?? []).map((row: any) => [String(row.rule_id), Array.isArray(row.match) ? row.match : []]));

    const grouped = new Map<string, RawPricingRow[]>();
    for (const row of (data ?? []) as RawPricingRow[]) {
        if (!row?.provider_id || !row?.api_model_id || !row?.capability_id) continue;
        const groupKey = `${row.provider_id}:${row.api_model_id}:${row.capability_id}`;
        if (!grouped.has(groupKey)) grouped.set(groupKey, []);
        grouped.get(groupKey)!.push(row);
    }

    for (const key of keys) {
        const rows = grouped.get(key);
        if (!rows?.length) continue;
        const card = rowsToPriceCard(key, rows, conditionMap);
        if (card) cards.set(key, card);
    }

    return cards;
}
