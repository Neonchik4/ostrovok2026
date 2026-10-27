import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HotelReviewsList } from "@/features/hotel-details";
import { ReviewItem } from "@/entities/hotel";

describe("HotelReviewsList", () => {
  const sampleReviews: ReviewItem[] = [
    {
      id: "rev_1",
      author: "Алексей",
      date: "2026-07-15",
      rating: 9.5,
      plus: "Прекрасный вид на горы и чистый номер",
      minus: "Немного шумно с улицы",
      room: "Люкс с балконом",
      traveller_type: "couple",
    },
    {
      id: "rev_2",
      author: "Мария",
      date: "2026-06-20",
      rating: 8.8,
      plus: "Вкусный сытный завтрак и отзывчивый персонал",
      minus: "-",
      room: "Стандартный двухместный",
      traveller_type: "family",
    },
    {
      id: "rev_3",
      author: "Дмитрий",
      date: "2026-05-10",
      rating: 9.0,
      plus: "Отличный бассейн и сауна",
      minus: "Долгое заселение",
    },
    {
      id: "rev_4",
      author: "Ольга",
      date: "2026-04-05",
      rating: 10.0,
      plus: "Все идеально, вернемся снова!",
      minus: "-",
    },
    {
      id: "rev_5",
      author: "Иван",
      date: "2026-03-01",
      rating: 8.5,
      plus: "Удобное расположение",
      minus: "Маленькая парковка",
    },
  ];

  it("renders loading indicator when isLoading is true", () => {
    render(<HotelReviewsList isLoading={true} />);
    expect(screen.getByText("Загрузка проверенных отзывов...")).toBeInTheDocument();
  });

  it("renders empty state message when reviews array is empty", () => {
    render(<HotelReviewsList reviews={[]} isLoading={false} />);
    expect(
      screen.getByText("Пока нет проверенных текстовых отзывов для этого объекта")
    ).toBeInTheDocument();
  });

  it("renders verified reviews list correctly", () => {
    render(<HotelReviewsList reviews={sampleReviews} />);

    expect(screen.getByText("Проверенные отзывы гостей (5)")).toBeInTheDocument();
    expect(screen.getByText("Алексей")).toBeInTheDocument();
    expect(screen.getByText("Прекрасный вид на горы и чистый номер")).toBeInTheDocument();
    expect(screen.getByText("Немного шумно с улицы")).toBeInTheDocument();
    expect(screen.getByText(/Люкс с балконом/)).toBeInTheDocument();
    expect(screen.getByText("9.5")).toBeInTheDocument();
  });

  it("shows more reviews upon clicking the expand button", () => {
    render(<HotelReviewsList reviews={sampleReviews} />);

    // Initially displays 4 reviews
    expect(screen.getByText("Показать еще отзывы (1)")).toBeInTheDocument();
    expect(screen.queryByText("Иван")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Показать еще отзывы (1)"));

    expect(screen.getByText("Иван")).toBeInTheDocument();
    expect(screen.queryByText(/Показать еще отзывы/)).not.toBeInTheDocument();
  });
});
