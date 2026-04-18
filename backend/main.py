"""
main.py — Omni Copilot Backend Entry Point.
Wires up FastAPI, FastMCP tool registry, Gemini LLM brain,
context-aware routing, and multimodal chat endpoint.
"""
import os
import base64
import traceback
import inspect
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from mcp.server.fastmcp import FastMCP

# ── Load environment before anything else ──
from core.auth import load_dotenv, update_env_key, get_gemini_key, get_groq_key, get_anthropic_key
load_dotenv()

# ── Import all tool modules ──
from tools import email_tools, drive_tools, calendar_tools
from tools import notion_tools, discord_tools, slack_tools
from tools import local_fs_tools, forms_tools

# ── Import old routers for backward-compatible REST endpoints ──
from routers import email, drive, calendar

# Global state for raw binary file uploads
CURRENT_ATTACHMENT = {}

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

@mcp_server.tool()
async def create_instant_meet() -> str:
    """Generates an instant Google Meet conference link."""
    return await calendar_tools.create_instant_meet()

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

@mcp_server.tool()
async def summarize_file(filepath: str, file_type: str = "auto") -> str:
    """Ingests any file (code, text, JSON, CSV, Markdown) and returns a structured
    summary and content preview for the LLM brain to use as context.
    AUTOMATICALLY route through this tool first when a user uploads or references
    a file and asks about it, before routing to any other tools."""
    return await local_fs_tools.summarize_file(filepath, file_type)

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
    "upload_attached_file_to_drive": drive_tools.upload_attached_file_to_drive,
    "delete_drive_file": delete_drive_file,
    "get_upcoming_events": get_upcoming_events,
    "create_calendar_event": create_calendar_event,
    "delete_calendar_event": delete_calendar_event,
    "create_instant_meet": create_instant_meet,
    "search_notion_pages": search_notion_pages,
    "create_notion_page": create_notion_page,
    "read_discord_channel": read_discord_channel,
    "send_discord_message": send_discord_message,
    "read_slack_channel": read_slack_channel,
    "send_slack_message": send_slack_message,
    "read_local_file": read_local_file,
    "list_local_directory": list_local_directory,
    "summarize_file": summarize_file,
    "create_google_form": create_google_form,
    "read_google_form_responses": read_google_form_responses,
}


