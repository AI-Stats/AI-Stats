import Link from "next/link";
import { Gamepad2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileGameSummary } from "@/lib/fetchers/profile/types";

export function ProfileGames({ summary }: { summary: ProfileGameSummary | null }) {
	const metrics = summary
		? [
			["Played", summary.totalPlayed],
			["Wins", summary.totalWins],
			["Streak", `${summary.currentStreak}d`],
			["Avg score", `${summary.averageScore}%`],
		]
		: [];
	return (
		<Card>
			<CardHeader className="sm:grid-cols-[1fr_auto]">
				<div>
					<CardTitle className="flex items-center gap-2"><Gamepad2 className="size-4" />Catalogue games</CardTitle>
					<CardDescription>Your signed-in daily results, synced across devices.</CardDescription>
				</div>
				<Button asChild><Link href="/games">Play today</Link></Button>
			</CardHeader>
			<CardContent className="space-y-5">
				{!summary || summary.totalPlayed === 0 ? (
					<div className="rounded-2xl bg-muted/40 p-5 text-sm text-muted-foreground">No signed-in results yet. Anonymous play still works and stays on that device.</div>
				) : (
					<>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{metrics.map(([label, value]) => <div key={label} className="rounded-2xl bg-muted/40 p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}
						</div>
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
							{summary.games.map((game) => (
								<div key={game.game} className="rounded-2xl p-3 ring-1 ring-foreground/10">
									<div className="font-medium">{game.label}</div>
									<div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Trophy className="size-3" />{game.wins} wins · {game.bestScore}% best</div>
								</div>
							))}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
