import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeBillSummary } from "../src/pipeline/pricing/engine";
import type { PriceCard, PriceRule } from "../src/pipeline/pricing/types";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cutoverMs = Date.parse("2026-08-16T16:00:00Z");
const usage = {
    input_text_tokens: 1_000_000,
    cached_read_text_tokens: 1_000_000,
    output_text_tokens: 1_000_000,
};

const cases = [
    {
        model: "deepseek/deepseek-v4-flash-0731",
        file: "packages/data/catalog/src/data/pricing/deepseek/deepseek-deepseek-v4-flash-0731/text.generate/pricing.json",
        beforeNanos: 422_800_000,
        offPeakNanos: 887_000_000,
        peakNanos: 1_774_000_000,
    },
    {
        model: "deepseek/deepseek-v4-pro-0813",
        file: "packages/data/catalog/src/data/pricing/deepseek/deepseek-deepseek-v4-pro-0813/text.generate/pricing.json",
        beforeNanos: 1_308_625_000,
        offPeakNanos: 2_662_000_000,
        peakNanos: 5_324_000_000,
    },
];

function loadCard(file: string, atMs: number): PriceCard {
    const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
    const rules = raw.rules
        .filter((rule: Record<string, unknown>) => {
            const from = typeof rule.effective_from === "string" ? Date.parse(rule.effective_from) : -Infinity;
            const to = typeof rule.effective_to === "string" ? Date.parse(rule.effective_to) : Infinity;
            return from <= atMs && atMs < to;
        })
        .map((rule: Record<string, unknown>): PriceRule => ({
            pricing_plan: String(rule.pricing_plan),
            meter: rule.meter as PriceRule["meter"],
            unit: String(rule.unit),
            unit_size: Number(rule.unit_size),
            price_per_unit: String(rule.price_per_unit),
            currency: String(rule.currency),
            match: Array.isArray(rule.match) ? rule.match as PriceRule["match"] : [],
            priority: Number(rule.priority),
            billing_timestamp_basis: rule.billing_timestamp_basis as PriceRule["billing_timestamp_basis"],
            time_windows: Array.isArray(rule.time_windows) ? rule.time_windows as PriceRule["time_windows"] : [],
        }));
    if (rules.length !== 3) throw new Error(`${raw.api_model_id}: expected three active meters, got ${rules.length}`);
    return {
        provider: String(raw.api_provider_id),
        model: String(raw.api_model_id),
        endpoint: String(raw.capability_id),
        effective_from: null,
        effective_to: null,
        currency: "USD",
        version: null,
        rules,
    };
}

function bill(card: PriceCard, providerAcceptedAt: number) {
    return computeBillSummary(usage, card, {
        request_started_at: providerAcceptedAt - 60_000,
        provider_accepted_at: providerAcceptedAt,
        completed_at: providerAcceptedAt + 60_000,
    }, "standard");
}

function totalNanos(result: ReturnType<typeof bill>): number {
    return result.lines.reduce((sum, line) => sum + Number(line.line_nanos ?? 0), 0);
}

let checks = 0;
for (const item of cases) {
    const before = bill(loadCard(item.file, cutoverMs - 1), cutoverMs - 1);
    if (totalNanos(before) !== item.beforeNanos) throw new Error(`${item.model}: incorrect pre-cutover total`);
    if (before.lines.some((line) => line.pricing_time_window !== null)) throw new Error(`${item.model}: pre-cutover window applied`);
    checks += 1;

    const card = loadCard(item.file, cutoverMs);
    const atCutover = bill(card, cutoverMs);
    if (totalNanos(atCutover) !== item.offPeakNanos) throw new Error(`${item.model}: incorrect exact-cutover total`);
    checks += 1;

    const dayStart = Date.parse("2026-08-17T00:00:00Z");
    for (let minute = 0; minute < 24 * 60; minute += 1) {
        const atMs = dayStart + minute * 60_000;
        const utcHour = Math.floor(minute / 60);
        const peak = (utcHour >= 1 && utcHour < 4) || (utcHour >= 6 && utcHour < 10);
        const result = bill(card, atMs);
        const expectedNanos = peak ? item.peakNanos : item.offPeakNanos;
        if (totalNanos(result) !== expectedNanos) throw new Error(`${item.model}: wrong total at ${new Date(atMs).toISOString()}`);
        if (result.lines.some((line) => line.billing_timestamp_basis !== "provider_accept")) {
            throw new Error(`${item.model}: wrong timestamp basis at ${new Date(atMs).toISOString()}`);
        }
        if (result.lines.some((line) => Boolean(line.pricing_time_window) !== peak)) {
            throw new Error(`${item.model}: wrong window at ${new Date(atMs).toISOString()}`);
        }
        checks += 1;
    }

    console.log(`${item.model}: verified pre-cutover, exact cutover, and all 1,440 UTC minutes`);
}

console.log(`DeepSeek pricing cutover rehearsal passed (${checks.toLocaleString()} production-engine checks).`);
