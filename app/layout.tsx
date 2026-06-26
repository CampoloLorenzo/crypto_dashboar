import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crypto Intelligence",
  description:
    "Dashboard di intelligence crypto — dati di mercato, scoring rischio/crescita euristico e assistente AI. Non è consulenza finanziaria.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