def build_system_prompt(context: str) -> str:
    """Generates a dynamic system prompt incorporating the user's active tab context."""
    return f"""You are Omni Copilot — an advanced autonomous integration agent. Your primary
function is to analyse the user's natural language input, determine their core intent, and
map that intent to the exact tool or sequence of tools required to execute the request.

The user is currently on the **{context}** tab. Prioritise this context when interpreting
ambiguous requests, but intelligently invoke any tool needed to fulfil the request.

═══════════════════════════════════
 AVAILABLE TOOL REGISTRY (20 tools)
═══════════════════════════════════
📧 Gmail
  • check_latest_emails(max_results)           – Read recent inbox
  • send_email(to, subject, body)               – Compose & send email
  • trash_email(message_id)                     – Move email to trash

📁 Google Drive
  • search_drive_files(query, limit)            – List / search files
  • upload_text_to_drive(filename, content)     – Create a new Drive file
  • upload_attached_file_to_drive()             – Upload the user's attached binary file
  • delete_drive_file(file_id)                  – Delete a file by ID

📅 Google Calendar
  • get_upcoming_events(max_results)            – Fetch upcoming events
  • create_calendar_event(title,date,time,duration) – Schedule event
  • delete_calendar_event(event_id)             – Cancel event by ID
  • create_instant_meet()                       – Start a live Google Meet now

📝 Notion
  • search_notion_pages(query)                  – Search workspace pages
  • create_notion_page(title, content)          – Create a new page

👾 Discord
  • read_discord_channel(channel_id, limit)     – Read channel messages
  • send_discord_message(channel_id, message)   – Post a message

💬 Slack
  • read_slack_channel(channel_id, limit)       – Fetch channel history
  • send_slack_message(channel_id, message)     – Post a message

💻 Local Files & Code
  • read_local_file(filepath)                   – Read a local file
  • list_local_directory(dirpath)               – Browse local folder
  • summarize_file(filepath, file_type)         – Summarise any file

📋 Google Forms
  • create_google_form(title, questions)        – Build a new form
  • read_google_form_responses(form_id)         – Read form submissions

═══════════════════════════════════
 OPERATIONAL RULES
═══════════════════════════════════
1. INTENT FIRST — Identify the user's explicit intent before calling any tool.

2. CHAIN TOOLS — For multi-step requests execute tools sequentially:
   e.g. "Summarise this file and send it to Slack" → summarize_file → send_slack_message
   e.g. "Read the Notion page about X and email it to the team" →
        search_notion_pages → <read content> → send_email

3. STRICT PARAMETER EXTRACTION — Extract parameters exactly as the user states.
   Never hallucinate email addresses, channel IDs, file paths, or event IDs.

4. CLARIFY WHEN REQUIRED — If a required parameter is missing, do NOT call the tool.
   Instead, ask the user for the specific missing information. Prefix your question with
   [CLARIFICATION_NEEDED] so the UI can render it as a distinct card. Example:
   [CLARIFICATION_NEEDED] What is the recipient's email address for this message?

5. IMPLICIT FILE SUMMARISATION — If the user references or uploads a file and asks a
   question about it, automatically call summarize_file first to gain context before
   answering or routing to other tools.

6. MISSING API KEYS — If a platform token/key is absent, respond:
   "⚠️ <Platform> is not connected. Please add your API key in the Integrations Hub
   (Settings ⚙ in the sidebar)."

═══════════════════════════════════
 RESPONSE FORMAT RULES
═══════════════════════════════════
• Emails     → ID: <id> | From: <sender> | Subject: <subject>
• Drive files → ID: <id> | File: <filename>
• Calendar   → ID: <id> | Event: <title> | At: <datetime>
• Notion     → 📄 <title> | ID: <uuid> | 🔗 <url>
• Discord    → ID: <id> | Discord: Server | Channel: <ch> | Author: <name> | Msg: <text>
• Slack      → Slack | User: <user> | Msg: <text>
• Success    → always include the word "successfully" so the UI can show a toast
• Errors     → prefix with ⚠️
• Be concise. Do not narrate which tool you are calling — just call it and report results."""


def build_groq_tools():
    """Builds OpenAI-compatible tool schemas for Groq API."""
    tools = []
    for name, fn in TOOL_FUNCTIONS.items():
        sig = inspect.signature(fn)
        properties = {}
        required = []
        for param_name, param in sig.parameters.items():
            param_type = "string"
            properties[param_name] = {"type": param_type, "description": f"The {param_name}"}
            if param.default == inspect.Parameter.empty:
                required.append(param_name)
        tools.append({
            "type": "function",
            "function": {
                "name": name,
                "description": fn.__doc__.split('\n')[0] if fn.__doc__ else "A tool function.",
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required
                }
            }
        })
    return tools


