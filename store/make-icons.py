#!/usr/bin/env python3
"""生成扩展图标（extension/icons/*.png）。

图标要跟「应急伪装」时替换的 favicon 同一枚：青色圆角方块 + 白色文稿 + 三条横线
（同一个造型在 `extension/src/app.js` 的 DARK_FAVICON 里是内联 SVG）。
**不要**用 NGA 官方的图标或素材 —— 这是第三方工具，用官方图会有商标/冒充风险。

用法：
    python3 store/make-icons.py          # 需要 Pillow（pip install pillow）
"""

import pathlib
from PIL import Image, ImageDraw

# 与 DARK_FAVICON 的 SVG viewBox（32 单位）一一对应
UNIT = 32
BG = (23, 107, 117, 255)          # --ng-accent 系（#176b75）
PAPER = (255, 255, 255, 235)
LINE = (23, 107, 117, 255)
PAPER_BOX = (9, 8, 23, 24)        # 文稿矩形
LINE_X = ((13, 20), (13, 20), (13, 17))
LINE_Y = (13, 17, 21)
SUPERSAMPLE = 8                   # 先画大图再缩，得到抗锯齿边缘
ARTWORK_RATIO = 0.88              # 四周留一点透明边（Chrome 图标规范的建议）


def render(size: int) -> Image.Image:
    scale = size * SUPERSAMPLE / UNIT
    canvas = Image.new("RGBA", (size * SUPERSAMPLE, size * SUPERSAMPLE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    pad = (1 - ARTWORK_RATIO) / 2 * UNIT
    box = [pad * scale, pad * scale, (UNIT - pad) * scale, (UNIT - pad) * scale]
    draw.rounded_rectangle(box, radius=6.4 * scale, fill=BG)

    px = [PAPER_BOX[0] * scale, PAPER_BOX[1] * scale, PAPER_BOX[2] * scale, PAPER_BOX[3] * scale]
    draw.rounded_rectangle(px, radius=2.6 * scale, fill=PAPER)
    # 右上 / 左下两个圆角是 SVG 里用弧线做的，这里用小方块补平
    draw.rectangle([px[0], px[1], px[0] + 2.6 * scale, px[3]], fill=PAPER)
    draw.rectangle([px[0], px[3] - 2.6 * scale, px[2], px[3]], fill=PAPER)

    for (x1, x2), y in zip(LINE_X, LINE_Y):
        draw.rounded_rectangle(
            [x1 * scale, (y - 0.6) * scale, x2 * scale, (y + 0.6) * scale],
            radius=0.6 * scale,
            fill=LINE,
        )

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = pathlib.Path(__file__).resolve().parent.parent / "extension" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = out / f"{size}.png"
        render(size).save(path)
        print(f"写入 {path.relative_to(path.parents[2])} ({size}×{size})")


if __name__ == "__main__":
    main()
