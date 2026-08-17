import { Resend } from "resend";
import {
	hasCompletedOnboarding,
	provisionPersonalWorkspace,
} from "@/lib/database/repositories/accounts";
import { evaluateTeamSsoEnforcementNoop } from "@/lib/auth/ssoEnforcement";
import { sendAccountLifecycleDiscordWebhook } from "@/lib/auth/accountLifecycleDiscord";
import {
	isResendOnboardingAutomationsEnabled,
	sendUserCreatedEvent,
} from "@/lib/automations/resend-events";
import { ensureWorkspaceStripeWallet } from "@/lib/server/activeTeamStripe";
import { setActiveWorkspaceCookie } from "@/utils/workspaceCookie";
import { shouldRedirectToOnboardingAfterLogin } from "@/lib/auth/post-login-onboarding";

type DeferredTaskRunner = (task: () => Promise<void>) => void;

type FinalizePostLoginInput = {
	user: {
		id: string;
		email?: string | null;
		name?: string | null;
		createdAt?: Date | string | null;
		userMetadata?: Record<string, unknown> | null;
	};
	returnUrl: string;
	source: "auth_callback" | "server_action";
	deferTask?: DeferredTaskRunner;
};

export type FinalizePostLoginResult = {
	redirectPath: string;
	workspaceId?: string;
	userId: string;
	createdPersonalTeam: boolean;
};

function makeSlug(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 50);
}

function deriveFirstName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "";
	return trimmed.split(/\s+/)[0] ?? "";
}

async function sendSignupWelcomeEmail(args: {
	email: string;
	displayName: string;
}) {
	const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
	if (!apiKey) return;

	const from =
		String(process.env.RESEND_FROM_EMAIL ?? "").trim() ||
		"Phaseo <noreply@phaseo.app>";
	const subject =
		String(process.env.RESEND_WELCOME_SUBJECT ?? "").trim() ||
		"Welcome to Phaseo";
	const templateId =
		String(process.env.RESEND_WELCOME_TEMPLATE_ID ?? "").trim() ||
		"welcome-email";
	const firstName = deriveFirstName(args.displayName);
	const dashboardUrl =
		String(
			process.env.NEXT_PUBLIC_WEBSITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "",
		).trim() || "https://phaseo.app";
	const getStartedUrl = `${dashboardUrl.replace(/\/+$/, "")}/settings/keys`;
	const docsUrl = `${dashboardUrl.replace(/\/+$/, "")}/help`;
	const resend = new Resend(apiKey);
	const { error } = await resend.emails.send({
		from,
		to: args.email,
		subject,
		template: {
			id: templateId,
			variables: {
				user_first_name: firstName || "",
				welcome_heading: firstName ? `Welcome, ${firstName}` : "Welcome",
				app_name: "Phaseo",
				providers_count: 14,
				models_count: 300,
				endpoints_count: 9,
				gateway_base_url: "https://api.phaseo.app/v1",
				example_model: "openai/gpt-4.1-mini",
				dashboard_url: dashboardUrl,
				quickstart_url: getStartedUrl,
				docs_url: docsUrl,
				support_email: "support@phaseo.app",
			},
		},
	});

	if (error) {
		throw new Error(`resend_error:${error.name}:${error.message}`);
	}
}

async function sendSignupWelcomeNotification(args: {
	email: string;
	displayName: string;
	userId: string;
	workspaceId: string;
	source: "auth_callback" | "server_action";
	createdAtIso: string;
}) {
	if (!isResendOnboardingAutomationsEnabled()) {
		await sendSignupWelcomeEmail({
			email: args.email,
			displayName: args.displayName,
		});
		return;
	}

	const firstName = deriveFirstName(args.displayName);

	try {
		await sendUserCreatedEvent({
			email: args.email,
			payload: {
				userId: args.userId,
				workspaceId: args.workspaceId,
				displayName: args.displayName,
				firstName,
				source: args.source,
				createdAtIso: args.createdAtIso,
			},
		});
		return;
	} catch (automationError) {
		console.error("Failed sending onboarding automation signup event", {
			userId: args.userId,
			workspaceId: args.workspaceId,
			error:
				automationError instanceof Error
					? automationError.message
					: String(automationError),
		});
	}

	await sendSignupWelcomeEmail({
		email: args.email,
		displayName: args.displayName,
	});
}

