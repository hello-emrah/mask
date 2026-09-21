"""Draws the Mask seal as flat geometry and writes logo.png plus the favicon ladder.

One colour, transparent ground: a carved face with a long slit for the eyes and a
short one for the mouth. Run from the repo root: python3 assets/seal.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = (0xA0, 0x72, 0x4A, 255)  # walnut
SIZE = 512
SS = 4  # supersample, then downscale for clean edges
FILL = 0.84  # longest extent of the glyph as a share of the canvas

def draw(size):
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = big / 2
    h = big * FILL / 2          # half height, the longest extent
    w = h * 0.74                # half width at the brow
    # An egg, wider at the brow and drawn in to the chin.
    pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720
        x = cx + w * math.sin(t) * (1 + 0.20 * math.cos(t))
        y = cy - h * math.cos(t)
        pts.append((x, y))
    d.polygon(pts, fill=ACCENT)

    def slit(y_centre, half_w, half_h):
        box = [cx - half_w, y_centre - half_h, cx + half_w, y_centre + half_h]
        d.rounded_rectangle(box, radius=half_h, fill=(0, 0, 0, 0))

    slit(cy - h * 0.20, w * 0.74, h * 0.085)   # the eyes, one bar
    slit(cy + h * 0.46, w * 0.30, h * 0.060)   # the mouth
    return img.resize((size, size), Image.LANCZOS)

out = Path(__file__).parent
master = draw(SIZE)
master.save(out / "logo.png")
master.save(out / "icon-512.png")
for s in (256, 180, 128, 64, 32):
    master.resize((s, s), Image.LANCZOS).save(out / f"icon-{s}.png")
print("seal written")
