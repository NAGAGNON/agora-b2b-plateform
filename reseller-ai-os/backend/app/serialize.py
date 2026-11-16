from datetime import datetime
from decimal import Decimal
from sqlalchemy import inspect


def ser(obj, **extra) -> dict:
    out = {}
    for c in inspect(obj).mapper.column_attrs:
        v = getattr(obj, c.key)
        if isinstance(v, Decimal):
            v = float(v)
        out[c.key] = v
    out.update(extra)
    return out


def js(v):
    """Rend un résultat de service JSON-compatible (Decimal → float)."""
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return {k: js(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [js(x) for x in v]
    return v
