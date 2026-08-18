import { describe, expect, it } from "vitest";
import { resolveVertexAccessToken, resolveVertexApiBase } from "./auth";

describe("google-vertex auth helpers", () => {
	it("throws coded error when project configuration is missing", () => {
		expect(() => resolveVertexApiBase({})).toThrowError("google-vertex_project_missing");
		try {
			resolveVertexApiBase({});
		} catch (error) {
			expect((error as any)?.code).toBe("google-vertex_project_missing");
		}
	});

	it("throws coded error when access token is missing", async () => {
		await expect(resolveVertexAccessToken("")).rejects.toMatchObject({
			message: "google-vertex_access_token_missing",
			code: "google-vertex_access_token_missing",
		});
	});

	it("uses the documented global Vertex endpoint by default", () => {
		const base = resolveVertexApiBase({ GOOGLE_VERTEX_PROJECT: "project-1" });
		expect(base).toBe(
			"https://aiplatform.googleapis.com/v1/projects/project-1/locations/global",
		);
	});

	it("uses the provider adapter location instead of the shared location binding", () => {
		expect(resolveVertexApiBase({
			GOOGLE_VERTEX_PROJECT: "project-1",
		}, "google-vertex")).toBe(
			"https://aiplatform.googleapis.com/v1/projects/project-1/locations/global",
		);
		expect(resolveVertexApiBase({ GOOGLE_VERTEX_PROJECT: "project-1" }, "google-vertex-eu")).toBe(
			"https://eu-aiplatform.googleapis.com/v1/projects/project-1/locations/eu",
		);
		expect(resolveVertexApiBase({ GOOGLE_VERTEX_PROJECT: "project-1" }, "google-vertex-us")).toBe(
			"https://us-central1-aiplatform.googleapis.com/v1/projects/project-1/locations/us-central1",
		);
	});
});
