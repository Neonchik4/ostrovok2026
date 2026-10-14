import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const ptRootUi = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../../public/fonts/PT-Root-UI-Web-Light.974865d0.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/PT-Root-UI-Web-Regular.fa37ad7a.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/PT-Root-UI-Web-Medium.4b7fa55b.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/PT-Root-UI-Web-Bold.853746a2.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "О!дин запрос — AI Агент поиска отелей (Островок 2026)",
  description:
    "AI-агент для умного поиска и прозрачного бронирования отелей на базе синтетического датасета и детерминированного чека.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`h-full ${ptRootUi.variable}`} suppressHydrationWarning>
      <body
        className={`min-h-full bg-background font-sans text-foreground antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
