import { useEffect, useRef } from "react";

/**
 * Хук автоматической прокрутки чата.
 * Разделяет поведение для плавного скролла (idle) и прямого удержания внизу (streaming).
 */
export function useChatAutoScroll(dependencies: unknown[], isStreaming: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (isStreaming) {
      // Во время стриминга токенов с высокой частотой удерживаем скролл строго внизу
      el.scrollTop = el.scrollHeight;
    } else {
      // По окончании ответа или при дискретных обновлениях — плавно докручиваем
      if (typeof el.scrollTo === "function") {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: "smooth",
        });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [dependencies, isStreaming]);

  return { scrollRef, messagesEndRef };
}
