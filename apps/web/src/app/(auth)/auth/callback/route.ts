import { after, NextResponse } from "next/server";
import {
	DEFAULT_AUTH_ERROR_MESSAGE,
	buildAuthErrorRedirectUrl,
	classifyPostLoginError,
	resolveCallbackErrorMessage,
} from "@/lib/auth/errorMessage";
import { sanitizeReturnUrl } from "@/lib/auth/return-url";
import { finalizePostLogin } from "@/lib/auth/post-login";
import { getServerIdentity } from "@/lib/auth/serverIdentity";

function buildHashPreservingAuthErrorResponse(requestUrl: string) {
	const fallbackUrl = buildAuthErrorRedirectUrl(
		requestUrl,
		DEFAULT_AUTH_ERROR_MESSAGE,
	);
	const fallbackPath = `${fallbackUrl.pathname}${fallbackUrl.search}`;
	const errorPath = fallbackUrl.pathname;

	const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting...</title>
    <noscript>
      <meta http-equiv="refresh" content="0;url=${fallbackPath}" />
    </noscript>
  </head>
  <body>
    <script>
      (function () {
        try {
          var rawHash = window.location.hash || '';
          var normalizedHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
          var params = new URLSearchParams(normalizedHash);
          var hasAuthError =
            !!params.get('error') ||
            !!params.get('error_code') ||
            !!params.get('error_description');

          var target = hasAuthError && normalizedHash
            ? ${JSON.stringify(errorPath)} + '#' + normalizedHash
            : ${JSON.stringify(fallbackPath)};
          window.location.replace(target);
        } catch (_e) {
          window.location.replace(${JSON.stringify(fallbackPath)});
        }
      })();
    </script>
    <noscript>
      <p>Redirecting to the sign-in error page...</p>
      <p><a href="${fallbackPath}">Continue</a></p>
    </noscript>
  </body>
</html>`;

	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const type = url.searchParams.get("type");
	const returnUrl = sanitizeReturnUrl(url.searchParams.get("returnUrl"), "/");
	const callbackErrorMessage = resolveCallbackErrorMessage(url);

	if (callbackErrorMessage) {
		console.error("Auth callback provider error", {
			error: url.searchParams.get("error"),
			errorCode: url.searchParams.get("error_code"),
			errorDescription: url.searchParams.get("error_description"),
		});
		return NextResponse.redirect(
			buildAuthErrorRedirectUrl(request.url, callbackErrorMessage),
		);
	}

	const identity = await getServerIdentity();
	const user = identity?.user;
	if (!user?.id) {
		console.error("Auth callback missing authenticated user after session exchange");
		if (type === "email" || type === "better-auth") {
			return buildHashPreservingAuthErrorResponse(request.url);
		}
		return NextResponse.redirect(
			buildAuthErrorRedirectUrl(request.url, DEFAULT_AUTH_ERROR_MESSAGE),
		);
	}

	try {
		const result = await finalizePostLogin({
			user,
			returnUrl,
			source: "auth_callback",
			deferTask: (task) => after(task),
		});
		return NextResponse.redirect(new URL(result.redirectPath, url));
	} catch (error) {
		const publicError = classifyPostLoginError(error);
		console.error("Failed to finalize post-login state during auth callback", {
			userId: user.id,
			code: publicError.code,
			error: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.redirect(
			buildAuthErrorRedirectUrl(
				request.url,
				publicError.message,
				publicError.code,
			),
		);
	}
}
