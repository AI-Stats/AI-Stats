import { existsSync, readFileSync, realpathSync } from "node:fs";
import { normalize, posix, win32 } from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type PathInstallation = {
	binDirectory: string;
	executable: string;
	manager: PackageManager | null;
	active: boolean;
};

export type DoctorIssue = {
	severity: "warning";
	code: "shadowed_installation";
	summary: string;
	remediation: string[];
};

export type DoctorReport = {
	ok: boolean;
	version: string;
	installation: {
		manager: PackageManager | null;
		currentExecutable: string;
		updateCommand: string | null;
	};
	path: {
		active: string | null;
		installations: PathInstallation[];
	};
	issues: DoctorIssue[];
};

function slashPath(value: string, caseInsensitive = true): string {
	const normalized = normalize(value).replaceAll("\\", "/");
	return caseInsensitive ? normalized.toLowerCase() : normalized;
}

export function packageManagerFromPath(value: string): PackageManager | null {
	const path = slashPath(value);
	if (path.includes("/.pnpm/") || path.includes("/pnpm/global/") || path.endsWith("/pnpm")) return "pnpm";
	if (path.includes("/.bun/install/global/") || path.includes("/bun/install/global/") || path.endsWith("/.bun/bin")) return "bun";
	if (path.includes("/yarn/data/global/") || path.includes("/config/yarn/global/") || path.endsWith("/yarn/bin")) return "yarn";
	if (path.includes("/npm/node_modules/@phaseo/cli/") || path.endsWith("/npm")) return "npm";
	if (path.includes("/node_modules/@phaseo/cli/")) return "npm";
	return null;
}

function packageManagerFromWrapper(contents: string): PackageManager | null {
	const text = contents.replaceAll("\\", "/").toLowerCase();
	if (text.includes("/.pnpm/") || text.includes("/pnpm/global/")) return "pnpm";
	if (text.includes("/.bun/") || text.includes("bun.exe")) return "bun";
	if (text.includes("/yarn/") || text.includes("yarn.js")) return "yarn";
	if (text.includes("node_modules/@phaseo/cli")) return "npm";
	return null;
}

export function detectInstalledPackageManager(
	entryPath: string | undefined = process.argv[1],
	env: NodeJS.ProcessEnv = process.env,
	realPath: (path: string) => string = realpathSync,
): PackageManager | null {
	if (entryPath) {
		const fromEntry = packageManagerFromPath(entryPath);
		if (fromEntry) return fromEntry;
		try {
			const fromTarget = packageManagerFromPath(realPath(entryPath));
			if (fromTarget) return fromTarget;
		} catch {
			// Continue to launch-environment detection when the target cannot be resolved.
		}
	}
	const userAgent = String(env.npm_config_user_agent ?? "").toLowerCase();
	if (userAgent.startsWith("pnpm/")) return "pnpm";
	if (userAgent.startsWith("yarn/")) return "yarn";
	if (userAgent.startsWith("bun/")) return "bun";
	if (userAgent.startsWith("npm/")) return "npm";
	return null;
}

function candidateNames(platform: NodeJS.Platform): string[] {
	return platform === "win32"
		? ["phaseo.cmd", "phaseo.ps1", "phaseo.exe", "phaseo"]
		: ["phaseo"];
}

export function findPathInstallations(options: {
	env?: NodeJS.ProcessEnv;
	platform?: NodeJS.Platform;
	exists?: (path: string) => boolean;
	readText?: (path: string) => string;
	realPath?: (path: string) => string;
} = {}): PathInstallation[] {
	const env = options.env ?? process.env;
	const platform = options.platform ?? process.platform;
	const exists = options.exists ?? existsSync;
	const readText = options.readText ?? ((path: string) => readFileSync(path, "utf8"));
	const realPath = options.realPath ?? realpathSync;
	const pathValue = env.PATH ?? env.Path ?? "";
	const separator = platform === "win32" ? ";" : ":";
	const joinPath = platform === "win32" ? win32.join : posix.join;
	const installations: PathInstallation[] = [];
	const seen = new Set<string>();

	for (const rawDirectory of pathValue.split(separator)) {
		const binDirectory = rawDirectory.trim().replace(/^"|"$/g, "");
		if (!binDirectory) continue;
		const key = slashPath(binDirectory, platform === "win32");
		if (seen.has(key)) continue;
		const executable = candidateNames(platform)
			.map((name) => joinPath(binDirectory, name))
			.find((path) => exists(path));
		if (!executable) continue;
		seen.add(key);
		let manager = packageManagerFromPath(binDirectory);
		if (!manager) {
			try {
				manager = packageManagerFromPath(realPath(executable));
			} catch {
				// Continue to wrapper inspection when the target cannot be resolved.
			}
		}
		if (!manager) {
			try {
				manager = packageManagerFromWrapper(readText(executable));
			} catch {
				// Binary executables and unreadable wrappers can still be reported.
			}
		}
		installations.push({
			binDirectory,
			executable,
			manager,
			active: installations.length === 0,
		});
	}
	return installations;
}

export function createDoctorReport(options: {
	version: string;
	currentExecutable?: string;
	env?: NodeJS.ProcessEnv;
	platform?: NodeJS.Platform;
	exists?: (path: string) => boolean;
	readText?: (path: string) => string;
	realPath?: (path: string) => string;
	updateCommandFor: (manager: PackageManager) => string;
	removeCommandFor: (manager: PackageManager) => string;
}): DoctorReport {
	const currentExecutable = options.currentExecutable ?? process.argv[1] ?? process.execPath;
	const manager = detectInstalledPackageManager(currentExecutable, options.env);
	const installations = findPathInstallations(options);
	const active = installations[0] ?? null;
	const shadowed = installations.slice(1);
	const remediation = shadowed.flatMap((installation) => {
		if (!installation.manager || installation.manager === active?.manager) return [];
		return [options.removeCommandFor(installation.manager)];
	});
	if (shadowed.length > 0 && remediation.length === 0) {
		remediation.push("Remove the unwanted Phaseo bin directory from PATH.");
	}
	const issues: DoctorIssue[] = shadowed.length > 0
		? [{
			severity: "warning",
			code: "shadowed_installation",
			summary: `${shadowed.length} Phaseo installation${shadowed.length === 1 ? " is" : "s are"} shadowed by ${active?.executable ?? "the active command"}.`,
			remediation: [...new Set(remediation)],
		}]
		: [];

	return {
		ok: issues.length === 0,
		version: options.version,
		installation: {
			manager,
			currentExecutable,
			updateCommand: manager ? options.updateCommandFor(manager) : null,
		},
		path: {
			active: active?.executable ?? null,
			installations,
		},
		issues,
	};
}
