import type { RequestMeta } from "@core/types";

function normalizeTraceState(value: string | null): string | null {
	if (!value || value.length > 512) return null;
	const members = value.split(",");
	if (members.length > 32) return null;
	const key = /^[a-z0-9][a-z0-9_\-*\/]{0,255}(?:@[a-z0-9][a-z0-9_\-*\/]{0,13})?$/;
	const val = /^[\x20-\x2B\x2D-\x3C\x3E-\x7E]{0,256}$/;
	const normalized: string[] = [];
	for (const member of members) {
		const separator = member.indexOf("=");
		if (separator <= 0) return null;
		const memberKey = member.slice(0, separator).trim();
		const memberValue = member.slice(separator + 1).trim();
		if (!key.test(memberKey) || !val.test(memberValue)) return null;
		normalized.push(`${memberKey}=${memberValue}`);
	}
	return normalized.join(",");
}

export function parseW3cTraceContext(
	traceparent: string | null,
	tracestate: string | null = null,
): RequestMeta["otelTraceContext"] {
	if (!traceparent || traceparent.length > 512) return null;
	const parts = traceparent.trim().toLowerCase().split("-");
	if (parts.length < 4) return null;
	const [version, traceId, parentSpanId, flags] = parts;
	if (!/^[0-9a-f]{2}$/.test(version) || version === "ff") return null;
	if (version === "00" && parts.length !== 4) return null;
	if (!/^[0-9a-f]{32}$/.test(traceId) || /^0+$/.test(traceId)) return null;
	if (!/^[0-9a-f]{16}$/.test(parentSpanId) || /^0+$/.test(parentSpanId)) return null;
	if (!/^[0-9a-f]{2}$/.test(flags)) return null;
	return {
		traceId,
		parentSpanId,
		traceFlags: Number.parseInt(flags, 16) & 1,
		traceState: normalizeTraceState(tracestate),
	};
}
