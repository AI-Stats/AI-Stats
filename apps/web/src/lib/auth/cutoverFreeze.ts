const SAFE_METHODS = new Set(["GET", "HEAD"]);

export function shouldBlockDuringCutover(method: string, pathname: string, freezeValue?: string): boolean {
	if (freezeValue?.trim().toLowerCase() !== "true") return false;
	if (!SAFE_METHODS.has(method.toUpperCase())) return true;
	return pathname.startsWith("/api/auth/") && pathname !== "/api/auth/get-session";
}
