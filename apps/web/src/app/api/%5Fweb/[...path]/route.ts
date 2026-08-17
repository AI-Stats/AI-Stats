import type { NextRequest } from "next/server";

const PRODUCTION_WEB_API_ORIGIN = "https://phaseo.app";

function webApiOrigin(): string {
	const configured = process.env.WEB_API_ORIGIN?.trim().replace(/\/+$/, "");
	if (configured) return configured;
	return PRODUCTION_WEB_API_ORIGIN;
}

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
) {
	const { path } = await context.params;
	const target = new URL(`/api/_web/${path.map(encodeURIComponent).join("/")}`, webApiOrigin());
	target.search = request.nextUrl.search;

	const upstream = await fetch(target, {
		headers: {
			Accept: request.headers.get("accept") ?? "application/json",
		},
		cache: "no-store",
		signal: request.signal,
	});
	const headers = new Headers();
	for (const name of ["content-type", "cache-control", "etag", "vary"]) {
		const value = upstream.headers.get(name);
		if (value) headers.set(name, value);
	}

	// Node fetch decodes compressed upstream bodies. Do not forward the
	// original content-encoding/content-length headers with that decoded body.
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers,
	});
}
