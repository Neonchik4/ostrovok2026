import {
  Compass,
  Landmark,
  type LucideIcon,
  Mountain,
  Trees,
  Waves,
} from "lucide-react";

/**
 * Стартовый сценарий онбординга (Issue #41, экран S01 / фича F01).
 * query — готовый запрос агенту, который запускает реальный поисковый поток
 * по валидному направлению из реестра locations.json.
 */
export interface OnboardingScenario {
  id: string;
  label: string;
  hint: string;
  query: string;
  icon: LucideIcon;
}

export const ONBOARDING_SCENARIOS: readonly OnboardingScenario[] = [
  {
    id: "sea",
    label: "К морю",
    hint: "Сочи и Красная Поляна",
    query: "Хочу на море в Сочи: подбери отель у пляжа",
    icon: Waves,
  },
  {
    id: "ski",
    label: "В горы и на лыжи",
    hint: "Шерегеш и Алтай",
    query: "Хочу в горы на лыжи в Шерегеш: отель рядом с подъёмниками",
    icon: Mountain,
  },
  {
    id: "weekend",
    label: "На выходные за город",
    hint: "Карелия и Калининград",
    query: "На выходные за город в Карелию: подбери отель на природе",
    icon: Trees,
  },
  {
    id: "culture",
    label: "В культурную столицу",
    hint: "Санкт-Петербург",
    query: "Хочу в Санкт-Петербург: музеи и архитектура, отель в центре",
    icon: Landmark,
  },
  {
    id: "undecided",
    label: "Пока не решил куда",
    hint: "Подберём направление вместе",
    query: "Пока не решил, куда поехать: предложи популярные направления и лучшие отели",
    icon: Compass,
  },
] as const;
