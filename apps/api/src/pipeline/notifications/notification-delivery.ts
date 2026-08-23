import { decryptWebhookSecret, validateWebhookEndpointUrlForDelivery } from "@/core/webhook-endpoints";
import { sendEmail } from "@/lib/email/resend";
import { getSupabaseAdmin } from "@/runtime/env";

const DELIVERABLE_KINDS = ["low_balance", "auto_top_up_failed", "payment_method_expiring", "model_deprecation", "notification_test"];

type EventRow = { id: string; kind: string; subject: string | null; workspace_id: string; payload: Record<string, unknown> | null; created_at: string };
type DestinationRow = { id: string; workspace_id: string; name: string; type: string; target_ciphertext: string; target_iv: string; target_key_version: string; status: string; is_ephemeral?: boolean };

export function eventContent(event: EventRow) {
	const payload = event.payload ?? {};
	const title = String(payload.title ?? event.subject ?? ({ low_balance: "Low balance alert", auto_top_up_failed: "Auto Top-Up failed", payment_method_expiring: "Payment method expiring soon", model_deprecation: "Model deprecation alert", notification_test: "Phaseo test notification" } as Record<string, string>)[event.kind] ?? "Phaseo notification");
	let message = String(payload.message ?? "");
	if (!message && event.kind === "low_balance") message = `Your workspace balance is $${Number(payload.balance_usd ?? 0).toFixed(2)}, at or below the configured $${Number(payload.threshold_usd ?? 0).toFixed(2)} threshold.`;
	if (!message && event.kind === "auto_top_up_failed") message = String(payload.reason ?? "Phaseo could not automatically add credits to your workspace.");
	if (!message && event.kind === "payment_method_expiring") message = `The ${String(payload.brand ?? "card")} ending in ${String(payload.last4 ?? "unknown")} expires ${String(payload.expiry ?? "soon")}.`;
	if (!message && event.kind === "model_deprecation") message = `${String(payload.model_name ?? payload.model_id ?? "A model used by your workspace")} has been deprecated${payload.retirement_date ? ` and is scheduled to retire on ${String(payload.retirement_date)}` : ""}.`;
	return { title, message: message || "A workspace notification was generated.", settingsUrl: "https://phaseo.app/settings/notifications" };
}

