from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

COTE_MAX = 1600
COTE_MINIATURE = 400
POIDS_MAX = 5 * 1024 * 1024
CAPTURES_MAX = 5

Image.MAX_IMAGE_PIXELS = 50_000_000


class ImageInvalide(ValueError):
    pass


def _en_webp(image, cote, qualite):
    copie = image.copy()
    copie.thumbnail((cote, cote), Image.LANCZOS)
    tampon = BytesIO()
    copie.save(tampon, "WEBP", quality=qualite, method=6)
    return tampon.getvalue()


def preparer_capture(fichier):
    nom = Path(fichier.name).name
    if fichier.size > POIDS_MAX:
        raise ImageInvalide(f"« {nom} » dépasse 5 Mo.")
    try:
        image = Image.open(fichier)
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ImageInvalide(f"« {nom} » n’est pas une image valide.")

    image = ImageOps.exif_transpose(image)
    transparente = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
    image = image.convert("RGBA" if transparente else "RGB")

    base = Path(nom).stem[:40] or "capture"
    return (
        ContentFile(_en_webp(image, COTE_MAX, 80), name=f"{base}.webp"),
        ContentFile(_en_webp(image, COTE_MINIATURE, 72), name=f"{base}.webp"),
    )
