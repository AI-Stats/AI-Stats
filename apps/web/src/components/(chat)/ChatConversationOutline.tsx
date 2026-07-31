"use client";

import { cn } from "@/lib/utils";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatConversationOutlineItem } from "./chatConversationOutline";

export function ChatConversationOutline({
	activeMessageId,
	items,
	onNavigate,
}: {
	activeMessageId: string | null;
	items: ChatConversationOutlineItem[];
	onNavigate: (item: ChatConversationOutlineItem) => void;
}) {
	if (items.length < 2) return null;

	return (
		<nav
			aria-label="Conversation outline"
			className="absolute right-3 top-1/2 z-20 hidden max-h-[min(68vh,36rem)] -translate-y-1/2 flex-col overflow-y-auto rounded-full border border-border/70 bg-background/85 px-2 py-2.5 shadow-sm backdrop-blur 2xl:flex"
		>
			<ol className="flex flex-col items-center gap-1.5">
				{items.map((item, index) => {
					const isActive = item.id === activeMessageId;
					return (
						<li key={item.id} className="flex">
							<Tooltip>
								<TooltipTrigger
									aria-current={isActive ? "step" : undefined}
									aria-label={`Jump to prompt ${index + 1}: ${item.label}`}
									className="group flex h-4 w-5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									onClick={() => onNavigate(item)}
									type="button"
								>
									<span
										aria-hidden="true"
										className={cn(
											"block rounded-full transition-all",
											isActive
												? "h-3.5 w-1.5 bg-foreground"
												: "h-1.5 w-1.5 bg-muted-foreground/45 group-hover:h-2.5 group-hover:bg-foreground",
										)}
									/>
								</TooltipTrigger>
								<TooltipContent
									side="left"
									sideOffset={10}
									className="max-w-72 flex-col items-start text-pretty"
								>
									<span className="font-medium">
										Prompt {index + 1}
									</span>
									<span className="line-clamp-3 text-background/80">
										{item.label}
									</span>
								</TooltipContent>
							</Tooltip>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
