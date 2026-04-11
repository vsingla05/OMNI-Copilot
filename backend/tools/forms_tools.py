"""
tools/forms_tools.py — Google Forms integration.
Provides tools for creating and reading Google Forms via the Google Forms API.
"""
from core.auth import get_google_services
from googleapiclient.discovery import build


def _get_forms_service():
    """Builds a Google Forms API service using the same OAuth credentials."""
    gmail, _, _ = get_google_services()
    # Reuse the same credentials from gmail service
    creds = gmail._http.credentials
    return build('forms', 'v1', credentials=creds)


async def create_google_form(title: str, questions: str) -> str:
    """Creates a new Google Form with a title and a list of questions.
    Use this when the user asks to create, build, or make a Google Form or survey.
    Args: title (form title), questions (newline-separated list of question texts).
    Returns the form URL."""
    try:
        service = _get_forms_service()
        
        # Step 1: Create the form with just a title
        form = {"info": {"title": title}}
        created = service.forms().create(body=form).execute()
        form_id = created['formId']
        
        # Step 2: Add questions via batchUpdate
        q_list = [q.strip() for q in questions.split('\n') if q.strip()]
        requests_body = []
        for i, q_text in enumerate(q_list):
            requests_body.append({
                "createItem": {
                    "item": {
                        "title": q_text,
                        "questionItem": {
                            "question": {
                                "required": False,
                                "textQuestion": {"paragraph": False}
                            }
                        }
                    },
                    "location": {"index": i}
                }
            })
        
        if requests_body:
            service.forms().batchUpdate(
                formId=form_id,
                body={"requests": requests_body}
            ).execute()
        
        url = created.get("responderUri", f"https://docs.google.com/forms/d/{form_id}")
        return f"Google Form '{title}' created successfully!\nForm URL: {url}"
    except Exception as e:
        return f"Form creation failed: {str(e)}"


async def read_google_form_responses(form_id: str) -> str:
    """Reads the responses submitted to a Google Form.
    Use this when the user asks to check, read, or view form responses or survey results.
    Args: form_id (the Google Form ID)."""
    try:
        service = _get_forms_service()
        responses = service.forms().responses().list(formId=form_id).execute()
        items = responses.get("responses", [])
        
        if not items:
            return "No responses found for this form."
        
        lines = [f"Total responses: {len(items)}"]
        for i, resp in enumerate(items[:5]):
            answers = resp.get("answers", {})
            answer_texts = []
            for qid, ans in answers.items():
                text_answers = ans.get("textAnswers", {}).get("answers", [])
                for ta in text_answers:
                    answer_texts.append(ta.get("value", ""))
            lines.append(f"Response {i+1}: {', '.join(answer_texts) or '(empty)'}")
        
        return "\n".join(lines)
    except Exception as e:
        return f"Failed to read form responses: {str(e)}"