export function buildProviderRequest(type: string, target: string, content: ReturnType<typeof eventContent>, event: EventRow): { url: string; body: unknown; headers?: Record<string, string> } {
	if (type === "discord") { const config = JSON.parse(target) as { channelId: string; botToken: string; userIds?: string[]; roleIds?: string[] }; const userIds = config.userIds ?? []; const roleIds = config.roleIds ?? []; const mentions = [...userIds.map((id) => `<@${id}>`), ...roleIds.map((id) => `<@&${id}>`)].join(" "); return { url: `https://discord.com/api/v10/channels/${encodeURIComponent(config.channelId)}/messages`, body: { content: `${mentions ? `${mentions}\n` : ""}**${content.title}**\n${content.message}\n${content.settingsUrl}`, allowed_mentions: { parse: [], users: userIds, roles: roleIds } }, headers: { authorization: `Bot ${config.botToken}` } }; }
	if (type === "discord_webhook") { let config: { url: string; userIds?: string[]; roleIds?: string[] }; try { config = JSON.parse(target) as typeof config; } catch { config = { url: target }; } const userIds = config.userIds ?? []; const roleIds = config.roleIds ?? []; const mentions = [...userIds.map((id) => `<@${id}>`), ...roleIds.map((id) => `<@&${id}>`)].join(" "); return { url: config.url, body: { content: `${mentions ? `${mentions}\n` : ""}**${content.title}**\n${content.message}`, allowed_mentions: { parse: [], users: userIds, roles: roleIds }, embeds: [{ title: content.title, description: content.message, url: content.settingsUrl, color: 5793266 }] } }; }
	if (type === "slack") { let config: { url: string; userIds?: string[]; userGroupIds?: string[] }; try { config = JSON.parse(target) as typeof config; } catch { config = { url: target }; } const mentions = [...(config.userIds ?? []).map((id) => `<@${id}>`), ...(config.userGroupIds ?? []).map((id) => `<!subteam^${id}>`)].join(" "); return { url: config.url, body: { text: `${mentions ? `${mentions} ` : ""}${content.title}: ${content.message}`, blocks: [{ type: "header", text: { type: "plain_text", text: content.title } }, ...(mentions ? [{ type: "section", text: { type: "mrkdwn", text: mentions } }] : []), { type: "section", text: { type: "mrkdwn", text: content.message } }, { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Manage notifications" }, url: content.settingsUrl }] }] } }; }
	if (type === "microsoft_teams") { let config: { url: string; mentionIds?: string[] }; try { config = JSON.parse(target) as typeof config; } catch { config = { url: target }; } const mentionIds = config.mentionIds ?? []; const mentionText = mentionIds.map((id) => `<at>${id}</at>`).join(" "); const entities = mentionIds.map((id) => ({ type: "mention", text: `<at>${id}</at>`, mentioned: { id, name: id } })); return { url: config.url, body: { type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: { $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4", body: [{ type: "TextBlock", weight: "Bolder", size: "Medium", text: content.title }, ...(mentionText ? [{ type: "TextBlock", wrap: true, text: mentionText }] : []), { type: "TextBlock", wrap: true, text: content.message }], actions: [{ type: "Action.OpenUrl", title: "Manage notifications", url: content.settingsUrl }], ...(entities.length ? { msteams: { entities } } : {}) } }] } }; }
	return { url: target, body: { id: event.id, type: event.kind, createdAt: event.created_at, workspaceId: event.workspace_id, data: { ...event.payload, title: content.title, message: content.message } } };
}

async function decryptTarget(destination: DestinationRow): Promise<string> {
	return decryptWebhookSecret({ secretCiphertext: destination.target_ciphertext, secretIv: destination.target_iv, secretKeyVersion: destination.target_key_version });
}

async function postJson(url: string, body: unknown, headers?: Record<string, string>): Promise<number> {
	const validated = await validateWebhookEndpointUrlForDelivery(url);
	if (!validated.ok) throw new Error("reason" in validated ? validated.reason : "webhook_url_invalid");
	const response = await fetch(validated.url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Phaseo-Notifications/1.0", ...headers }, body: JSON.stringify(body), redirect: "manual" });
	if (!response.ok) {
		const hostname = new URL(validated.url).hostname.toLowerCase();
		const isDiscordWebhook = (hostname === "discord.com" || hostname === "discordapp.com") && new URL(validated.url).pathname.startsWith("/api/webhooks/");
		const providerError = await response.json().catch(() => null) as { code?: unknown; message?: unknown } | null;
		const providerCode = typeof providerError?.code === "number" || typeof providerError?.code === "string" ? String(providerError.code) : null;
		if (isDiscordWebhook && response.status === 404) throw new Error(`Discord webhook not found${providerCode ? ` (Discord code ${providerCode})` : ""}. Check that the complete webhook URL was copied after saving it in Discord.`);
		if (hostname === "discord.com" && response.status === 401) throw new Error("Discord rejected the bot token.");
		if (hostname === "discord.com" && response.status === 404) throw new Error("Discord channel not found, or the bot cannot access it.");
		if (hostname === "hooks.slack.com" && response.status === 404) throw new Error("Slack webhook not found. It may have been removed or rotated.");
		throw new Error(`Destination returned HTTP ${response.status}.`);
	}
	return response.status;
}

async function deliver(event: EventRow, destination: DestinationRow): Promise<number> {
	const target = await decryptTarget(destination);
	const content = eventContent(event);
	if (destination.type === "email") {
		let recipients: string[];
		try { const parsed = JSON.parse(target); recipients = Array.isArray(parsed) ? parsed.map(String) : [target]; } catch { recipients = [target]; }
		for (const [index, recipient] of recipients.entries()) await sendEmail({ to: recipient, subject: content.title, text: `${content.title}\n\n${content.message}\n\nManage notifications: ${content.settingsUrl}`, html: `<div style="font-family:ui-sans-serif,system-ui;line-height:1.5"><h2>${content.title.replaceAll("<", "&lt;")}</h2><p>${content.message.replaceAll("<", "&lt;")}</p><p><a href="${content.settingsUrl}">Manage notifications</a></p></div>`, idempotencyKey: `notification:${event.id}:${destination.id}:${index}` });
		return 202;
	}
	const request = buildProviderRequest(destination.type, target, content, event);
	return postJson(request.url, request.body, request.headers);
}

export async function deliverNotificationTest(input: {
	type?: string;
	target?: string;
	destinationId?: string;
	workspaceId: string;
}): Promise<number> {
	const event: EventRow = {
		id: crypto.randomUUID(),
		kind: "notification_test",
		subject: "Phaseo test notification",
		workspace_id: input.workspaceId,
		payload: {
			title: "Phaseo test notification",
			message: "Your notification destination is connected and ready.",
		},
		created_at: new Date().toISOString(),
	};

	if (input.destinationId) {
		const result = await getSupabaseAdmin()
			.from("notification_destinations")
			.select("id,workspace_id,name,type,target_ciphertext,target_iv,target_key_version,status,is_ephemeral")
			.eq("id", input.destinationId)
			.eq("workspace_id", input.workspaceId)
			.eq("status", "active")
			.maybeSingle();
		if (result.error || !result.data) throw new Error("notification_destination_not_found");
		return deliver(event, result.data as DestinationRow);
	}

	if (!input.type || !input.target) throw new Error("notification_test_target_missing");
	const content = eventContent(event);
	if (input.type === "email") {
		let recipients: string[];
		try { const parsed = JSON.parse(input.target); recipients = Array.isArray(parsed) ? parsed.map(String) : [input.target]; } catch { recipients = [input.target]; }
		for (const [index, recipient] of recipients.entries()) await sendEmail({
			to: recipient,
			subject: content.title,
			text: `${content.title}\n\n${content.message}\n\nManage notifications: ${content.settingsUrl}`,
			html: `<div style="font-family:ui-sans-serif,system-ui;line-height:1.5"><h2>${content.title}</h2><p>${content.message}</p><p><a href="${content.settingsUrl}">Manage notifications</a></p></div>`,
			idempotencyKey: `notification-test:${event.id}:${index}`,
		});
		return 202;
	}
	const request = buildProviderRequest(input.type, input.target, content, event);
	return postJson(request.url, request.body, request.headers);
}

export async function runNotificationDeliveryJob(limit = 25): Promise<{ queued: number; sent: number; failed: number }> {
	const supabase = getSupabaseAdmin();
	const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const eventsResult = await supabase.from("email_outbox").select("id,kind,subject,workspace_id,payload,created_at").in("kind", DELIVERABLE_KINDS).not("workspace_id", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(100);
	if (eventsResult.error) throw new Error(`notification_events_fetch_failed:${eventsResult.error.message}`);
	let queued = 0;
	for (const event of (eventsResult.data ?? []) as EventRow[]) {
		let destinationQuery = supabase.from("notification_destinations").select("id").eq("workspace_id", event.workspace_id).eq("status", "active");
		const requestedDestination = typeof event.payload?.destination_id === "string" ? event.payload.destination_id : null;
		if (requestedDestination) destinationQuery = destinationQuery.eq("id", requestedDestination);
		const destinations = await destinationQuery;
		if (destinations.error) throw new Error(`notification_destinations_fetch_failed:${destinations.error.message}`);
		const rows = (destinations.data ?? []).map((destination) => ({ event_id: event.id, destination_id: destination.id, workspace_id: event.workspace_id, status: "pending" }));
		if (rows.length) {
			const inserted = await supabase.from("notification_delivery_attempts").upsert(rows, { onConflict: "event_id,destination_id", ignoreDuplicates: true });
			if (inserted.error) throw new Error(`notification_attempts_enqueue_failed:${inserted.error.message}`);
			queued += rows.length;
		}
	}
	const attempts = await supabase.from("notification_delivery_attempts").select("id,event_id,destination_id,attempts").in("status", ["pending", "retry"]).lte("next_attempt_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(limit);
	if (attempts.error) throw new Error(`notification_attempts_fetch_failed:${attempts.error.message}`);
	let sent = 0; let failed = 0;
	for (const attempt of attempts.data ?? []) {
		try {
			const [eventResult, destinationResult] = await Promise.all([
				supabase.from("email_outbox").select("id,kind,subject,workspace_id,payload,created_at").eq("id", attempt.event_id).single(),
				supabase.from("notification_destinations").select("id,workspace_id,name,type,target_ciphertext,target_iv,target_key_version,status,is_ephemeral").eq("id", attempt.destination_id).eq("status", "active").single(),
			]);
			if (eventResult.error || destinationResult.error) throw new Error("notification_delivery_source_missing");
			const responseStatus = await deliver(eventResult.data as EventRow, destinationResult.data as DestinationRow);
			await supabase.from("notification_delivery_attempts").update({ status: "sent", attempts: Number(attempt.attempts ?? 0) + 1, response_status: responseStatus, last_error: null, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", attempt.id);
			if ((destinationResult.data as DestinationRow).is_ephemeral) await supabase.from("notification_destinations").update({ status: "deleted", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", attempt.destination_id);
			sent += 1;
		} catch (error) {
			const attemptsCount = Number(attempt.attempts ?? 0) + 1;
			const terminal = attemptsCount >= 5;
			await supabase.from("notification_delivery_attempts").update({ status: terminal ? "failed" : "retry", attempts: attemptsCount, next_attempt_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** attemptsCount) * 1000).toISOString(), last_error: String(error instanceof Error ? error.message : error).slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", attempt.id);
			if (terminal) await supabase.from("notification_destinations").update({ status: "deleted", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", attempt.destination_id).eq("is_ephemeral", true);
			failed += 1;
		}
	}
	return { queued, sent, failed };
}

export async function enqueueModelDeprecationNotifications(now = new Date()): Promise<{ workspaces: number; enqueued: number }> {
	const supabase = getSupabaseAdmin();
	const settingsResult = await supabase.from("workspace_settings").select("workspace_id").eq("model_deprecation_alerts_enabled", true).limit(500);
	if (settingsResult.error) throw new Error(`model_deprecation_settings_fetch_failed:${settingsResult.error.message}`);
	let enqueued = 0;
	for (const settings of settingsResult.data ?? []) {
		const workspaceId = String(settings.workspace_id);
		const usage = await supabase.from("gateway_requests").select("model_id").eq("workspace_id", workspaceId).not("model_id", "is", null).gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(5000);
		if (usage.error) continue;
		const modelIds = [...new Set((usage.data ?? []).map((row) => String(row.model_id ?? "").trim()).filter(Boolean))];
		if (!modelIds.length) continue;
		const models = await supabase.from("v2_models").select("model_slug,name,status,deprecated_at,retired_at").in("model_slug", modelIds);
		if (models.error) continue;
		const workspace = await supabase.from("workspaces").select("name,owner_user_id").eq("id", workspaceId).maybeSingle();
		if (workspace.error || !workspace.data?.owner_user_id) continue;
		const user = await (supabase as any).auth.admin.getUserById(workspace.data.owner_user_id).catch(() => null);
		const email = String(user?.data?.user?.email ?? "").trim();
		if (!email) continue;
		for (const model of models.data ?? []) {
			const deprecated = String(model.status ?? "").toLowerCase() === "deprecated" || (model.deprecated_at && Date.parse(String(model.deprecated_at)) <= now.getTime());
			if (!deprecated) continue;
			const dedupeKey = `model_deprecation:${workspaceId}:${model.model_slug}:${String(model.deprecated_at ?? model.status ?? "deprecated")}`.slice(0, 500);
			const inserted = await supabase.from("email_outbox").upsert({ dedupe_key: dedupeKey, kind: "model_deprecation", template: "model_deprecation", to_email: email, subject: `${String(model.name ?? model.model_slug)} has been deprecated`, workspace_id: workspaceId, user_id: workspace.data.owner_user_id, payload: { workspace_name: workspace.data.name ?? "your workspace", model_id: model.model_slug, model_name: model.name ?? model.model_slug, deprecation_date: model.deprecated_at, retirement_date: model.retired_at, title: `${String(model.name ?? model.model_slug)} has been deprecated` } }, { onConflict: "dedupe_key", ignoreDuplicates: true });
			if (!inserted.error) enqueued += 1;
		}
	}
	return { workspaces: settingsResult.data?.length ?? 0, enqueued };
}
