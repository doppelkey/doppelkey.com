import type { Metadata } from "next";
import { Krona_One, Liter, Noto_Sans } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});
const kronaOne = Krona_One({
  variable: "--font-krona-one",
  subsets: ["latin"],
  weight: "400",
});
const liter = Liter({
  variable: "--font-liter",
  adjustFontFallback: false,
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Doppelkey | A daily digit word puzzle",
  description: "Build words of four or more letters from four keypad digits.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${kronaOne.variable} ${liter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
