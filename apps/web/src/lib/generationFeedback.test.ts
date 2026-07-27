import {
	GENERATION_FEEDBACK_COMMENT_QUESTION_ID,
	GENERATION_FEEDBACK_CATEGORY_QUESTION_ID,
	GENERATION_FEEDBACK_SURVEY_ID,
	buildGenerationFeedbackEvents,
} from "./generationFeedback";

describe("buildGenerationFeedbackEvents", () => {
	it("builds a completed trace-linked category response", () => {
		const events = buildGenerationFeedbackEvents({
			category: "Latency",
			requestId: "req_123",
			submissionId: "submission_123",
			workspaceId: "workspace_123",
		});

		expect(events).toEqual([
			{
				event: "survey sent",
				properties: expect.objectContaining({
					$ai_trace_id: "req_123",
					$survey_completed: true,
					$survey_id: GENERATION_FEEDBACK_SURVEY_ID,
					$survey_question_id: GENERATION_FEEDBACK_CATEGORY_QUESTION_ID,
					$survey_response: "Latency",
					$survey_submission_id: "submission_123",
					workspace_id: "workspace_123",
				}),
			},
		]);
	});

	it("groups a trimmed comment with the selected category", () => {
		const events = buildGenerationFeedbackEvents({
			category: "Incorrect Response",
			comment: "  The answer missed the requested format.  ",
			requestId: "req_456",
			submissionId: "submission_456",
			workspaceId: "workspace_456",
		});

		expect(events).toHaveLength(2);
		expect(events[0].properties).toEqual(
			expect.objectContaining({
				$survey_completed: false,
				$survey_response: "Incorrect Response",
			}),
		);
		expect(events[1].properties).toEqual(
			expect.objectContaining({
				$survey_completed: true,
				$survey_question_id: GENERATION_FEEDBACK_COMMENT_QUESTION_ID,
				$survey_response: "The answer missed the requested format.",
				$survey_submission_id: "submission_456",
			}),
		);
	});
});
