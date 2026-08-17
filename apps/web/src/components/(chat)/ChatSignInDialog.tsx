"use client";

import { Login } from "@/components/(gateway)/auth/Login";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function ChatSignInDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
				<DialogHeader className="sr-only">
					<DialogTitle>Sign in to chat</DialogTitle>
					<DialogDescription>
						Sign in without losing your current chat.
					</DialogDescription>
				</DialogHeader>
				<Login
					returnUrl="/chat"
					useBetterAuth
				/>
			</DialogContent>
		</Dialog>
	);
}
