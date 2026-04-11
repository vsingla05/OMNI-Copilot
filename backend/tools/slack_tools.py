"""
tools/slack_tools.py — Slack Bot integration.
Provides tools for reading and sending Slack messages via the Slack Web API.
"""
import requests
from core.auth import get_slack_token

SLACK_API = "https://slack.com/api"


def _resolve_slack_target(token: str, target: str) -> str:
    """Attempts to resolve a channel name or username to a Slack ID."""
    cn = target.strip()
    if not cn:
        return cn
        
    # If it looks like a Slack ID (C/U/D/G/W followed by uppercase/numbers), assume it's an ID
    import re
    if re.match(r'^[CUDGW][A-Z0-9]+$', cn.upper()):
        return cn.upper()

    # Hardcoded overrides for common channels
    cn_lower = cn.lower().lstrip('#@')
    if cn_lower == "general":
        return "C0ASDNTD5D2"

    headers = {"Authorization": f"Bearer {token}"}
    
    resolution_errors = []

    # 1. Search Channels
    try:
        params = {
            "exclude_archived": "true",
            "types": "public_channel,private_channel",
            "limit": 1000
        }
        res = requests.get(f"{SLACK_API}/conversations.list", headers=headers, params=params, timeout=5)
        data = res.json()
        if data.get("ok"):
            for channel in data.get("channels", []):
                if channel.get("name", "").lower() == cn_lower:
                    return channel["id"]
        else:
            resolution_errors.append(f"channels: {data.get('error')}")
    except Exception as e:
        resolution_errors.append(f"channels_req: {str(e)}")

    # 2. Search Users for DM
    try:
        res = requests.get(f"{SLACK_API}/users.list", headers=headers, timeout=5)
        data = res.json()
        if data.get("ok"):
            for user in data.get("members", []):
                names = [
                    user.get("name", "").lower(),
                    user.get("profile", {}).get("real_name", "").lower(),
                    user.get("profile", {}).get("display_name", "").lower()
                ]
                # Exact match
                if cn_lower in names:
                    return user["id"]
            # Fallback to partial match
            for user in data.get("members", []):
                real_name = user.get("profile", {}).get("real_name", "").lower()
                if cn_lower in real_name:
                    return user["id"]
        else:
            resolution_errors.append(f"users: {data.get('error')}")
    except Exception as e:
        resolution_errors.append(f"users_req: {str(e)}")

    if resolution_errors:
        print(f"[DEBUG] Slack target resolution failed: {', '.join(resolution_errors)}")

    return cn


async def read_slack_channel(channel_id: str, limit: int = 5) -> str:
    """Reads the most recent messages from a Slack channel.
    Use this when the user asks to check, read, or show their Slack messages or conversations.
    Args: channel_id (Slack channel ID or channel/user name), limit (max messages to fetch).
    Returns formatted lines with author and message content."""
    token = get_slack_token()
    if not token:
        return "Slack Bot Token is missing. Please ask the user to connect Slack in the Integrations Hub."
    
    resolved_id = _resolve_slack_target(token, channel_id)
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(f"{SLACK_API}/conversations.history",
                          headers=headers,
                          params={"channel": resolved_id, "limit": limit},
                          timeout=10)
        data = res.json()
        
        if not data.get("ok"):
            error = data.get("error", "unknown")
            return f"Slack API error: {error}. Could not resolve target '{channel_id}'."
            
        messages = data.get("messages", [])
        if not messages:
            return "No messages found in this Slack conversation."
            
        lines = []
        for msg in messages:
            user = msg.get("user", "bot")
            text = msg.get("text", "(empty)")[:120]
            lines.append(f"Slack | User: {user} | Msg: {text}")
        return "\n".join(lines)
    except requests.exceptions.Timeout:
        return "Slack API request timed out."
    except Exception as e:
        return f"Slack read failed: {str(e)}"


async def send_slack_message(channel_id: str, message: str) -> str:
    """Sends a message to a specific Slack channel or user.
    Use this when the user asks to send, post, or write a message in Slack.
    Args: channel_id (Slack channel ID or channel/user name), message (the text to send)."""
    token = get_slack_token()
    if not token:
        return "Slack Bot Token is missing. Please ask the user to connect Slack in the Integrations Hub."
    
    resolved_id = _resolve_slack_target(token, channel_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        res = requests.post(f"{SLACK_API}/chat.postMessage",
                           headers=headers,
                           json={"channel": resolved_id, "text": message},
                           timeout=10)
        data = res.json()
        if data.get("ok"):
            return f"Message sent to Slack successfully!"
        return f"Slack send failed: {data.get('error', 'unknown error')}. Target was '{channel_id}'."
    except Exception as e:
        return f"Slack send failed: {str(e)}"
