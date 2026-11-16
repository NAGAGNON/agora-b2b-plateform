"""Arithmétique monétaire exacte (Decimal, arrondi commercial au centime)."""
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def D(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        value = repr(value)
    try:
        return Decimal(str(value).replace(",", ".").replace("€", "").replace(" ", "").strip())
    except InvalidOperation as e:
        raise ValueError(f"Montant invalide : {value!r}") from e


def q2(value) -> Decimal:
    return D(value).quantize(CENT, rounding=ROUND_HALF_UP)


def pct(numerator, denominator) -> Decimal | None:
    """Pourcentage à 1 décimale ; None si le dénominateur est nul."""
    d = D(denominator)
    if d == 0:
        return None
    return (D(numerator) / d * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def to_cents(value) -> int:
    return int((q2(value) * 100).to_integral_value())


def from_cents(cents: int) -> Decimal:
    return (Decimal(cents) / 100).quantize(CENT)
