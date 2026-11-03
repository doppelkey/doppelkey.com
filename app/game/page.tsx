import type { Metadata } from "next";
import Game from "./Game";

export const metadata: Metadata = {
  title: "Doppelkey | Play today's puzzle",
  description:
    "Build words of four or more letters from today's four keypad digits.",
};

export default function GamePage() {
  return <Game />;
}
