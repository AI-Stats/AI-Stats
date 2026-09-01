const requestIds = new WeakMap<Request, string>();

function validSuppliedRequestId(request: Request): string | null {
	const supplied = request.headers.get("x-request-id")?.trim();
	if (supplied && supplied.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(supplied)) return supplied;
	return null;
}

export function requestIdFor(request: Request): string {
	const existing = requestIds.get(request);
	if (existing) return existing;
	const requestId = validSuppliedRequestId(request) ?? crypto.randomUUID();
	requestIds.set(request, requestId);
	return requestId;
}
