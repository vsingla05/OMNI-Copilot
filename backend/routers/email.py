from fastapi import APIRouter
from pydantic import BaseModel
from auth import get_google_services
from email.message import EmailMessage
import base64

router = APIRouter(prefix="/email", tags=["Email"])

class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str

@router.post("/send")
async def send_email_endpoint(request: EmailRequest):
    """Sends an email via Gmail API."""
    try:
        gmail, _, _ = get_google_services()
        message = EmailMessage()
        message.set_content(request.body)
        message["To"] = request.to
        message["Subject"] = request.subject

        # Encode for Gmail API
        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        create_message = {"raw": encoded_message}
        sent = gmail.users().messages().send(userId="me", body=create_message).execute()

        return {"response": f"Email sent successfully. Message ID: {sent['id']}"}
    except Exception as e:
        return {"response": f"Email send failed: {str(e)}"}

@router.delete("/trash/{message_id}")
async def trash_email(message_id: str):
    """Moves an email to trash by ID."""
    try:
        gmail, _, _ = get_google_services()
        gmail.users().messages().trash(userId="me", id=message_id).execute()
        return {"response": f"Email {message_id} moved to trash successfully."}
    except Exception as e:
        return {"response": f"Could not trash email: {str(e)}"}

# Tool function for LLM/MCP to read emails
async def tool_check_latest_emails(max_results: int = 3) -> str:
    """Reads the subjects and senders of the most recent emails."""
    gmail, _, _ = get_google_services()
    results = gmail.users().messages().list(userId='me', maxResults=max_results).execute()
    messages = results.get('messages', [])

    if not messages:
        return "No new messages."

    email_summary = []
    for msg in messages:
        txt = gmail.users().messages().get(userId='me', id=msg['id'], format='metadata', metadataHeaders=['Subject', 'From']).execute()
        headers = txt['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
        sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
        email_summary.append(f"ID: {msg['id']} | From: {sender} | Subject: {subject}")
    
    return "\n".join(email_summary)
