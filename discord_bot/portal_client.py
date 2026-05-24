"""DSC FMS Portal API client used by the bot to write maps + sync_logs."""
from __future__ import annotations
import logging
from typing import Any, Optional
import httpx

log = logging.getLogger(__name__)


class PortalClient:
    def __init__(self, base_url: str, token: str, timeout: float = 15.0):
        self._base = base_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=timeout, headers=self._headers)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _post(self, path: str, payload: dict) -> dict:
        r = await self._client.post(f"{self._base}{path}", json=payload)
        r.raise_for_status()
        return r.json()

    async def _patch(self, path: str, payload: dict) -> dict:
        r = await self._client.patch(f"{self._base}{path}", json=payload)
        r.raise_for_status()
        return r.json()

    async def _delete(self, path: str, payload: dict) -> dict:
        r = await self._client.request("DELETE", f"{self._base}{path}", json=payload)
        r.raise_for_status()
        return r.json()

    async def _get(self, path: str, params: Optional[dict] = None) -> dict:
        r = await self._client.get(f"{self._base}{path}", params=params)
        r.raise_for_status()
        return r.json()

    async def post_discord(self, *, channel_id: str, content: str, **extra: Any) -> dict:
        return await self._post(
            "/api/discord/messages/post-discord",
            {"channel_id": channel_id, "content": content, **extra},
        )

    async def post_telegram(self, *, chat_id: str | int, text: str, **extra: Any) -> dict:
        return await self._post(
            "/api/discord/messages/post-telegram",
            {"chat_id": chat_id, "text": text, **extra},
        )

    async def edit_message(self, *, new_content: str, **extra: Any) -> dict:
        return await self._patch(
            "/api/discord/messages/edit",
            {"new_content": new_content, **extra},
        )

    async def delete_message(self, **extra: Any) -> dict:
        return await self._delete("/api/discord/messages/delete", extra)

    async def sync_status(self) -> dict:
        return await self._get("/api/discord/sync/status")

    async def channels(self, guild_id: str) -> dict:
        return await self._get("/api/discord/channels", {"guild_id": guild_id})
