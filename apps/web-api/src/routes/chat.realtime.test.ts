import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/chat/proxy", async (original) => ({
	...await original<typeof import("@/chat/proxy")>(),
	resolveGatewayKeys: async () => ({ apiKey: "test-key", userId: "user-1", workspaceId: "workspace-1" }),
}));
import { chatRouter } from "./chat";
afterEach(() => vi.unstubAllGlobals());

it("submits the supported Chat contract and returns the server-owned relay", async () => {
	let body: Record<string, unknown> = {};
	vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
		body = JSON.parse(init.body);
		return Response.json({ clientSecret: "rtsec_test", connect: { url: "/v1/realtime/sessions/rt_test/relay" } });
	}));
	const response = await chatRouter.request("https://phaseo.app/realtime/session", {
		method: "POST", headers: { "content-type": "application/json" },
		body: JSON.stringify({ provider: "openai", model: "gpt-realtime", voice: "marin", instructions: "Be concise." }),
	}, { ENV: "development", PHASEO_GATEWAY_URL: "https://api.phaseo.app/v1" });
	 expect(response.status).toBe(200);
	 expect(body).toEqual({ provider: "openai", model: "openai/gpt-realtime", voice: "marin", instructions: "Be concise.", source: "chat", metadata: { feature: "chat_realtime_voice", userId: "user-1", workspaceId: "workspace-1" } });
	 expect((await response.json() as any).connect.url).toBe("wss://api.phaseo.app/v1/realtime/sessions/rt_test/relay");
});
