import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameExperience } from "@/components/(games)/GameExperience";
import { catalogueGamesEnabled } from "@/lib/games/preview";
import { GAME_INFO, isGameKey } from "@/lib/games/types";

type GamePageProps = { params: Promise<{ game: string }> };

export async function generateMetadata({
  params,
}: GamePageProps): Promise<Metadata> {
  const { game } = await params;
  return isGameKey(game)
    ? { title: GAME_INFO[game].title, description: GAME_INFO[game].description }
    : {};
}

async function GamePageContent({ params }: GamePageProps) {
  if (!(await catalogueGamesEnabled())) notFound();
  const { game } = await params;
  if (!isGameKey(game)) notFound();
  return <GameExperience game={game} />;
}

export default async function GamePage(props: GamePageProps) {
  const t = await getTranslations("Product.gamesDetail");
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-4 py-12">
          <div className="mx-auto max-w-6xl animate-pulse text-sm text-muted-foreground">
            {t("preparing")}
          </div>
        </main>
      }
    >
      <GamePageContent {...props} />
    </Suspense>
  );
}
