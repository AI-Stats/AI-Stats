export type IntegrationId =
	| "codex"
	| "claude-code"
	| "opencode"
	| "deepseek-harness"
	| "pi"
	| "hermes"
	| "aider"
	| "cline"
	| "roo-code"
	| "kilo-code"
	| "continue"
	| "cursor"
	| "zed"
	| "openclaw";

export type IntegrationStatus = "not-installed" | "available" | "configured" | "conflict";

export type IntegrationInspection = {
	id: IntegrationId;
	name: string;
	status: IntegrationStatus;
	configPath: string;
	details: string[];
};

export type FileChange = {
	path: string;
	before: string | null;
	after: string | null;
	description: string;
};

export type IntegrationOptions = {
	homeDir: string;
	model?: string;
};

export interface IntegrationAdapter {
	readonly id: IntegrationId;
	readonly name: string;
	readonly guideUrl?: string;
	inspect(options: IntegrationOptions): Promise<IntegrationInspection>;
	planSetup(options: IntegrationOptions): Promise<FileChange[]>;
	planRemove(options: IntegrationOptions): Promise<FileChange[]>;
	setupInstructions?(options: IntegrationOptions): string[];
	removeInstructions?(options: IntegrationOptions): string[];
	applySetup?(options: IntegrationOptions): Promise<void>;
	applyRemove?(options: IntegrationOptions): Promise<void>;
	readonly setupIsAutomatic?: boolean;
}
