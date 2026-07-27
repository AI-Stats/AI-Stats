"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitGenerationFeedback } from "@/app/(dashboard)/gateway/usage/server-actions";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	GENERATION_FEEDBACK_CATEGORIES,
	GENERATION_FEEDBACK_MAX_COMMENT_LENGTH,
	type GenerationFeedbackCategory,
} from "@/lib/generationFeedback";

export default function GenerationFeedbackDialog({
	onOpenChange,
	open,
	requestId,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	requestId: string | null;
}) {
	const [category, setCategory] =
		useState<GenerationFeedbackCategory | null>(null);
	const [comment, setComment] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		if (open) return;
		setCategory(null);
		setComment("");
		setError(null);
	}, [open, requestId]);

	const submit = () => {
		if (!requestId || !category) return;
		setError(null);
		startTransition(async () => {
			const result = await submitGenerationFeedback({
				category,
				comment,
				requestId,
			});
			if (!result.success) {
				const message = result.error ?? "Feedback could not be sent.";
				setError(message);
				toast.error(message);
				return;
			}
			toast.success("Feedback submitted");
			onOpenChange(false);
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-5 sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle>Report Feedback</DialogTitle>
					<DialogDescription>
						Help us improve by reporting an issue with this generation.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="feedback-category">
							Category
						</label>
						<Select
							value={category}
							onValueChange={(value) => {
								setCategory(value);
								setError(null);
							}}
						>
							<SelectTrigger
								id="feedback-category"
								className="w-full data-[size=default]:h-10"
							>
								<SelectValue placeholder="Select a category" />
							</SelectTrigger>
							<SelectContent align="start">
								{GENERATION_FEEDBACK_CATEGORIES.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="feedback-comment">
							Comment
						</label>
						<Textarea
							id="feedback-comment"
							value={comment}
							maxLength={GENERATION_FEEDBACK_MAX_COMMENT_LENGTH}
							className="min-h-28 resize-y"
							placeholder="Describe the issue…"
							onChange={(event) => setComment(event.target.value)}
						/>
						<div className="text-right text-xs tabular-nums text-muted-foreground">
							{comment.length.toLocaleString()}/{GENERATION_FEEDBACK_MAX_COMMENT_LENGTH.toLocaleString()}
						</div>
					</div>

					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						disabled={isPending}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button disabled={!category || isPending} onClick={submit}>
						{isPending ? "Submitting…" : "Submit"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