async def call_groq(message: str, context: str, image_data: str = None) -> str:
    """Calls the Groq API with function calling enabled."""
    api_key = get_groq_key()
    if not api_key:
        return await keyword_router(message, context)
        
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        sys_prompt_groq = f"""You are Omni Copilot — an integration agent.
You are currently responding in the {context} tab.

Rules for Tools:
1. Auto-format dates/times (e.g. 'April 20, 2026', '3:00 PM') internally before calling tools. Do not ask the user for formatting.
2. Do not invent parameters. If the user asks to upload or create a file but does NOT provide the filename or the text content, you MUST stop and ask them using [CLARIFICATION_NEEDED].
3. CRITICAL: NEVER REFORMAT the literal string lines returned by tools! If a tool outputs "📄 MyPage | ID: 123" or "ID: 999 | Event: Team Sync", you MUST paste that EXACT string unaltered in your final text. DO NOT change the punctuation strings, DO NOT convert them into bullet points, and DO NOT change their prefixes. The system UI relies on the exact syntax to render cards.
4. SEQUENTIAL EXECUTION: If you need to generate a link/ID with one tool and use it in another tool (like emailing a Meet link), DO NOT execute them in parallel. Call the first tool, wait for the link, and then call the second tool!
5. If a file upload, deletion, or creation succeeds, you MUST include the exact phrase "done successfully" anywhere in your text so the UI badge pops up."""
        
        messages = [
            {"role": "system", "content": sys_prompt_groq},
            {"role": "user", "content": message}
        ]
        
        tools = build_groq_tools()
        
        for _ in range(5):
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=tools,
                temperature=0.7,
            )
            
            msg_obj = response.choices[0].message
            if getattr(msg_obj, "tool_calls", None):
                messages.append({
                    "role": "assistant",
                    "content": msg_obj.content,
                    "tool_calls": [
                        {
                            "id": t.id,
                            "type": "function",
                            "function": {"name": t.function.name, "arguments": t.function.arguments}
                        } for t in msg_obj.tool_calls
                    ]
                })
                
                for tool_call in msg_obj.tool_calls:
                    fn_name = tool_call.function.name
                    fn_to_call = TOOL_FUNCTIONS.get(fn_name)
                    if fn_to_call:
                        args_str = tool_call.function.arguments
                        fn_args = json.loads(args_str) if args_str and args_str.strip() not in ("null", "") else {}
                        if not isinstance(fn_args, dict):
                            fn_args = {}
                            
                        # Safely typecast strings back to ints where required
                        sig = inspect.signature(fn_to_call)
                        for k, v in fn_args.items():
                            if k in sig.parameters and sig.parameters[k].annotation == int:
                                try: fn_args[k] = int(v)
                                except: pass
                                
                        fn_res = await fn_to_call(**fn_args)
                        messages.append({
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": fn_name,
                            "content": str(fn_res)
                        })
                continue # Loop back and let LLM see the tool output!
                
            return msg_obj.content if msg_obj.content else "Request completed successfully."
            
        return "Loop execution limit reached."
        
    except Exception as e:
        trace = traceback.format_exc()
        print(f"[Groq Error] {trace}")
        return f"⚠️ Groq Error: {str(e)}"


def build_anthropic_tools():
    """Builds Anthropic-compatible tool schemas."""
    tools = []
    for name, fn in TOOL_FUNCTIONS.items():
        sig = inspect.signature(fn)
        properties = {}
        required = []
        for param_name, param in sig.parameters.items():
            param_type = "string"
            properties[param_name] = {"type": param_type, "description": f"The {param_name}"}
            if param.default == inspect.Parameter.empty:
                required.append(param_name)
        tools.append({
            "name": name,
            "description": fn.__doc__.split('\n')[0] if fn.__doc__ else "A tool function.",
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        })
    return tools


