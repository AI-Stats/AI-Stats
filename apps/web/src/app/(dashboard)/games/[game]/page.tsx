import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export default async function GamePage({ params }: GamePageProps) {
  if (!catalogueGamesEnabled()) notFound();
  const { game } = await params;
  if (!isGameKey(game)) notFound();
  return <GameExperience game={game} />;
}
