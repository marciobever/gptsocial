import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meta Studio — Campanhas assistidas por IA",
  description: "Crie, revise e publique campanhas e criativos no Meta Ads.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
