"""Small helpers both tool sets share."""
from datetime import date, timedelta

from .registry import ToolError


def parse_date(value: str | None, default: date) -> date:
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ToolError(f"'{value}' is not a date. Use YYYY-MM-DD.")


def school_days(start: date, end: date) -> list[date]:
    """Monday to Saturday between start and end, both included."""
    days, d = [], start
    while d <= end:
        if d.weekday() != 6:
            days.append(d)
        d += timedelta(days=1)
    return days


def next_school_day(d: date) -> date:
    d += timedelta(days=1)
    return d + timedelta(days=1) if d.weekday() == 6 else d


def rupees(n: int) -> str:
    return f"₹{n:,}"
