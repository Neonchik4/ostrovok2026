import asyncio

from app.middleware.body_limit import RequestBodyLimitMiddleware


def run_request(chunks, headers=(), max_bytes=4):
    sent = []
    received_by_app = []
    events = list(chunks)

    async def receive():
        assert events, "Unexpected extra read from client"
        return events.pop(0)

    async def send(message):
        sent.append(message)

    async def app(scope, receive, send):
        while True:
            message = await receive()
            received_by_app.append(message)
            if not message.get("more_body", False):
                break
        await send({"type": "http.response.start", "status": 200, "headers": []})
        # The response may be much larger than the request limit and must stream.
        await send({"type": "http.response.body", "body": b"data: first\n\n", "more_body": True})
        await send({"type": "http.response.body", "body": b"data: last\n\n", "more_body": False})

    middleware = RequestBodyLimitMiddleware(app, max_bytes=max_bytes)
    asyncio.run(middleware({"type": "http", "headers": list(headers)}, receive, send))
    return sent, received_by_app, events


def chunk(body, more=False):
    return {"type": "http.request", "body": body, "more_body": more}


def test_accepts_exact_limit_and_does_not_buffer_sse_response():
    sent, received, _ = run_request([chunk(b"1234")])
    assert sent[0]["status"] == 200
    assert [message["body"] for message in received] == [b"1234"]
    assert len(sent) == 3
    assert sent[1]["more_body"] is True
    assert sent[2]["body"] == b"data: last\n\n"


def test_rejects_large_content_length_without_reading_body():
    sent, received, unread = run_request([chunk(b"12345")], [(b"content-length", b"5")])
    assert sent[0]["status"] == 413
    assert received == []
    assert len(unread) == 1


def test_rejects_chunked_body_over_limit_without_calling_app():
    sent, received, _ = run_request([chunk(b"12", True), chunk(b"345")])
    assert sent[0]["status"] == 413
    assert received == []


def test_does_not_trust_a_small_content_length():
    sent, received, _ = run_request([chunk(b"12345")], [(b"content-length", b"1")])
    assert sent[0]["status"] == 413
    assert received == []


def test_replays_request_body_without_changing_its_bytes():
    chunks = [chunk(b"12", True), chunk(b"34")]
    sent, received, _ = run_request(chunks)
    assert sent[0]["status"] == 200
    assert b"".join(message["body"] for message in received) == b"1234"
    assert received[-1]["more_body"] is False


def test_disconnected_upload_does_not_call_app():
    sent, received, _ = run_request([chunk(b"1", True), {"type": "http.disconnect"}])
    assert sent == []
    assert received == []


def test_invalid_content_length_returns_400():
    for value in (b"abc", b"-1"):
        sent, received, _ = run_request([], [(b"content-length", value)])
        assert sent[0]["status"] == 400
        assert received == []


def test_passes_non_http_scopes_through():
    scopes = []

    async def app(scope, receive, send):
        scopes.append(scope["type"])

    async def unused():
        raise AssertionError("Must not be called")

    middleware = RequestBodyLimitMiddleware(app)
    for kind in ("lifespan", "websocket"):
        asyncio.run(middleware({"type": kind}, unused, unused))
    assert scopes == ["lifespan", "websocket"]
