import { homedir } from "node:os";
import { codexAdapter } from "./adapters/codex.js";
import { claudeCodeAdapter } from "./adapters/claude-code.js";
import { deepSeekHarnessAdapter } from "./adapters/deepseek-harness.js";
import { openCodeAdapter } from "./adapters/opencode.js";
import { guidedAdapters } from "./adapters/guided.js";
import { piAdapter } from "./adapters/pi.js";
import { openClawAdapter } from "./adapters/openclaw.js";
import { hermesAdapter } from "./adapters/hermes.js";
import { zedAdapter } from "./adapters/zed.js";
import { aiderAdapter } from "./adapters/aider.js";
import { continueAdapter } from "./adapters/continue.js";
import { applyChanges, renderPlan } from "./files.js";
import { getIntegrationGatewayCredential, revokeIntegrationGatewayCredential } from "./credential.js";
import type { IntegrationAdapter, IntegrationId } from "./types.js";

const adapters: IntegrationAdapter[] = [codexAdapter, claudeCodeAdapter, openCodeAdapter, deepSeekHarnessAdapter, piAdapter, openClawAdapter, hermesAdapter, aiderAdapter, continueAdapter, zedAdapter, ...guidedAdapters];

function adapterFor(value: string | undefined): IntegrationAdapter {
	const adapter = adapters.find((entry) => entry.id === value);
	if (!adapter) throw new Error(`Unknown integration: ${value || "(missing)"}. Supported: ${adapters.map((entry) => entry.id).join(", ")}`);
	return adapter;
}

function isTrue(value: string | boolean | undefined): boolean {
	return value === true || value === "true" || value === "1";
}

function stringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
	const value = flags[key];
	return typeof value === "string" ? value : undefined;
}

function printSetupInstructions(adapter: IntegrationAdapter, options: { homeDir: string; model?: string }): void {
	const instructions = adapter.setupInstructions?.(options);
	if (!instructions) return;
	process.stdout.write("Finish setup:\n");
	for (const [index, instruction] of instructions.entries()) {
		process.stdout.write(`  ${index + 1}. ${instruction}\n`);
	}
	if (!adapter.setupIsAutomatic) process.stdout.write(`  ${instructions.length + 1}. Copy the dedicated key with: phaseo integrations credential ${adapter.id}\n`);
	if (adapter.guideUrl) process.stdout.write(`Guide: ${adapter.guideUrl}\n`);
}

function printRemoveInstructions(adapter: IntegrationAdapter, options: { homeDir: string; model?: string }): void {
	const instructions = adapter.removeInstructions?.(options);
	if (!instructions) return;
	process.stdout.write("Finish cleanup:\n");
	for (const [index, instruction] of instructions.entries()) process.stdout.write(`  ${index + 1}. ${instruction}\n`);
}

export async function runIntegrationCommand(
	args: string[],
	flags: Record<string, string | boolean>,
): Promise<void> {
	const [command, integration, ...extra] = args;
	const invalidArgumentCount =
		(command === "credential" && args.length !== 2) ||
		((command === "list" || command === "status") && args.length > 2) ||
		((command === "setup" || command === "remove") && args.length !== 2) ||
		extra.length > 0;
	if (invalidArgumentCount) {
		throw new Error("Usage: phaseo integrations list|status|setup|remove");
	}

	if (command === "credential") {
		const adapter = adapterFor(integration);
		const credential = await getIntegrationGatewayCredential(adapter.id);
		process.stdout.write(credential);
		return;
	}

	if (command === "list" || command === "status") {
		const selected = integration ? [adapterFor(integration)] : adapters;
		const inspections = await Promise.all(selected.map((adapter) => adapter.inspect({ homeDir: homedir() })));
		if (isTrue(flags.json)) {
			process.stdout.write(`${JSON.stringify(inspections, null, 2)}\n`);
			return;
		}
		for (const item of inspections) {
			process.stdout.write(`${item.id.padEnd(14)} ${item.status.padEnd(13)} ${item.configPath}\n`);
			for (const detail of item.details) process.stdout.write(`  ${detail}\n`);
		}
		return;
	}

	if (command !== "setup" && command !== "remove") {
		throw new Error("Usage: phaseo integrations list|status|setup|remove");
	}

	const adapter = adapterFor(integration);
	if (adapter.id === "claude-code" && stringFlag(flags, "model")) {
		throw new Error("--model is only supported for the Codex, OpenCode, and DeepSeek Harness integrations");
	}
	const options = { homeDir: homedir(), model: stringFlag(flags, "model") };
	const changes = command === "setup" ? await adapter.planSetup(options) : await adapter.planRemove(options);

	if (isTrue(flags.json)) {
		process.stdout.write(`${JSON.stringify({
			integration: adapter.id as IntegrationId,
			action: command,
			dryRun: isTrue(flags["dry-run"]),
			changes: changes.map(({ path, description, before, after }) => ({
				path,
				description,
				operation: after === null ? "delete" : before === null ? "create" : "update",
			})),
			instructions: command === "setup" ? adapter.setupInstructions?.(options) ?? [] : [],
			cleanupInstructions: command === "remove" ? adapter.removeInstructions?.(options) ?? [] : [],
		}, null, 2)}\n`);
		if (isTrue(flags["dry-run"])) return;
	} else {
		process.stdout.write(renderPlan(changes));
		if (isTrue(flags["dry-run"])) {
			if (command === "setup") printSetupInstructions(adapter, options);
			else printRemoveInstructions(adapter, options);
			return;
		}
	}

	if (command === "setup") await getIntegrationGatewayCredential(adapter.id);
	try {
		await applyChanges(changes);
		if (command === "setup") await adapter.applySetup?.(options);
		else await adapter.applyRemove?.(options);
	} catch (error) {
		if (command === "setup") await revokeIntegrationGatewayCredential(adapter.id).catch(() => undefined);
		throw error;
	}
	if (command === "remove") await revokeIntegrationGatewayCredential(adapter.id);
	if (!isTrue(flags.json)) {
		const outcome = command === "remove"
			? "disconnected"
			: adapter.setupInstructions && !adapter.setupIsAutomatic
				? "ready to finish in the application"
				: "configured";
		process.stdout.write(`${adapter.name} is now ${outcome}.\n`);
	}
	if (command === "setup" && !isTrue(flags.json) && (adapter.id === "opencode" || adapter.id === "deepseek-harness")) {
		process.stdout.write(`Copy its API key with: phaseo integrations credential ${adapter.id}\n`);
	}
	if (command === "setup" && !isTrue(flags.json) && adapter.setupInstructions) {
		printSetupInstructions(adapter, options);
	}
	if (command === "remove" && !isTrue(flags.json)) printRemoveInstructions(adapter, options);
}
