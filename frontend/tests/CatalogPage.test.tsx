import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CatalogPage from "@/app/catalog/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/catalog",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

// Mock useChatStream hook
vi.mock("@/shared/api", () => ({
  useChatStream: () => ({
    hotels: [
      {
        id: "hotel-1",
        name: "Гранд Отель Сочи",
        city: "Сочи",
        stars: 5,
        rating: 9.2,
        reviews_count: 310,
        image_urls: [],
        match_score_pct: 95,
        tags: ["теплый бассейн", "завтрак"],
        min_price_per_night_rub: 12000,
        coordinates: { lat: 43.5855, lon: 39.7231 },
      },
      {
        id: "hotel-2",
        name: "Апартаменты Ривьера",
        city: "Сочи",
        stars: 3,
        rating: 8.4,
        reviews_count: 85,
        image_urls: [],
        match_score_pct: 78,
        tags: ["можно с питомцами"],
        min_price_per_night_rub: 4500,
        coordinates: { lat: 43.5900, lon: 39.7200 },
      },
    ],
    transportSummary: null,
    thoughts: [],
    isStreaming: false,
    sendMessage: vi.fn(),
  }),
  formatPrice: (p: number) => `${p} ₽`,
}));

describe("CatalogPage 3-Column Simulator (Frontend 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3-column layout: filters, hotels list, and map", () => {
    const { container } = render(<CatalogPage />);

    // Unified header
    const header = screen.getByRole("banner");
    expect((container.firstChild as HTMLElement).firstElementChild).toBe(header);
    expect(header).toHaveClass("h-14");
    expect(within(header).getByAltText("Островок")).toHaveAttribute("src", "/ostrovok-mark.png");
    expect(within(header).getByRole("heading", { name: "Каталог Островка" })).toBeInTheDocument();
    expect(screen.queryByText("Островок 2026")).not.toBeInTheDocument();

    // Screen navigation
    expect(screen.getAllByRole("navigation", { name: "Переключатель экранов" })).toHaveLength(1);
    expect(within(header).getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(within(header).getByRole("button", { name: "Каталог Островка" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    // Column 1: Filters
    expect(screen.getByRole("complementary", { name: /Фильтры каталога/i })).toBeInTheDocument();
    expect(screen.getByText("Даты поездки")).toBeInTheDocument();
    expect(screen.getByText("Бюджет / ночь")).toBeInTheDocument();

    // Column 2: Hotels
    expect(screen.getByText("Гранд Отель Сочи")).toBeInTheDocument();
    expect(screen.getByText("Апартаменты Ривьера")).toBeInTheDocument();

    // Column 3: Map
    expect(screen.getByText("Яндекс.Карты: Сочи")).toBeInTheDocument();

    // Ghost Agent
    expect(screen.getByTestId("ghost-actor-container")).toBeInTheDocument();
    expect(screen.getByTestId("ghost-action-bar")).toBeInTheDocument();
  });

  it("filters hotels reactively when star filter is selected", () => {
    render(<CatalogPage />);

    expect(screen.getByText("Гранд Отель Сочи")).toBeInTheDocument();
    expect(screen.getByText("Апартаменты Ривьера")).toBeInTheDocument();

    // Click 5 stars filter
    const fiveStarsBtn = screen.getByRole("button", { name: "5 ★" });
    fireEvent.click(fiveStarsBtn);

    // Only 5-star hotel remains
    expect(screen.getByText("Гранд Отель Сочи")).toBeInTheDocument();
    expect(screen.queryByText("Апартаменты Ривьера")).not.toBeInTheDocument();
  });

  it("interacts with ghost action bar to adjust filters", () => {
    render(<CatalogPage />);

    // Click quick chip "Теплый бассейн" on Action Bar
    const poolChip = screen.getByRole("button", { name: "Теплый бассейн" });
    fireEvent.click(poolChip);

    // Hotel with pool should stay, hotel without should be filtered out
    expect(screen.getByText("Гранд Отель Сочи")).toBeInTheDocument();
    expect(screen.queryByText("Апартаменты Ривьера")).not.toBeInTheDocument();
  });
});
