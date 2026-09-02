"use client";

import { useEffect, useState } from "react";
import {
	BookOpenText,
	Code2,
	Lightbulb,
	PenLine,
	type LucideIcon,
} from "lucide-react";
import { useInitialChatAuth } from "@/components/(chat)/ChatAuthProvider";
import { useTranslations } from "next-intl";

type DayPeriod = "morning" | "afternoon" | "evening";

type PromptStarter = {
	label: string;
	prompt: string;
	icon: LucideIcon;
};

const PROMPT_STARTERS: Record<DayPeriod, PromptStarter[]> = {
	morning: [
		{ label: "Plan my day", prompt: "Help me make a focused plan for today.", icon: Lightbulb },
		{ label: "Draft something", prompt: "Help me draft something clear and concise.", icon: PenLine },
		{ label: "Learn a topic", prompt: "Teach me something useful in simple terms.", icon: BookOpenText },
		{ label: "Build an idea", prompt: "Help me turn an idea into a practical first version.", icon: Code2 },
	],
	afternoon: [
		{ label: "Solve a problem", prompt: "Help me work through a problem step by step.", icon: Lightbulb },
		{ label: "Improve my writing", prompt: "Help me improve a piece of writing.", icon: PenLine },
		{ label: "Explain anything", prompt: "Explain a complex topic in a clear way.", icon: BookOpenText },
		{ label: "Prototype an idea", prompt: "Help me prototype an idea quickly.", icon: Code2 },
	],
	evening: [
		{ label: "Reflect on today", prompt: "Help me reflect on today and identify what matters next.", icon: Lightbulb },
		{ label: "Write creatively", prompt: "Help me write something imaginative.", icon: PenLine },
		{ label: "Explore a question", prompt: "Help me explore an interesting question.", icon: BookOpenText },
		{ label: "Make something", prompt: "Help me make a small useful project.", icon: Code2 },
	],
};

function getDayPeriod(hour: number): DayPeriod {
	if (hour < 12) return "morning";
	if (hour < 18) return "afternoon";
	return "evening";
}
export function ChatMessagesEmptyState({
	onSelectPrompt,
	temporaryMode = false,
}: {
	onSelectPrompt: (prompt: string) => void;
	temporaryMode?: boolean;
}) {
	const initialAuth = useInitialChatAuth();
	const t = useTranslations("Product.chat");
	const [period, setPeriod] = useState<DayPeriod>("morning");

	useEffect(() => {
		setPeriod(getDayPeriod(new Date().getHours()));
	}, []);

	const displayName = initialAuth?.user?.displayName?.trim();
	const firstName = displayName?.split(/\s+/)[0] || undefined;
	const starters = PROMPT_STARTERS[period];

	return (
		<div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
			<section className="mx-auto w-full max-w-2xl">
				<div className="text-center">
					{temporaryMode ? (
						<p className="mb-3 inline-flex items-center rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
							{t("temporary")}
						</p>
					) : null}
					<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
						{t("greeting", { period: t(period), name: firstName ? `, ${firstName}` : "" })}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						{t("greetingPrompt")}
					</p>
				</div>

				<div className="mt-8 grid gap-2 sm:grid-cols-2">
					{starters.map((starter) => {
						const Icon = starter.icon;
						return (
							<button
								key={starter.label}
								type="button"
								onClick={() => onSelectPrompt(starter.prompt)}
								className="group flex min-h-12 items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
								<span>{starter.label}</span>
							</button>
						);
					})}
				</div>
			</section>
		</div>
	);
}
