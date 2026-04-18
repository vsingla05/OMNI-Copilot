"""
tools/local_fs_tools.py — Safe local filesystem reader.
Provides tools for reading local code files safely within a sandboxed directory.
Also exposes summarize_file for multi-modal file understanding by the LLM brain.
"""
import os
import json


# Safety: Restrict to the project root or a configurable workspace
ALLOWED_ROOT = os.path.expanduser("~/Documents")


async def read_local_file(filepath: str) -> str:
    """Reads the content of a local file on the user's machine.
    Use this when the user asks to read, view, open, or inspect a local file or code.
    Args: filepath (relative or absolute path to the file).
    SAFETY: Only reads files under the user's Documents directory. Returns an error for paths outside."""
    try:
        abs_path = os.path.abspath(filepath)
        
        # Security check: prevent reading outside the allowed root
        if not abs_path.startswith(ALLOWED_ROOT):
            return f"Access denied: Can only read files under {ALLOWED_ROOT}"
        
        if not os.path.exists(abs_path):
            return f"File not found: {abs_path}"
        
        if os.path.isdir(abs_path):
            items = os.listdir(abs_path)[:20]
            return f"Directory listing for {abs_path}:\n" + "\n".join(items)
        
        # Read with size limit (500KB)
        size = os.path.getsize(abs_path)
        if size > 500_000:
            return f"File too large ({size} bytes). Max 500KB for safety."
        
        with open(abs_path, 'r', errors='replace') as f:
            content = f.read()
        
        return f"File: {abs_path}\n---\n{content}"
    except Exception as e:
        return f"Failed to read file: {str(e)}"


async def list_local_directory(dirpath: str = ".") -> str:
    """Lists all files and subdirectories in a local directory.
    Use this when the user asks to list, browse, or explore local folders.
    Args: dirpath (path to the directory to list)."""
    try:
        abs_path = os.path.abspath(dirpath)
        
        if not abs_path.startswith(ALLOWED_ROOT):
            return f"Access denied: Can only browse under {ALLOWED_ROOT}"
        
        if not os.path.isdir(abs_path):
            return f"Not a directory: {abs_path}"
        
        items = []
        for entry in os.scandir(abs_path):
            prefix = "📁" if entry.is_dir() else "📄"
            size = f"({entry.stat().st_size}B)" if entry.is_file() else ""
            items.append(f"{prefix} {entry.name} {size}")
        
        return f"Directory: {abs_path}\n" + "\n".join(items[:30])
    except Exception as e:
        return f"Failed to list directory: {str(e)}"


async def summarize_file(filepath: str, file_type: str = "auto") -> str:
    """Ingests a local file (code, text, JSON, CSV, Markdown, PDF stub) and returns
    a rich structured summary for use by the LLM brain before answering or routing to
    other tools (e.g. send_slack_message, create_notion_page).
    Use this AUTOMATICALLY whenever a user uploads or references a file and asks about it.
    Args: filepath (absolute or relative path), file_type ('code'|'text'|'json'|'csv'|'md'|'auto').
    Returns a summary block the LLM can use as context."""
    try:
        abs_path = os.path.abspath(filepath)

        if not abs_path.startswith(ALLOWED_ROOT):
            return f"Access denied: Can only read files under {ALLOWED_ROOT}"

        if not os.path.exists(abs_path):
            return f"File not found: {abs_path}"

        if os.path.isdir(abs_path):
            return f"Path is a directory, not a file: {abs_path}. Use list_local_directory instead."

        size = os.path.getsize(abs_path)
        if size > 800_000:
            return f"File too large to summarize ({size:,} bytes). Limit is 800 KB."

        ext = os.path.splitext(abs_path)[1].lower()

        # Auto-detect type from extension
        if file_type == "auto":
            if ext in (".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java", ".cpp", ".c", ".h"):
                file_type = "code"
            elif ext in (".json",):
                file_type = "json"
            elif ext in (".csv",):
                file_type = "csv"
            elif ext in (".md", ".markdown"):
                file_type = "md"
            else:
                file_type = "text"

        with open(abs_path, "r", errors="replace") as f:
            raw = f.read()

        # For large files, only surface the first 6000 chars so Gemini gets enough context
        # without hitting token limits.
        preview = raw[:6000]
        truncated = len(raw) > 6000

        if file_type == "json":
            try:
                parsed = json.loads(raw)
                keys = list(parsed.keys()) if isinstance(parsed, dict) else f"{len(parsed)} items"
                note = f"Top-level keys: {keys}" if isinstance(keys, list) else f"Array length: {keys}"
            except Exception:
                note = "(Could not parse JSON — showing raw preview)"
        elif file_type == "csv":
            lines = raw.splitlines()
            headers = lines[0] if lines else "(empty)"
            note = f"Columns: {headers} | Total rows: {len(lines) - 1}"
        elif file_type == "code":
            line_count = raw.count("\n")
            note = f"Language: {ext.lstrip('.')} | Lines: {line_count}"
        elif file_type == "md":
            headings = [l.strip() for l in raw.splitlines() if l.startswith("#")]
            note = f"Headings found: {headings[:8]}"
        else:
            word_count = len(raw.split())
            note = f"Word count: {word_count}"

        trunc_note = "\n[... file truncated to first 6000 chars ...]" if truncated else ""
        return (
            f"=== FILE SUMMARY ===\n"
            f"Path      : {abs_path}\n"
            f"Type      : {file_type} ({ext})\n"
            f"Size      : {size:,} bytes\n"
            f"Note      : {note}\n"
            f"=== CONTENT PREVIEW ===\n"
            f"{preview}{trunc_note}"
        )
    except Exception as e:
        return f"Failed to summarize file: {str(e)}"
