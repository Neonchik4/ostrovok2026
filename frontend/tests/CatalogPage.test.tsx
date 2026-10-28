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
    expect(screen.getByRole("combobox", { name: "Сортировка отелей" })).toHaveValue("match");
    expect(screen.getByText("Цена за ночь")).toBeInTheDocument();

    // Column 2: Hotels
    expect(screen.getByText("Гранд Отель Сочи")).toBeInTheDocument();
    expect(screen.getByText("Апартаменты Ривьера")).toBeInTheDocument();

    // Hotel cards as in the design
    expect(screen.getByText("2 отеля")).toBeInTheDocument();
    expect(screen.getByText("9,2")).toBeInTheDocument();
    expect(screen.getByText("310 оценок")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Выбрать номер" })).toHaveLength(2);

    // Никаких заглушек без данных бэкенда
    expect(screen.queryByText("Даты и гости")).not.toBeInTheDocument();
    expect(screen.queryByText(/окт/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "В избранное" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Гранд Отель Сочи" })).not.toBeInTheDocument();

    // Column 3: Map
    expect(screen.getByRole("region", { name: "Карта отелей" })).toBeInTheDocument();

    // Ghost Agent: плавающий призрак в углу вместо нижней плашки
    expect(screen.getByRole("button", { name: "Открыть чат с Ghost" })).toBeInTheDocument();
    expect(screen.queryByTestId("ghost-action-bar")).not.toBeInTheDocument();
  });

  it("uses the full screen width without max-w-7xl side gutters", () => {
    render(<CatalogPage />);

    const serp = screen.getByTestId("classic-serp-container");
    expect(serp).toHaveClass("w-full");
    // Развёрнутая карта позиционируется внутри каталога, под шапкой сайта
    expect(serp).toHaveClass("relative");
    expect(serp.querySelector(".max-w-7xl")).toBeNull();
    expect(screen.getByRole("complementary", { name: /Фильтры каталога/i })).toHaveClass(
      "w-[266px]"
    );
  });

  it("quick filter chips and amenity checkboxes control the same filter", () => {
    render(<CatalogPage />);

    const chip = screen.getByRole("button", { name: "Тёплый бассейн" });
    fireEvent.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Тёплый бассейн" })).toBeChecked();
    expect(screen.getByText("Гранд Отель Сочи")).toBeInTheDocument();
    expect(screen.queryByText("Апартаменты Ривьера")).not.toBeInTheDocument();
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

  it("adjusts filters from the Ghost chat", () => {
    render(<CatalogPage />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Сообщение Ghost" }), {
      target: { value: "с теплым бассейном" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    // Hotel with pool should stay, hotel without should be filtered out
    expect(screen.getByText("Гранд Отель Сочи")).toBeInTheDocument();
    expect(screen.queryByText("Апартаменты Ривьера")).not.toBeInTheDocument();
  });
});
