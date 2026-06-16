import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayUp Admin",
  description: "PlayUp — внутренняя админка",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