async function sendSignupDiscordWebhook(args: {
	userId: string;
	email: string | null;
	createdAtIso: string;
}) {
	await sendAccountLifecycleDiscordWebhook({
		event: "signup",
		userId: args.userId,
		email: args.email,
		timestampIso: args.createdAtIso,
	});
}

async function ensureWalletRow(
	workspaceId: string,
	userId: string,
	email: string | null | undefined,
	displayName: string,
) {
	await ensureWorkspaceStripeWallet({
		workspaceId,
		userId,
		email: email ?? undefined,
		name: displayName,
	});
}

export async function finalizePostLogin(
	input: FinalizePostLoginInput,
): Promise<FinalizePostLoginResult> {
	const user = input.user;
	if (!user?.id) {
		throw new Error("AUTHENTICATED_USER_MISSING");
	}

	const displayName =
		String(user.userMetadata?.full_name ?? user.userMetadata?.name ?? user.name ?? "").trim() ||
		(user.email?.split("@")[0] ?? "User");

	const provisionedTeam = await provisionPersonalWorkspace({
		userId: user.id,
		displayName,
		baseSlug: `${makeSlug(displayName)}-personal`,
	});
	const workspaceId = provisionedTeam.workspaceId;
	await setActiveWorkspaceCookie(workspaceId);

	try {
		await ensureWalletRow(
			workspaceId,
			user.id,
			user.email,
			displayName,
		);
	} catch (error) {
		console.error("Failed to ensure wallet row during post-login finalize", {
			source: input.source,
			workspaceId,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	if (provisionedTeam.createdPersonalTeam) {
		const notificationTasks: Promise<unknown>[] = [];

		if (user.email) {
			notificationTasks.push(
				sendSignupWelcomeNotification({
					email: user.email,
					displayName,
					userId: user.id,
					workspaceId,
					source: input.source,
					createdAtIso: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt ?? new Date().toISOString()),
				}).catch((error) => {
					console.error("Failed sending signup onboarding notification", {
						source: input.source,
						userId: user.id,
						workspaceId,
						error: error instanceof Error ? error.message : String(error),
					});
				}),
			);
		}

		notificationTasks.push(
			sendSignupDiscordWebhook({
				userId: user.id,
				email: user.email ?? null,
				createdAtIso: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt ?? new Date().toISOString()),
			}).catch((error) => {
				console.error("Failed sending direct signup Discord webhook", {
					source: input.source,
					userId: user.id,
					workspaceId,
					error: error instanceof Error ? error.message : String(error),
				});
			}),
		);

		if (input.deferTask) {
			input.deferTask(async () => {
				await Promise.allSettled(notificationTasks);
			});
		} else {
			await Promise.allSettled(notificationTasks);
		}
	}

	try {
		await evaluateTeamSsoEnforcementNoop({
			workspaceId,
			userId: user.id,
			authMethod: "unknown",
			source: input.source,
		});
	} catch (error) {
		console.error("Failed deferred SSO enforcement hook during post-login finalize", {
			source: input.source,
			workspaceId,
			userId: user.id,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	let onboardingComplete: boolean | null = null;
	if (provisionedTeam.createdPersonalTeam && input.returnUrl === "/") {
		try {
			onboardingComplete = await hasCompletedOnboarding(user.id);
		} catch (error) {
			console.error("Failed to check onboarding status during post-login", {
				source: input.source,
				workspaceId,
				userId: user.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	const shouldShowOnboarding = shouldRedirectToOnboardingAfterLogin({
		returnUrl: input.returnUrl,
		onboardingComplete,
		createdPersonalTeam: provisionedTeam.createdPersonalTeam,
	});

	const redirectPath = shouldShowOnboarding ? "/onboarding" : input.returnUrl;

	return {
		redirectPath,
		workspaceId,
		userId: user.id,
		createdPersonalTeam: provisionedTeam.createdPersonalTeam,
	};
}
