"""Frontières de jours/semaines/mois dans le fuseau de l'utilisateur (stockage en UTC)."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from ..config import env


def tz() -> ZoneInfo:
    return ZoneInfo(env().timezone)


def local(dt: datetime) -> datetime:
    return dt.astimezone(tz())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def start_of_day(dt: datetime) -> datetime:
    l = local(dt)
    return l.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def start_of_week(dt: datetime) -> datetime:
    l = local(dt)
    d = l.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=l.weekday())
    return d.astimezone(timezone.utc)


def month_start(year: int, month: int) -> datetime:
    return datetime(year, month, 1, tzinfo=tz()).astimezone(timezone.utc)


def start_of_month(dt: datetime) -> datetime:
    l = local(dt)
    return month_start(l.year, l.month)


def next_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + delta
    return idx // 12, idx % 12 + 1


def month_range(year: int, month: int) -> tuple[datetime, datetime]:
    ny, nm = next_month(year, month)
    return month_start(year, month), month_start(ny, nm)


def month_key(dt: datetime) -> str:
    l = local(dt)
    return f"{l.year}-{l.month:02d}"
