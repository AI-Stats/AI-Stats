"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const sampleTokens = [
	"Lorem", "ipsum", "dolor", "sit", "amet,", "consectetur", "adipiscing", "elit.",
	"Integer", "vel", "sem", "at", "sapien", "facilisis", "viverra.", "Suspendisse",
	"potenti.", "Donec", "eu", "nibh", "vitae", "justo", "ornare", "tempor.",
	"Curabitur", "mattis", "libero", "sed", "nunc", "volutpat,", "quis", "aliquet",
	"erat", "faucibus.",
];

const lanes = [
	{ name: "Measured pace", speed: "18 tokens/s", firstToken: 900, interval: 220, color: "bg-amber-500" },
	{ name: "Fast pace", speed: "45 tokens/s", firstToken: 520, interval: 105, color: "bg-sky-500" },
	{ name: "Very fast pace", speed: "90 tokens/s", firstToken: 240, interval: 48, color: "bg-emerald-500" },
];

const windowSize = 72;

export default function TokenSpeedSimulation() {
	const [elapsed, setElapsed] = useState(0);
	const [playing, setPlaying] = useState(true);
	const startRef = useRef(performance.now());
	const pausedAtRef = useRef(0);

	useEffect(() => {
		if (!playing) return;
		startRef.current = performance.now() - pausedAtRef.current;
		let frame = 0;
		const tick = (now: number) => {
			const next = now - startRef.current;
			pausedAtRef.current = next;
			setElapsed(next);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing]);

	const replay = () => {
		pausedAtRef.current = 0;
		startRef.current = performance.now();
		setElapsed(0);
		setPlaying(true);
	};

	return (
		<div className="overflow-hidden rounded-md border border-border/70 bg-background">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-5 py-3">
				<div>
					<p className="text-sm font-medium">Live relative-speed playback</p>
					<p className="mt-0.5 text-xs text-muted-foreground">Speeds are slowed proportionally so the difference is visible.</p>
				</div>
				<div className="flex gap-2">
					<Button className="rounded-md" size="sm" variant="outline" onClick={() => setPlaying((value) => !value)}>
						{playing ? <Pause /> : <Play />}{playing ? "Pause" : "Play"}
					</Button>
					<Button className="rounded-md" size="sm" variant="outline" onClick={replay}><RotateCcw />Replay</Button>
				</div>
			</div>

			<div className="divide-y divide-border/70">
				{lanes.map((lane) => {
					const generatedCount = Math.max(0, Math.floor((elapsed - lane.firstToken) / lane.interval) + 1);
					const firstVisibleIndex = Math.max(0, generatedCount - windowSize);
					const visibleTokens = Array.from(
						{ length: Math.min(generatedCount, windowSize) },
						(_, index) => ({
							absoluteIndex: firstVisibleIndex + index,
							value: sampleTokens[(firstVisibleIndex + index) % sampleTokens.length],
						})
					);
					const waiting = elapsed < lane.firstToken;
					return (
						<div key={lane.name} className="grid gap-4 px-5 py-6 sm:grid-cols-[9rem_minmax(0,1fr)]">
							<div>
								<div className="flex items-center gap-2"><span className={`size-2 rounded-full ${lane.color}`} /><p className="text-sm font-medium">{lane.name}</p></div>
								<p className="mt-1 pl-4 font-mono text-xs text-muted-foreground">{lane.speed}</p>
							</div>
							<StreamingOutput
								laneName={lane.name}
								waiting={waiting}
								generatedCount={generatedCount}
								tokens={visibleTokens}
							/>
						</div>
					);
				})}
			</div>

			<div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-5 py-2 font-mono text-xs text-muted-foreground">
				<span>{playing ? "Streaming continuously" : "Playback paused"}</span>
				<span>{(elapsed / 1000).toFixed(1)} seconds</span>
			</div>
		</div>
	);
}

function StreamingOutput({
	laneName,
	waiting,
	generatedCount,
	tokens,
}: {
	laneName: string;
	waiting: boolean;
	generatedCount: number;
	tokens: Array<{ absoluteIndex: number; value: string }>;
}) {
	const outputRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const output = outputRef.current;
		if (output) output.scrollTop = output.scrollHeight;
	}, [generatedCount]);

	return (
		<ScrollArea
			viewportRef={outputRef}
			className="h-[7.25rem] rounded-md border border-border/70 bg-muted/15"
			viewportClassName="p-4 font-mono text-sm leading-7"
		>
			<div>
				{waiting && <span className="inline-flex items-center gap-2 text-muted-foreground"><span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />Waiting for first token</span>}
				<span aria-live="polite">
					{tokens.map((token, index) => (
						<span key={`${laneName}-${token.absoluteIndex}`} className={index === tokens.length - 1 ? "bg-foreground px-0.5 text-background" : ""}>{token.value}{" "}</span>
					))}
				</span>
				{generatedCount > 0 && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" />}
			</div>
		</ScrollArea>
	);
}
