import { resolveGatewayPath } from "./endpoint-paths";
import { buildEndpointRoutes, ENDPOINT_OPTIONS } from "./endpointRoutes";
import { buildExamplePayload } from "./quickstartPayloads";

describe("Parse quickstart", () => {
	test("uses the dedicated Parse route", () => {
		expect(resolveGatewayPath("parse")).toBe("/parse");
		expect(ENDPOINT_OPTIONS).toContainEqual({
			value: "parse",
			label: "Document Parse",
		});
		expect(
			buildEndpointRoutes([{ value: "parse", label: "Document Parse" }]),
		).toEqual([
			expect.objectContaining({
				value: "parse",
				method: "POST",
				path: "/v1/parse",
			}),
		]);
	});

	test("builds a valid document-image request", () => {
		expect(buildExamplePayload("parse", "cohere/parse-v5.0")).toEqual({
			model: "cohere/parse-v5.0",
			document: {
				type: "image_url",
				image_url: "https://cohere.com/favicon-32x32.png",
			},
			output_format: "markdown",
		});
	});
});