async def call_anthropic(message: str, context: str, image_data: str = None) -> str:
    """Calls the Anthropic API (Claude 3.7 Sonnet) with function calling enabled."""
    api_key = get_anthropic_key()
    if not api_key:
        return await keyword_router(message, context)
        
    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)
        
        sys_prompt_anthropic = f"""You are Omni Copilot — an advanced autonomous integration agent. 
The user is currently on the **{context}** tab.
CRITICAL: You MUST use the provided tools to execute actions. Do NOT output python function signatures as plain text.

OPERATIONAL RULES:
1. Always use tools to fulfil requests.
2. If missing a required parameter defined in the tool schema, DO NOT call the tool. Ask the user with [CLARIFICATION_NEEDED] prefix.
3. NEVER ask for or invent parameters that are not explicitly defined in the provided tool schema.
4. Emails response format: ID: <id> | From: <sender> | Subject: <subject>
5. Calendar response format: ID: <id> | Event: <title> | At: <datetime>
6. Always include "successfully" in your text if a tool succeeds so the UI shows a toast.
"""
        messages = [{"role": "user", "content": message}]
        tools = build_anthropic_tools()
        
        response = client.messages.create(
            model="claude-3-7-sonnet-latest",
            max_tokens=2048,
            system=sys_prompt_anthropic,
            messages=messages,
            tools=tools,
        )
        
        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    fn_name = block.name
                    fn_args = block.input
                    fn_to_call = TOOL_FUNCTIONS.get(fn_name)
                    if fn_to_call:
                        # Safely typecast strings back to ints where required
                        sig = inspect.signature(fn_to_call)
                        for k, v in fn_args.items():
                            if k in sig.parameters and sig.parameters[k].annotation == int:
                                try: fn_args[k] = int(v)
                                except: pass
                                
                        fn_res = await fn_to_call(**fn_args)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(fn_res),
                        })
            
            messages.append({"role": "user", "content": tool_results})
            final_response = client.messages.create(
                model="claude-3-7-sonnet-latest",
                max_tokens=2048,
                system=sys_prompt_anthropic,
                messages=messages,
                tools=tools,
            )
            return "".join([b.text for b in final_response.content if b.type == "text"])
            
        return "".join([b.text for b in response.content if b.type == "text"])
        
    except Exception as e:
        trace = traceback.format_exc()
        print(f"[Anthropic Error] {trace}")
        return f"⚠️ Anthropic Error: {str(e)}"


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
        
        # Use the Gemini Chat API with automatic function calling
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=tool_configs,
            temperature=0.7,
        )
        
        chat = client.chats.create(
            model="gemini-2.0-flash",
            config=config,
        )
        
        # Send message with any embedded media parts; chat automatically handles tool execution
        response = chat.send_message(contents)
        
        # Extract text from the response
        if response and response.text:
            return response.text

        return "I successfully completed your request using my tools! (No explicit text response returned)"
    except Exception as e:
        error_msg = str(e)
        print(f"[Gemini Exception Raw Message]: {error_msg}")
        if "quota" in error_msg.lower() or "rate" in error_msg.lower():
            return "⚠️ Gemini rate limit reached. Please wait a moment and try again."
        if "api key" in error_msg.lower() or "invalid" in error_msg.lower():
            return "⚠️ Gemini API key is invalid. Please check your GEMINI_API_KEY in the .env file."
        
        # We temporarily return the exact traceback so we can see why `client.chats.create` is failing!
        trace = traceback.format_exc()
        print(f"[Gemini Error] {trace}")
        return f"CRITICAL AI CRASH:\n{trace}"


