import { getBindings } from "@/runtime/env";
import {
	countWorkspaceKeys,
	findWorkspaceWallet,
	userHasPaidWorkspaceAccess as queryUserHasPaidWorkspaceAccess,
	upsertWorkspaceWallet,
} from "@/repositories/management";

const DEFAULT_KEY_LIMIT = 100;

export const CHAT_MANAGED_KEY_NAME = "__chat_route_managed_key__";

export function getWorkspaceKeyLimit(): number {
	const bindings = getBindings();
	const raw = Number.parseInt(
		String(
			(bindings as any).WORKSPACE_KEY_LIMIT ??
				(bindings as any).NON_ENTERPRISE_KEY_LIMIT ??
				"",
		),
		10,
	);
	if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_KEY_LIMIT;
	return raw;
}

export async function userHasPaidWorkspaceAccess(userId: string): Promise<boolean> {
	return queryUserHasPaidWorkspaceAccess(userId);
}

export async function enforceWorkspaceKeyLimit(workspaceId: string): Promise<void> {
	const keyLimit = getWorkspaceKeyLimit();
	const totalKeys = await countWorkspaceKeys(workspaceId, CHAT_MANAGED_KEY_NAME);
	if (totalKeys >= keyLimit) {
		throw new Error(`Key limit reached (${keyLimit}) for this workspace. Delete an existing key to create a new one.`);
	}
}

async function createStripeCustomer(args: {
	workspaceId: string;
	userId: string;
	email?: string | null;
	name?: string | null;
}) {
	const bindings = getBindings();
	const secretKey =
		typeof bindings.STRIPE_SECRET_KEY === "string" && bindings.STRIPE_SECRET_KEY.trim()
			? bindings.STRIPE_SECRET_KEY.trim()
			: typeof bindings.TEST_STRIPE_SECRET_KEY === "string" && bindings.TEST_STRIPE_SECRET_KEY.trim()
				? bindings.TEST_STRIPE_SECRET_KEY.trim()
				: "";
	if (!secretKey) return null;

	const form = new URLSearchParams();
	if (args.email?.trim()) form.set("email", args.email.trim());
	if (args.name?.trim()) form.set("name", args.name.trim());
	form.set("metadata[workspace_id]", args.workspaceId);
	form.set("metadata[user_id]", args.userId);

	const response = await fetch("https://api.stripe.com/v1/customers", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
			"Idempotency-Key": `workspace:${args.workspaceId}`,
			"Stripe-Version": "2026-04-22.dahlia",
		},
		body: form.toString(),
	});

	let payload: any = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}
	if (!response.ok) {
		throw new Error(
			String(payload?.error?.message ?? `Stripe customer creation failed with status ${response.status}`),
		);
	}
	const customerId = String(payload?.id ?? "").trim();
	if (!customerId) {
		throw new Error("Stripe customer creation returned no id");
	}
	return customerId;
}

export async function ensureWorkspaceWalletProvisioned(args: {
	workspaceId: string;
	userId: string;
	email?: string | null;
	name?: string | null;
}) {
	const existing = await findWorkspaceWallet(args.workspaceId);
	if (existing?.workspaceId && existing.stripeCustomerId) {
		return { workspaceId: args.workspaceId, customerId: existing.stripeCustomerId };
	}

	const customerId = await createStripeCustomer(args);
	if (!customerId) {
		throw new Error("Stripe customer provisioning is not configured for workspace creation");
	}
	await upsertWorkspaceWallet(args.workspaceId, customerId);

	return { workspaceId: args.workspaceId, customerId };
}
