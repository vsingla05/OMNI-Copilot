"""
tools/local_fs_tools.py — Safe local filesystem reader.
Provides tools for reading local code files safely within a sandboxed directory.
"""
import os


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
