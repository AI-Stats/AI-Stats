"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";

const states: Array<{ state: OrbState; label: string }> = [
	{ state: "working", label: "Working" },
	{ state: "searching", label: "Searching" },
	{ state: "solving", label: "Solving" },
	{ state: "composing", label: "Composing" },
];

export function OrbSpecimen() {
	return (
		<div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-200/80 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-4">
			{states.map(({ state, label }) => (
				<div
					key={state}
					className="flex min-h-32 flex-col items-center justify-center gap-3 bg-white px-4 py-5 dark:bg-zinc-950"
				>
					<ThinkingOrb state={state} size={64} aria-label={`${label} orb`} />
					<span className="text-xs font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
						{label}
					</span>
				</div>
			))}
		</div>
	);
}
