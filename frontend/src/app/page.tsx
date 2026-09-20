"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Compass, ShieldCheck, Zap } from "lucide-react";

const ISLAND_ASCII = `
           .  :  *  .  :  *  .
        *     .   |   .     *
           . -- ( O ) -- .
        *     .   |   .     *
               ______
             .-'      '-.
            /    [==]    \\
           /     |  |     \\
          /      |__|      \\
  .  *   /   _   |  |   _   \\   *  .
        /   / \\  |  |  / \\   \\
       /   /   \\ |  | /   \\   \\
~ ~ ~~/___/____ \\|__|/ ____\\___\\~~~~ ~ ~~
     /                           \\
    /       _.-"""""""-._         \\
   /     .-'             '-.       \\
~~|-----'                   '-----|~~
  |    /\\   /\\         /\\   /\\    |
  |   /  \\ /  \\       /  \\ /  \\   |
~~\__/____\\____\\_____/____/____\\__/~~
`.trim();

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/30 selection:text-primary">
      {/* Background grid effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/80 bg-background/60 px-6 py-4 backdrop-blur-md lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/20 text-primary shadow-[0_0_15px_rgba(2,132,199,0.3)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-mono text-lg font-black tracking-wider text-foreground">
              OSTROVOK<span className="text-primary">.AI</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/app">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-primary/50 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_rgba(2,132,199,0.4)]"
            >
              <span>Открыть</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12">
        <div className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-12">
          {/* Left Column: ASCII Print Artwork */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <div className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-card/80 p-6 shadow-[0_0_30px_rgba(2,132,199,0.12)] backdrop-blur-xl transition-all duration-500 hover:border-primary/60 hover:shadow-[0_0_40px_rgba(2,132,199,0.25)]">
              {/* Card Terminal Header */}
              <div className="mb-4 flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-destructive/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    AGENT_TERMINAL :: OSTROVOK_ISLAND
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-primary">
                  <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
                  <span>ONLINE</span>
                </div>
              </div>

              {/* ASCII Canvas */}
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center justify-center py-2"
              >
                <pre className="font-mono text-xs leading-relaxed text-primary drop-shadow-[0_0_8px_rgba(2,132,199,0.6)] sm:text-sm">
                  {ISLAND_ASCII}
                </pre>
              </motion.div>

              {/* Terminal Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3 font-mono text-[11px] text-muted-foreground">
                <span>[RESORT :: PACIFIC_ISLAND]</span>
                <span className="text-primary/80">✦ AI CONCIERGE</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Minimal Info & Big Goto CTA */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="flex flex-col items-start gap-6 lg:col-span-6"
          >
            {/* Status Chip */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>ИИ-Агент нового поколения</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Умный поиск отелей <span className="text-primary">Островок</span>
            </h1>

            {/* Concise Description */}
            <p className="max-w-lg text-lg text-muted-foreground">
              Персональный ИИ-консьерж с прозрачным мышлением. Находит идеальный отель по
              любому свободному запросу.
            </p>

            {/* Goto Action Button */}
            <div className="mt-2 flex items-center gap-4">
              <Link href="/app">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-[0_0_25px_rgba(2,132,199,0.5)] transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_35px_rgba(2,132,199,0.7)]"
                >
                  <span>Открыть</span>
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Feature Highlights Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
          className="mt-20 grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-3"
        >
          <div className="rounded-2xl border border-border/80 bg-card/50 p-6 backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:bg-card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-base font-bold text-foreground">Естественный язык</h3>
            <p className="text-sm text-muted-foreground">
              Понимает сложные жизненные контексты и подробные пожелания.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/50 p-6 backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:bg-card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-base font-bold text-foreground">Прозрачные мысли</h3>
            <p className="text-sm text-muted-foreground">
              Визуализация рассуждений агента и промежуточного поиска.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/50 p-6 backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:bg-card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-base font-bold text-foreground">Мгновенный подбор</h3>
            <p className="text-sm text-muted-foreground">
              Интерактивные карточки отелей с ценами и ключевыми преимуществами.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 py-6 text-center font-mono text-xs text-muted-foreground">
        <span>Ostrovok Hackathon 2026 &bull; AI Hotel Concierge</span>
      </footer>
    </div>
  );
}
