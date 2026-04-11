"""
tools/email_tools.py — Gmail CRUD operations.
Provides tools for reading, sending, and trashing emails via the Gmail API.
"""
from core.auth import get_google_services
from email.message import EmailMessage
import base64


async def check_latest_emails(max_results: int = 5) -> str:
    """Reads the subjects and senders of the most recent emails from the user's Gmail inbox.
    Use this tool when the user asks to check, read, list, or show their emails.
    Returns formatted lines like: ID: <id> | From: <sender> | Subject: <subject>"""
    try:
        gmail, _, _ = get_google_services()
        results = gmail.users().messages().list(userId='me', maxResults=max_results).execute()
        messages = results.get('messages', [])

        if not messages:
            return "No new messages in your inbox."

        email_summary = []
        for msg in messages:
            txt = gmail.users().messages().get(
                userId='me', id=msg['id'], format='metadata',
                metadataHeaders=['Subject', 'From']
            ).execute()
            headers = txt['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
            email_summary.append(f"ID: {msg['id']} | From: {sender} | Subject: {subject}")

        return "\n".join(email_summary)
    except Exception as e:
        return f"Failed to read emails: {str(e)}"


async def send_email(to: str, subject: str, body: str) -> str:
    """Sends an email via Gmail on behalf of the user.
    Use this tool when the user asks to send, compose, draft, or write an email.
    Args: to (recipient email address), subject (email subject line), body (the email body text).
    Returns a confirmation string with the sent message ID."""
    try:
        gmail, _, _ = get_google_services()
        message = EmailMessage()
        message.set_content(body)
        message["To"] = to
        message["Subject"] = subject
        encoded = base64.urlsafe_b64encode(message.as_bytes()).decode()
        sent = gmail.users().messages().send(userId="me", body={"raw": encoded}).execute()
        return f"Email sent successfully to {to}. Message ID: {sent['id']}"
    except Exception as e:
        return f"Email send failed: {str(e)}"


async def trash_email(message_id: str) -> str:
    """Moves an email to the trash by its Gmail message ID.
    Use this tool when the user asks to delete, trash, or remove an email."""
    try:
        gmail, _, _ = get_google_services()
        gmail.users().messages().trash(userId="me", id=message_id).execute()
        return f"Email {message_id} moved to trash successfully."
    except Exception as e:
        return f"Could not trash email: {str(e)}"
