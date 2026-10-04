from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class RequestBodyLimitMiddleware:
    """Bound request memory before parsing JSON; never buffer response bodies."""

    def __init__(self, app: ASGIApp, max_bytes: int = 2 * 1024 * 1024):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        for name, value in scope.get("headers", []):
            if name.lower() == b"content-length":
                try:
                    size = int(value)
                    if size < 0:
                        raise ValueError("Negative content length")
                except ValueError:
                    await JSONResponse({"detail": "Invalid Content-Length"}, status_code=400)(scope, receive, send)
                    return
                if size > self.max_bytes:
                    await self._reject(scope, receive, send)
                    return

        # A bytearray bounds memory even for many tiny chunks; no disk spooling.
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_bytes:
                await self._reject(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        replayed = False

        async def replay_receive() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            # StreamingResponse may listen for a subsequent client disconnect.
            return await receive()

        await self.app(scope, replay_receive, send)

    async def _reject(self, scope: Scope, receive: Receive, send: Send) -> None:
        await JSONResponse({"detail": "Request body too large"}, status_code=413)(scope, receive, send)
