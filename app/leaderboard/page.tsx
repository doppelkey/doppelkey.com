import type { Metadata } from "next";
import Leaderboard from "./Leaderboard";

export const metadata: Metadata = {
  title: "Doppelkey | Daily leaderboard",
  description: "Today's ranked scores for the Doppelkey daily word puzzle.",
};

export default function LeaderboardPage() {
  return <Leaderboard />;
}
