import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "О!дин запрос — AI Агент поиска отелей (Островок 2026)",
  description:
    "AI-агент для умного поиска и прозрачного бронирования отелей на базе синтетического датасета и детерминированного чека.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`dark h-full ${inter.variable}`}>
      <body className={`h-full overflow-hidden bg-background text-foreground font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
