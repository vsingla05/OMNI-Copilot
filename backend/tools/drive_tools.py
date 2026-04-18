"""
tools/drive_tools.py — Google Drive file operations.
Provides tools for listing, searching, uploading, and deleting Drive files.
"""
from core.auth import get_google_services


async def search_drive_files(query: str = "", limit: int = 5) -> str:
    """Lists or searches files in the user's Google Drive.
    Use this tool when the user asks to list, search, find, or show their Drive files.
    This is also required to find a file's ID before deleting it!
    Args: query (optional search term to filter files by name), limit (max results to return).
    Returns formatted lines like: ID: <id> | File: <filename>"""
    try:
        _, drive, _ = get_google_services()
        q_filter = f"name contains '{query}'" if query else None
        results = drive.files().list(
            pageSize=limit,
            fields="files(id, name, mimeType, modifiedTime)",
            orderBy="modifiedTime desc",
            q=q_filter
        ).execute()
        items = results.get('files', [])

        if not items:
            return "No files found in Google Drive."
        return "\n".join([f"ID: {f['id']} | File: {f['name']}" for f in items])
    except Exception as e:
        return f"Drive search failed: {str(e)}"


async def upload_text_to_drive(filename: str, content: str) -> str:
    """Creates a new text file in Google Drive with the given filename and content.
    Use this tool when the user asks to create, save, or upload a document to Drive.
    Args: filename (name for the new file), content (text content of the file)."""
    try:
        from googleapiclient.http import MediaInMemoryUpload
        _, drive, _ = get_google_services()
        media = MediaInMemoryUpload(content.encode('utf-8'), mimetype='text/plain')
        file_meta = {'name': filename}
        created = drive.files().create(body=file_meta, media_body=media, fields='id,name').execute()
        return f"File '{created['name']}' uploaded to Drive. ID: {created['id']}"
    except Exception as e:
        return f"Drive upload failed: {str(e)}"


async def upload_attached_file_to_drive() -> str:
    """Uploads the user's currently attached file (e.g. PDF, binary, image) to Google Drive.
    Use this tool when the user explicitly attaches a file in chat and asks to upload or save it to Drive."""
    try:
        from googleapiclient.http import MediaIoBaseUpload
        import io
        import main
        
        if not getattr(main, "CURRENT_ATTACHMENT", None):
            return "No file is currently attached to the chat prompt."
            
        filename = main.CURRENT_ATTACHMENT.get("filename", "untitled_file")
        mime_type = main.CURRENT_ATTACHMENT.get("mime_type", "application/octet-stream")
        data = main.CURRENT_ATTACHMENT.get("data")
        
        if not data:
            return "Failed to read binary data from the attached file."

        _, drive, _ = get_google_services()
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime_type, resumable=True)
        file_meta = {'name': filename}
        
        created = drive.files().create(body=file_meta, media_body=media, fields='id,name').execute()
        return f"File '{created['name']}' uploaded to Drive. ID: {created['id']}"
    except Exception as e:
        return f"Drive attached file upload failed: {str(e)}"


async def delete_drive_file(file_id: str) -> str:
    """Permanently deletes a file from Google Drive by its file ID.
    CRITICAL: If the user provides a filename instead of an ID, you MUST use the search_drive_files tool first to find the file's ID before calling this delete tool.
    Use this tool when the user asks to delete or remove a file from Drive."""
    try:
        _, drive, _ = get_google_services()
        drive.files().delete(fileId=file_id).execute()
        return f"File {file_id} deleted from Google Drive."
    except Exception as e:
        return f"Could not delete file: {str(e)}"
