import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { codexAdapter, renderCodexProfile } from "../src/integrations/adapters/codex.js";
import { claudeCodeAdapter, renderClaudeSettings } from "../src/integrations/adapters/claude-code.js";
import { applyChanges } from "../src/integrations/files.js";
import { runIntegrationCommand } from "../src/integrations/index.js";
import { getIntegrationGatewayCredential, revokeIntegrationGatewayCredential } from "../src/integrations/credential.js";
import { readSession, writeSession } from "../src/session.js";

test("Codex profile uses the Responses API without embedding a credential", () => {
	const profile = renderCodexProfile("anthropic/claude-sonnet-4.6");
	assert.match(profile, /wire_api = "responses"/);
	assert.match(profile, /\[model_providers\.phaseo\.auth\]/);
	assert.match(profile, /command = "phaseo"/);
	assert.match(profile, /model = "anthropic\/claude-sonnet-4.6"/);
	assert.doesNotMatch(profile, /phaseo_v1_sk_/);
	assert.doesNotMatch(profile, /env_key/);
});

test("Claude Code settings preserve unrelated values", () => {
	const rendered = renderClaudeSettings("/tmp/settings.json", JSON.stringify({
		permissions: { allow: ["Read"] },
		env: { KEEP_ME: "yes" },
	}));
	const settings = JSON.parse(rendered);
	assert.deepEqual(settings.permissions, { allow: ["Read"] });
	assert.equal(settings.env.KEEP_ME, "yes");
	assert.equal(settings.env.ANTHROPIC_BASE_URL, "https://api.phaseo.app");
	assert.equal(settings.env.CLAUDE_CODE_API_KEY_HELPER_TTL_MS, "300000");
	assert.equal(settings.env.ANTHROPIC_API_KEY, "");
	assert.equal(settings.env.ANTHROPIC_AUTH_TOKEN, "");
	assert.equal(settings.apiKeyHelper, "phaseo integrations credential");
});

test("Claude Code rejects malformed configuration", () => {
	assert.throws(() => renderClaudeSettings("/tmp/settings.json", "{broken"), /Cannot update malformed/);
});

test("Claude Code refuses to replace another gateway or credential helper", () => {
	assert.throws(
		() => renderClaudeSettings("/tmp/settings.json", JSON.stringify({ env: { ANTHROPIC_BASE_URL: "https://other.example" } })),
		/different ANTHROPIC_BASE_URL/,
	);
	assert.throws(
		() => renderClaudeSettings("/tmp/settings.json", JSON.stringify({ apiKeyHelper: "other-helper" })),
		/different apiKeyHelper/,
	);
	assert.throws(
		() => renderClaudeSettings("/tmp/settings.json", JSON.stringify({ env: { ANTHROPIC_API_KEY: "existing" } })),
		/already define ANTHROPIC_API_KEY/,
	);
});

test("Codex setup and removal only manage the Phaseo profile", async () => {
	const homeDir = await mkdtemp(join(tmpdir(), "phaseo-codex-integration-"));
	const previousCodexHome = process.env.CODEX_HOME;
	process.env.CODEX_HOME = join(homeDir, ".codex");
	try {
		const options = { homeDir, model: "openai/gpt-5.6-terra" };
		await applyChanges(await codexAdapter.planSetup(options));
		const profile = await readFile(join(homeDir, ".codex", "phaseo.config.toml"), "utf8");
		assert.match(profile, /model = "openai\/gpt-5.6-terra"/);
		assert.equal((await codexAdapter.inspect(options)).status, "configured");
		await applyChanges(await codexAdapter.planRemove(options));
		await assert.rejects(readFile(join(homeDir, ".codex", "phaseo.config.toml"), "utf8"), { code: "ENOENT" });
	} finally {
		if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
		else process.env.CODEX_HOME = previousCodexHome;
		await rm(homeDir, { recursive: true, force: true });
	}
});

test("Claude Code setup and removal preserve unrelated settings", async () => {
	const homeDir = await mkdtemp(join(tmpdir(), "phaseo-claude-integration-"));
	const settingsPath = join(homeDir, ".claude", "settings.json");
	try {
		await applyChanges([{ path: settingsPath, before: null, after: '{"permissions":{"allow":["Read"]}}\n', description: "fixture" }]);
		const options = { homeDir };
		await applyChanges(await claudeCodeAdapter.planSetup(options));
		assert.equal((await claudeCodeAdapter.inspect(options)).status, "configured");
		await applyChanges(await claudeCodeAdapter.planRemove(options));
		const settings = JSON.parse(await readFile(settingsPath, "utf8"));
		assert.deepEqual(settings, { permissions: { allow: ["Read"] } });
	} finally {
		await rm(homeDir, { recursive: true, force: true });
	}
});

test("Claude Code removal leaves an unmanaged settings file byte-for-byte unchanged", async () => {
	const homeDir = await mkdtemp(join(tmpdir(), "phaseo-claude-unmanaged-"));
	const settingsPath = join(homeDir, ".claude", "settings.json");
	const original = '{"permissions":{"allow":["Read"]}}\n';
	try {
		await applyChanges([{ path: settingsPath, before: null, after: original, description: "fixture" }]);
		assert.deepEqual(await claudeCodeAdapter.planRemove({ homeDir }), []);
		assert.equal(await readFile(settingsPath, "utf8"), original);
	} finally {
		await rm(homeDir, { recursive: true, force: true });
	}
});

