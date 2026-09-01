import { afterEach, describe, expect, it, vi } from "vitest";
import type { GatewayBindings } from "@/runtime/env.types";
import { observabilityIncidentInternals } from "./observability-incidents";

function createBindings() {
	const values = new Map<string, string>();
	const cache = {
		get: vi.fn(async (key: string) => {
			const value = values.get(key);
			return value ? JSON.parse(value) : null;
		}),
		put: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
	};
	return {
		bindings: {
			GATEWAY_CACHE: cache as unknown as KVNamespace,
			LINEAR_API_KEY: "lin_api_test",
			LINEAR_TEAM_ID: "team-id",
			LINEAR_PROJECT_ID: "project-id",
			LINEAR_TRIAGE_STATUS_ID: "triage-id",
			LINEAR_ASSIGNEE_ID: "assignee-id",
			LINEAR_OBSERVABILITY_LABEL_ID: "observability-label-id",
		} as GatewayBindings,
		cache,
	};
}

const incident = {
	source: "posthog" as const,
	action: "open" as const,
	fingerprint: "error-group-123",
	title: "Checkout page crashed",
	description: "A production browser exception was grouped by PostHog.",
	severity: "high" as const,
	environment: "production",
	source_url: "https://eu.posthog.com/project/1/error_tracking/1",
	replay_url: "https://eu.posthog.com/project/1/replay/abc",
	release: "release-sha",
	route: "/checkout",
	request_ids: ["request-123"],
	occurrences: 12,
	affected_users: 3,
};

afterEach(() => vi.restoreAllMocks());

describe("observability incident Linear sync", () => {
	it("requires a long exact bearer token", () => {
		const secret = "a".repeat(32);
		expect(observabilityIncidentInternals.isAuthorized(`Bearer ${secret}`, secret)).toBe(true);
		expect(observabilityIncidentInternals.isAuthorized(`Bearer ${"b".repeat(32)}`, secret)).toBe(false);
		expect(observabilityIncidentInternals.isAuthorized("Bearer short", "short")).toBe(false);
	});

	it("creates one linked issue and deduplicates immediate repeats", async () => {
		const { bindings, cache } = createBindings();
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
			data: { issueCreate: { success: true, issue: { id: "issue-id", identifier: "PHA-42", url: "https://linear.app/phaseo-ai/issue/PHA-42" } } },
		}), { status: 200, headers: { "content-type": "application/json" } }));

		const first = await observabilityIncidentInternals.handleIncident(bindings, incident);
		const second = await observabilityIncidentInternals.handleIncident(bindings, { ...incident, action: "repeated" });

		expect(first).toMatchObject({ created: true, identifier: "PHA-42" });
		expect(second).toMatchObject({ created: false, commented: false, identifier: "PHA-42" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(cache.put).toHaveBeenCalledTimes(1);
		const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
		expect(request.variables.input).toMatchObject({
			teamId: "team-id",
			projectId: "project-id",
			stateId: "triage-id",
			assigneeId: "assignee-id",
			priority: 2,
		});
		expect(request.variables.input.description).toContain("request-123");
		expect(request.variables.input.description).toContain("Open session replay");
	});

	it("comments when a mapped signal resolves", async () => {
		const { bindings } = createBindings();
		const fetchMock = vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response(JSON.stringify({
				data: { issueCreate: { success: true, issue: { id: "issue-id", identifier: "PHA-42", url: "https://linear.app/phaseo-ai/issue/PHA-42" } } },
			}), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: { commentCreate: { success: true } } }), { status: 200 }));

		await observabilityIncidentInternals.handleIncident(bindings, incident);
		const result = await observabilityIncidentInternals.handleIncident(bindings, { ...incident, action: "resolved" });

		expect(result).toMatchObject({ created: false, commented: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const commentRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
		expect(commentRequest.variables.input.body).toContain("signal resolved");
	});
});
