import { spawn } from "node:child_process";
import { detectInstalledPackageManager, type PackageManager } from "../installation.js";
import { isCommandAvailable } from "./files.js";
import type { IntegrationId } from "./types.js";

export const PRIMARY_HARNESSES = ["codex", "claude-code", "hermes", "opencode", "pi", "prime-agent", "deepseek-harness", "openclaw"] as const satisfies readonly IntegrationId[];

const PACKAGES: Partial<Record<(typeof PRIMARY_HARNESSES)[number], string>> = {
	codex: "@openai/codex",
	"claude-code": "@anthropic-ai/claude-code",
	opencode: "opencode-ai",
	"deepseek-harness": "@deepseek-ai/dsh",
	pi: "@earendil-works/pi-coding-agent",
	openclaw: "openclaw@latest",
};

const COMMANDS: Record<(typeof PRIMARY_HARNESSES)[number], string[]> = {
	codex: ["codex", "codex.exe", "codex.cmd", "codex.ps1"],
	"claude-code": ["claude", "claude.exe", "claude.cmd", "claude.ps1"],
	opencode: ["opencode", "opencode.exe", "opencode.cmd", "opencode.ps1"],
	"deepseek-harness": ["dsh", "dsh.exe", "dsh.cmd", "dsh.ps1"],
	pi: ["pi", "pi.exe", "pi.cmd", "pi.ps1"],
	"prime-agent": ["prime-agent", "prime-agent.exe", "prime-agent.cmd"],
	hermes: ["hermes", "hermes.exe", "hermes.cmd"],
	openclaw: ["openclaw", "openclaw.exe", "openclaw.cmd"],
};

export type InstallInvocation = { command: string; args: string[] };

export function isPrimaryHarness(value: IntegrationId): value is (typeof PRIMARY_HARNESSES)[number] {
	return (PRIMARY_HARNESSES as readonly IntegrationId[]).includes(value);
}

export function installInvocationFor(integration: (typeof PRIMARY_HARNESSES)[number], manager: PackageManager): InstallInvocation {
	if (integration === "prime-agent") {
		throw new Error("Prime Agent must be installed manually from its verified release instructions");
	}
	if (integration === "hermes") {
		throw new Error("Hermes Agent must be installed manually from its verified release instructions");
	}
	const packageName = PACKAGES[integration];
	if (!packageName) throw new Error(`No installer is defined for ${integration}`);
	const extraArgs = integration === "pi" ? ["--ignore-scripts"] : [];
	switch (manager) {
		case "pnpm": return { command: "pnpm", args: ["add", "-g", ...extraArgs, packageName] };
		case "yarn": return { command: "yarn", args: ["global", "add", ...extraArgs, packageName] };
		case "bun": return { command: "bun", args: ["install", "-g", ...extraArgs, packageName] };
		default: return { command: "npm", args: ["install", "-g", ...extraArgs, packageName] };
	}
}

export function renderInstallInvocation(invocation: InstallInvocation): string {
	if (invocation.command === "sh" && invocation.args[0] === "-c") return `sh -c ${JSON.stringify(invocation.args[1])}`;
	return [invocation.command, ...invocation.args].join(" ");
}

async function availableManager(): Promise<PackageManager> {
	const detected = detectInstalledPackageManager();
	if (detected && await isCommandAvailable([detected, `${detected}.cmd`, `${detected}.exe`])) return detected;
	for (const manager of ["npm", "pnpm", "yarn", "bun"] as const) {
		if (await isCommandAvailable([manager, `${manager}.cmd`, `${manager}.exe`])) return manager;
	}
	throw new Error("A Node.js package manager is required to install coding harnesses");
}

export async function harnessInstallPlan(integration: IntegrationId): Promise<InstallInvocation | null> {
	if (!isPrimaryHarness(integration) || await isCommandAvailable(COMMANDS[integration])) return null;
	if (integration === "prime-agent") {
		throw new Error("Prime Agent is not installed. Install it manually from its verified release instructions, then rerun Phaseo setup");
	}
	if (integration === "hermes") {
		throw new Error("Hermes Agent is not installed. Install it manually from its verified release instructions, then rerun Phaseo setup");
	}
	if (integration === "pi" && await isCommandAvailable(["npm", "npm.cmd", "npm.exe"])) {
		return installInvocationFor(integration, "npm");
	}
	return installInvocationFor(integration, await availableManager());
}

export async function installHarness(invocation: InstallInvocation, options: { quiet?: boolean; capture?: boolean } = {}): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const packageManagers = new Set(["npm", "pnpm", "yarn", "bun"]);
		const command = process.platform === "win32" && packageManagers.has(invocation.command) ? `${invocation.command}.cmd` : invocation.command;
		const child = spawn(command, invocation.args, {
			stdio: options.quiet ? "ignore" : options.capture ? "pipe" : "inherit",
			windowsHide: true,
		});
		let captured = "";
		if (options.capture) {
			child.stdout?.on("data", (chunk) => { captured = `${captured}${String(chunk)}`.slice(-8000); });
			child.stderr?.on("data", (chunk) => { captured = `${captured}${String(chunk)}`.slice(-8000); });
		}
		child.once("error", reject);
		child.once("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Harness installation failed with exit code ${code ?? "unknown"}: ${renderInstallInvocation(invocation)}${captured.trim() ? `\n${captured.trim()}` : ""}`));
		});
	});
}
