import { renderToStaticMarkup } from "react-dom/server";

import type { RequestRow } from "@/app/(dashboard)/gateway/usage/server-actions";
import RequestDetailDialog from "./RequestDetailDialog";
import { RouteRequestDetailErrorDialog } from "./RouteRequestDetailDialog";

const router = {
	push: jest.fn(),
	refresh: jest.fn(),
};

jest.mock("next/navigation", () => ({
	useRouter: () => router,
	useSearchParams: () => new URLSearchParams(),
}));

const historicalRequestWithoutCollections = {
	request_id: "req_historical",
	created_at: "2026-08-11T12:00:00.000Z",
	endpoint: null,
	model_id: null,
	provider: null,
	app_id: null,
	session_id: null,
	success: true,
	status_code: 200,
	error_code: null,
	error_message: null,
	error_payload: null,
	usage: null,
	cost_nanos: null,
} as RequestRow;

describe("RequestDetailDialog", () => {
	it("opens a historical request when optional collections are absent", () => {
		expect(() =>
			renderToStaticMarkup(
				<RequestDetailDialog
					open
					onOpenChange={() => {}}
					request={historicalRequestWithoutCollections}
				/>,
			),
		).not.toThrow();
	});

	it("renders a retryable state when a route detail cannot load", () => {
		const markup = renderToStaticMarkup(
			<RouteRequestDetailErrorDialog closeHref="/settings/usage/logs/requests" />,
		);

		expect(markup).toContain("Request details unavailable");
		expect(markup).toContain("Try again");
		expect(markup).toContain("Back to request logs");
	});
});
