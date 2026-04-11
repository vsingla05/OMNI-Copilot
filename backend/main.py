"""
main.py — Omni Copilot Backend Entry Point.
Wires up FastAPI, FastMCP tool registry, Gemini LLM brain,
context-aware routing, and multimodal chat endpoint.
"""
import os
import base64
import traceback
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from mcp.server.fastmcp import FastMCP

# ── Load environment before anything else ──
from core.auth import load_dotenv, update_env_key, get_gemini_key
load_dotenv()

# ── Import all tool modules ──
from tools import email_tools, drive_tools, calendar_tools
from tools import notion_tools, discord_tools, slack_tools
from tools import local_fs_tools, forms_tools

# ── Import old routers for backward-compatible REST endpoints ──
from routers import email, drive, calendar

# ══════════════════════════════════════════════════
#  FastAPI + FastMCP Setup
# ══════════════════════════════════════════════════
app = FastAPI(title="Omni Copilot Backend", version="2.0")
mcp_server = FastMCP("omni-copilot-server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════════════
#  MCP Tool Registration — 14 tools across 8 platforms
# ══════════════════════════════════════════════════

# 📧 Email (Gmail)
@mcp_server.tool()
async def check_latest_emails(max_results: int = 5) -> str:
    """Reads the subjects and senders of the most recent emails from the user's Gmail inbox."""
    return await email_tools.check_latest_emails(max_results)

@mcp_server.tool()
async def send_email(to: str, subject: str, body: str) -> str:
    """Sends an email via Gmail on behalf of the user."""
    return await email_tools.send_email(to, subject, body)

@mcp_server.tool()
async def trash_email(message_id: str) -> str:
    """Moves an email to the trash by its Gmail message ID."""
    return await email_tools.trash_email(message_id)

# 📁 Drive
@mcp_server.tool()
async def search_drive_files(query: str = "", limit: int = 5) -> str:
    """Lists or searches files in the user's Google Drive."""
    return await drive_tools.search_drive_files(query, limit)

@mcp_server.tool()
async def upload_text_to_drive(filename: str, content: str) -> str:
    """Creates a new text file in Google Drive."""
    return await drive_tools.upload_text_to_drive(filename, content)

@mcp_server.tool()
async def delete_drive_file(file_id: str) -> str:
    """Deletes a file from Google Drive by its file ID."""
    return await drive_tools.delete_drive_file(file_id)

# 📅 Calendar
@mcp_server.tool()
async def get_upcoming_events(max_results: int = 5) -> str:
    """Gets the next upcoming events from the user's Google Calendar."""
    return await calendar_tools.get_upcoming_events(max_results)

@mcp_server.tool()
async def create_calendar_event(title: str, date: str, time: str, duration: str = "1 hour") -> str:
    """Creates a new event on the user's Google Calendar."""
    return await calendar_tools.create_calendar_event(title, date, time, duration)

@mcp_server.tool()
async def delete_calendar_event(event_id: str) -> str:
    """Deletes a calendar event by its event ID."""
    return await calendar_tools.delete_calendar_event(event_id)

# 📝 Notion
@mcp_server.tool()
async def search_notion_pages(query: str = "") -> str:
    """Searches the user's Notion workspace for pages matching a query."""
    return await notion_tools.search_notion_pages(query)

@mcp_server.tool()
async def create_notion_page(title: str, content: str) -> str:
    """Creates a new page in the user's Notion workspace."""
    return await notion_tools.create_notion_page(title, content)

# 👾 Discord
@mcp_server.tool()
async def read_discord_channel(channel_id: str, limit: int = 5) -> str:
    """Reads the most recent messages from a Discord channel."""
    return await discord_tools.read_discord_channel(channel_id, limit)

@mcp_server.tool()
async def send_discord_message(channel_id: str, message: str) -> str:
    """Sends a message to a specific Discord channel."""
    return await discord_tools.send_discord_message(channel_id, message)

# 💬 Slack
@mcp_server.tool()
async def read_slack_channel(channel_id: str, limit: int = 5) -> str:
    """Reads the most recent messages from a Slack channel."""
    return await slack_tools.read_slack_channel(channel_id, limit)

@mcp_server.tool()
async def send_slack_message(channel_id: str, message: str) -> str:
    """Sends a message to a specific Slack channel."""
    return await slack_tools.send_slack_message(channel_id, message)

# 💻 Local Code / Files
@mcp_server.tool()
async def read_local_file(filepath: str) -> str:
    """Reads a local file on the user's machine (sandboxed to ~/Documents)."""
    return await local_fs_tools.read_local_file(filepath)

@mcp_server.tool()
async def list_local_directory(dirpath: str = ".") -> str:
    """Lists files and subdirectories in a local directory."""
    return await local_fs_tools.list_local_directory(dirpath)

# 📋 Google Forms
@mcp_server.tool()
async def create_google_form(title: str, questions: str) -> str:
    """Creates a new Google Form with a title and questions."""
    return await forms_tools.create_google_form(title, questions)

@mcp_server.tool()
async def read_google_form_responses(form_id: str) -> str:
    """Reads responses submitted to a Google Form."""
    return await forms_tools.read_google_form_responses(form_id)

# ══════════════════════════════════════════════════
#  Mount MCP + Legacy REST Routers
# ══════════════════════════════════════════════════
app.mount("/mcp", mcp_server.streamable_http_app())
app.include_router(email.router)
app.include_router(drive.router)
app.include_router(calendar.router)

# ══════════════════════════════════════════════════
#  Gemini LLM Brain — Autonomous Function Calling
# ══════════════════════════════════════════════════

# Build Gemini tools list from functions (for the genai SDK)
TOOL_FUNCTIONS = {
    "check_latest_emails": check_latest_emails,
    "send_email": send_email,
    "trash_email": trash_email,
    "search_drive_files": search_drive_files,
    "upload_text_to_drive": upload_text_to_drive,
    "delete_drive_file": delete_drive_file,
    "get_upcoming_events": get_upcoming_events,
    "create_calendar_event": create_calendar_event,
    "delete_calendar_event": delete_calendar_event,
    "search_notion_pages": search_notion_pages,
    "create_notion_page": create_notion_page,
    "read_discord_channel": read_discord_channel,
    "send_discord_message": send_discord_message,
    "read_slack_channel": read_slack_channel,
    "send_slack_message": send_slack_message,
    "read_local_file": read_local_file,
    "list_local_directory": list_local_directory,
    "create_google_form": create_google_form,
    "read_google_form_responses": read_google_form_responses,
}


def build_system_prompt(context: str) -> str:
    """Generates a dynamic system prompt incorporating the user's active tab context."""
    return f"""You are Omni Copilot — an elite AI assistant that seamlessly manages 8 platforms: Gmail, Google Calendar, Google Drive, Notion, Discord, Slack, local code files, and Google Forms.

The user is currently on the **{context}** tab. Prioritize this context when interpreting ambiguous requests, but intelligently use any tool needed to fulfill their request.

RESPONSE FORMAT RULES:
- For email results, format each as: ID: <id> | From: <sender> | Subject: <subject>
- For drive files, format each as: ID: <id> | File: <filename>
- For calendar events, format each as: ID: <id> | Event: <title> | At: <datetime>
- For notion pages, format each as: ID: <id> | Notion: workspace | Title: <title>
- For discord messages, format each as: ID: <id> | Discord: Server | Channel: <ch> | Author: <name> | Msg: <text>
- For success confirmations, include the word "successfully" so the UI can show a toast.
- Be concise, helpful, and don't explain your tools — just use them and report results.
- If a platform's API key is missing, tell the user to connect it in the Integrations Hub (Settings gear in the sidebar)."""


async def call_gemini(message: str, context: str, image_data: str = None) -> str:
    """Calls the Gemini model with function calling enabled."""
    api_key = get_gemini_key()
    if not api_key:
        # Fallback to keyword-based routing if no Gemini key
        return await keyword_router(message, context)
    
    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        # Build tool declarations from our function signatures
        tool_configs = []
        for name, fn in TOOL_FUNCTIONS.items():
            tool_configs.append(fn)
        
        system_prompt = build_system_prompt(context)
        
        # Build content parts
        contents = []
        if image_data:
            try:
                img_bytes = base64.b64decode(image_data)
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type="image/png"))
            except Exception:
                pass
        contents.append(message)
        
        # Use the Gemini API with automatic function calling
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=tool_configs,
        )
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=config,
        )
        
        # Extract text from the response
        if response and response.text:
            return response.text
        
        return "I processed your request but got an empty response. Please try again."
        
    except ImportError:
        return await keyword_router(message, context)
    except Exception as e:
        error_msg = str(e)
        if "quota" in error_msg.lower() or "rate" in error_msg.lower():
            return "⚠️ Gemini rate limit reached. Please wait a moment and try again."
        if "api key" in error_msg.lower() or "invalid" in error_msg.lower():
            return "⚠️ Gemini API key is invalid. Please check your GEMINI_API_KEY in the .env file."
        print(f"[Gemini Error] {traceback.format_exc()}")
        # Fallback to keyword router
        return await keyword_router(message, context)


