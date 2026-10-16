import re
from typing import Any

import httpx

OSTROVOK_ORIGIN = "https://ostrovok.ru"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

BLOCKED_RESPONSE_HEADERS = {
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "strict-transport-security",
}


class LiveProxyService:
    """
    Сервис потокового проксирования страниц боевого сайта ostrovok.ru
    с нейтрализацией заголовков CSP/Frame-Ancestors и инъекцией агента Muse.
    """

    def __init__(self, timeout_sec: float = 15.0) -> None:
        self.timeout = timeout_sec

    def sanitize_headers(self, headers: httpx.Headers) -> dict[str, str]:
        """Удаляет заголовки, блокирующие рендеринг во фрейме/оверлее."""
        cleaned: dict[str, str] = {}
        for key, val in headers.items():
            k_lower = key.lower()
            if k_lower not in BLOCKED_RESPONSE_HEADERS and not k_lower.startswith("content-encoding"):
                cleaned[key] = val
        cleaned["access-control-allow-origin"] = "*"
        cleaned["access-control-allow-methods"] = "GET, POST, OPTIONS"
        cleaned["access-control-allow-headers"] = "*"
        return cleaned

    def inject_copilot_runtime(self, html: str) -> str:
        """
        Встраивает тег <base>, скрипт агента и оверлей-контейнер
        в HTML реального сайта Островка.
        """
        # 1. Устраняем мета-теги CSP, если они есть в DOM
        html = re.sub(
            r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>',
            "",
            html,
            flags=re.IGNORECASE,
        )

        # 2. Добавляем <base> в <head>, чтобы все ссылки, шрифты и ассеты подтягивались с ostrovok.ru
        base_tag = f'\n  <base href="{OSTROVOK_ORIGIN}/">\n'
        if "<head>" in html:
            html = html.replace("<head>", f"<head>{base_tag}", 1)
        elif "<head " in html:
            html = re.sub(r'(<head[^>]*>)', r'\1' + base_tag, html, count=1)

        # 3. Инжектируем клиентский рантайм Muse-агента перед </body>
        injection_code = (
            "\n<!-- OSTROVOK LIVE COPILOT INJECTION -->\n"
            '<div id="ostrovok-copilot-container"></div>\n'
            '<script src="/live-agent/muse-runtime.js" defer></script>\n'
            "<!-- /OSTROVOK LIVE COPILOT INJECTION -->\n"
        )

        if "</body>" in html:
            html = html.replace("</body>", f"{injection_code}</body>", 1)
        else:
            html += injection_code

        return html

    async def fetch_page(self, path: str, query_params: dict[str, Any] | None = None) -> tuple[int, dict[str, str], str]:
        """
        Запрашивает реальную страницу с ostrovok.ru, вырезает CSP и инжектирует скрипты.
        """
        clean_path = path.lstrip("/")
        target_url = f"{OSTROVOK_ORIGIN}/{clean_path}" if clean_path else OSTROVOK_ORIGIN

        req_headers = {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        }

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            resp = await client.get(target_url, params=query_params, headers=req_headers)
            sanitized_headers = self.sanitize_headers(resp.headers)
            sanitized_headers["content-type"] = "text/html; charset=utf-8"

            modified_html = self.inject_copilot_runtime(resp.text)
            return resp.status_code, sanitized_headers, modified_html

    async def proxy_api(
        self,
        method: str,
        path: str,
        headers: dict[str, str] | None = None,
        content: bytes | None = None,
        query_params: dict[str, Any] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        """
        Проксирует внутренние API-вызовы (например, /hotel/search/v2/site/serp).
        """
        clean_path = path.lstrip("/")
        target_url = f"{OSTROVOK_ORIGIN}/{clean_path}"

        fwd_headers = {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9",
        }
        if headers:
            for k in ["content-type", "cookie", "x-csrftoken"]:
                if k in headers:
                    fwd_headers[k] = headers[k]

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.request(
                method=method,
                url=target_url,
                params=query_params,
                headers=fwd_headers,
                content=content,
            )
            out_headers = self.sanitize_headers(resp.headers)
            return resp.status_code, out_headers, resp.content
