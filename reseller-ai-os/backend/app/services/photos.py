"""Préparation d'images : recadrage, luminosité, contraste, couleur, rotation, visuel de présentation étiqueté.
Le détourage d'arrière-plan n'est PAS fourni (aucun service/modèle autorisé configuré) ; il n'est jamais simulé."""
import io, uuid
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session
from ..config import env
from ..models import InventoryItem, ItemPhoto

MAX_BYTES = 15 * 1024 * 1024
MAX_SIDE = 2000
CAPABILITIES = {"crop": True, "rotate": True, "brightness": True, "contrast": True, "color": True, "auto_enhance": True,
                "reorder": True, "presentation_visual": True, "background_removal": False}


class PhotoError(ValueError):
    pass


def root() -> Path:
    p = Path(env().storage_dir).resolve() / "photos"
    p.mkdir(parents=True, exist_ok=True)
    return p


def full_path(rel: str) -> Path:
    p = (root() / rel).resolve()
    if root() not in p.parents:
        raise PhotoError("Chemin invalide.")
    return p


def _load(data: bytes) -> Image.Image:
    if len(data) > MAX_BYTES:
        raise PhotoError("Image trop volumineuse (> 15 Mo).")
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError) as e:
        raise PhotoError("Fichier image invalide.") from e
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    return img


def _save(db: Session, item: InventoryItem, img: Image.Image, *, kind, real, label=None) -> ItemPhoto:
    rel = f"{item.id}/{uuid.uuid4().hex}.jpg"
    path = root() / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", quality=88, optimize=True)
    pos = (max([p.position for p in item.photos], default=-1)) + 1
    ph = ItemPhoto(item_id=item.id, path=rel, kind=kind, is_real_photo=real, label=label, position=pos)
    db.add(ph)
    db.flush()
    db.refresh(item)
    return ph


def add_photo(db: Session, item: InventoryItem, data: bytes, label=None) -> ItemPhoto:
    return _save(db, item, _load(data), kind="real", real=True, label=label)


def edit_photo(db: Session, item: InventoryItem, photo: ItemPhoto, *, rotate=0, crop=None, brightness=1.0, contrast=1.0, color=1.0,
               auto=False, replace=False) -> ItemPhoto:
    """crop = (left, top, right, bottom) en fractions 0-1. Crée une copie « retouchée » (l'original est conservé)."""
    if photo.item_id != item.id:
        raise PhotoError("Photo d'un autre article.")
    img = Image.open(full_path(photo.path)).convert("RGB")
    if rotate:
        img = img.rotate(-int(rotate), expand=True)
    if crop:
        l, t, r, b = [float(x) for x in crop]
        if not (0 <= l < r <= 1 and 0 <= t < b <= 1):
            raise PhotoError("Zone de recadrage invalide.")
        w, h = img.size
        img = img.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    if auto:
        img = ImageOps.autocontrast(img, cutoff=1)
    for enhancer, val in ((ImageEnhance.Brightness, brightness), (ImageEnhance.Contrast, contrast), (ImageEnhance.Color, color)):
        v = float(val)
        if not 0.2 <= v <= 3:
            raise PhotoError("Réglage hors limites (0,2 à 3).")
        if v != 1.0:
            img = enhancer(img).enhance(v)
    return _save(db, item, img, kind="edited", real=photo.is_real_photo, label=(photo.label or "") + " (retouchée)")


def presentation_visual(db: Session, item: InventoryItem, source: ItemPhoto, text: str | None = None) -> ItemPhoto:
    """Visuel de présentation (jamais une photo réelle) : l'image réelle sur fond neutre, bandeau explicite."""
    img = Image.open(full_path(source.path)).convert("RGB")
    canvas = Image.new("RGB", (1200, 1200), (245, 246, 244))
    img.thumbnail((1000, 960))
    canvas.paste(img, ((1200 - img.width) // 2, 60))
    d = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 34)
    except OSError:
        font = ImageFont.load_default()
    d.rectangle([0, 1120, 1200, 1200], fill=(22, 101, 52))
    d.text((30, 1140), text or "VISUEL DE PRÉSENTATION — non contractuel, voir photos réelles", fill=(255, 255, 255), font=font)
    return _save(db, item, canvas, kind="presentation", real=False, label="Visuel de présentation")


def reorder(db: Session, item: InventoryItem, ids: list[int]):
    by = {p.id: p for p in item.photos}
    if set(ids) != set(by):
        raise PhotoError("La liste doit contenir exactement les photos de l'article.")
    for pos, pid in enumerate(ids):
        by[pid].position = pos
    db.flush()


def delete_photo(db: Session, photo: ItemPhoto):
    try:
        full_path(photo.path).unlink(missing_ok=True)
    except PhotoError:
        pass
    db.delete(photo)
    db.flush()
