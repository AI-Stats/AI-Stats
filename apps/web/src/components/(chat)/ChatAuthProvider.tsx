"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { InternalAuthHeaderData } from "@/lib/fetchers/internal/authTypes";

const ChatAuthContext = createContext<InternalAuthHeaderData | null>(null);

export function ChatAuthProvider({
	children,
	initialAuth,
}: {
	children: ReactNode;
	initialAuth: InternalAuthHeaderData;
}) {
	return (
		<ChatAuthContext.Provider value={initialAuth}>
			{children}
		</ChatAuthContext.Provider>
	);
}

export function useInitialChatAuth() {
	return useContext(ChatAuthContext);
}
