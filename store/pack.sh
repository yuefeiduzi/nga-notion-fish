#!/usr/bin/env bash
# 打包上架用的 zip。
#
#   bash store/pack.sh          # 产物：dist/nga-reader-<版本>.zip
#
# 两家商店都是直接上传这个 zip：包里就是 extension/ 下的文件，manifest.json 在**根目录**
# （别把 extension/ 这一层也打进去，这是最常见的低级错误）。
# 打包前建议先在 chrome://extensions 里重新加载、把 dev/README.md 里的自检过一遍。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" "$ROOT/extension/manifest.json")"
OUT="$ROOT/dist/nga-reader-$VERSION.zip"

mkdir -p "$ROOT/dist"
rm -f "$OUT"

# 整个 extension/ 都要进包（没有构建步骤，源码就是产物）；只排掉系统垃圾文件
(cd "$ROOT/extension" && zip -qr "$OUT" . -x '*.DS_Store' -x '__MACOSX/*')

echo "版本   $VERSION"
echo "产物   ${OUT#"$ROOT/"}"
echo "大小   $(du -h "$OUT" | cut -f1)"
echo "--- 包内文件 ---"
unzip -l "$OUT" | sed -n '4,$p'
