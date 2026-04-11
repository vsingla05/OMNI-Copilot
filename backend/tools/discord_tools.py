"""
tools/discord_tools.py — Discord Bot API integration.
Provides tools for reading and sending messages in Discord channels.
"""
import requests
from core.auth import get_discord_token

DISCORD_API = "https://discord.com/api/v10"


async def read_discord_channel(channel_id: str, limit: int = 5) -> str:
    """Reads the most recent messages from a Discord channel.
    Use this when the user asks to check, read, or show their Discord messages.
    Args: channel_id (the Discord channel ID to fetch messages from), limit (max messages).
    Returns formatted lines like: ID: <id> | Discord: Server | Channel: <ch> | Author: <name> | Msg: <text>"""
    token = get_discord_token()
    if not token:
        return "Discord Bot Token is missing. Please ask the user to connect Discord in the Integrations Hub."
    
    headers = {"Authorization": f"Bot {token}"}
    try:
        res = requests.get(f"{DISCORD_API}/channels/{channel_id}/messages?limit={limit}",
                          headers=headers, timeout=10)
        if res.status_code == 401:
            return "Discord token is invalid or expired. Please reconnect in the Integrations Hub."
        if res.status_code != 200:
            return f"Discord API error (HTTP {res.status_code})."
            
        messages = res.json()
        if not messages:
            return "No messages found in this channel."
            
        lines = []
        for msg in messages:
            author = msg.get("author", {}).get("username", "Unknown")
            content = msg.get("content", "(no text)")[:120]
            lines.append(f"ID: {msg['id']} | Discord: Server | Channel: {channel_id} | Author: {author} | Msg: {content}")
        return "\n".join(lines)
    except requests.exceptions.Timeout:
        return "Discord API request timed out."
    except Exception as e:
        return f"Discord read failed: {str(e)}"


async def send_discord_message(channel_id: str, message: str) -> str:
    """Sends a message to a specific Discord channel.
    Use this when the user asks to send, post, or write a message in Discord.
    Args: channel_id (the Discord channel ID), message (the text to send)."""
    token = get_discord_token()
    if not token:
        return "Discord Bot Token is missing. Please ask the user to connect Discord in the Integrations Hub."
    
    headers = {
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
    }
    try:
        res = requests.post(f"{DISCORD_API}/channels/{channel_id}/messages",
                           headers=headers, json={"content": message}, timeout=10)
        if res.status_code in (200, 201):
            return f"Message sent to Discord channel {channel_id} successfully!"
        return f"Discord send failed (HTTP {res.status_code})."
    except Exception as e:
        return f"Discord send failed: {str(e)}"
