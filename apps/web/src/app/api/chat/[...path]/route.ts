import type { NextRequest } from "next/server";

const PRODUCTION_WEB_API_ORIGIN = "https://phaseo.app";

function webApiOrigin(): string {
	return (process.env.WEB_API_ORIGIN?.trim() || PRODUCTION_WEB_API_ORIGIN).replace(/\/+$/, "");
}

async function proxyChat(
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
	const { path } = await context.params;
	const target = new URL(`/api/chat/${path.map(encodeURIComponent).join("/")}`, webApiOrigin());
	target.search = request.nextUrl.search;

	const headers = new Headers();
	for (const name of ["accept", "authorization", "content-type", "cookie"]) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}

	const upstream = await fetch(target, {
		method: request.method,
		headers,
		body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
		cache: "no-store",
		redirect: "manual",
		signal: request.signal,
		duplex: "half",
	} as RequestInit);
	const responseHeaders = new Headers();
	for (const name of ["cache-control", "content-type", "etag", "vary", "x-request-id"]) {
		const value = upstream.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders,
	});
}

export const GET = proxyChat;
export const POST = proxyChat;
export const DELETE = proxyChat;
