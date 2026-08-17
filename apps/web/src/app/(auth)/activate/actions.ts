"use server";

import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/oauth/apiBaseUrl";
import { headers } from "next/headers";

async function callDeviceActivation(body: Record<string, unknown>) {
	const cookie = (await headers()).get("cookie")?.trim();
	const authHeaders: HeadersInit | null = cookie ? { Cookie: cookie } : null;
	if (!authHeaders) {
		throw new Error("Unauthorized");
	}

	const response = await fetch(`${apiBaseUrl()}/oauth/device/activate`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders,
		},
		body: JSON.stringify(body),
		cache: "no-store",
	});
	const payload = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(String(payload?.error_description ?? payload?.message ?? "Activation failed"));
	}
	return payload;
}

export async function approveDeviceAction(formData: FormData) {
	const userCode = String(formData.get("user_code") ?? "");
	const workspaceId = String(formData.get("workspace_id") ?? "");
	await callDeviceActivation({
		action: "approve",
		user_code: userCode,
		workspace_id: workspaceId,
	});
	redirect("/activate?approved=1");
}

export async function denyDeviceAction(formData: FormData) {
	const userCode = String(formData.get("user_code") ?? "");
	await callDeviceActivation({
		action: "deny",
		user_code: userCode,
	});
	redirect("/activate?denied=1");
}

export async function lookupDeviceRequest(userCode: string) {
	return callDeviceActivation({
		action: "lookup",
		user_code: userCode,
	});
}
