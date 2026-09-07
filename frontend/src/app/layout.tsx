import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ru" className="dark h-full">
      <body className="h-full overflow-hidden bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
