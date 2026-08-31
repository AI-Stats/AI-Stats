export type ChatRequestErrorKind =
	| "payment"
	| "authentication"
	| "validation"
	| "forbidden"
	| "model-unavailable"
	| "timeout"
	| "conflict"
	| "rate-limit"
	| "service"
	| "generic";

type PresentableChatError = {
	status: number | null;
	errorCode: string | null;
	message: string;
	description: string | null;
	details: Array<{ message: string }>;
};

export type ChatRequestErrorPresentation = {
	kind: ChatRequestErrorKind;
	title: string;
	description: string;
	canRetry: boolean;
	canChooseModel: boolean;
};

function getErrorSummary(error: PresentableChatError) {
	return (
		error.description ||
		error.details[0]?.message ||
		error.message ||
		`Request failed${error.status ? ` (${error.status})` : ""}.`
	);
}

export function getChatRequestErrorPresentation(
	error: PresentableChatError,
): ChatRequestErrorPresentation {
	const code = String(error.errorCode ?? "").toLowerCase();
	const summary = getErrorSummary(error);
	const status = error.status;

	if (/(pricing_not_configured|missing_pricing)/.test(code)) {
		return {
			kind: "model-unavailable",
			title: "This model isn't available in Chat",
			description: "Choose another model and try again.",
			canRetry: false,
			canChooseModel: true,
		};
	}

	if (
		status === 402 ||
		/(insufficient_(funds|credits)|payment_required|credit_balance)/.test(code)
	) {
		return {
			kind: "payment",
			title: "Please add credits to use this model",
			description: "Or try a free model.",
			canRetry: false,
			canChooseModel: false,
		};
	}

	if (status === 401 || /(unauthorized|authentication|invalid_token)/.test(code)) {
		return {
			kind: "authentication",
			title: "Please sign in again",
			description: "Your session may have expired.",
			canRetry: false,
			canChooseModel: false,
		};
	}

	if (status === 400 || status === 422 || /(validation|invalid_request)/.test(code)) {
		return {
			kind: "validation",
			title: "This request needs a change",
			description: summary,
			canRetry: false,
			canChooseModel: false,
		};
	}

	if (status === 403 || /(forbidden|permission_denied|access_denied)/.test(code)) {
		return {
			kind: "forbidden",
			title: "This request isn't allowed",
			description: summary,
			canRetry: false,
			canChooseModel: false,
		};
	}

	if (status === 404 || /(model_not_found|not_found|no_candidates)/.test(code)) {
		return {
			kind: "model-unavailable",
			title: "This model isn't available",
			description: "Choose another model and try again.",
			canRetry: false,
			canChooseModel: true,
		};
	}

	if (status === 408 || status === 504 || /(timeout|timed_out)/.test(code)) {
		return {
			kind: "timeout",
			title: "The request timed out",
			description: "The model took too long to respond. Try again.",
			canRetry: true,
			canChooseModel: false,
		};
	}

	if (status === 409 || code.includes("conflict")) {
		return {
			kind: "conflict",
			title: "The request couldn't be completed",
			description: "The chat state changed while it was running. Try again.",
			canRetry: true,
			canChooseModel: false,
		};
	}

	if (status === 429 || /(rate_limit|resource_exhausted|quota_exceeded)/.test(code)) {
		return {
			kind: "rate-limit",
			title: "This model is busy right now",
			description: "Wait a moment and try again, or choose another model.",
			canRetry: true,
			canChooseModel: true,
		};
	}

	if (
		(status != null && status >= 500) ||
		/(upstream_error|all_failed|service_unavailable|empty_response)/.test(code)
	) {
		return {
			kind: "service",
			title: "The model is temporarily unavailable",
			description: "Try again, or choose another model.",
			canRetry: true,
			canChooseModel: true,
		};
	}

	return {
		kind: "generic",
		title: `Request failed${status ? ` (${status})` : ""}.`,
		description: summary,
		canRetry: false,
		canChooseModel: false,
	};
}
