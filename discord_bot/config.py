"""환경변수 로딩 및 설정 검증."""
from __future__ import annotations
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    discord_bot_token: str
    telegram_bot_token: str
    portal_api_base: str
    portal_service_jwt: str
    owner_id: str
    guild_id: str
    log_level: str = "INFO"

    @staticmethod
    def from_env() -> "Settings":
        def req(name: str) -> str:
            v = os.environ.get(name, "").strip()
            if not v:
                raise RuntimeError(f"missing env: {name}")
            return v

        return Settings(
            discord_bot_token=req("DISCORD_BOT_TOKEN"),
            telegram_bot_token=req("TELEGRAM_BOT_TOKEN"),
            portal_api_base=req("PORTAL_API_BASE").rstrip("/"),
            portal_service_jwt=req("PORTAL_SERVICE_JWT"),
            owner_id=req("BOT_OWNER_ID"),
            guild_id=req("BOT_GUILD_ID"),
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )
