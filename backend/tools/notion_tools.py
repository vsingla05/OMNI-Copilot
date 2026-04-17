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


def _extract_rich_text(rich_text_list: list) -> str:
    """Convert Notion rich_text array to plain string."""
    return "".join(part.get("plain_text", "") for part in rich_text_list)


def _blocks_to_text(blocks: list, indent: int = 0) -> str:
    """Recursively convert Notion blocks to readable markdown-ish text."""
    lines = []
    prefix = "  " * indent
    for block in blocks:
        btype = block.get("type", "")
        data  = block.get(btype, {})

        if btype == "paragraph":
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}{text}")

        elif btype in ("heading_1", "heading_2", "heading_3"):
            hashes = {"heading_1": "#", "heading_2": "##", "heading_3": "###"}[btype]
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}{hashes} {text}")

        elif btype == "bulleted_list_item":
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}• {text}")

        elif btype == "numbered_list_item":
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}1. {text}")

        elif btype == "to_do":
            checked = "✅" if data.get("checked") else "⬜"
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}{checked} {text}")

        elif btype == "toggle":
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}▶ {text}")

        elif btype == "quote":
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}> {text}")

        elif btype == "code":
            text = _extract_rich_text(data.get("rich_text", []))
            lang = data.get("language", "")
            lines.append(f"{prefix}```{lang}\n{prefix}{text}\n{prefix}```")

        elif btype == "callout":
            emoji = data.get("icon", {}).get("emoji", "💡")
            text = _extract_rich_text(data.get("rich_text", []))
            if text:
                lines.append(f"{prefix}{emoji} {text}")

        elif btype == "divider":
            lines.append(f"{prefix}---")

        elif btype == "child_page":
            title = data.get("title", "Untitled")
            lines.append(f"{prefix}📄 [{title}]")

        elif btype == "image":
            url = data.get("file", {}).get("url") or data.get("external", {}).get("url", "")
            caption = _extract_rich_text(data.get("caption", []))
            lines.append(f"{prefix}🖼️ Image{': ' + caption if caption else ''}")

        # Recurse into children if present
        if block.get("has_children"):
            # Children have to be fetched separately — caller handles this
            pass

    return "\n".join(lines)


def fetch_page_blocks(page_id: str, headers: dict, depth: int = 0) -> str:
    """Fetch all blocks of a page recursively (up to depth 3 to avoid huge payloads)."""
    if depth > 3:
        return ""
    try:
        all_blocks = []
        cursor = None
        while True:
            params = {"page_size": 100}
            if cursor:
                params["start_cursor"] = cursor
            res = requests.get(
                f"{NOTION_API}/blocks/{page_id}/children",
                headers=headers, params=params, timeout=15
            )
            if res.status_code != 200:
                break
            data = res.json()
            all_blocks.extend(data.get("results", []))
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")

        # Recursively fetch children
        text_parts = []
        indent = depth
        for block in all_blocks:
            btype = block.get("type", "")
            bdata = block.get(btype, {})
            prefix = "  " * indent

            if btype == "paragraph":
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}{t}")
            elif btype in ("heading_1", "heading_2", "heading_3"):
                hashes = {"heading_1": "#", "heading_2": "##", "heading_3": "###"}[btype]
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}{hashes} {t}")
            elif btype == "bulleted_list_item":
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}• {t}")
            elif btype == "numbered_list_item":
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}1. {t}")
            elif btype == "to_do":
                checked = "✅" if bdata.get("checked") else "⬜"
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}{checked} {t}")
            elif btype == "toggle":
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}▶ {t}")
            elif btype == "quote":
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}> {t}")
            elif btype == "code":
                t = _extract_rich_text(bdata.get("rich_text", []))
                lang = bdata.get("language", "")
                text_parts.append(f"{prefix}```{lang}\n{prefix}{t}\n{prefix}```")
            elif btype == "callout":
                emoji = bdata.get("icon", {}).get("emoji", "💡")
                t = _extract_rich_text(bdata.get("rich_text", []))
                if t: text_parts.append(f"{prefix}{emoji} {t}")
            elif btype == "divider":
                text_parts.append(f"{prefix}---")
            elif btype == "child_page":
                title = bdata.get("title", "Untitled")
                text_parts.append(f"{prefix}📄 {title}")
                # Recurse into child page
                if depth < 3:
                    child_content = fetch_page_blocks(block["id"], headers, depth + 1)
                    if child_content:
                        text_parts.append(child_content)
            elif btype == "image":
                caption = _extract_rich_text(bdata.get("caption", []))
                text_parts.append(f"{prefix}🖼️ Image{': ' + caption if caption else ''}")

            # Recurse into non-page children blocks
            elif block.get("has_children") and btype != "child_page":
                child_content = fetch_page_blocks(block["id"], headers, depth + 1)
                if child_content:
                    text_parts.append(child_content)

        return "\n".join(text_parts)
    except Exception as e:
        return f"(Error fetching blocks: {e})"