async def keyword_router(message: str, context: str) -> str:
    """Fallback keyword-based router when Gemini is unavailable."""
    msg = message.lower()
    ctx = context.lower()

    # ── Context (active tab) ALWAYS wins over keyword scanning ──
    # Only fall through to keyword matching if the context doesn't match a platform.

    # 📧 Email
    if ctx == "email" or (ctx not in ("notion", "drive", "calendar", "discord", "slack", "code", "forms") and ("email" in msg or "mail" in msg)):
        if any(w in msg for w in ["send", "compose", "draft", "write"]):
            return "[DRAFT_EMAIL]\nTo: \nSubject: \nBody: " + message
        result = await check_latest_emails(5)
        return f"Here is what I found in your inbox:\n{result}"

    # 📅 Calendar
    elif ctx == "calendar" or (ctx not in ("notion", "drive", "email", "discord", "slack", "code", "forms") and ("calendar" in msg or "event" in msg or "meeting" in msg)):
        if any(w in msg for w in ["create", "schedule", "add", "book"]):
            return "[DRAFT_EVENT]\nTitle: \nDate: \nTime: \nDuration: 1 hour"
        result = await get_upcoming_events(5)
        return f"Here are your upcoming events:\n{result}"

    # 📁 Drive
    elif ctx == "drive" or (ctx not in ("notion", "email", "calendar", "discord", "slack", "code", "forms") and ("drive" in msg or "file" in msg)):
        result = await search_drive_files("", 5)
        return f"Here are your Drive files:\n{result}"

    # 📝 Notion — ctx match is checked first so "email" in content doesn't hijack
    elif ctx == "notion" or (ctx not in ("email", "drive", "calendar", "discord", "slack", "code", "forms") and "notion" in msg):
        # CREATE intent
        if any(w in msg for w in ["create", "draft", "new", "write", "add", "titled", "title", "make"]):
            import re
            title_match = re.search(r'titled?\s+["\']?([^"\'\n]+?)["\']?(?:\s+with|\s+containing|$)', message, re.IGNORECASE)
            title = title_match.group(1).strip() if title_match else "New Page"
            result = await create_notion_page(title, message)
            return result
        # LIST ALL intent — pass empty query so Notion returns everything
        if any(w in msg for w in ["list", "fetch", "show", "get", "all", "everything"]):
            result = await search_notion_pages("")
            return f"Here is what I found in Notion:\n{result}"
        # SEARCH intent — strip filler words so we search by real keywords
        import re
        clean_query = re.sub(
            r'\b(search|find|look|up|for|in|notion|my|pages?|docs?|the|a|an)\b',
            '', msg, flags=re.IGNORECASE
        ).strip()
        result = await search_notion_pages(clean_query if len(clean_query) > 2 else "")
        return f"Here is what I found in Notion:\n{result}"

    # 👾 Discord
    elif ctx == "discord" or (ctx not in ("notion", "email", "drive", "calendar", "slack", "code", "forms") and "discord" in msg):
        if any(w in msg for w in ["send", "post", "write"]):
            channel = "general"
            import re
            m = re.search(r'to the "([^"]+)" channel', message)
            if m: channel = m.group(1)
            result = await send_discord_message(channel, message)
            return result
        result = await read_discord_channel("general", 5)
        return f"Here are the latest Discord messages:\n{result}"

    # 💬 Slack
    elif ctx == "slack" or (ctx not in ("notion", "email", "drive", "calendar", "discord", "code", "forms") and "slack" in msg):
        if any(w in msg for w in ["send", "post", "write"]):
            channel = "general"
            import re
            m = re.search(r'to the "([^"]+)" channel', message)
            if m: channel = m.group(1)
            result = await send_slack_message(channel, message)
            return result
        result = await read_slack_channel("general", 5)
        return f"Here are your Slack messages:\n{result}"

    # 💻 Local Code / Files
    elif ctx == "code" or (ctx not in ("notion", "email", "drive", "calendar", "discord", "slack", "forms") and ("code" in msg or "local" in msg)):
        result = await list_local_directory(".")
        return f"Here are your local files:\n{result}"

    # 📋 Google Forms
    elif ctx == "forms" or (ctx not in ("notion", "email", "drive", "calendar", "discord", "slack", "code") and ("form" in msg or "survey" in msg)):
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
    groq: str = ""
    anthropic: str = ""

@app.post("/update-keys")
async def update_keys(req: KeysUpdateRequest):
    """Save API keys to .env and update os.environ live."""
    if req.notion:  update_env_key("NOTION_API_KEY", req.notion)
    if req.discord: update_env_key("DISCORD_BOT_TOKEN", req.discord)
    if req.slack:   update_env_key("SLACK_BOT_TOKEN", req.slack)
    if req.gemini:  update_env_key("GEMINI_API_KEY", req.gemini)
    if req.groq:    update_env_key("GROQ_API_KEY", req.groq)
    if req.anthropic: update_env_key("ANTHROPIC_API_KEY", req.anthropic)
    return {"response": "Keys updated successfully!"}


class ChatRequest(BaseModel):
    message: str
    context: str = "Email"
    image_data: Optional[str] = None

