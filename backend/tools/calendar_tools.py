"""
tools/calendar_tools.py — Google Calendar CRUD operations.
Provides tools for reading, creating, updating, and deleting calendar events.
"""
from core.auth import get_google_services
from datetime import datetime, timedelta
import re


def _parse_datetime(date_str: str, time_str: str) -> str:
    """Internal helper to parse date/time into ISO 8601 with local timezone."""
    time_str = re.sub(r'(?i)(\d)([apm]{2})$', r'\1 \2', time_str.strip()).upper()
    combined = f"{date_str.strip()} {time_str}"
    
    formats = [
        "%B %d, %Y %I:%M %p",
        "%B %d %Y %I:%M %p",
        "%b %d, %Y %I:%M %p",
        "%b %d %Y %I:%M %p",
        "%d %B %Y %I:%M %p",
        "%d %B %Y %H:%M",
        "%Y-%m-%d %I:%M %p",
        "%Y-%m-%d %H:%M",
        "%B %d, %Y %H:%M",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(combined, fmt)
            if dt.year == 1900:
                dt = dt.replace(year=datetime.now().year)
            local_dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
            return local_dt.isoformat()
        except ValueError:
            continue
    raise ValueError(f"Could not parse: '{combined}'. Use format like 'April 11, 2026' and '4:00 PM'.")


async def get_upcoming_events(max_results: int = 5, date: str = None) -> str:
    """Gets the next upcoming events from the user's Google Calendar.
    Use this when the user asks about their schedule, calendar, events, or meetings.
    If 'date' is provided (e.g., 'April 20, 2026'), fetches events specifically for that day.
    Returns formatted lines like: ID: <id> | Event: <title> | At: <datetime>"""
    try:
        _, _, calendar = get_google_services()
        
        if date:
            start_iso = _parse_datetime(date, "12:00 AM")
            end_dt = datetime.fromisoformat(start_iso) + timedelta(days=1)
            time_min = start_iso
            time_max = end_dt.isoformat()
        else:
            time_min = datetime.utcnow().isoformat() + 'Z'
            time_max = None

        if time_max:
            results = calendar.events().list(
                calendarId='primary', timeMin=time_min, timeMax=time_max,
                maxResults=max_results, singleEvents=True,
                orderBy='startTime'
            ).execute()
        else:
            results = calendar.events().list(
                calendarId='primary', timeMin=time_min,
                maxResults=max_results, singleEvents=True,
                orderBy='startTime'
            ).execute()
            
        events = results.get('items', [])

        if not events:
            return "No upcoming events found."

        lines = []
        for ev in events:
            start = ev['start'].get('dateTime', ev['start'].get('date'))
            lines.append(f"ID: {ev['id']} | Event: {ev['summary']} | At: {start}")
        return "\n".join(lines)
    except Exception as e:
        return f"Failed to read calendar: {str(e)}"


async def create_calendar_event(title: str, date: str, time: str, duration: str = "1 hour") -> str:
    """Creates a new event on the user's Google Calendar.
    Use this when the user asks to schedule, create, add, or book a meeting/event.
    Args: title (event name), date (e.g. 'April 15, 2026'), time (e.g. '3:00 PM'), duration (e.g. '1 hour')."""
    try:
        _, _, calendar = get_google_services()
        start_iso = _parse_datetime(date, time)
        end_dt = datetime.fromisoformat(start_iso)
        
        dur_lower = duration.lower()
        if "hour" in dur_lower:
            hours = int(re.search(r'\d+', duration).group()) if re.search(r'\d+', duration) else 1
            end_dt += timedelta(hours=hours)
        elif "min" in dur_lower:
            mins = int(re.search(r'\d+', duration).group()) if re.search(r'\d+', duration) else 30
            end_dt += timedelta(minutes=mins)
        else:
            end_dt += timedelta(hours=1)
            
        event = {
            'summary': title,
            'start': {'dateTime': start_iso},
            'end':   {'dateTime': end_dt.isoformat()},
        }
        created = calendar.events().insert(calendarId="primary", body=event).execute()
        return f"Event '{title}' created successfully! Link: {created.get('htmlLink')}"
    except Exception as e:
        return f"Event creation failed: {str(e)}"


async def delete_calendar_event(event_id: str) -> str:
    """Deletes a calendar event by its event ID.
    Use this when the user asks to delete, cancel, or remove an event."""
    try:
        _, _, calendar = get_google_services()
        calendar.events().delete(calendarId="primary", eventId=event_id).execute()
        return f"Event {event_id} deleted successfully."
    except Exception as e:
        return f"Could not delete event: {str(e)}"
