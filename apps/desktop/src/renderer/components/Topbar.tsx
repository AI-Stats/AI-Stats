import { ArrowLeft, ArrowRight, Command, Moon, Plus, Sun } from "lucide-react";
import type { ProductSurface, ThemePreference } from "../types";

type TopbarProps = {
	surface: ProductSurface;
	theme: ThemePreference;
	onThemeChange: (theme: ThemePreference) => void;
};

export function Topbar({ surface, theme, onThemeChange }: TopbarProps) {
	return (
		<header className="topbar">
			<div className="history-controls">
				<button type="button" aria-label="Back" disabled>
					<ArrowLeft size={15} />
				</button>
				<button type="button" aria-label="Forward" disabled>
					<ArrowRight size={15} />
				</button>
			</div>

			<div className="topbar-context">
				<span>Phaseo</span>
				<span className="breadcrumb-separator">/</span>
				<strong>{surface === "workspace" ? "Workspace" : "Platform"}</strong>
			</div>

			<div className="topbar-actions">
				<button className="command-button" type="button">
					<Command size={14} />
					<span>Commands</span>
					<kbd>⌘K</kbd>
				</button>
				<button
					className="icon-button"
					type="button"
					onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
					aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
				>
					{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
				</button>
				<button className="primary-button compact" type="button">
					<Plus size={15} />
					{surface === "workspace" ? "New mission" : "New API key"}
				</button>
			</div>
		</header>
	);
}
