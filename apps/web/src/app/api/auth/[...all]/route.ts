import { NextResponse } from "next/server";

import { getBetterAuth, isBetterAuthEnabled } from "@/lib/auth/betterAuth";

async function handler(request: Request): Promise<Response> {
	if (!isBetterAuthEnabled()) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	return getBetterAuth().handler(request);
}

export { handler as GET, handler as POST };
