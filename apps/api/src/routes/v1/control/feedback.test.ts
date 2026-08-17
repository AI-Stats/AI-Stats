import { beforeEach, describe, expect, it, vi } from "vitest";

const guardManagementAuthMock = vi.fn();
const repository = vi.hoisted(() => ({
	findTestRunAccess: vi.fn(), findVisibleTestRun: vi.fn(), insertEvent: vi.fn(), insertFeedback: vi.fn(),
	insertTestRun: vi.fn(), listEvents: vi.fn(), listFeedback: vi.fn(), listTestRuns: vi.fn(),
	listVisiblePresetIds: vi.fn(), requestExists: vi.fn(), summarizeFeedback: vi.fn(), updateTestRun: vi.fn(),
}));

vi.mock("@/pipeline/before/guards", () => ({ guardManagementAuth: (...args: unknown[]) => guardManagementAuthMock(...args) }));
vi.mock("@/repositories/feedback", () => repository);
vi.mock("@/routes/utils", () => ({
	withRuntime: (handler: (req: Request) => Promise<Response>) => async (c: { req: { raw: Request } }) => handler(c.req.raw),
	json: (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } }),
}));

import { feedbackRoutes, observabilityEventsRoutes, presetTestRunsRoutes } from "./feedback";

const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const PRESET_ID = "55555555-5555-4555-8555-555555555555";
const TEST_RUN_ID = "66666666-6666-4666-8666-666666666666";
const feedbackRow = {
	id: "11111111-1111-4111-8111-111111111111", workspace_id: WORKSPACE_ID, request_id: "req_123",
	session_id: null, preset_id: null, test_run_id: null, source: "api", rating: "thumbs_up", score: "1",
	reason: null, reason_tags: [], comment: null, metadata: {}, metadata_dimensions: {}, end_user_id: null,
	created_by_user_id: USER_ID, created_at: "2026-07-05T10:00:00.000Z",
};

describe("feedback control routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		guardManagementAuthMock.mockResolvedValue({ ok: true, value: { workspaceId: WORKSPACE_ID, userId: USER_ID, authMethod: "api_key", scopes: ["feedback:read", "feedback:write"] } });
		repository.listVisiblePresetIds.mockResolvedValue([PRESET_ID]);
		repository.requestExists.mockResolvedValue(true);
		repository.findTestRunAccess.mockResolvedValue({ id: TEST_RUN_ID, preset_id: PRESET_ID, baseline_preset_id: null });
		repository.insertFeedback.mockResolvedValue(feedbackRow);
		repository.insertEvent.mockResolvedValue({
			id: "22222222-2222-4222-8222-222222222222", workspace_id: WORKSPACE_ID, request_id: "req_123",
			session_id: null, preset_id: null, test_run_id: null, category: "outcome", event_name: "purchase",
			value: { amount: 10 }, numeric_value: "10", metadata: {}, metadata_dimensions: {}, end_user_id: null,
			source: "api", occurred_at: "2026-07-05T10:00:00.000Z", created_by_user_id: USER_ID,
			created_at: "2026-07-05T10:00:00.000Z",
		});
		repository.listFeedback.mockResolvedValue([]);
		repository.listEvents.mockResolvedValue([]);
		repository.listTestRuns.mockResolvedValue([]);
		repository.summarizeFeedback.mockResolvedValue([]);
	});

	it("enforces feedback write scope before touching storage", async () => {
		guardManagementAuthMock.mockResolvedValue({ ok: true, value: { workspaceId: WORKSPACE_ID, authMethod: "api_key", scopes: ["feedback:read"] } });
		const response = await feedbackRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: "req_123", rating: "thumbs_up" }) });
		expect(response.status).toBe(403);
		expect(repository.insertFeedback).not.toHaveBeenCalled();
	});

	it("creates workspace-scoped feedback through Drizzle", async () => {
		const response = await feedbackRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: "req_123", rating: "thumbs_up", score: 1 }) });
		expect(response.status).toBe(201);
		expect(repository.requestExists).toHaveBeenCalledWith(WORKSPACE_ID, "req_123");
		expect(repository.insertFeedback).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WORKSPACE_ID, requestId: "req_123", createdByUserId: USER_ID, score: "1" }));
		await expect(response.json()).resolves.toMatchObject({ data: { workspace_id: WORKSPACE_ID, score: 1 } });
	});

	it("does not expose a private preset absent from the visible set", async () => {
		repository.listVisiblePresetIds.mockResolvedValue([]);
		const response = await feedbackRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset_id: PRESET_ID, rating: "thumbs_up" }) });
		expect(response.status).toBe(404);
		expect(repository.insertFeedback).not.toHaveBeenCalled();
	});

	it("links test-run-only feedback to its visible preset", async () => {
		await feedbackRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test_run_id: TEST_RUN_ID, rating: "correct" }) });
		expect(repository.insertFeedback).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WORKSPACE_ID, presetId: PRESET_ID, testRunId: TEST_RUN_ID }));
	});

	it("rejects invalid ratings and scores before insertion", async () => {
		const rating = await feedbackRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: "req_123", rating: "mostly_good" }) });
		const score = await feedbackRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: "req_123", score: 2 }) });
		expect(rating.status).toBe(400);
		expect(score.status).toBe(400);
		expect(repository.insertFeedback).not.toHaveBeenCalled();
	});

	it("passes indexed filters to the typed feedback query", async () => {
		const response = await feedbackRoutes.request(`https://api.example.com/?rating=unrated&metadata.country=GB&preset_id=${PRESET_ID}&since=2026-07-01T00:00:00Z`);
		expect(response.status).toBe(200);
		expect(repository.listFeedback).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WORKSPACE_ID, visiblePresetIds: [PRESET_ID], presetId: PRESET_ID, metadata: { country: "GB" }, unrated: true, since: "2026-07-01T00:00:00.000Z" }));
	});

	it("uses the SQL summary repository", async () => {
		repository.summarizeFeedback.mockResolvedValue([{ group_value: PRESET_ID, count: "3", positive: "2", negative: "1", partial: "0", average_score: "0.67", ratings: { thumbs_up: "2", thumbs_down: "1" }, last_feedback_at: "2026-07-05T10:00:00.000Z" }]);
		const response = await feedbackRoutes.request("https://api.example.com/summary?group_by=preset");
		expect(response.status).toBe(200);
		expect(repository.summarizeFeedback).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WORKSPACE_ID, groupBy: "preset_id", visiblePresetIds: [PRESET_ID] }));
		await expect(response.json()).resolves.toEqual({ group_by: "preset_id", data: [{ preset_id: PRESET_ID, count: 3, positive: 2, negative: 1, partial: 0, average_score: 0.67, ratings: { thumbs_up: 2, thumbs_down: 1 }, last_feedback_at: "2026-07-05T10:00:00.000Z" }] });
	});

	it("creates observability events and validates request ownership", async () => {
		const response = await observabilityEventsRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: "req_123", category: "outcome", event: "purchase", value: { amount: 10 }, numeric_value: 10 }) });
		expect(response.status).toBe(201);
		expect(repository.insertEvent).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WORKSPACE_ID, requestId: "req_123", eventName: "purchase", numericValue: "10" }));
	});

	it("rejects unsupported test-run statuses before insertion", async () => {
		const response = await presetTestRunsRoutes.request("https://api.example.com/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset_id: PRESET_ID, status: "queued_forever" }) });
		expect(response.status).toBe(400);
		expect(repository.insertTestRun).not.toHaveBeenCalled();
	});
});
