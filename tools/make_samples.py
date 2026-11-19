#!/usr/bin/env python3
"""Draws the three bundled sample scenes for Leonida Cover Lab with PIL.

Original flat-illustration scenes, drawn from primitives (no photos, no
third-party art): a neon boulevard at sunset, a wooden pier over turquoise
water, and a palm beach. They ship under app/samples/ so the app can compose
a finished cover the moment it opens, and so the ?shot= scenes are
deterministic.

Run:  python3 tools/make_samples.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

W, H = 1200, 900
OUT = os.path.join(os.path.dirname(__file__), "..", "app", "samples")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(img, stops):
    """Vertical gradient from (pos, colour) stops."""
    px = img.load()
    for y in range(img.height):
        t = y / max(1, img.height - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                col = lerp(c0, c1, 0 if p1 == p0 else (t - p0) / (p1 - p0))
                break
        else:
            col = stops[-1][1]
        for x in range(img.width):
            px[x, y] = col
    return img


def sun(draw, cx, cy, r, top, bottom, stripe_col=None, stripes=0):
    """A retro sun disc, optionally cut by horizontal stripes near its base."""
    for i in range(r * 2):
        t = i / (2 * r)
        col = lerp(top, bottom, t)
        y = cy - r + i
        half = int(math.sqrt(max(0, r * r - (i - r) ** 2)))
        draw.line([(cx - half, y), (cx + half, y)], fill=col)
    if stripes:
        for i in range(stripes):
            y = cy + int(r * (0.25 + 0.16 * i))
            h = 4 + i * 3
            draw.rectangle([cx - r, y, cx + r, y + h], fill=stripe_col)


def _curve(draw, pts, col, width):
    """A thick polyline through pts, drawn as overlapping discs so it never gaps."""
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=col, width=width)
    for px_, py_ in pts:
        r = width // 2
        draw.ellipse([px_ - r, py_ - r, px_ + r, py_ + r], fill=col)


def palm(draw, x, y, s, col, lean=0.35):
    """A palm silhouette: a curved trunk and seven drooping fronds. s is the height."""
    top_x = x + int(s * lean)
    top_y = y - s
    trunk = []
    for i in range(17):
        t = i / 16
        trunk.append((int(x + (top_x - x) * t + math.sin(t * 2.4) * s * 0.045),
                      int(y - s * t)))
    _curve(draw, trunk, col, max(5, s // 26))
    for ang in (-168, -132, -96, -58, -22, 12, 44):
        rad = math.radians(ang)
        ln = s * (0.5 + 0.08 * math.cos(ang))
        pts = []
        for i in range(13):
            t = i / 12
            fx = top_x + math.cos(rad) * ln * t
            fy = top_y + math.sin(rad) * ln * 0.42 * t + s * 0.22 * t * t
            pts.append((int(fx), int(fy)))
        _curve(draw, pts, col, max(4, s // 45))
    draw.ellipse([top_x - 8, top_y - 4, top_x + 8, top_y + 12], fill=col)


def grain(img, amount=7, seed=7):
    rnd = random.Random(seed)
    noise = Image.effect_noise(img.size, 18).convert("L")
    px = img.load()
    nz = noise.load()
    for yy in range(0, img.height, 2):
        for xx in range(0, img.width, 2):
            d = (nz[xx, yy] - 128) * amount // 128
            for dy in (0, 1):
                for dx in (0, 1):
                    if xx + dx < img.width and yy + dy < img.height:
                        r, g, b = px[xx + dx, yy + dy]
                        px[xx + dx, yy + dy] = (max(0, min(255, r + d)),
                                                max(0, min(255, g + d)),
                                                max(0, min(255, b + d)))
    return img


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    img.save(path, "JPEG", quality=84)
    print("wrote", path, os.path.getsize(path), "bytes")


def boulevard():
    img = Image.new("RGB", (W, H))
    vgrad(img, [(0.0, (38, 16, 74)), (0.35, (104, 32, 116)),
                (0.58, (214, 51, 132)), (0.72, (255, 110, 84)),
                (0.8, (255, 176, 102)), (1.0, (24, 10, 40))])
    d = ImageDraw.Draw(img, "RGBA")
    sun(d, 600, 470, 235, (255, 214, 120), (255, 94, 98),
        stripe_col=(150, 40, 110), stripes=4)
    # skyline
    rnd = random.Random(11)
    for layer, (base, col) in enumerate([(560, (30, 14, 54)), (600, (18, 8, 36))]):
        x = -20
        while x < W + 20:
            bw = rnd.randint(55, 120)
            bh = rnd.randint(120, 300) + layer * 30
            d.rectangle([x, base - bh, x + bw, base + 160], fill=col)
            for wy in range(base - bh + 14, base - 6, 24):
                for wx in range(x + 9, x + bw - 9, 18):
                    if rnd.random() < 0.42:
                        d.rectangle([wx, wy, wx + 7, wy + 10],
                                    fill=(255, 196, 110) if rnd.random() < 0.7 else (120, 240, 255))
            x += bw + rnd.randint(4, 22)
    # road with perspective and neon sheen
    horizon = 640
    d.polygon([(0, H), (430, horizon), (770, horizon), (W, H)], fill=(26, 12, 34))
    for i in range(9):
        t = i / 8
        y = horizon + (H - horizon) * (t ** 1.7)
        d.line([(0, y), (W, y)], fill=(255, 90, 160, int(26 + 60 * t)), width=2)
    for i in range(-3, 4):
        d.line([(600 + i * 26, horizon), (600 + i * 190, H)],
               fill=(255, 190, 90, 60), width=3)
    # streetlight glows
    for x, y, s in [(120, 560, 90), (1050, 545, 110), (255, 610, 60), (950, 615, 64)]:
        glow = Image.new("RGBA", (s * 2, s * 2), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([0, 0, s * 2, s * 2], fill=(255, 120, 200, 90))
        glow = glow.filter(ImageFilter.GaussianBlur(s // 3))
        img.paste(glow, (x - s, y - s), glow)
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(255, 220, 250))
    palm(d, 92, 700, 300, (12, 5, 24), lean=0.3)
    palm(d, 1115, 715, 330, (12, 5, 24), lean=-0.32)
    palm(d, 210, 660, 200, (16, 7, 30), lean=0.42)
    return grain(img, 6, 3)


def pier():
    img = Image.new("RGB", (W, H))
    vgrad(img, [(0.0, (64, 130, 200)), (0.3, (120, 190, 225)),
                (0.46, (255, 196, 130)), (0.55, (64, 196, 205)),
                (0.75, (28, 160, 180)), (1.0, (14, 110, 140))])
    d = ImageDraw.Draw(img, "RGBA")
    sun(d, 880, 330, 120, (255, 226, 150), (255, 150, 90))
    # distant headland
    d.polygon([(0, 470), (180, 415), (420, 452), (560, 470), (0, 500)], fill=(40, 110, 120))
    # sea sparkle
    rnd = random.Random(5)
    for _ in range(240):
        y = rnd.randint(500, 880)
        x = rnd.randint(0, W)
        ln = rnd.randint(6, 30)
        d.line([(x, y), (x + ln, y)], fill=(255, 255, 255, rnd.randint(40, 120)), width=2)
    # pier deck in perspective
    deck = [(300, H), (520, 500), (700, 500), (1020, H)]
    d.polygon(deck, fill=(122, 79, 48))
    for i in range(13):
        t = i / 12
        y = 500 + (H - 500) * (t ** 1.6)
        lx = 520 - (520 - 300) * ((y - 500) / (H - 500))
        rx = 700 + (1020 - 700) * ((y - 500) / (H - 500))
        d.line([(lx, y), (rx, y)], fill=(84, 52, 30), width=max(2, int(2 + t * 5)))
    d.line([(520, 500), (300, H)], fill=(70, 42, 24), width=6)
    d.line([(700, 500), (1020, H)], fill=(70, 42, 24), width=6)
    # posts and rails
    for t in (0.06, 0.3, 0.58, 0.9):
        y = 500 + (H - 500) * (t ** 1.6)
        lx = 520 - 220 * ((y - 500) / (H - 500))
        rx = 700 + 320 * ((y - 500) / (H - 500))
        ph = 30 + t * 90
        d.line([(lx, y - ph), (lx, y + 26)], fill=(60, 36, 20), width=max(3, int(4 + t * 7)))
        d.line([(rx, y - ph), (rx, y + 26)], fill=(60, 36, 20), width=max(3, int(4 + t * 7)))
    d.line([(520, 470), (300, 830)], fill=(60, 36, 20), width=5)
    d.line([(700, 470), (1020, 830)], fill=(60, 36, 20), width=5)
    # lifeguard stand silhouette at the pier head
    d.polygon([(560, 500), (660, 500), (646, 428), (574, 428)], fill=(150, 44, 66))
    d.polygon([(548, 428), (672, 428), (640, 392), (580, 392)], fill=(178, 52, 78))
    d.rectangle([596, 446, 624, 486], fill=(255, 214, 150))
    # birds
    for x, y, s in [(240, 150, 16), (300, 120, 12), (180, 190, 11)]:
        d.arc([x - s, y - s // 2, x, y + s // 2], 200, 330, fill=(20, 40, 60), width=3)
        d.arc([x, y - s // 2, x + s, y + s // 2], 210, 340, fill=(20, 40, 60), width=3)
    return grain(img, 5, 9)


def beach():
    img = Image.new("RGB", (W, H))
    vgrad(img, [(0.0, (58, 140, 215)), (0.34, (140, 205, 235)),
                (0.44, (178, 232, 228)), (0.52, (64, 200, 195)),
                (0.66, (120, 220, 200)), (0.74, (250, 226, 168)),
                (1.0, (238, 200, 132))])
    d = ImageDraw.Draw(img, "RGBA")
    sun(d, 250, 170, 88, (255, 232, 160), (255, 180, 100))
    # soft clouds
    for cx, cy, s in [(760, 120, 60), (880, 150, 44), (520, 90, 38), (1020, 80, 52)]:
        for dx, dy, r in [(0, 0, s), (-s // 2, 8, s // 2), (s // 2, 10, s // 2 + 6)]:
            d.ellipse([cx + dx - r, cy + dy - r // 2, cx + dx + r, cy + dy + r // 2],
                      fill=(255, 255, 255, 170))
    # foam lines where sea meets sand
    for i, y in enumerate((655, 690, 726)):
        pts = [(x, y + int(7 * math.sin(x / 90 + i * 2))) for x in range(0, W + 40, 40)]
        d.line(pts, fill=(255, 255, 255, 200 - i * 30), width=5 - i)
    # umbrella
    ux, uy = 830, 700
    d.line([(ux, uy), (ux + 26, uy + 130)], fill=(90, 60, 40), width=7)
    for i, col in enumerate([(255, 92, 132), (255, 240, 245)] * 3):
        a0 = math.pi * (1.02 + i * 0.16)
        a1 = math.pi * (1.02 + (i + 1) * 0.16)
        d.polygon([(ux, uy), (ux + int(150 * math.cos(a0)), uy + int(58 * math.sin(a0)) + 34),
                   (ux + int(150 * math.cos(a1)), uy + int(58 * math.sin(a1)) + 34)], fill=col)
    d.ellipse([ux - 60, uy + 118, ux + 90, uy + 138], fill=(214, 178, 118))
    # palms framing both sides
    palm(d, 36, 890, 520, (18, 74, 44), lean=0.22)
    palm(d, 1176, 880, 540, (16, 66, 40), lean=-0.2)
    palm(d, 120, 850, 330, (24, 92, 54), lean=0.3)
    # sparkles on the water
    rnd = random.Random(21)
    for _ in range(160):
        y = rnd.randint(480, 640)
        x = rnd.randint(0, W)
        d.line([(x, y), (x + rnd.randint(5, 22), y)], fill=(255, 255, 255, rnd.randint(50, 130)), width=2)
    return grain(img, 5, 14)


if __name__ == "__main__":
    save(boulevard(), "boulevard.jpg")
    save(pier(), "pier.jpg")
    save(beach(), "beach.jpg")
