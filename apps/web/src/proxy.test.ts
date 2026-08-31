import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { publicLocales } from "@/i18n/routing";
import {
	config,
	isLocalizedAuthPath,
	isLocalizedPagePath,
	proxy,
} from "./proxy";

const origin = "https://phaseo.ai";
const localizedAuthRoutes = ["sign-in", "sign-up", "error"] as const;

describe("public localisation proxy", () => {
	it("matches every exact public auth route", () => {
		for (const route of localizedAuthRoutes) {
			expect(
				unstable_doesMiddlewareMatch({ config, url: `${origin}/${route}` }),
			).toBe(true);

			for (const locale of publicLocales) {
				const pathname = `/${locale}/${route}`;
				expect(isLocalizedAuthPath(pathname)).toBe(true);
				expect(
					unstable_doesMiddlewareMatch({
						config,
						url: `${origin}${pathname}`,
					}),
				).toBe(true);
			}
		}
	});

	it("keeps non-localized and invalid paths outside locale negotiation", () => {
		for (const pathname of [
			"/settings",
			"/internal/localisation-preview/de-DE",
			"/api/account/me",
			"/docs/getting-started",
			"/favicon.ico",
			"/en-XA/sign-in",
			"/xx/sign-in",
			"/de-DE/sign-in/enterprise",
		]) {
			expect(isLocalizedAuthPath(pathname)).toBe(false);
		}
		expect(isLocalizedPagePath("/models")).toBe(true);
		expect(isLocalizedPagePath("/de-DE/models")).toBe(true);
		expect(isLocalizedPagePath("/api/account/me")).toBe(false);
		expect(isLocalizedPagePath("/.well-known/api-catalog")).toBe(false);
		expect(isLocalizedPagePath("/wordmark.svg")).toBe(false);
		expect(isLocalizedPagePath("/auth/callback")).toBe(false);
		expect(isLocalizedPagePath("/docs/getting-started")).toBe(false);
	});

	it("negotiates the complete page tree, not only auth routes", async () => {
		const unprefixed = await proxy(new NextRequest(`${origin}/models`));
		expect(new URL(unprefixed.headers.get("x-middleware-rewrite")!).pathname).toBe(
			"/en-GB/models",
		);

		const localized = await proxy(new NextRequest(`${origin}/de-DE/models`));
		expect(localized.headers.get("x-middleware-next")).toBe("1");
	});

	it("rewrites unprefixed auth routes to the default locale internally", async () => {
		const response = await proxy(new NextRequest(`${origin}/sign-in`));
		const rewrite = response.headers.get("x-middleware-rewrite");

		expect(rewrite).not.toBeNull();
		expect(new URL(rewrite!).pathname).toBe("/en-GB/sign-in");
	});

	it("negotiates the first unprefixed auth visit from Accept-Language", async () => {
		const response = await proxy(
			new NextRequest(`${origin}/sign-in`, {
				headers: { "accept-language": "de-DE,de;q=0.9,en;q=0.7" },
			}),
		);

		expect(response.status).toBe(307);
		expect(new URL(response.headers.get("location")!).pathname).toBe(
			"/de-DE/sign-in",
		);
	});

	it("remembers an explicit locale for later unprefixed auth visits", async () => {
		const response = await proxy(
			new NextRequest(`${origin}/sign-up`, {
				headers: { cookie: "PHASEO_LOCALE=ar-SA" },
			}),
		);

		expect(response.status).toBe(307);
		expect(new URL(response.headers.get("location")!).pathname).toBe(
			"/ar-SA/sign-up",
		);
	});

	it("removes an explicit default-locale prefix", async () => {
		const response = await proxy(new NextRequest(`${origin}/en-GB/sign-up`));

		expect(response.status).toBe(307);
		expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-up");
	});

	it("preserves a non-default public locale prefix", async () => {
		const response = await proxy(new NextRequest(`${origin}/de-DE/error`));

		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-rewrite")).toBeNull();
		expect(response.headers.get("x-middleware-next")).toBe("1");
	});
});
