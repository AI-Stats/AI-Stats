import { describe, expect, it } from "vitest";
import { DECLARED_CLIENTS, detectClientAttribution } from "./clientAttribution";

describe("detectClientAttribution", () => {
    it("prefers a recognized declared client", () => {
        const headers = new Headers({
            "x-phaseo-client": "phaseo-agent-typescript",
            "x-phaseo-client-version": "1.4.0",
            "user-agent": "codex/9.9",
        });
        expect(detectClientAttribution(headers)).toEqual({
            id: "phaseo-agent-typescript",
            name: "Phaseo Agent TypeScript SDK",
            kind: "agent_sdk",
            version: "1.4.0",
            detection: "declared",
        });
    });

	it.each([
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

	it("keeps the client source registry exhaustive", () => {
		expect(DECLARED_CLIENTS).toEqual({
			"phaseo-typescript": { name: "Phaseo TypeScript SDK", kind: "sdk" },
			"phaseo-python": { name: "Phaseo Python SDK", kind: "sdk" },
			"phaseo-agent-typescript": { name: "Phaseo Agent TypeScript SDK", kind: "agent_sdk" },
			"phaseo-go": { name: "Phaseo Go SDK", kind: "sdk" },
			"phaseo-java": { name: "Phaseo Java SDK", kind: "sdk" },
			"phaseo-csharp": { name: "Phaseo C# SDK", kind: "sdk" },
			"phaseo-cpp": { name: "Phaseo C++ SDK", kind: "sdk" },
			"phaseo-php": { name: "Phaseo PHP SDK", kind: "sdk" },
			"phaseo-ruby": { name: "Phaseo Ruby SDK", kind: "sdk" },
			"phaseo-rust": { name: "Phaseo Rust SDK", kind: "sdk" },
			"phaseo-agent-python": { name: "Phaseo Agent Python SDK", kind: "agent_sdk" },
			"phaseo-agent-go": { name: "Phaseo Agent Go SDK", kind: "agent_sdk" },
			"phaseo-agent-java": { name: "Phaseo Agent Java SDK", kind: "agent_sdk" },
			"phaseo-agent-csharp": { name: "Phaseo Agent C# SDK", kind: "agent_sdk" },
			"phaseo-agent-php": { name: "Phaseo Agent PHP SDK", kind: "agent_sdk" },
			"phaseo-agent-ruby": { name: "Phaseo Agent Ruby SDK", kind: "agent_sdk" },
			"phaseo-agent-rust": { name: "Phaseo Agent Rust SDK", kind: "agent_sdk" },
			codex: { name: "Codex", kind: "coding_agent" },
			"claude-code": { name: "Claude Code", kind: "coding_agent" },
			"openai-typescript": { name: "OpenAI TypeScript SDK", kind: "sdk" },
			"openai-python": { name: "OpenAI Python SDK", kind: "sdk" },
			"anthropic-typescript": { name: "Anthropic TypeScript SDK", kind: "sdk" },
			"anthropic-python": { name: "Anthropic Python SDK", kind: "sdk" },
			curl: { name: "cURL", kind: "http_client" },
			httpie: { name: "HTTPie", kind: "http_client" },
			postman: { name: "Postman", kind: "http_client" },
			insomnia: { name: "Insomnia", kind: "http_client" },
			axios: { name: "Axios", kind: "http_client" },
			"python-requests": { name: "Python Requests", kind: "http_client" },
		});
	});

	it.each(Object.entries(DECLARED_CLIENTS))(
		"classifies declared source %s with its canonical tuple",
		(id, source) => {
			expect(detectClientAttribution(new Headers({ "x-phaseo-client": id }))).toMatchObject({
				id,
				name: source.name,
				kind: source.kind,
				detection: "declared",
			});
		},
	);

	it("does not treat App attribution as a client source", () => {
		expect(detectClientAttribution(new Headers({ "x-phaseo-client": "phaseo-chat" }))).toEqual({
			id: "api",
			name: "Direct HTTP",
			kind: "api",
			version: null,
			detection: "unknown",
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
            name: "Direct HTTP",
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
