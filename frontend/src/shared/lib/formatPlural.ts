/**
 * Вспомогательные функции грамматического склонения для интерфейса бронирования.
 */

/**
 * Склонение слова "гость" в зависимости от количества.
 */
export function pluralizeGuests(count: number): string {
  const abs = Math.abs(Math.round(count));
  if (abs % 10 === 1 && abs % 100 !== 11) {
    return `${abs} гость`;
  }
  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) {
    return `${abs} гостя`;
  }
  return `${abs} гостей`;
}

/**
 * Склонение слова "ночь" в зависимости от количества.
 */
export function pluralizeNights(count: number): string {
  const abs = Math.abs(Math.round(count));
  if (abs % 10 === 1 && abs % 100 !== 11) {
    return `${abs} ночь`;
  }
  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) {
    return `${abs} ночи`;
  }
  return `${abs} ночей`;
}