test("Claude Code removal preserves a conflicting Phaseo gateway", async () => {
	const homeDir = await mkdtemp(join(tmpdir(), "phaseo-claude-conflict-"));
	const settingsPath = join(homeDir, ".claude", "settings.json");
	const original = `${JSON.stringify({ env: { ANTHROPIC_BASE_URL: "https://api.phaseo.app" }, apiKeyHelper: "other-helper" }, null, 2)}\n`;
	try {
		await applyChanges([{ path: settingsPath, before: null, after: original, description: "fixture" }]);
		assert.deepEqual(await claudeCodeAdapter.planRemove({ homeDir }), []);
		assert.equal(await readFile(settingsPath, "utf8"), original);
	} finally {
		await rm(homeDir, { recursive: true, force: true });
	}
});

test("Claude Code setup rejects the Codex-only model option", async () => {
	await assert.rejects(
		runIntegrationCommand(["setup", "claude-code"], { model: "anthropic/claude-sonnet-4.6", "dry-run": true }),
		/--model is only supported for the Codex integration/,
	);
});

test("integration commands reject unexpected positional arguments", async () => {
	await assert.rejects(
		runIntegrationCommand(["setup", "codex", "unexpected"], { "dry-run": true }),
		/Usage: phaseo integrations/,
	);
});

test("browser login provisions and securely reuses a short-lived gateway key", async () => {
	const homeDir = await mkdtemp(join(tmpdir(), "phaseo-integration-credential-"));
	const previousBackend = process.env.PHASEO_SESSION_BACKEND;
	const previousConfigDir = process.env.PHASEO_CONFIG_DIR;
	const previousApiKey = process.env.PHASEO_API_KEY;
	const previousFetch = globalThis.fetch;
	process.env.PHASEO_SESSION_BACKEND = "file";
	process.env.PHASEO_CONFIG_DIR = homeDir;
	delete process.env.PHASEO_API_KEY;
	const requests: Array<{ url: string; method: string }> = [];
	globalThis.fetch = async (input, init) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		requests.push({ url, method });
		if (method === "POST" && url.endsWith("/v1/keys")) {
			return new Response(JSON.stringify({ data: { id: "key_agent", key: "phaseo_v1_sk_agent_secret" } }), {
				status: 201,
				headers: { "content-type": "application/json" },
			});
		}
		if (method === "DELETE" && url.endsWith("/v1/keys/key_agent")) {
			return new Response(null, { status: 204 });
		}
		throw new Error(`Unexpected request: ${method} ${url}`);
	};
	try {
		await writeSession({
			accessToken: "oauth-session-token",
			refreshToken: "refresh-token",
			expiresAt: Date.now() + 60 * 60 * 1000,
			apiUrl: "https://api.phaseo.app",
		});
		assert.equal(await getIntegrationGatewayCredential(), "phaseo_v1_sk_agent_secret");
		assert.equal(await getIntegrationGatewayCredential(), "phaseo_v1_sk_agent_secret");
		assert.equal(requests.filter((request) => request.method === "POST").length, 1);
		assert.equal((await readSession())?.integrationGatewayKeyId, "key_agent");
		assert.equal(await revokeIntegrationGatewayCredential(), true);
		assert.equal((await readSession())?.integrationGatewayKey, undefined);
		assert.equal(requests.filter((request) => request.method === "DELETE").length, 1);
	} finally {
		globalThis.fetch = previousFetch;
		if (previousBackend === undefined) delete process.env.PHASEO_SESSION_BACKEND;
		else process.env.PHASEO_SESSION_BACKEND = previousBackend;
		if (previousConfigDir === undefined) delete process.env.PHASEO_CONFIG_DIR;
		else process.env.PHASEO_CONFIG_DIR = previousConfigDir;
		if (previousApiKey === undefined) delete process.env.PHASEO_API_KEY;
		else process.env.PHASEO_API_KEY = previousApiKey;
		await rm(homeDir, { recursive: true, force: true });
	}
});

test("transaction rollback removes files created earlier in the plan", async () => {
	const homeDir = await mkdtemp(join(tmpdir(), "phaseo-integration-rollback-"));
	const createdPath = join(homeDir, "created.txt");
	const blockingPath = join(homeDir, "not-a-directory");
	try {
		await writeFile(blockingPath, "block");
		await assert.rejects(applyChanges([
			{ path: createdPath, before: null, after: "created", description: "create fixture" },
			{ path: join(blockingPath, "child"), before: null, after: "fail", description: "fail fixture" },
		]));
		await assert.rejects(readFile(createdPath, "utf8"), { code: "ENOENT" });
	} finally {
		await rm(homeDir, { recursive: true, force: true });
	}
});

test("stale file plans never overwrite newer content", async () => {
	const homeDir = await mkdtemp(join(tmpdir(), "phaseo-integration-stale-"));
	const path = join(homeDir, "settings.json");
	try {
		await writeFile(path, "original");
		const plan = [{ path, before: "original", after: "phaseo", description: "update fixture" }];
		await writeFile(path, "newer");
		await assert.rejects(applyChanges(plan), /Refusing to apply stale file change/);
		assert.equal(await readFile(path, "utf8"), "newer");
	} finally {
		await rm(homeDir, { recursive: true, force: true });
	}
});
