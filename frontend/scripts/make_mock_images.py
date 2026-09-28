"""Generate synthetic placeholder angiogram + mask images for MOCK mode.

These are NOT real angiograms. They are drawn curves on a noisy grey field so
the frontend can be built and demoed before the real backend/models exist.

Run from the frontend/ directory:
    python3 scripts/make_mock_images.py
Outputs to public/mock/lca/ and public/mock/rca/.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SS = 2  # supersampling factor for smoother edges
OUT = Path(__file__).resolve().parent.parent / "public" / "mock"
rng = np.random.default_rng(7)

COLORS = {"LAD": (229, 72, 77), "LCX": (62, 139, 255), "RCA": (61, 179, 122)}


def spline(points, n=220):
    """Catmull-Rom spline through points (list of (x, y) in 0..1 space)."""
    pts = np.array(points, dtype=float)
    pts = np.vstack([pts[0], pts, pts[-1]])
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for t in np.linspace(0, 1, n // (len(pts) - 3), endpoint=False):
            out.append(
                0.5
                * (
                    2 * p1
                    + (-p0 + p2) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t**2
                    + (-p0 + 3 * p1 - 3 * p2 + p3) * t**3
                )
            )
    out.append(pts[-2])
    return np.array(out)


def vessel_mask(path, r0, r1):
    """Grayscale 'L' mask (0/255) of a tapered vessel along path."""
    s = SIZE * SS
    img = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(img)
    n = len(path)
    for i, (x, y) in enumerate(path):
        r = (r0 + (r1 - r0) * i / (n - 1)) * SS
        cx, cy = x * s, y * s
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def branch(path_pts, r0, r1, side_branches=()):
    """Vessel plus optional short side branches: [(t_along, dx, dy, length_pts)]."""
    main = spline(path_pts)
    m = vessel_mask(main, r0, r1)
    arr = np.array(m)
    for t, dx, dy, r in side_branches:
        i = int(t * (len(main) - 1))
        x, y = main[i]
        sub = spline([(x, y), (x + dx * 0.4, y + dy * 0.4), (x + dx, y + dy)], n=60)
        arr = np.maximum(arr, np.array(vessel_mask(sub, r, r * 0.4)))
    return Image.fromarray(arr)


def background():
    y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE
    base = 0.34 + 0.12 * np.exp(-(((x - 0.5) ** 2 + (y - 0.5) ** 2) / 0.22))
    # soft "diaphragm" and "spine" shadows for a bit of realism
    base -= 0.10 * np.exp(-(((x - 0.5) ** 2) / 0.006))
    base -= 0.14 * np.exp(-(((y - 1.02) ** 2) / 0.02))
    # heart silhouette, slightly darker
    base -= 0.08 * np.exp(-((((x - 0.48) / 0.34) ** 2 + ((y - 0.52) / 0.36) ** 2)))
    noise = rng.normal(0, 0.035, (SIZE, SIZE))
    noise = np.array(Image.fromarray((noise * 255 + 128).clip(0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.2))) / 255 - 0.5
    img = (base + noise * 0.5).clip(0, 1)
    return Image.fromarray((img * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.8))


def compose(bg, vessels):
    """Darken the background where vessels are (contrast dye is radio-opaque)."""
    arr = np.array(bg).astype(float)
    for m in vessels:
        a = np.array(m.filter(ImageFilter.GaussianBlur(1.6))).astype(float) / 255
        arr = arr * (1 - 0.82 * a) + 20 * 0.82 * a
    return Image.fromarray(arr.clip(0, 255).astype("uint8")).convert("RGB")


def rgba_mask(mask):
    """Opaque white where the artery is, fully transparent elsewhere."""
    a = mask.point(lambda v: 255 if v > 127 else 0)
    img = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    img.putalpha(a)
    return img


def overlay(original, masks):
    base = original.convert("RGBA")
    for name, m in masks.items():
        tint = Image.new("RGBA", (SIZE, SIZE), COLORS[name] + (0,))
        tint.putalpha(m.point(lambda v: 150 if v > 127 else 0))
        base = Image.alpha_composite(base, tint)
    return base.convert("RGB")


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)


def make_lca():
    lad = branch(
        [(0.36, 0.20), (0.44, 0.27), (0.55, 0.37), (0.60, 0.52), (0.55, 0.68), (0.47, 0.82)],
        11, 4,
        side_branches=[(0.35, 0.16, -0.02, 4.5), (0.55, 0.15, 0.02, 4), (0.75, 0.12, 0.01, 3.5)],
    )
    lcx = branch(
        [(0.36, 0.20), (0.30, 0.29), (0.24, 0.40), (0.22, 0.54), (0.27, 0.68), (0.34, 0.76)],
        9, 3.5,
        side_branches=[(0.4, -0.10, 0.05, 4), (0.65, -0.09, 0.07, 3.5)],
    )
    # short left-main trunk feeding both branches; drawn in LAD mask
    trunk = branch([(0.30, 0.08), (0.33, 0.14), (0.36, 0.20)], 12, 11)
    lad = Image.fromarray(np.maximum(np.array(lad), np.array(trunk)))
    original = compose(background(), [lad, lcx])
    d = OUT / "lca"
    save(original, d / "original.png")
    save(rgba_mask(lad), d / "lad.png")
    save(rgba_mask(lcx), d / "lcx.png")
    save(overlay(original, {"LAD": lad, "LCX": lcx}), d / "overlay.png")


def make_rca():
    rca = branch(
        [(0.62, 0.10), (0.66, 0.20), (0.70, 0.32), (0.66, 0.46), (0.58, 0.58), (0.50, 0.70), (0.54, 0.82)],
        10, 4,
        side_branches=[(0.3, 0.13, 0.0, 4), (0.5, 0.12, 0.03, 4), (0.8, -0.12, 0.05, 3.5)],
    )
    original = compose(background(), [rca])
    d = OUT / "rca"
    save(original, d / "original.png")
    save(rgba_mask(rca), d / "rca.png")
    save(overlay(original, {"RCA": rca}), d / "overlay.png")


if __name__ == "__main__":
    make_lca()
    make_rca()
    print("wrote", OUT)
