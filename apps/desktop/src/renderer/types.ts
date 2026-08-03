import type { LucideIcon } from "lucide-react";

export type ProductSurface = "workspace" | "platform";
export type ThemePreference = "dark" | "light" | "system";

export type NavigationItem = {
	id: string;
	label: string;
	icon: LucideIcon;
	badge?: number;
};
