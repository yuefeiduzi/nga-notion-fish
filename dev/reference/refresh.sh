#!/usr/bin/env bash
# 重新从 GreasyFork 拉取 dev/reference 里的参考脚本
#
#   bash dev/reference/refresh.sh          # 走本机代理 127.0.0.1:7897
#   PROXY= bash dev/reference/refresh.sh   # 直连
#
# GreasyFork 的 raw 地址形如：https://update.greasyfork.org/scripts/<id>/<名称>.user.js
# 注意：必须先访问 /zh-CN/scripts/<id>-<slug>/code（带 slug），否则会 301 后拿不到 raw 链接。

set -euo pipefail

PROXY="${PROXY-http://127.0.0.1:7897}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURL=(curl -sSL --fail -m 60)
[ -n "$PROXY" ] && CURL+=(-x "$PROXY")

# id|输出文件名|脚本页 slug（slug 随便写，只要存在即可）
ENTRIES=(
    "393991|nga-optimize__393991.user.js|nga-%E4%BC%98%E5%8C%96%E6%91%B8%E9%B1%BC%E4%BD%93%E9%AA%8C"
    "389620|nga-filter__389620.user.js|nga-filter"
    "416741|nga-userinfo-enhance__416741.user.js|nga-userinfo-enhance"
    "23009|nga-auto-pager-v2__23009.user.js|nga-auto-pager-v2"
    "491021|nga-dark-clean-mode__491021.user.js|nga-dark-clean-mode"
    "482017|nga-fast-view-post-fix__482017.user.js|nga-fast-view-post-fix"
    "40576|nga-excel__40576.user.js|nga-excel"
    "386552|nga-plus-plus__386552.user.js|nga-plus"
)

for entry in "${ENTRIES[@]}"; do
    IFS='|' read -r id out slug <<<"$entry"
    page=$("${CURL[@]}" "https://greasyfork.org/zh-CN/scripts/$id-$slug/code" || true)
    raw=$(printf '%s' "$page" | grep -oE 'https://update\.greasyfork\.org/scripts/[^"]+' | head -1 || true)

    if [ -z "$raw" ]; then
        printf '%-40s 跳过（没找到 raw 链接，可能脚本已改名/删除）\n' "$out"
        continue
    fi

    if "${CURL[@]}" -o "$DIR/$out" "$raw"; then
        printf '%-40s %s bytes\n' "$out" "$(wc -c <"$DIR/$out" | tr -d ' ')"
    else
        printf '%-40s 下载失败\n' "$out"
    fi
done

echo "完成。用 git diff 看看上游选择器有没有变化。"
