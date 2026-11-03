import type { Metadata } from "next";
import Account from "./Account";

export const metadata: Metadata = {
  title: "Doppelkey | Your account",
  description: "Your Doppelkey username, profile picture and streak.",
};

export default function AccountPage() {
  return <Account />;
}
