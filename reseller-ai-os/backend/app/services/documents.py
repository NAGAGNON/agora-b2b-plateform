"""Import de factures / confirmations de commande (PDF, e-mail .eml, texte, CSV). L'extraction est « au mieux » :
rien n'est enregistré avant confirmation explicite de l'utilisateur."""
import email, io, re, uuid
from email import policy
from pathlib import Path
from pypdf import PdfReader
from sqlalchemy.orm import Session
from ..config import env
from ..core.money import D
from ..models import Document
from . import importer

MAX = 15 * 1024 * 1024
AMOUNT = r"(\d{1,3}(?:[ .]\d{3})*[.,]\d{2}|\d+[.,]\d{2})"


class DocError(ValueError):
    pass


def _money(s: str):
    s = s.replace(" ", "")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    return D(s)


def extract_text(filename: str, data: bytes) -> tuple[str, str]:
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((p.extract_text() or "") for p in reader.pages[:30])
        except Exception as e:
            raise DocError(f"PDF illisible : {e}") from e
        if not text.strip():
            raise DocError("PDF sans texte extractible (document scanné ?). Saisissez les montants manuellement.")
        return "pdf", text
    if name.endswith(".eml"):
        msg = email.message_from_bytes(data, policy=policy.default)
        body = msg.get_body(preferencelist=("plain", "html"))
        text = f"Sujet: {msg['subject']}\nDate: {msg['date']}\n" + (body.get_content() if body else "")
        return "email", text
    if name.endswith((".csv", ".tsv")):
        return "csv", data.decode("utf-8-sig", errors="replace")
    if name.endswith(".txt"):
        return "text", data.decode("utf-8", errors="replace")
    raise DocError("Format non pris en charge (PDF, .eml, .txt, .csv).")


def guess_fields(text: str) -> dict:
    out: dict = {}
    m = re.search(r"(?i:commande|order|facture|invoice)\s*(?i:n[°o]?\.?)?\s*[:#]?\s*((?=[A-Z0-9\-_/]*\d)[A-Z0-9][A-Z0-9\-_/]{4,})", text)
    if m:
        out["reference"] = m.group(1)
    totals = re.findall(r"(?:total\s*(?:ttc|à payer|a payer)?|montant\s*(?:total|ttc)?|amount due|grand total)[^\d\n]{0,25}" + AMOUNT, text, re.I)
    if totals:
        out["total"] = str(_money(totals[-1]))
    m = re.search(r"\b(\d{2}[/.-]\d{2}[/.-]\d{4}|\d{4}-\d{2}-\d{2})\b", text)
    if m:
        out["date"] = m.group(1)
    m = re.search(r"(?:suivi|tracking|colis)[^\w]{0,10}([A-Z0-9]{8,24})", text, re.I)
    if m:
        out["tracking"] = m.group(1)
    return out


def analyze(db: Session, filename: str, data: bytes) -> Document:
    if len(data) > MAX:
        raise DocError("Fichier trop volumineux (> 15 Mo).")
    kind, text = extract_text(filename, data)
    parsed: dict = {"fields": guess_fields(text), "note": "Extraction automatique indicative — vérifiez avant de confirmer."}
    if kind == "csv":
        cols, rows = importer.parse_csv(text)
        m = importer.guess_mapping(cols)
        qty_col = next((c for c in cols if c.lower() in ("quantity", "quantité", "quantite", "qty", "qte")), None)
        lines = []
        for r in rows:
            if m.get("name") and m.get("purchase_price") and r.get(m["name"]):
                try:
                    lines.append({"name": r[m["name"]], "unit_price": str(_money(str(r[m["purchase_price"]]))),
                                  "quantity": int(r[qty_col]) if qty_col and r.get(qty_col) else 1})
                except Exception:
                    continue
        parsed["lines"] = lines
        if not lines:
            parsed["note"] = f"Aucune ligne reconnue. Colonnes : {', '.join(cols)}"
    root = Path(env().storage_dir).resolve() / "documents"
    root.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^\w.\-]", "_", filename)[-80:]
    rel = f"{uuid.uuid4().hex}_{safe}"
    (root / rel).write_bytes(data)
    doc = Document(filename=filename[:300], path=rel, kind=kind, extracted_text=text[:50000], parsed=parsed)
    db.add(doc)
    db.flush()
    return doc
