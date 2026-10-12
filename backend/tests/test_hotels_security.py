import pytest
from fastapi import HTTPException
from app.api.hotels import get_hotel_details

@pytest.mark.asyncio
async def test_get_hotel_details_path_traversal_blocked():
    malicious_ids = [
        "../etc/passwd",
        r"..\windows\system32",
        "hotel/../../secret",
        "/etc/passwd",
        "hotel" + chr(0) + ".json",
        "..",
        "....//....//etc/passwd"
    ]
    for hotel_id in malicious_ids:
        with pytest.raises(HTTPException) as exc_info:
            await get_hotel_details(hotel_id)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Invalid hotel ID format"

@pytest.mark.asyncio
async def test_get_hotel_details_not_found():
    with pytest.raises(HTTPException) as exc_info:
        await get_hotel_details("non_existent_hotel_12345")
    assert exc_info.value.status_code == 404
