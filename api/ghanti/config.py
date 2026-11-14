"""All settings come from env vars. Copy .env.example to .env for local dev."""
import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

IST = ZoneInfo("Asia/Kolkata")


def _db_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./ghanti.db")
    # Neon hands out postgres:// or postgresql://, SQLAlchemy wants the driver named.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _db_url()

GNANI_API_KEY = os.getenv("GNANI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Tried in order. The free tier allows 15 requests a minute on a Flash-Lite model and 5 on
# a Flash one, each counted separately, so a busy model falls through to the next.
GEMINI_MODELS = [m.strip() for m in os.getenv(
    "GEMINI_MODELS", "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash").split(",") if m.strip()]

# "mock" costs no Gnani credits. Switch to "gnani" for the real thing.
SPEECH_MODE = os.getenv("SPEECH_MODE", "mock")

SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-only-secret")
CRON_SECRET = os.getenv("CRON_SECRET", "")

# Real speech calls allowed per day. Keeps a public demo from draining credits.
VOICE_CAP_PER_USER = int(os.getenv("VOICE_CAP_PER_USER", "40"))
VOICE_CAP_TOTAL = int(os.getenv("VOICE_CAP_TOTAL", "300"))


def today() -> date:
    return datetime.now(IST).date()
