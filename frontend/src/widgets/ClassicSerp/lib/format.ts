/** Склонение по числу: pluralizeRu(2, ["отель", "отеля", "отелей"]) → "2 отеля". */
export function pluralizeRu(count: number, [one, few, many]: [string, string, string]): string {
  const abs = Math.abs(Math.round(count));
  if (abs % 10 === 1 && abs % 100 !== 11) return `${abs} ${one}`;
  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) return `${abs} ${few}`;
  return `${abs} ${many}`;
}

/** Рейтинг с десятичной запятой: 9.2 → «9,2». */
export function formatRating(rating: number): string {
  return rating.toFixed(1).replace(".", ",");
}

/** «1,2 км до моря» / «350 м до подъёмника». */
export function formatDistance(meters: number, target: string): string {
  if (meters < 1000) return `${Math.round(meters)} м ${target}`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} км ${target}`;
}
