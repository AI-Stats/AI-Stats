import { describe, expect, it } from "vitest";
import { detectClientAttribution } from "./clientAttribution";

describe("detectClientAttribution", () => {
    it("prefers a recognized declared client", () => {
        const headers = new Headers({
            "x-phaseo-client": "phaseo-agent-typescript",
            "x-phaseo-client-version": "1.4.0",
            "user-agent": "codex/9.9",
        });
        expect(detectClientAttribution(headers)).toEqual({
            id: "phaseo-agent-typescript",
            name: "Phaseo Agent SDK",
            kind: "agent_sdk",
            version: "1.4.0",
            detection: "declared",
        });
    });

	it.each([
		["phaseo-chat", "Phaseo Chat", "app"],
		["phaseo-go", "Phaseo Go SDK", "sdk"],
		["phaseo-cpp", "Phaseo C++ SDK", "sdk"],
		["phaseo-agent-python", "Phaseo Agent Python SDK", "agent_sdk"],
		["phaseo-agent-rust", "Phaseo Agent Rust SDK", "agent_sdk"],
	])("recognizes declared Phaseo client %s", (id, name, kind) => {
		expect(detectClientAttribution(new Headers({ "x-phaseo-client": id }))).toMatchObject({
			id,
			name,
			kind,
			detection: "declared",
		});
	});

    it("recognizes Codex from its user agent", () => {
        expect(detectClientAttribution(new Headers({ "user-agent": "codex_cli_rs/0.42.0" }))).toMatchObject({
            id: "codex",
            version: "0.42.0",
            detection: "user_agent",
        });
    });

    it("reads the version from Codex Desktop's observed user agent", () => {
        expect(detectClientAttribution(new Headers({
            "x-phaseo-client": "codex",
            "originator": "Codex Desktop",
            "user-agent": "Codex Desktop/0.145.0 (Windows 10.0.26200; x86_64)",
        }))).toMatchObject({
            id: "codex",
            version: "0.145.0",
            detection: "declared",
        });
    });

    it("recognizes Claude Code's CLI user agent", () => {
        expect(detectClientAttribution(new Headers({ "user-agent": "claude-cli/1.0.83" }))).toMatchObject({
            id: "claude-code",
            version: "1.0.83",
            detection: "user_agent",
        });
    });

    it("does not trust arbitrary declared names", () => {
        expect(detectClientAttribution(new Headers({ "x-phaseo-client": "Definitely Codex" }))).toEqual({
            id: "api",
            name: "Direct API",
            kind: "api",
            version: null,
            detection: "unknown",
        });
    });

    it.each([
        ["OpenAI/JS 5.12.0", "openai-typescript", "5.12.0"],
        ["OpenAI/Python 1.99.1", "openai-python", "1.99.1"],
        ["Anthropic/JS 0.94.0", "anthropic-typescript", "0.94.0"],
        ["curl/8.12.1", "curl", "8.12.1"],
        ["PostmanRuntime/7.43.0", "postman", "7.43.0"],
        ["python-requests/2.32.4", "python-requests", "2.32.4"],
    ])("recognizes common HTTPS client %s", (userAgent, id, version) => {
        expect(detectClientAttribution(new Headers({ "user-agent": userAgent }))).toMatchObject({
            id,
            version,
            detection: "user_agent",
        });
    });
});
