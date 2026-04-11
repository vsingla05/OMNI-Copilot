import os.path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mcp.server.fastmcp import FastMCP

from routers import email, drive, calendar

# Initialize FastAPI and FastMCP
app = FastAPI(title="Omni Copilot Web Backend")
mcp_server = FastMCP("google-master-server")

# Allow frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DEFINING THE AI TOOLS ── 
@mcp_server.tool()
async def check_latest_emails(max_results: int = 3) -> str:
    return await email.tool_check_latest_emails(max_results)

@mcp_server.tool()
async def search_drive_files(limit: int = 5) -> str:
    return await drive.tool_search_drive_files(limit)

@mcp_server.tool()
async def get_upcoming_events(max_results: int = 3) -> str:
    return await calendar.tool_get_upcoming_events(max_results)

# ── MOUNT MCP AND ROUTERS ──
app.mount("/mcp", mcp_server.streamable_http_app())

app.include_router(email.router)
app.include_router(drive.router)
app.include_router(calendar.router)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat_with_copilot(request: ChatRequest):
    """
    Keyword router for the frontend /chat endpoint.
    When a real LLM is attached, this endpoint will pass the message to the LLM,
    which will automatically call the mcp_server tools above.
    """
    user_message = request.message.lower()
    
    if "email" in user_message:
        tool_result = await check_latest_emails(3)
        return {"response": f"Here is what I found in your inbox:\n{tool_result}"}
    
    elif "drive" in user_message or "file" in user_message:
        tool_result = await search_drive_files(5)
        return {"response": f"Here are your latest Drive files:\n{tool_result}"}
    
    elif "calendar" in user_message or "event" in user_message:
        tool_result = await get_upcoming_events(3)
        return {"response": f"Here are your upcoming events:\n{tool_result}"}
    
    return {"response": f"I received your message: '{request.message}'. Connect an LLM to process this!"}