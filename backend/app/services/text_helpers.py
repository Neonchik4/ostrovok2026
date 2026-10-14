
def sanitize_user_input(text: str, max_length: int = 1000) -> str:
    """
    Secure by Design:
    - Ограничение максимальной длины входящей строки (защита от context exhaustion и ReDoS).
    - Удаление нулевых байтов и опасных управляющих символов.
    - Нормализация пробельных символов.
    """
    if not text:
        return ""
    cleaned = text.replace("\x00", "").strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned

def pluralize_guests(n: int) -> str:
    """Склонение слова 'гость' в зависимости от числа."""
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return "гость"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return "гостя"
    return "гостей"

def pluralize_nights(n: int) -> str:
    """Склонение слова 'ночь' в зависимости от числа."""
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return "ночь"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return "ночи"
    return "ночей"

def pluralize_hotels(n: int) -> str:
    """Склонение слова 'отель' в зависимости от числа."""
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return "отель"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return "отеля"
    return "отелей"