@app.post("/chat")
async def chat_with_copilot(request: ChatRequest):
    """
    Context-aware chat endpoint.
    Receives { message, context, image_data } and routes to Groq (primary), 
    Gemini (secondary), Anthropic (tertiary), or keyword router based on available API keys.
    """
    global CURRENT_ATTACHMENT
    CURRENT_ATTACHMENT.clear()
    
    if request.image_data and "|||" in request.image_data:
        parts = request.image_data.split("|||")
        if len(parts) == 3:
            CURRENT_ATTACHMENT["filename"] = parts[0]
            CURRENT_ATTACHMENT["mime_type"] = parts[1]
            try:
                CURRENT_ATTACHMENT["data"] = base64.b64decode(parts[2])
            except:
                pass
                
        # If summarizing a PDF, natively extract text here so LLM can read it
        if CURRENT_ATTACHMENT.get("data") and "pdf" in CURRENT_ATTACHMENT["mime_type"]:
            try:
                import PyPDF2
                import io
                reader = PyPDF2.PdfReader(io.BytesIO(CURRENT_ATTACHMENT["data"]))
                text = "".join([page.extract_text() for page in reader.pages]).strip()
                request.message += f"\n\n[Attached PDF Content of {parts[0]}]:\n{text[:10000]}"
            except Exception as e:
                request.message += f"\n\n[Failed to extract text from PDF: {e}]"
                
        # If it's a code file or pure text file, try to natively decode it
        elif CURRENT_ATTACHMENT.get("data"):
            try:
                text = CURRENT_ATTACHMENT["data"].decode('utf-8')
                print(f"[DEBUG] Decoded {len(text)} characters from {parts[0]}")
                request.message += f"\n\n---START OF SECURE FILE ATTACHMENT ({parts[0]})---\n{text[:15000]}\n---END OF FILE ATTACHMENT---\n(System note to LLM: the file data has been physically provided to you above. Do not ask for it. Read the raw text block above to summarize the file!)"
            except UnicodeDecodeError:
                print(f"[DEBUG] Failed to decode {parts[0]} as UTF-8.")
                pass
                
    try:
        from core.auth import get_anthropic_key, get_gemini_key, get_groq_key
        
        # 1. Try Groq Primary
        if get_groq_key():
            response = await call_groq(message=request.message, context=request.context, image_data=request.image_data)
            if not response.startswith("⚠️ Groq Error"):
                return {"response": response}
                
        # 2. Try Gemini Secondary
        if get_gemini_key():
            response = await call_gemini(message=request.message, context=request.context, image_data=request.image_data)
            if not response.startswith("⚠️ Gemini") and not response.startswith("CRITICAL AI CRASH"):
                return {"response": response}
                
        # 3. Try Anthropic Tertiary
        if get_anthropic_key():
            response = await call_anthropic(message=request.message, context=request.context, image_data=request.image_data)
            if not response.startswith("⚠️ Anthropic"):
                return {"response": response}
                
        # 4. Local Fallback Route
        response = await keyword_router(request.message, request.context)
        return {"response": response}
        
    except Exception as e:
        print(f"[Chat Error] {traceback.format_exc()}")
        return {"response": f"⚠️ Something went wrong: {str(e)}. Please try again."}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    has_anthropic = bool(get_anthropic_key())
    has_gemini = bool(get_gemini_key())
    has_groq = bool(get_groq_key())
    
    if has_groq:
        llm = "groq"
    elif has_gemini:
        llm = "gemini"
    elif has_anthropic:
        llm = "anthropic"
    else:
        llm = "keyword-fallback"
        
    return {
        "status": "ok",
        "llm": llm,
        "tools_registered": len(TOOL_FUNCTIONS),
    }


@app.get("/notion/page/{page_id}")
async def get_notion_page(page_id: str):
    """Fetch full content of a Notion page (title + recursive blocks + child pages)."""
    result = await notion_tools.get_notion_page_content(page_id)
    if "error" in result:
        return {"error": result["error"]}
    return result