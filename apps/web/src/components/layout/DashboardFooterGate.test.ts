import { shouldShowDashboardFooter } from "./DashboardFooterGate";

describe("shouldShowDashboardFooter", () => {
	it.each(["/chat", "/chat/fusion", "/chat/image/session-1"])(
		"keeps the dashboard footer out of %s",
		(pathname) => {
			expect(shouldShowDashboardFooter(pathname)).toBe(false);
		},
	);

	it.each(["/", "/models", "/settings/account", "/chats"])(
		"keeps the dashboard footer on %s",
		(pathname) => {
			expect(shouldShowDashboardFooter(pathname)).toBe(true);
		},
	);
});
