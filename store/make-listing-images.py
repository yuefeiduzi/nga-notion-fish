#!/usr/bin/env python3
"""生成商店列表用的品牌图（截图除外，截图是真浏览器拍的）。

    python3 store/make-listing-images.py

产物（都在 store/images/）：
    小宣传图 440×280 · Chrome 必填、Edge 可选
    Edge logo 300×300（Chromium 系的扩展图标另有 extension/icons/，由 make-icons.py 生成）

只做「品牌图」，不做截图 —— 截图要真实界面，见 store/README.md。
"""

import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from importlib import import_module

icons = import_module("make-icons")  # 复用同一枚图标的造型，保证和扩展图标一致

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "images"
TEAL = (23, 107, 117, 255)
TEAL_DARK = (12, 68, 75, 255)
INK = (255, 255, 255, 255)

FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if pathlib.Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def promotional_tile(path: pathlib.Path) -> None:
    """440×280 小宣传图：整块铺满品牌色 + 图标 + 名字（Chrome 说别放太多字，就放名字）。"""
    w, h = 440, 280
    img = Image.new("RGBA", (w, h), TEAL)
    draw = ImageDraw.Draw(img)
    # 右下角压一层深色做体积感（避免整张太平）
    draw.polygon([(w, h), (w * 0.58, h), (w, h * 0.38)], fill=TEAL_DARK)

    mark = icons.render(120).resize((104, 104), Image.LANCZOS)
    img.alpha_composite(mark, (36, 58))

    draw.text((36, 178), "NGA 阅读器", font=font(38), fill=INK)
    draw.text((38, 226), "把论坛读成资讯日报", font=font(19), fill=(214, 238, 240, 255))
    img.convert("RGB").save(path)
    print(f"写入 {path.relative_to(HERE.parent)} ({w}×{h})")


def edge_logo(path: pathlib.Path) -> None:
    """Edge 商品页的 logo：300×300，和扩展图标同一枚。"""
    size = 300
    icons.render(size).save(path)
    print(f"写入 {path.relative_to(HERE.parent)} ({size}×{size})")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    promotional_tile(OUT / "promo-440x280.png")
    edge_logo(OUT / "logo-300x300.png")


if __name__ == "__main__":
    main()
