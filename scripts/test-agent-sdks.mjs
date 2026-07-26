#!/usr/bin/env node
import { spawn } from "node:child_process";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

const suites = {
	ts: {
		name: "TypeScript Agent SDK",
		steps: [
			{ command: "pnpm", args: ["--filter", "@phaseo/sdk", "run", "build"] },
			{ command: "pnpm", args: ["--filter", "@phaseo/agent-sdk", "run", "typecheck"] },
			{ command: "pnpm", args: ["--filter", "@phaseo/agent-sdk", "run", "test"] },
		],
	},
	py: {
		name: "Python Agent SDK",
		steps: [{
			command: "python",
			args: ["-m", "pytest", "packages/sdk/agent-sdk-py/tests"],
			env: {
				PYTHONPATH: [
					join(root, "packages/sdk/agent-sdk-py/src"),
					join(root, "packages/sdk/sdk-py/src"),
					process.env.PYTHONPATH,
				].filter(Boolean).join(delimiter),
			},
		}],
	},
	go: { name: "Go Agent SDK", steps: [{ command: "go", args: ["test", "./..."], cwd: "packages/sdk/agent-sdk-go" }] },
	csharp: { name: "C# Agent SDK", steps: [{ command: "dotnet", args: ["test", "tests/Phaseo.AgentSdk.Tests/Phaseo.AgentSdk.Tests.csproj", "-c", "Release"], cwd: "packages/sdk/agent-sdk-csharp" }] },
	java: {
		name: "Java Agent SDK",
		steps: [
			{ command: "mvn", args: ["-q", "-DskipTests", "install"], cwd: "packages/sdk/sdk-java" },
			{ command: "mvn", args: ["-q", "test"], cwd: "packages/sdk/agent-sdk-java" },
		],
	},
	php: {
		name: "PHP Agent SDK",
		steps: [
			{ command: "php", args: ["tests/agent_loop_test.php"], cwd: "packages/sdk/agent-sdk-php" },
			{ command: "php", args: ["tests/composer_install_test.php"], cwd: "packages/sdk/agent-sdk-php" },
		],
	},
	ruby: { name: "Ruby Agent SDK", steps: [{ command: "ruby", args: ["-Ilib", "-Itests", "tests/agent_loop_test.rb"], cwd: "packages/sdk/agent-sdk-ruby" }] },
};

const requested = process.argv.slice(2).flatMap((arg) => arg.split(",")).map((arg) => arg.trim()).filter(Boolean);
const selected = !requested.length || requested.includes("all") ? Object.keys(suites) : requested;
const unknown = selected.filter((name) => !suites[name]);
if (unknown.length) throw new Error(`Unknown Agent SDK suite(s): ${unknown.join(", ")}`);

async function runStep(suite, step) {
	const windowsShim = process.platform === "win32" && ["pnpm", "mvn"].includes(step.command);
	const command = windowsShim ? "cmd.exe" : step.command;
	const args = windowsShim
		? ["/d", "/s", "/c", step.command, ...step.args]
		: step.args;
	await new Promise((resolveStep, reject) => {
		const child = spawn(command, args, {
			cwd: resolve(root, step.cwd ?? "."),
			env: { ...process.env, ...(step.env ?? {}) },
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("close", (code) => code === 0 ? resolveStep() : reject(new Error(`${suite.name} failed`)));
	});
}

for (const name of selected) {
	const suite = suites[name];
	console.log(`\n=== ${suite.name} ===`);
	for (const step of suite.steps) await runStep(suite, step);
}