async def keyword_router(message: str, context: str) -> str:
    """Fallback keyword-based router when Gemini is unavailable."""
    msg = message.lower()
    ctx = context.lower()
    
    # Context-first routing
    if ctx == "email" or "email" in msg:
        if any(w in msg for w in ["send", "compose", "draft", "write"]):
            return "[DRAFT_EMAIL]\nTo: \nSubject: \nBody: " + message
        result = await check_latest_emails(5)
        return f"Here is what I found in your inbox:\n{result}"
    
    elif ctx == "calendar" or "calendar" in msg or "event" in msg or "meeting" in msg:
        if any(w in msg for w in ["create", "schedule", "add", "book"]):
            return "[DRAFT_EVENT]\nTitle: \nDate: \nTime: \nDuration: 1 hour"
        result = await get_upcoming_events(5)
        return f"Here are your upcoming events:\n{result}"
    
    elif ctx == "drive" or "drive" in msg or "file" in msg:
        result = await search_drive_files("", 5)
        return f"Here are your Drive files:\n{result}"
    
    elif ctx == "notion" or "notion" in msg:
        if any(w in msg for w in ["create", "draft", "new", "write"]):
            result = await create_notion_page("New Page", message)
            return result
        result = await search_notion_pages(message[:50])
        return f"Here is what I found in Notion:\n{result}"
    
    elif ctx == "discord" or "discord" in msg:
        if any(w in msg for w in ["send", "post", "write"]):
            channel = "general"
            import re
            m = re.search(r'to the "([^"]+)" channel', message)
            if m: channel = m.group(1)
            result = await send_discord_message(channel, message)
            return result
        result = await read_discord_channel("general", 5)
        return f"Here are the latest Discord messages:\n{result}"
    
    elif ctx == "slack" or "slack" in msg:
        if any(w in msg for w in ["send", "post", "write"]):
            channel = "general"
            import re
            m = re.search(r'to the "([^"]+)" channel', message)
            if m: channel = m.group(1)
            result = await send_slack_message(channel, message)
            return result
        result = await read_slack_channel("general", 5)
        return f"Here are your Slack messages:\n{result}"
    
    elif ctx == "code" or "code" in msg or "local" in msg:
        result = await list_local_directory(".")
        return f"Here are your local files:\n{result}"
    
    elif ctx == "forms" or "form" in msg or "survey" in msg:
        if any(w in msg for w in ["create", "build", "make"]):
            return "To create a form, please specify a title and questions."
        return "Google Forms agent ready. Ask me to create forms or read responses."
    
    return f"I'm ready to help with your {context} workspace! Try asking me to read, create, or search."


