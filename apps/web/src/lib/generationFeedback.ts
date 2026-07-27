export const GENERATION_FEEDBACK_SURVEY_ID =
	process.env.POSTHOG_GENERATION_FEEDBACK_SURVEY_ID ??
	"019fa0b3-f0a7-0000-c4d0-8fe5c3214f44";

export const GENERATION_FEEDBACK_CATEGORY_QUESTION_ID =
	process.env.POSTHOG_GENERATION_FEEDBACK_CATEGORY_QUESTION_ID ??
	"a3d13572-3cfe-4b52-a39a-37ff3b3c1441";

export const GENERATION_FEEDBACK_COMMENT_QUESTION_ID =
	process.env.POSTHOG_GENERATION_FEEDBACK_COMMENT_QUESTION_ID ??
	"c4cf0ae5-12b8-4c61-bb6f-8067d59f8148";

export const GENERATION_FEEDBACK_MAX_COMMENT_LENGTH = 1_000;

export const GENERATION_FEEDBACK_CATEGORIES = [
	"Latency",
	"Incoherence",
	"Incorrect Response",
	"Formatting",
	"Billing",
	"API Error",
	"Guardrail False Positive",
	"Other",
] as const;

export type GenerationFeedbackCategory =
	(typeof GENERATION_FEEDBACK_CATEGORIES)[number];

type GenerationFeedbackEvent = {
	event: "survey sent";
	properties: Record<string, unknown>;
};

export function buildGenerationFeedbackEvents(args: {
	category: GenerationFeedbackCategory;
	comment?: string;
	requestId: string;
	submissionId: string;
	workspaceId: string;
}): GenerationFeedbackEvent[] {
	const comment = args.comment?.trim() ?? "";
	const sharedProperties = {
		$ai_trace_id: args.requestId,
		$survey_id: GENERATION_FEEDBACK_SURVEY_ID,
		$survey_submission_id: args.submissionId,
		generation_id: args.requestId,
		workspace_id: args.workspaceId,
	};
	const events: GenerationFeedbackEvent[] = [
		{
			event: "survey sent",
			properties: {
				...sharedProperties,
				$survey_completed: comment.length === 0,
				$survey_question_id: GENERATION_FEEDBACK_CATEGORY_QUESTION_ID,
				$survey_question_type: "single_choice",
				$survey_response: args.category,
				[`$survey_response_${GENERATION_FEEDBACK_CATEGORY_QUESTION_ID}`]:
					args.category,
			},
		},
	];

	if (comment) {
		events.push({
			event: "survey sent",
			properties: {
				...sharedProperties,
				$survey_completed: true,
				$survey_question_id: GENERATION_FEEDBACK_COMMENT_QUESTION_ID,
				$survey_question_type: "open",
				$survey_response: comment,
				[`$survey_response_${GENERATION_FEEDBACK_COMMENT_QUESTION_ID}`]:
					comment,
			},
		});
	}

	return events;
}
