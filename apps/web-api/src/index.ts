import { Hono, type Context, type Next } from "hono";
import type { Env } from "@/env";
import { accountRouter } from "@/routes/account";
import { internalRouter } from "@/routes/internal";
import { chatRouter } from "@/routes/chat";
import { publicRouter } from "@/routes/public";
import { frontendRouter } from "@/routes/frontend";
import { frontendCreditAvailabilityRouter } from "@/routes/frontend-credit-availability";
import { frontendProfileAvatarsRouter } from "@/routes/frontend-profile-avatars";
import { requireUser } from "@/auth/requireUser";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { isCutoverWriteFreezeEnabled } from "@/cutover-freeze";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
	if (!isCutoverWriteFreezeEnabled(c.env) || c.req.method === "GET" || c.req.method === "HEAD") {
		return next();
	}
	return c.json(
		{ error: "cutover_maintenance", message: "Phaseo is briefly read-only during a database migration." },
		503,
		{ ...PRIVATE_NO_STORE_HEADERS, "Retry-After": "60" },
	);
});

async function enforceMigratedMfa(c: Context<{ Bindings: Env }>, next: Next) {
	const user = await requireUser(c.req.raw, c.env);
	if (!user?.mfaReenrollmentRequired) return next();
	return c.json({ error: "mfa_reenrollment_required" }, 403, PRIVATE_NO_STORE_HEADERS);
}

app.use("/api/chat/*", enforceMigratedMfa);
app.use("/api/internal/*", enforceMigratedMfa);

app.route("/api/_web", publicRouter);
app.route("/api/account", accountRouter);
app.route("/api/internal", internalRouter);
app.route("/api/chat", chatRouter);
app.route("/api/_web", frontendRouter);
app.route("/api/_web", frontendCreditAvailabilityRouter);
app.route("/api/_web", frontendProfileAvatarsRouter);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
