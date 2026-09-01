import { test } from "node:test";
import assert from "node:assert/strict";
import { backendTs } from "../src/index.js";
import type { IR } from "@phaseo/oapi-core";

test("backend-ts emits stable file set", async () => {
	const ir: IR = {
		version: 1,
		info: { title: "Example", version: "1.0.0" },
		models: [
			{
				name: "Widget",
				schema: {
					kind: "object",
					properties: { id: { kind: "primitive", type: "string" } },
					required: ["id"]
				}
			}
		],
		operations: [
			{
				operationId: "getWidget",
				method: "get",
				path: "/widgets/{id}",
				tags: ["widgets"],
				params: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { kind: "primitive", type: "string" }
					}
				],
				responses: [
					{
						status: "200",
						schema: { kind: "ref", name: "Widget" }
					}
				]
			}
		]
	};

	const files = await backendTs.generate(ir, { outDir: "ignored" });
	const paths = files.map((file) => file.path);
	assert.deepEqual(paths, [
		"client/default.ts",
		"client/index.ts",
		"index.ts",
		"models/index.ts",
		"models/Widget.ts"
	]);
	const widgetModel = files.find((file) => file.path === "models/Widget.ts");
	assert.ok(widgetModel?.contents.includes("export interface Widget"));
	const clientFile = files.find((file) => file.path === "client/default.ts");
	assert.ok(clientFile?.contents.includes("getWidget"));
	assert.ok(clientFile?.contents.includes("path: {"));
	assert.ok(clientFile?.contents.includes("args: GetWidgetParams"));
	assert.ok(!clientFile?.contents.includes("args: GetWidgetParams = {}"));
	assert.ok(clientFile?.contents.includes('String(path["id"])'));
});

test("backend-ts parenthesizes array item unions", async () => {
	const ir: IR = {
		version: 1,
		info: { title: "Example", version: "1.0.0" },
		models: [{
			name: "OrganisationIdList",
			schema: { kind: "array", items: { kind: "enum", values: ["openai", "google"] } },
		}],
		operations: [],
	};

	const files = await backendTs.generate(ir, { outDir: "ignored" });
	const model = files.find((file) => file.path === "models/OrganisationIdList.ts");
	assert.match(model?.contents ?? "", /export type OrganisationIdList = \("openai" \| "google"\)\[\];/);
});

test("backend-ts cannot terminate JSDoc from an OpenAPI description", async () => {
	const ir: IR = {
		version: 1,
		info: { title: "Example", version: "1.0.0" },
		models: [{
			name: "Widget",
			doc: "safe */ export const injected = true; /*",
			schema: { kind: "object", properties: {}, required: [] },
		}],
		operations: [],
	};

	const files = await backendTs.generate(ir, { outDir: "ignored" });
	const model = files.find((file) => file.path === "models/Widget.ts")?.contents ?? "";
	assert.ok(model.includes("safe *\\/ export const injected = true; /*"));
	assert.doesNotMatch(model, /\*\/\s*export const injected/);
});
