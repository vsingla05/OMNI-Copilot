"""
core/auth.py — Google OAuth2 + API Key loaders for all platforms.
Centralizes credential management for the entire Omni Copilot backend.
"""
import os
import os.path
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/forms.body',
]

# ── .env loader (no external dependency) ──
def load_dotenv():
    """Load variables from .env file into os.environ."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

def update_env_key(key: str, value: str):
    """Upserts a key=value pair into the .env file and updates os.environ."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()
    found = False
    with open(env_path, 'w') as f:
        for line in lines:
            if line.strip().startswith(f"{key}="):
                f.write(f"{key}={value}\n")
                found = True
            else:
                f.write(line)
        if not found:
            f.write(f"{key}={value}\n")
    os.environ[key] = value

# ── Google OAuth2 Service Builder ──
_google_services_cache = None

def get_google_services():
    """
    Authenticates with Google OAuth2 and returns active service objects.
    Returns: (gmail_service, drive_service, calendar_service)
    Caches after first successful auth to avoid re-building on every call.
    """
    global _google_services_cache
    if _google_services_cache:
        return _google_services_cache

    creds = None
    base_dir = os.path.dirname(os.path.dirname(__file__))
    token_path = os.path.join(base_dir, 'token.json')
    creds_path = os.path.join(base_dir, 'credentials.json')

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    gmail_service = build('gmail', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    calendar_service = build('calendar', 'v3', credentials=creds)

    _google_services_cache = (gmail_service, drive_service, calendar_service)
    return _google_services_cache

# ── Platform Key Getters ──
def get_notion_key() -> str:
    return os.environ.get('NOTION_API_KEY', '').strip()

def get_discord_token() -> str:
    return os.environ.get('DISCORD_BOT_TOKEN', '').strip()

def get_slack_token() -> str:
    return os.environ.get('SLACK_BOT_TOKEN', '').strip()

def get_gemini_key() -> str:
    return os.environ.get('GEMINI_API_KEY', '').strip()
