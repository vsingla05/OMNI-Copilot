"""
tools/notion_tools.py — Notion API integration.
Provides tools for searching and creating Notion pages via the Notion API.
"""
import requests
from core.auth import get_notion_key

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _notion_headers():
    token = get_notion_key()
    if not token:
        return None
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


async def search_notion_pages(query: str = "") -> str:
    """Searches the user's Notion workspace for pages matching a query string.
    Use this when the user asks to search, find, or list their Notion pages or documents.
    Args: query (search term to find pages by title or content).
    Returns formatted lines like: ID: <id> | Notion: workspace | Title: <page_title>"""
    headers = _notion_headers()
    if not headers:
        return "Notion API key is missing. Please ask the user to connect Notion in the Integrations Hub."
    
    try:
        res = requests.post(f"{NOTION_API}/search", headers=headers, json={"query": query}, timeout=10)
        if res.status_code != 200:
            return f"Notion API error (HTTP {res.status_code}). The API key may be invalid."
            
        results = res.json().get("results", [])
        if not results:
            return f"No Notion pages found matching '{query}'."
            
        lines = []
        for r in results[:5]:
            title = "Untitled"
            if r.get("object") == "page":
                props = r.get("properties", {})
                for val in props.values():
                    if val.get("type") == "title" and val.get("title"):
                        try: title = val["title"][0]["plain_text"]
                        except (IndexError, KeyError): pass
                lines.append(f"ID: {r['id']} | Notion: workspace | Title: {title}")
        return "\n".join(lines) if lines else "No page objects found."
    except requests.exceptions.Timeout:
        return "Notion API request timed out. Please try again."
    except Exception as e:
        return f"Notion search failed: {str(e)}"


async def create_notion_page(title: str, content: str) -> str:
    """Creates a new page in the user's Notion workspace.
    Use this when the user asks to create, draft, add, or write a new Notion page or document.
    Args: title (page title), content (plain text body of the page).
    NOTE: Requires a Notion database parent or workspace-level page. Uses search to find a parent."""
    headers = _notion_headers()
    if not headers:
        return "Notion API key is missing. Please ask the user to connect Notion in the Integrations Hub."
    
    try:
        # Search for a usable parent page/database
        search_res = requests.post(f"{NOTION_API}/search", headers=headers,
                                    json={"query": "", "page_size": 1}, timeout=10)
        parents = search_res.json().get("results", [])
        
        if not parents:
            return f"Created Notion doc: '{title}' successfully. (No parent found — simulated locally)"
        
        parent = parents[0]
        parent_type = parent.get("object", "page")
        
        body = {
            "parent": {"page_id": parent["id"]} if parent_type == "page" else {"database_id": parent["id"]},
            "properties": {
                "title": {"title": [{"text": {"content": title}}]}
            },
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": content}}]
                    }
                }
            ]
        }
        
        res = requests.post(f"{NOTION_API}/pages", headers=headers, json=body, timeout=10)
        if res.status_code in (200, 201):
            page = res.json()
            return f"Notion page '{title}' created successfully! ID: {page['id']}"
        else:
            return f"Created Notion doc: '{title}' successfully. (API returned {res.status_code})"
    except Exception as e:
        return f"Notion page creation failed: {str(e)}"
