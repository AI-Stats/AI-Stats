import type { Env } from "@/env";
import { findIdentityBySessionToken } from "@/repositories/identity";

const authenticationFailures = new WeakMap<Request, string>();

export function getAuthenticationFailure(request: Request): string {
	return authenticationFailures.get(request) ?? "unauthorized";
}

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  createdAt: string;
  appMetadata: Record<string, unknown>;
  factors: Array<{
    id: string;
    factor_type: string;
    status: string;
  }>;
	mfaReenrollmentRequired?: boolean;
  userMetadata: Record<string, unknown>;
};

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization")?.trim();
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

type BetterAuthSessionResponse = {
  session?: { createdAt?: string };
  user?: {
    appMetadata?: Record<string, unknown> | null;
    createdAt?: string | Date;
    email?: string | null;
    id?: string;
		mfaReenrollmentRequired?: boolean;
    twoFactorEnabled?: boolean;
    userMetadata?: Record<string, unknown> | null;
  };
};

async function planetScaleBearerUser(request: Request, env: Env): Promise<AuthenticatedUser | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const user = await findIdentityBySessionToken(env, token);
    if (!user?.id) {
		authenticationFailures.set(request, "bearer_session_not_found");
		console.warn("[auth/require-user] bearer session not found");
		return null;
	}
    return {
      id: user.id,
      email: user.email,
      createdAt: String(user.createdAt ?? ""),
      appMetadata: user.appMetadata && typeof user.appMetadata === "object" && !Array.isArray(user.appMetadata) ? user.appMetadata as Record<string, unknown> : {},
      userMetadata: user.userMetadata && typeof user.userMetadata === "object" && !Array.isArray(user.userMetadata) ? user.userMetadata as Record<string, unknown> : {},
      factors: user.twoFactorEnabled
        ? [{ id: "better-auth-totp", factor_type: "totp", status: "verified" }]
        : [],
      mfaReenrollmentRequired: user.mfaReenrollmentRequired === true,
    };
	} catch (error) {
		authenticationFailures.set(request, "bearer_session_lookup_failed");
		console.warn("[auth/require-user] bearer session lookup failed", { error: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

function betterAuthSessionUrl(env: Env): string | null {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/auth/get-session`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function betterAuthUser(request: Request, env: Env): Promise<AuthenticatedUser | null> {
  const cookie = request.headers.get("cookie")?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const sessionUrl = betterAuthSessionUrl(env);
  if ((!cookie && !authorization?.startsWith("Bearer ")) || !sessionUrl) return null;

  try {
    const response = await fetch(sessionUrl, {
      headers: {
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(3_000),
    });
		if (!response.ok) {
			authenticationFailures.set(request, `better_auth_session_rejected_${response.status}`);
			console.warn("[auth/require-user] Better Auth session endpoint rejected request", { status: response.status });
			return null;
		}
    const payload = await response.json<BetterAuthSessionResponse>();
    const user = payload.user;
		if (!user?.id) {
			authenticationFailures.set(request, "better_auth_session_missing_user");
			console.warn("[auth/require-user] Better Auth session response had no user");
			return null;
		}
    const createdAt = user.createdAt ?? payload.session?.createdAt;
    return {
      id: user.id,
      email: user.email ?? null,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : typeof createdAt === "string"
            ? createdAt
            : "",
      appMetadata:
        user.appMetadata && typeof user.appMetadata === "object" ? user.appMetadata : {},
      factors: user.twoFactorEnabled
        ? [{ id: "better-auth-totp", factor_type: "totp", status: "verified" }]
        : [],
		mfaReenrollmentRequired: user.mfaReenrollmentRequired === true,
      userMetadata:
        user.userMetadata && typeof user.userMetadata === "object" ? user.userMetadata : {},
    };
	} catch (error) {
		authenticationFailures.set(request, "better_auth_session_request_failed");
		console.warn("[auth/require-user] Better Auth session request failed", { error: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

export async function requireUser(request: Request, env: Env): Promise<AuthenticatedUser | null> {
	authenticationFailures.delete(request);
	if (!request.headers.get("cookie") && !request.headers.get("authorization")) {
		authenticationFailures.set(request, "credentials_missing");
		console.warn("[auth/require-user] request had no cookie or authorization header");
	}
	const directBetterAuthSession = await planetScaleBearerUser(request, env);
	if (directBetterAuthSession) { authenticationFailures.delete(request); return directBetterAuthSession; }
	const betterAuthSession = await betterAuthUser(request, env);
	if (betterAuthSession) { authenticationFailures.delete(request); return betterAuthSession; }
	return null;
}
