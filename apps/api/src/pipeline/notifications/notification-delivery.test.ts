import { describe, expect, it } from "vitest";
import { buildProviderRequest, eventContent, forEachPage } from "./notification-delivery";

const event = { id: "event-1", kind: "model_deprecation", subject: null, workspace_id: "workspace-1", created_at: "2026-08-23T12:00:00.000Z", payload: { model_name: "Example Model", retirement_date: "2026-09-30" } };

describe("notification provider payloads", () => {
	it("visits every row across bounded pages", async () => {
		const rows = Array.from({ length: 205 }, (_, index) => index);
		const ranges: Array<[number, number]> = [];
		const visited: number[] = [];
		const count = await forEachPage(100, async (from, to) => {
			ranges.push([from, to]);
			return rows.slice(from, to + 1);
		}, async (row) => { visited.push(row); });
		expect(count).toBe(205);
		expect(visited).toEqual(rows);
		expect(ranges).toEqual([[0, 99], [100, 199], [200, 299]]);
	});
	it("formats model deprecation content", () => { expect(eventContent(event).message).toContain("Example Model has been deprecated"); });
	it("limits Discord mentions to explicitly configured users and roles", () => { const request = buildProviderRequest("discord_webhook", JSON.stringify({ url: "https://discord.com/api/webhooks/123/token", userIds: ["123456789012345678"], roleIds: ["987654321098765432"] }), eventContent(event), event); expect(request.body).toMatchObject({ allowed_mentions: { parse: [], users: ["123456789012345678"], roles: ["987654321098765432"] } }); expect((request.body as { content: string }).content).toContain("<@&987654321098765432>"); });
	it("builds an authenticated Discord bot request", () => { const request = buildProviderRequest("discord", JSON.stringify({ channelId: "123", botToken: "token" }), eventContent(event), event); expect(request.url).toContain("/channels/123/messages"); expect(request.headers?.authorization).toBe("Bot token"); });
	it("builds Slack blocks", () => { const request = buildProviderRequest("slack", "https://hooks.slack.com/services/test", eventContent(event), event); expect(JSON.stringify(request.body)).toContain("Manage notifications"); });
	it("formats explicit Slack user and user group mentions", () => { const request = buildProviderRequest("slack", JSON.stringify({ url: "https://hooks.slack.com/services/test", userIds: ["U012ABCDEF"], userGroupIds: ["S012ABCDEF"] }), eventContent(event), event); expect(JSON.stringify(request.body)).toContain("<@U012ABCDEF>"); expect(JSON.stringify(request.body)).toContain("<!subteam^S012ABCDEF>"); });
	it("builds a Teams adaptive card", () => { const request = buildProviderRequest("microsoft_teams", "https://example.com/teams", eventContent(event), event); expect(JSON.stringify(request.body)).toContain("AdaptiveCard"); });
	it("adds supported Teams user mention entities", () => { const request = buildProviderRequest("microsoft_teams", JSON.stringify({ url: "https://example.com/teams", mentionIds: ["alex@example.com"] }), eventContent(event), event); expect(JSON.stringify(request.body)).toContain("<at>alex@example.com</at>"); expect(JSON.stringify(request.body)).toContain('"type":"mention"'); });
	it("builds a stable custom webhook envelope", () => { const request = buildProviderRequest("custom_webhook", "https://example.com/hook", eventContent(event), event); expect(request.body).toMatchObject({ id: "event-1", type: "model_deprecation", workspaceId: "workspace-1" }); });
});