async def get_notion_page_content(page_id: str) -> dict:
    """Fetches the full content of a Notion page including all nested blocks and child pages.
    Returns a dict with title, url, and content."""
    headers = _notion_headers()
    if not headers:
        return {"error": "Notion API key is missing."}

    try:
        # Get page metadata
        page_res = requests.get(f"{NOTION_API}/pages/{page_id}", headers=headers, timeout=10)
        if page_res.status_code != 200:
            return {"error": f"Could not fetch page (HTTP {page_res.status_code})"}

        page = page_res.json()

        # Extract title
        title = "Untitled"
        for val in page.get("properties", {}).values():
            if val.get("type") == "title":
                for part in val.get("title", []):
                    t = part.get("plain_text", "").strip()
                    if t:
                        title = t
                        break

        url = page.get("url", "")

        # Fetch all blocks recursively
        content = fetch_page_blocks(page_id, headers, depth=0)

        return {
            "title": title,
            "url": url,
            "content": content or "(This page has no text content)",
            "page_id": page_id,
        }
    except Exception as e:
        return {"error": str(e)}


async def search_notion_pages(query: str = "") -> str:
    """Searches the user's Notion workspace for pages matching a query string.
    Use this when the user asks to search, find, or list their Notion pages or documents.
    Args: query (search term to find pages by title or content. IMPORTANT: Leave this completely empty "" if the user asks to "list all", "fetch all", "show all" pages.)
    Returns formatted lines like: ID: <id> | Notion: workspace | Title: <page_title>"""
    headers = _notion_headers()
    if not headers:
        return "Notion API key is missing. Please ask the user to connect Notion in the Integrations Hub."

    def _extract_title(obj: dict) -> str:
        """Extract plain-text title from a Notion page or database object."""
        obj_type = obj.get("object", "")
        if obj_type == "database":
            # Database titles live under .title[]
            for part in obj.get("title", []):
                text = part.get("plain_text", "").strip()
                if text:
                    return text
            return "Untitled Database"
        # page: title is in properties
        for val in obj.get("properties", {}).values():
            if val.get("type") == "title":
                for part in val.get("title", []):
                    text = part.get("plain_text", "").strip()
                    if text:
                        return text
        return "Untitled"

    try:
        all_results = []
        payload = {"query": query, "page_size": 100}
        # Paginate through ALL results using Notion's cursor
        while True:
            res = requests.post(f"{NOTION_API}/search", headers=headers, json=payload, timeout=15)
            if res.status_code != 200:
                return f"Notion API error (HTTP {res.status_code}): {res.text[:200]}"

            data = res.json()
            all_results.extend(data.get("results", []))

            # Stop if no more pages
            if not data.get("has_more"):
                break
            payload["start_cursor"] = data.get("next_cursor")

        if not all_results:
            msg = f"No Notion pages found matching '{query}'." if query else "No Notion pages found."
            return msg + "\n\n💡 Tip: Make sure your Notion integration is shared with your pages:\nNotion → Open a page → ··· → Connections → Select your integration."

        lines = []
        for r in all_results:
            obj_type = r.get("object", "page")
            title = _extract_title(r)
            url = r.get("url", "")
            icon = "🗄️" if obj_type == "database" else "📄"
            entry = f"{icon} {title} | ID: {r['id']}"
            if url:
                entry += f" | 🔗 {url}"
            lines.append(entry)

        summary = f"Found {len(lines)} item(s) in your Notion workspace"
        if query:
            summary += f" matching '{query}'"
        summary += ":\n"
        return summary + "\n".join(lines)

    except requests.exceptions.Timeout:
        return "Notion API request timed out. Please try again."
    except Exception as e:
        return f"Notion search failed: {str(e)}"


async def create_notion_page(title: str, content: str) -> str:
    """Creates a new page in the user's Notion workspace.
    Use this when the user asks to create, draft, add, or write a new Notion page or document.
    Args: title (page title), content (plain text body of the page)."""
    headers = _notion_headers()
    if not headers:
        return "Notion API key is missing. Please ask the user to connect Notion in the Integrations Hub."

    page_body = {
        "parent": {"type": "workspace", "workspace": True},
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

    try:
        res = requests.post(f"{NOTION_API}/pages", headers=headers, json=page_body, timeout=10)

        if res.status_code in (200, 201):
            page = res.json()
            page_url = page.get("url", "")
            return f"Notion page '{title}' created successfully! ID: {page['id']}" + (f"\n🔗 {page_url}" if page_url else "")

        # Workspace root failed — fall back to first accessible parent
        if res.status_code in (400, 403):
            search_res = requests.post(
                f"{NOTION_API}/search", headers=headers,
                json={"filter": {"value": "page", "property": "object"}, "page_size": 5},
                timeout=10
            )
            parents = search_res.json().get("results", [])

            for parent in parents:
                fallback_body = {
                    "parent": {"page_id": parent["id"]},
                    "properties": {
                        "title": {"title": [{"text": {"content": title}}]}
                    },
                    "children": page_body["children"]
                }
                fb_res = requests.post(f"{NOTION_API}/pages", headers=headers, json=fallback_body, timeout=10)
                if fb_res.status_code in (200, 201):
                    page = fb_res.json()
                    page_url = page.get("url", "")
                    return f"Notion page '{title}' created successfully (under '{parent.get('id', 'parent page')}')! ID: {page['id']}" + (f"\n🔗 {page_url}" if page_url else "")

            return (
                f"❌ Could not create Notion page '{title}'. "
                f"Notion returned HTTP {res.status_code}: {res.text[:300]}\n\n"
                "💡 Make sure your Notion integration has been shared with at least one page:\n"
                "Notion → Settings → Connections → Your Integration → Share a page with it."
            )

        return f"❌ Notion API error (HTTP {res.status_code}): {res.text[:300]}"

    except requests.exceptions.Timeout:
        return "Notion API request timed out. Please try again."
    except Exception as e:
        return f"Notion page creation failed: {str(e)}"
