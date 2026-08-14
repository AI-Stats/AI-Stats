import { join } from "node:path";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationOptions } from "../types.js";

const START_MARKER = "# Phaseo CLI: deepseek-harness start";
const END_MARKER = "# Phaseo CLI: deepseek-harness end";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

function harnessHome(options: IntegrationOptions): string {
	return process.env.DSH_HOME || join(options.homeDir, ".dsh");
}

function patchPath(options: IntegrationOptions): string {
	return join(harnessHome(options), "cordis.patch.yml");
}

function managedBlock(model: string): string {
	const quotedModel = JSON.stringify(model);
	return `${START_MARKER}
- id: llm-pi-ai
  config:
    providers:
      phaseo:
        displayName: Phaseo
        apiKeyEnv: PHASEO_API_KEY
        api: openai-completions
        baseURL: https://api.phaseo.app/v1
        models:
          - id: ${quotedModel}
- id: agent-default-model
  config:
    provider: phaseo
    model: ${quotedModel}
${END_MARKER}`;
}

function markerRange(path: string, input: string): { start: number; end: number } | null {
	const start = input.indexOf(START_MARKER);
	const endMarker = input.indexOf(END_MARKER);
	if (start === -1 && endMarker === -1) return null;
	if (start === -1 || endMarker === -1 || endMarker < start) {
		throw new Error(`Cannot update malformed Phaseo-managed DeepSeek Harness configuration at ${path}`);
	}
	if (input.indexOf(START_MARKER, start + START_MARKER.length) !== -1 || input.indexOf(END_MARKER, endMarker + END_MARKER.length) !== -1) {
		throw new Error(`Cannot update duplicate Phaseo-managed DeepSeek Harness configuration at ${path}`);
	}
	return { start, end: endMarker + END_MARKER.length };
}

export function renderDeepSeekHarnessPatch(path: string, before: string | null, model = DEFAULT_MODEL): string {
	const current = before ?? "";
	const range = markerRange(path, current);
	const block = managedBlock(model);
	if (range) return `${current.slice(0, range.start)}${block}${current.slice(range.end)}`;
	const prefix = current.length === 0 || current.endsWith("\n") ? current : `${current}\n`;
	return `${prefix}${prefix.length > 0 ? "\n" : ""}${block}\n`;
}

function renderRemovedPatch(path: string, before: string): string | null {
	const range = markerRange(path, before);
	if (!range) return null;
	let output = `${before.slice(0, range.start)}${before.slice(range.end)}`;
	output = output.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
	return output.length > 0 ? `${output}\n` : null;
}

export const deepSeekHarnessAdapter: IntegrationAdapter = {
	id: "deepseek-harness",
	name: "DeepSeek Harness",
	async inspect(options) {
		const path = patchPath(options);
		const current = await readOptionalFile(path);
		const installed = await isCommandAvailable(["dsh", "dsh.exe", "dsh.cmd", "dsh.ps1"]);
		if (current === null) {
			return { id: "deepseek-harness", name: "DeepSeek Harness", status: installed ? "available" : "not-installed", configPath: path, details: [] };
		}
		const range = markerRange(path, current);
		return {
			id: "deepseek-harness",
			name: "DeepSeek Harness",
			status: range ? "configured" : installed ? "available" : "not-installed",
			configPath: path,
			details: range
				? ["Phaseo provider and default model configured", "Credential source: PHASEO_API_KEY"]
				: [],
		};
	},
	async planSetup(options) {
		const path = patchPath(options);
		const before = await readOptionalFile(path);
		const after = renderDeepSeekHarnessPatch(path, before, options.model);
		if (before === after) return [];
		return [{ path, before, after, description: "Configure DeepSeek Harness to use Phaseo" }];
	},
	async planRemove(options) {
		const path = patchPath(options);
		const before = await readOptionalFile(path);
		if (before === null) return [];
		if (!markerRange(path, before)) return [];
		const after = renderRemovedPatch(path, before);
		if (after === before) return [];
		return [{ path, before, after, description: "Remove Phaseo from DeepSeek Harness" }];
	},
};
