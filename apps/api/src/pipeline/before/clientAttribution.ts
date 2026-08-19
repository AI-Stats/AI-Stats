export type ClientSourceKind = "sdk" | "agent_sdk" | "coding_agent" | "http_client" | "api" | "unknown";

export type ClientAttribution = {
    id: string;
    name: string;
    kind: ClientSourceKind;
    version: string | null;
    detection: "declared" | "user_agent" | "unknown";
};

const DECLARED_CLIENTS: Record<string, { name: string; kind: ClientSourceKind }> = {
    "phaseo-typescript": { name: "Phaseo TypeScript SDK", kind: "sdk" },
    "phaseo-python": { name: "Phaseo Python SDK", kind: "sdk" },
    "phaseo-agent-typescript": { name: "Phaseo Agent SDK", kind: "agent_sdk" },
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
};

function bounded(value: string | null, max = 64): string | null {
    const normalized = value?.trim();
    return normalized ? normalized.slice(0, max) : null;
}

function versionFromUserAgent(userAgent: string, pattern: RegExp): string | null {
    return bounded(userAgent.match(pattern)?.[1] ?? null);
}

function inferredVersion(id: string, userAgent: string): string | null {
    if (id === "codex") {
        return versionFromUserAgent(userAgent, /\bCodex(?: Desktop| CLI)?\/([\w.-]+)/i)
            ?? versionFromUserAgent(userAgent, /\bcodex(?:[_ -]?(?:cli|cli_rs))?[\/-]([\w.-]+)/i);
    }
    if (id === "claude-code") {
        return versionFromUserAgent(userAgent, /\bclaude(?:[_ -]?(?:code|cli))[\/-]([\w.-]+)/i);
    }
    return null;
}

export function detectClientAttribution(headers: Headers): ClientAttribution {
    const userAgent = bounded(headers.get("user-agent"), 1024) ?? "";
    const declaredId = bounded(headers.get("x-phaseo-client"))?.toLowerCase() ?? null;
    const declared = declaredId ? DECLARED_CLIENTS[declaredId] : null;
    if (declaredId && declared) {
        return {
            id: declaredId,
            name: declared.name,
            kind: declared.kind,
            version: bounded(headers.get("x-phaseo-client-version")) ?? inferredVersion(declaredId, userAgent),
            detection: "declared",
        };
    }

    const candidates: Array<{ id: string; pattern: RegExp; version: RegExp }> = [
        { id: "codex", pattern: /\bcodex(?:[_ -]?(?:cli|cli_rs))?\b/i, version: /\bcodex(?:[_ -]?(?:cli|cli_rs))?[\/-]([\w.-]+)/i },
        { id: "claude-code", pattern: /\bclaude(?:[_ -]?(?:code|cli))\b/i, version: /\bclaude(?:[_ -]?(?:code|cli))[\/-]([\w.-]+)/i },
        { id: "phaseo-python", pattern: /\bphaseo-python\b/i, version: /\bphaseo-python[\/-]([\w.-]+)/i },
        { id: "phaseo-typescript", pattern: /\bphaseo-(?:typescript|js)\b/i, version: /\bphaseo-(?:typescript|js)[\/-]([\w.-]+)/i },
        { id: "phaseo-agent-typescript", pattern: /\bphaseo-agent-(?:typescript|js)\b/i, version: /\bphaseo-agent-(?:typescript|js)[\/-]([\w.-]+)/i },
        { id: "openai-typescript", pattern: /\bOpenAI\/JS\b/i, version: /\bOpenAI\/JS\s+([\w.-]+)/i },
        { id: "openai-python", pattern: /\bOpenAI\/Python\b/i, version: /\bOpenAI\/Python\s+([\w.-]+)/i },
        { id: "anthropic-typescript", pattern: /\bAnthropic\/JS\b/i, version: /\bAnthropic\/JS\s+([\w.-]+)/i },
        { id: "anthropic-python", pattern: /\bAnthropic\/Python\b/i, version: /\bAnthropic\/Python\s+([\w.-]+)/i },
        { id: "postman", pattern: /\bPostmanRuntime\b/i, version: /\bPostmanRuntime\/([\w.-]+)/i },
        { id: "insomnia", pattern: /\binsomnia\b/i, version: /\binsomnia\/([\w.-]+)/i },
        { id: "httpie", pattern: /\bHTTPie\b/i, version: /\bHTTPie\/([\w.-]+)/i },
        { id: "curl", pattern: /\bcurl\b/i, version: /\bcurl\/([\w.-]+)/i },
        { id: "axios", pattern: /\baxios\b/i, version: /\baxios\/([\w.-]+)/i },
        { id: "python-requests", pattern: /\bpython-requests\b/i, version: /\bpython-requests\/([\w.-]+)/i },
    ];
    const match = candidates.find((candidate) => candidate.pattern.test(userAgent));
    if (match) {
        const client = DECLARED_CLIENTS[match.id];
        return {
            id: match.id,
            name: client.name,
            kind: client.kind,
            version: versionFromUserAgent(userAgent, match.version),
            detection: "user_agent",
        };
    }

    return { id: "api", name: "Direct API", kind: "api", version: null, detection: "unknown" };
}
