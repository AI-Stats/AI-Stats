import { join } from "node:path";
import { isMap, isScalar, parseDocument } from "yaml";
import { isCommandAvailable, readOptionalFile } from "../files.js";
import type { IntegrationAdapter, IntegrationOptions } from "../types.js";

const START_MARKER = "# Phaseo CLI: deepseek-harness start";
const END_MARKER = "# Phaseo CLI: deepseek-harness end";
const CREDENTIAL_MARKER = "Managed by Phaseo CLI";
const CREDENTIAL_KEY = "PHASEO_API_KEY";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

function harnessHome(options: IntegrationOptions): string {
	return process.env.DSH_HOME || join(options.homeDir, ".dsh");
}

function patchPath(options: IntegrationOptions): string {
	return join(harnessHome(options), "cordis.patch.yml");
}

function credentialPath(options: IntegrationOptions): string {
	return join(harnessHome(options), ".credentials.yaml");
}

function managedBlock(model: string, models?: IntegrationOptions["models"]): string {
	const quotedModel = JSON.stringify(model);
	const catalog = models?.length ? [...models] : [{ id: model, name: model }];
	if (!catalog.some((entry) => entry.id === model)) catalog.unshift({ id: model, name: model });
	const renderedModels = catalog.map((entry) => `          - id: ${JSON.stringify(entry.id)}`).join("\n");
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
${renderedModels}
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

export function renderDeepSeekHarnessPatch(
	path: string,
	before: string | null,
	model = DEFAULT_MODEL,
	models?: IntegrationOptions["models"],
): string {
	const current = before ?? "";
	const range = markerRange(path, current);
	const block = managedBlock(model, models);
	if (range) return `${current.slice(0, range.start)}${block}${current.slice(range.end)}`;
	const prefix = current.length === 0 || current.endsWith("\n") ? current : `${current}\n`;
	return `${prefix}${prefix.length > 0 ? "\n" : ""}${block}\n`;
}

function credentialDocument(path: string, input: string | null) {
	const document = parseDocument(input ?? "{}\n");
	if (document.errors.length > 0) {
		throw new Error(`Cannot update malformed DeepSeek Harness credentials at ${path}: ${document.errors[0]?.message ?? "invalid YAML"}`);
	}
	if (!isMap(document.contents)) throw new Error(`Cannot update DeepSeek Harness credentials at ${path}: root must be a mapping`);
	return { document, map: document.contents };
}

function credentialPair(path: string, input: string | null) {
	const { document, map } = credentialDocument(path, input);
	const pair = map.items.find((entry) => String(entry.key) === CREDENTIAL_KEY);
	return { document, map, pair };
}

function isManagedCredential(pair: ReturnType<typeof credentialPair>["pair"]): boolean {
	return pair !== undefined && isScalar(pair.key) && (pair.key.commentBefore?.includes(CREDENTIAL_MARKER) ?? false);
}

export function renderDeepSeekHarnessCredential(path: string, before: string | null, credential: string): string {
	const { document, map, pair } = credentialPair(path, before);
	if (pair && !isManagedCredential(pair)) throw new Error(`${path} already contains an unmanaged ${CREDENTIAL_KEY}`);
	if (pair) document.delete(CREDENTIAL_KEY);
	const managedPair = document.createPair(CREDENTIAL_KEY, credential);
	if (!isScalar(managedPair.key)) throw new Error(`Failed to mark the DeepSeek Harness credential at ${path}`);
	managedPair.key.commentBefore = ` ${CREDENTIAL_MARKER}`;
	map.items.push(managedPair as unknown as typeof map.items[number]);
	return document.toString();
}

function renderRemovedCredential(path: string, before: string): string | null {
	const { document, pair } = credentialPair(path, before);
	if (!isManagedCredential(pair)) return null;
	document.delete(CREDENTIAL_KEY);
	return document.toString();
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
		const after = renderDeepSeekHarnessPatch(path, before, options.model, options.models);
		if (before === after) return [];
		return [{ path, before, after, description: "Configure DeepSeek Harness to use Phaseo" }];
	},
	async planCredential(options, credential) {
		const path = credentialPath(options);
		const before = await readOptionalFile(path);
		const after = renderDeepSeekHarnessCredential(path, before, credential);
		if (before === after) return [];
		return [{ path, before, after, description: "Store the Phaseo credential in DeepSeek Harness" }];
	},
	async planRemove(options) {
		const changes = [];
		const path = patchPath(options);
		const before = await readOptionalFile(path);
		if (before !== null && markerRange(path, before)) {
			const after = renderRemovedPatch(path, before);
			if (after !== before) changes.push({ path, before, after, description: "Remove Phaseo from DeepSeek Harness" });
		}
		const credentialsPath = credentialPath(options);
		const credentialsBefore = await readOptionalFile(credentialsPath);
		if (credentialsBefore !== null) {
			const credentialsAfter = renderRemovedCredential(credentialsPath, credentialsBefore);
			if (credentialsAfter !== null && credentialsAfter !== credentialsBefore) {
				changes.push({ path: credentialsPath, before: credentialsBefore, after: credentialsAfter, description: "Remove the Phaseo DeepSeek Harness credential" });
			}
		}
		return changes;
	},
};
