"""Discord and Telegram event handlers — convert platform events to SyncJobs."""
from __future__ import annotations
import logging
import discord
from telegram import Update
from telegram.ext import ContextTypes

from .sync_queue import SyncJob, SyncQueue

log = logging.getLogger(__name__)


def make_discord_message_handler(queue: SyncQueue, telegram_chat_id: str, allowed_channels: set[str]):
    """Mirror Discord messages → Telegram."""

    async def on_message(message: discord.Message) -> None:
        if message.author.bot:
            return
        if str(message.channel.id) not in allowed_channels:
            return
        text = f"[{message.author.display_name}] {message.content}"
        await queue.enqueue(SyncJob(
            kind="post_telegram",
            payload={
                "chat_id": telegram_chat_id,
                "text": text,
                "source_platform": "discord",
                "source_msg_id": str(message.id),
                "discord_msg_id": str(message.id),
                "discord_channel_id": str(message.channel.id),
                "author_display_name": message.author.display_name,
            },
        ))
        log.info("queued discord→telegram msg=%s", message.id)

    return on_message


def make_telegram_handler(queue: SyncQueue, default_discord_channel: str, allowed_chats: set[str]):
    """Mirror Telegram messages → Discord."""

    async def on_update(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        if not msg or not msg.text:
            return
        chat_id = str(update.effective_chat.id) if update.effective_chat else ""
        if allowed_chats and chat_id not in allowed_chats:
            return
        author = (msg.from_user.full_name if msg.from_user else "telegram")
        content = f"[{author}] {msg.text}"
        await queue.enqueue(SyncJob(
            kind="post_discord",
            payload={
                "channel_id": default_discord_channel,
                "content": content,
                "source_platform": "telegram",
                "source_msg_id": str(msg.message_id),
                "telegram_msg_id": str(msg.message_id),
                "telegram_chat_id": chat_id,
                "author_display_name": author,
            },
        ))
        log.info("queued telegram→discord msg=%s", msg.message_id)

    return on_update
