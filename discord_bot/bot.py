"""Discord ↔ Telegram bridge bot.

Runs two clients side-by-side and forwards messages through the portal API:
    Discord message  → POST /api/discord/messages/post-telegram
    Telegram update  → POST /api/discord/messages/post-discord

Both calls write a discord_message_maps row + a discord_sync_logs row so the
monitoring dashboard reflects activity in real time.
"""
from __future__ import annotations
import asyncio
import logging
import discord
from telegram.ext import Application, MessageHandler, filters

from .config import Settings
from .handlers import make_discord_message_handler, make_telegram_handler
from .portal_client import PortalClient
from .sync_queue import SyncJob, SyncQueue


async def job_handler(client: PortalClient, job: SyncJob):
    if job.kind == "post_discord":
        return await client.post_discord(**job.payload)
    if job.kind == "post_telegram":
        return await client.post_telegram(**job.payload)
    if job.kind == "edit":
        return await client.edit_message(**job.payload)
    if job.kind == "delete":
        return await client.delete_message(**job.payload)
    raise ValueError(f"unknown job kind: {job.kind}")


async def main() -> None:
    settings = Settings.from_env()
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    log = logging.getLogger("bot")

    portal = PortalClient(settings.portal_api_base, settings.portal_service_jwt)

    # Load channel routing from the portal so we don't hardcode IDs.
    channels_resp = await portal.channels(settings.guild_id)
    rows = channels_resp.get("data", []) if isinstance(channels_resp, dict) else []
    enabled_channel_ids = {str(r["channel_id"]) for r in rows if r.get("enabled", True)}
    default_discord_channel = next(
        (str(r["channel_id"]) for r in rows if r.get("channel_role") == "general"),
        next(iter(enabled_channel_ids), ""),
    )
    if not default_discord_channel:
        raise RuntimeError("no Discord channels configured for guild")

    telegram_chat_id = ""
    for r in rows:
        if r.get("telegram_chat_id"):
            telegram_chat_id = str(r["telegram_chat_id"])
            break

    queue = SyncQueue(workers=3)
    queue.start(lambda job: job_handler(portal, job))

    # Discord client
    intents = discord.Intents.default()
    intents.message_content = True
    intents.guilds = True
    intents.messages = True
    dclient = discord.Client(intents=intents)
    on_discord_message = make_discord_message_handler(queue, telegram_chat_id, enabled_channel_ids)

    @dclient.event
    async def on_ready():
        log.info("Discord connected as %s", dclient.user)

    @dclient.event
    async def on_message(message: discord.Message):
        await on_discord_message(message)

    # Telegram app
    tapp = Application.builder().token(settings.telegram_bot_token).build()
    allowed_chats = {telegram_chat_id} if telegram_chat_id else set()
    on_telegram = make_telegram_handler(queue, default_discord_channel, allowed_chats)
    tapp.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_telegram))

    log.info("starting Discord + Telegram clients")
    discord_task = asyncio.create_task(dclient.start(settings.discord_bot_token))
    await tapp.initialize()
    await tapp.start()
    await tapp.updater.start_polling()

    try:
        await discord_task
    finally:
        log.info("shutting down")
        await tapp.updater.stop()
        await tapp.stop()
        await tapp.shutdown()
        await queue.stop()
        await portal.aclose()
        await dclient.close()


if __name__ == "__main__":
    asyncio.run(main())
