import { notFound } from "next/navigation";
import { GameHub } from "@/components/(games)/GameHub";
import { catalogueGamesEnabled } from "@/lib/games/preview";

export default function GamesPage() {
  if (!catalogueGamesEnabled()) notFound();
  return <GameHub />;
}
