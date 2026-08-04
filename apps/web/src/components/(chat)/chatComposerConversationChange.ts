export type ComposerConversationState = {
	activeThreadId: string | null;
	temporaryMode: boolean;
};

export function shouldResetComposerForConversationChange(
	previous: ComposerConversationState | null,
	current: ComposerConversationState,
): boolean {
	if (!previous) return true;
	if (previous.temporaryMode !== current.temporaryMode) return false;
	return previous.activeThreadId !== current.activeThreadId;
}
