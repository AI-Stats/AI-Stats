import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Gauge,
  Swords,
  Target,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GAME_INFO, GAME_KEYS, type GameKey } from "@/lib/games/types";

const ICONS: Record<GameKey, React.ComponentType<{ className?: string }>> = {
  modele: Target,
  timeline: CalendarClock,
  pricele: CircleDollarSign,
  "head-to-head": Swords,
  sprint: Gauge,
};

export function GameHub() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,var(--color-muted),transparent_42%)] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Catalogue lab
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Five ways to know the models.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Daily games generated from Phaseo’s model catalogue. A new set lands
            at midnight UTC.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_KEYS.map((game) => {
            const Icon = ICONS[game];
            const info = GAME_INFO[game];
            return (
              <Link
                key={game}
                href={info.path}
                className="group rounded-[24px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <Card className="h-full transition-transform duration-200 group-hover:-translate-y-1">
                  <CardHeader>
                    <div className="mb-6 flex size-10 items-center justify-center rounded-2xl bg-foreground text-background">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-xl">{info.title}</CardTitle>
                    <CardDescription className="leading-6">
                      {info.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex items-center gap-2 font-medium">
                    Play today{" "}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
