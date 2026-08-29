import { describe, expect, it } from "vitest";
import { parseRequestLabels } from "./request-labels";

describe("parseRequestLabels", () => {
    it("parses unique string labels from the Phaseo header", () => {
        const result = parseRequestLabels(new Request("https://gateway.local", {
            headers: {
                "x-phaseo-metadata": JSON.stringify({
                    labels: [
                        { key: "team", value: "support" },
                        { key: "environment", value: "production" },
                    ],
                }),
            },
        }));

        expect(result).toEqual({
            ok: true,
            labels: [
                { key: "team", value: "support" },
                { key: "environment", value: "production" },
            ],
        });
    });

    it("does not read unrelated metadata headers and rejects duplicate keys", () => {
        expect(parseRequestLabels(new Request("https://gateway.local", {
            headers: { "x-unrecognized-metadata": '{"labels":[{"key":"team","value":"support"}]}' },
        }))).toEqual({ ok: true, labels: [] });

        const result = parseRequestLabels(new Request("https://gateway.local", {
            headers: { "x-phaseo-metadata": '{"labels":[{"key":"team","value":"support"},{"key":"team","value":"sales"}]}' },
        }));
        expect(result).toMatchObject({ ok: false, message: expect.stringContaining("duplicate") });
    });

    it("rejects malformed metadata and invalid key characters", () => {
        expect(parseRequestLabels(new Request("https://gateway.local", {
            headers: { "x-phaseo-metadata": "not-json" },
        }))).toMatchObject({ ok: false, message: expect.stringContaining("valid JSON") });

        expect(parseRequestLabels(new Request("https://gateway.local", {
            headers: { "x-phaseo-metadata": '{"labels":[{"key":"team/name","value":"support"}]}' },
        })).ok).toBe(false);
    });
});
