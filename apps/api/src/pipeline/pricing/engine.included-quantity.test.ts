import { describe, expect, it } from "vitest";
import { computeBillSummary } from "./engine";
import type { PriceCard } from "./types";

const card: PriceCard = {
    provider: "minimax",
    model: "minimax/h3",
    endpoint: "video.generate",
    effective_from: null,
    effective_to: null,
    currency: "USD",
    version: null,
    rules: [{
        pricing_plan: "standard",
        meter: "input_image",
        unit: "image",
        unit_size: 1,
        price_per_unit: "0.04",
        currency: "USD",
        match: [],
        priority: 100,
        included_quantity: 5,
    }],
};

describe("pricing engine included quantity handling", () => {
    it("does not bill usage within the included quantity", () => {
        const result = computeBillSummary({ input_image: 5 }, card);

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0].quantity).toBe(5);
        expect(result.lines[0].billable_units).toBe(0);
        expect(result.lines[0].line_nanos).toBe(0);
        expect(result.lines[0].bill_mode).toBe("over");
        expect(result.lines[0].included_quantity).toBe(5);
    });

    it("bills only usage above the included quantity", () => {
        const result = computeBillSummary({ input_image: 7 }, card);

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0].billable_units).toBe(2);
        expect(result.lines[0].line_nanos).toBe(80_000_000);
        expect(result.lines[0].line_cost_usd).toBe("0.080000000");
    });
});

describe("MiniMax H3 input video pricing", () => {
    const videoCard: PriceCard = {
        ...card,
        rules: [
            {
                pricing_plan: "standard",
                meter: "input_video_seconds",
                unit: "second",
                unit_size: 1,
                price_per_unit: "0.13",
                currency: "USD",
                match: [{
                    path: "video_params.resolution",
                    op: "eq",
                    value: "2K",
                }],
                priority: 100,
            },
            {
                pricing_plan: "standard",
                meter: "input_video_seconds",
                unit: "second",
                unit_size: 1,
                price_per_unit: "0.09",
                currency: "USD",
                match: [{
                    path: "video_params.resolution",
                    op: "eq",
                    value: "768P",
                }],
                priority: 100,
            },
        ],
    };

    it.each([
        ["2K", 1_300_000_000],
        ["768P", 900_000_000],
    ])("selects the %s input-video rate", (resolution, expectedNanos) => {
        const result = computeBillSummary(
            { input_video_seconds: 10 },
            videoCard,
            { video_params: { resolution } },
        );

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0].line_nanos).toBe(expectedNanos);
    });
});