# ══════════════════════════════════════════════════
#  API Endpoints
# ══════════════════════════════════════════════════

class KeysUpdateRequest(BaseModel):
    notion: str = ""
    discord: str = ""
    slack: str = ""
    gemini: str = ""

@app.post("/update-keys")
async def update_keys(req: KeysUpdateRequest):
    """Save API keys to .env and update os.environ live."""
    if req.notion:  update_env_key("NOTION_API_KEY", req.notion)
    if req.discord: update_env_key("DISCORD_BOT_TOKEN", req.discord)
    if req.slack:   update_env_key("SLACK_BOT_TOKEN", req.slack)
    if req.gemini:  update_env_key("GEMINI_API_KEY", req.gemini)
    return {"response": "Keys updated successfully!"}


class ChatRequest(BaseModel):
    message: str
    context: str = "Email"
    image_data: Optional[str] = None

@app.post("/chat")
async def chat_with_copilot(request: ChatRequest):
    """
    Context-aware chat endpoint.
    Receives { message, context, image_data } and routes to Gemini LLM
    (with fallback to keyword router if Gemini key is absent).
    """
    try:
        response = await call_gemini(
            message=request.message,
            context=request.context,
            image_data=request.image_data
        )
        return {"response": response}
    except Exception as e:
        print(f"[Chat Error] {traceback.format_exc()}")
        return {"response": f"⚠️ Something went wrong: {str(e)}. Please try again."}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    has_gemini = bool(get_gemini_key())
    return {
        "status": "ok",
        "llm": "gemini" if has_gemini else "keyword-fallback",
        "tools_registered": len(TOOL_FUNCTIONS),
    }