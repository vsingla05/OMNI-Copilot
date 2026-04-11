from fastapi import APIRouter
from pydantic import BaseModel
from core.auth import get_google_services
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/calendar", tags=["Calendar"])

class EventRequest(BaseModel):
    title: str
    date: str
    time: str
    duration: str

class EventPatchRequest(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    duration: Optional[str] = None

def parse_datetime(date_str: str, time_str: str) -> str:
    """Attempts to parse standard date/time strings to ISO 8601 with local timezone."""
    import re
    
    # Clean up time to ensure a space before AM/PM (e.g., "7:00PM" -> "7:00 PM")
    time_str = re.sub(r'(?i)(\d)([apm]{2})$', r'\1 \2', time_str.strip()).upper()
    combined = f"{date_str.strip()} {time_str}"
    
    formats = [
        "%B %d, %Y %I:%M %p",  # April 11, 2026 4:00 PM
        "%B %d %Y %I:%M %p",   # April 11 2026 4:00 PM
        "%b %d, %Y %I:%M %p",  # Apr 11, 2026 4:00 PM
        "%b %d %Y %I:%M %p",   # Apr 11 2026 4:00 PM
        "%b %d %I:%M %p",      # Apr 11 4:00 PM (Assumes 1900, but works as fallback)
        "%Y-%m-%d %I:%M %p",   # 2026-04-11 4:00 PM
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(combined, fmt)
            # If the parser returned year 1900 (because user gave no year), snap it to current year
            if dt.year == 1900:
                dt = dt.replace(year=datetime.now().year)
                
            # Attach local server timezone
            local_dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
            return local_dt.isoformat()
        except ValueError:
            continue
            
    raise ValueError(f"Could not parse date and time: '{combined}'. Please format like 'April 11, 2026' and '4:00 PM'.")

@router.post("/create")
async def create_event_endpoint(request: EventRequest):
    """Creates a calendar event via Google Calendar API."""
    try:
        _, _, calendar = get_google_services()
        
        start_iso = parse_datetime(request.date, request.time)
        # Parse duration (e.g. '1 hour' or '2 hours')
        end_dt = datetime.fromisoformat(start_iso)
        if "hour" in request.duration.lower():
            try:
                hours = int(request.duration.split()[0])
                end_dt = end_dt + timedelta(hours=hours)
            except:
                end_dt = end_dt + timedelta(hours=1)
        elif "min" in request.duration.lower():
            try:
                mins = int(request.duration.split()[0])
                end_dt = end_dt + timedelta(minutes=mins)
            except:
                end_dt = end_dt + timedelta(hours=1)
        else:
            end_dt = end_dt + timedelta(hours=1) # default
            
        event = {
            'summary': request.title,
            'description': f"Duration: {request.duration}",
            'start': {'dateTime': start_iso},
            'end':   {'dateTime': end_dt.isoformat()},
        }

        created = calendar.events().insert(calendarId="primary", body=event).execute()
        return {"response": f"Calendar event created successfully. Link: {created.get('htmlLink')}"}
    except Exception as e:
        return {"response": f"Event creation failed: {str(e)}"}

@router.patch("/update/{event_id}")
async def update_event(event_id: str, request: EventPatchRequest):
    """Updates a calendar event."""
    try:
        _, _, calendar = get_google_services()
        
        event_body = {}
        if request.title: 
            event_body["summary"] = request.title
            
        if request.date and request.time:
            start_iso = parse_datetime(request.date, request.time)
            end_dt = datetime.fromisoformat(start_iso) + timedelta(hours=1)
            event_body["start"] = {"dateTime": start_iso}
            event_body["end"] = {"dateTime": end_dt.isoformat()}
            
        if request.duration: 
            event_body["description"] = f"Duration: {request.duration}"
            
        updated = calendar.events().patch(
            calendarId="primary", eventId=event_id, body=event_body
        ).execute()
        return {"response": f"Event '{updated.get('summary', '')}' updated successfully."}
    except Exception as e:
        return {"response": f"Could not update event: {str(e)}"}

@router.delete("/delete/{event_id}")
async def delete_event(event_id: str):
    """Deletes a calendar event."""
    try:
        _, _, calendar = get_google_services()
        calendar.events().delete(calendarId="primary", eventId=event_id).execute()
        return {"response": f"Calendar event {event_id} deleted successfully."}
    except Exception as e:
        return {"response": f"Could not delete event: {str(e)}"}

# Tool function for LLM/MCP to get events
async def tool_get_upcoming_events(max_results: int = 3) -> str:
    """Gets the next upcoming events from Google Calendar."""
    _, _, calendar = get_google_services()
    now = datetime.utcnow().isoformat() + 'Z'
    events_result = calendar.events().list(calendarId='primary', timeMin=now,
                                          maxResults=max_results, singleEvents=True,
                                          orderBy='startTime').execute()
    events = events_result.get('items', [])

    if not events:
        return "No upcoming events found."
    
    event_summary = []
    for event in events:
        start = event['start'].get('dateTime', event['start'].get('date'))
        event_summary.append(f"ID: {event['id']} | Event: {event['summary']} | At: {start}")
    return "\n".join(event_summary)
