from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from core.auth import get_google_services
from typing import Optional

router = APIRouter(prefix="/drive", tags=["Drive"])

class DrivePatchRequest(BaseModel):
    name: Optional[str] = None

@router.post("/upload")
async def upload_file_to_drive(file: UploadFile = File(...)):
    """Uploads a real file to Google Drive."""
    try:
        from googleapiclient.http import MediaIoBaseUpload
        _, drive, _ = get_google_services()

        file_metadata = {"name": file.filename}
        
        # We need to read the uploaded file contents
        content = await file.read()
        import io
        media = MediaIoBaseUpload(
            io.BytesIO(content),
            mimetype=file.content_type,
            resumable=True
        )
        
        created = drive.files().create(
            body=file_metadata, media_body=media, fields="id, name"
        ).execute()

        return {"response": f"File '{created['name']}' uploaded to Drive successfully. ID: {created['id']}"}
    except Exception as e:
        return {"response": f"Upload failed: {str(e)}"}

@router.delete("/delete/{file_id}")
async def delete_drive_file(file_id: str):
    """Deletes a file from Google Drive."""
    try:
        _, drive, _ = get_google_services()
        drive.files().delete(fileId=file_id).execute()
        return {"response": f"Drive file {file_id} deleted successfully."}
    except Exception as e:
        return {"response": f"Could not delete file: {str(e)}"}

@router.patch("/update/{file_id}")
async def update_drive_file(file_id: str, request: DrivePatchRequest):
    """Updates metadata (e.g. name) of a Google Drive file."""
    try:
        _, drive, _ = get_google_services()
        meta = {}
        if request.name: 
            meta["name"] = request.name
        
        if meta:
            drive.files().update(fileId=file_id, body=meta).execute()
            
        return {"response": f"Drive file metadata updated successfully."}
    except Exception as e:
        return {"response": f"Could not update file: {str(e)}"}

# Tool function for LLM/MCP to search drive files
async def tool_search_drive_files(limit: int = 5) -> str:
    """Lists the names of the most recently modified files in Google Drive."""
    _, drive, _ = get_google_services()
    results = drive.files().list(pageSize=limit, fields="files(id, name)", orderBy="modifiedTime desc").execute()
    items = results.get('files', [])

    if not items:
        return "No files found."
    return "\n".join([f"ID: {item['id']} | File: {item['name']}" for item in items])
