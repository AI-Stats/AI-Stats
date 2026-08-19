import { isCommandAvailable } from "../files.js";
import type { IntegrationAdapter, IntegrationId, IntegrationOptions } from "../types.js";

const BASE_URL = "https://api.phaseo.app/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

type GuidedDefinition = {
	id: IntegrationId;
	name: string;
	commands: string[];
	defaultModel?: string;
	instructions: (model: string) => string[];
};

function guidedAdapter(definition: GuidedDefinition): IntegrationAdapter {
	return {
		id: definition.id,
		name: definition.name,
		guideUrl: `https://phaseo.app/docs/v1/guides/integrations/${definition.id}`,
		async inspect() {
			const installed = await isCommandAvailable(definition.commands);
			return {
				id: definition.id,
				name: definition.name,
				status: installed ? "available" : "not-installed",
				configPath: "Application settings",
				details: ["Phaseo CLI creates and revokes the dedicated key; finish provider setup in the application."],
			};
		},
		async planSetup() { return []; },
		async planRemove() { return []; },
		setupInstructions(options: IntegrationOptions) {
			return definition.instructions(options.model ?? definition.defaultModel ?? DEFAULT_MODEL);
		},
		removeInstructions() {
			return [`Remove the Phaseo custom provider from ${definition.name}'s application settings.`];
		},
	};
}

const openAiUi = (name: string) => (model: string) => [
	`Open ${name} provider settings and choose OpenAI Compatible.`,
	`Set Base URL to ${BASE_URL}.`,
	`Set Model to ${model}.`,
];

export const guidedAdapters: IntegrationAdapter[] = [
	guidedAdapter({ id: "cline", name: "Cline", commands: ["code", "code.exe", "cursor", "cursor.exe"], instructions: openAiUi("Cline") }),
	guidedAdapter({ id: "roo-code", name: "Roo Code", commands: ["code", "code.exe", "cursor", "cursor.exe"], instructions: openAiUi("Roo Code") }),
	guidedAdapter({ id: "kilo-code", name: "Kilo Code", commands: ["code", "code.exe", "cursor", "cursor.exe"], instructions: openAiUi("Kilo Code") }),
	guidedAdapter({ id: "cursor", name: "Cursor", commands: ["cursor", "cursor.exe", "cursor.cmd"], defaultModel: "openai/gpt-5.6-terra", instructions: (model) => [
		"Open Cursor Settings → Models and enable the OpenAI API Key section.",
		`Set Override OpenAI Base URL to ${BASE_URL}.`,
		`Add or enable ${model} only if Cursor accepts it as an OpenAI-family model.`,
	] }),
];
