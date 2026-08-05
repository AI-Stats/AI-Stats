import { cn } from "@/lib/utils";

export function AIGeneratedNotice({ className }: { className?: string }) {
	return (
		<p
			role="note"
			className={cn(
				"text-center text-[11px] leading-4 text-muted-foreground",
				className,
			)}
		>
			AI can make mistakes. Check important info.
		</p>
	);
}
