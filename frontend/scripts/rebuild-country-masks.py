#!/usr/bin/env python3
"""Regenera las siluetas de los países en alta resolución.

Los GIFs originales del TEGNet (VB6) están pensados para un tablero de
593x380 px y se ven escalonados al agrandarlos. Este script los rehace como
PNGs suavizados y con antialiasing, manteniendo el mismo encuadre (bounding
box) de cada país, para que las coordenadas de TegMap.tsx sigan valiendo.

Para que las fronteras entre países vecinos sigan encajando (sin huecos ni
superposiciones), no se suaviza cada GIF por separado: se arma el tablero
completo como un mapa de etiquetas (cada pixel -> id de país), se suaviza
todo junto y cada pixel queda para el país con mayor peso. Así lo que un
país gana en una frontera lo pierde exactamente el vecino.

Entrada:  public/map/countries/{id}.gif (originales del VB, se conservan)
          ../TegNet/frmMapa.frm         (posición de cada objPais(id))
Salida:   public/map/countries/{id}.png

Uso (desde frontend/):
    python3 scripts/rebuild-country-masks.py [--scale 8] [--sigma 0.8]

Requiere numpy y Pillow.
"""

import argparse
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
COUNTRIES_DIR = ROOT / "public/map/countries"
FRM_PATH = ROOT.parent / "TegNet/frmMapa.frm"

BOARD_W, BOARD_H = 593, 380
TWIPS_PER_PIXEL = 15
COUNTRY_COUNT = 50

# Tierras que no estaban en los GIFs del VB, en coordenadas del tablero.
# "width" amplía la caja del país para que entren (actualizar `w` en TegMap.tsx).
EXTRA_LAND = {
    # Argentina: Islas Malvinas (Gran Malvina y Soledad)
    1: {
        "width": 39,
        "polygons": [
            [(207.5, 349.0), (210.0, 347.2), (212.6, 347.6), (213.4, 349.6),
             (212.2, 352.2), (210.6, 354.4), (208.4, 354.0), (207.2, 351.6)],
            [(214.6, 348.4), (217.4, 347.0), (220.6, 347.8), (222.6, 350.0),
             (221.8, 352.8), (219.4, 355.4), (216.6, 355.6), (215.6, 353.4), (214.4, 351.0)],
        ],
    },
}


def read_positions() -> dict[int, tuple[int, int]]:
    """Lee Left/Top (twips) de cada objPais(i) del formulario VB."""
    text = FRM_PATH.read_text(encoding="latin-1")
    positions = {}
    for block in re.findall(r"Begin TegNet\.ctlPais objPais(.*?)\n   End", text, re.S):
        props = dict(re.findall(r"^\s+(\w+)\s+=\s+(-?\d+)", block, re.M))
        index = int(props["Index"])
        if 1 <= index <= COUNTRY_COUNT:
            positions[index] = (
                int(props["Left"]) // TWIPS_PER_PIXEL,
                int(props["Top"]) // TWIPS_PER_PIXEL,
            )
    missing = set(range(1, COUNTRY_COUNT + 1)) - positions.keys()
    if missing:
        raise SystemExit(f"Faltan posiciones en frmMapa.frm para: {sorted(missing)}")
    return positions


def opaque_mask(path: Path) -> np.ndarray:
    """Pixeles no transparentes de un GIF (True = parte del país)."""
    return np.array(Image.open(path).convert("RGBA"))[:, :, 3] > 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--scale", type=int, default=8, help="factor de escala de salida (default 8)")
    parser.add_argument(
        "--sigma",
        type=float,
        default=0.8,
        help="suavizado en pixeles del tablero original; más alto = más redondeado (default 0.8)",
    )
    args = parser.parse_args()

    # Se trabaja al doble de la escala de salida y luego se reduce: eso da el antialiasing.
    work = args.scale * 2
    positions = read_positions()

    # 1) Tablero de etiquetas en resolución original (0 = océano)
    labels = np.zeros((BOARD_H, BOARD_W), dtype=np.uint8)
    boxes = {}
    for cid, (x, y) in positions.items():
        mask = opaque_mask(COUNTRIES_DIR / f"{cid}.gif")
        h, w = mask.shape
        region = labels[y : y + h, x : x + w]
        region[mask[: region.shape[0], : region.shape[1]]] = cid
        boxes[cid] = (x, y, w, h)

    # 2) Suavizado conjunto: peso de cada país, acumulado sobre todo el tablero
    H, W = BOARD_H * work, BOARD_W * work
    best = np.zeros((H, W), dtype=np.uint8)  # mayor peso visto por pixel
    owner = np.zeros((H, W), dtype=np.uint8)  # país con ese peso
    total = np.zeros((H, W), dtype=np.uint16)  # suma de pesos (tierra vs. océano)
    pad = int(np.ceil(args.sigma * 4)) + 1
    radius = args.sigma * work

    for cid, (x, y, w, h) in boxes.items():
        x0, y0 = max(x - pad, 0), max(y - pad, 0)
        x1, y1 = min(x + w + pad, BOARD_W), min(y + h + pad, BOARD_H)
        indicator = Image.fromarray(((labels[y0:y1, x0:x1] == cid) * 255).astype(np.uint8))
        indicator = indicator.resize(((x1 - x0) * work, (y1 - y0) * work), Image.NEAREST)
        weight = np.array(indicator.filter(ImageFilter.GaussianBlur(radius)))

        sl = (slice(y0 * work, y1 * work), slice(x0 * work, x1 * work))
        wins = weight > best[sl]
        best[sl][wins] = weight[wins]
        owner[sl][wins] = cid
        total[sl] += weight

    land = total >= 128

    # Tierras extra: se dibujan directamente a la resolución de trabajo
    for cid, extra in EXTRA_LAND.items():
        x, y, w, h = boxes[cid]
        boxes[cid] = (x, y, max(w, extra["width"]), h)
        canvas = Image.new("L", (W, H), 0)
        draw = ImageDraw.Draw(canvas)
        for poly in extra["polygons"]:
            draw.polygon([(px * work, py * work) for px, py in poly], fill=255)
        painted = np.array(canvas) > 0
        owner[painted] = cid
        land[painted] = True

    # 3) Recorte por país, reducción a la escala final y guardado
    s = args.scale
    for cid, (x, y, w, h) in boxes.items():
        sl = (slice(y * work, (y + h) * work), slice(x * work, (x + w) * work))
        shape = ((owner[sl] == cid) & land[sl]).astype(np.uint8) * 255
        alpha = Image.fromarray(shape).resize((w * s, h * s), Image.BOX)
        out = Image.new("RGBA", alpha.size, (255, 255, 255, 0))
        out.putalpha(alpha)
        out.save(COUNTRIES_DIR / f"{cid}.png", optimize=True)

    print(f"{len(boxes)} siluetas generadas en {COUNTRIES_DIR} (x{s}, sigma {args.sigma})")


if __name__ == "__main__":
    main()
