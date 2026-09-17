#!/usr/bin/env python3
"""开发用静态服务器（仅本地调试，不参与扩展运行）。

它把阅读模式关心的三个 NGA 路径映射到 dev/fixtures/ 下的样例页面，
其余请求按仓库根目录提供，这样样例页面里的 /src/**.js 模块可以直接 import。

    python3 dev/server.py 8765
    然后打开 http://127.0.0.1:8765/read.php?tid=1234567
"""

import http.server
import os
import socketserver
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

# 页面路径 → 样例页面
MAPPING = {
    "/": "dev/fixtures/home.html",
    "/index.php": "dev/fixtures/home.html",
    "/thread.php": "dev/fixtures/board.html",
    "/read.php": "dev/fixtures/thread.html",
}

# 带查询参数的覆盖映射：(路径, 查询里必须出现的参数名) -> 样例页面
QUERY_MAPPING = [
    ("/read.php", "blocked", "dev/fixtures/blocked.html"),
    ("/thread.php", "blocked", "dev/fixtures/blocked.html"),
    # 合集（子版块）页：thread.php?stid=…
    ("/thread.php", "stid", "dev/fixtures/board-subset.html"),
]

# 资源前缀 → 真实目录（扩展的代码在 extension/ 下，样例页面按扩展内的路径引用）
PREFIXES = [
    ("/src/", "extension/src/"),
    ("/popup/", "extension/popup/"),
]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        override = next(
            (fixture for target, key, fixture in QUERY_MAPPING if path == target and key in query),
            None,
        )
        if override:
            self.path = "/" + override
        elif path in MAPPING:
            self.path = "/" + MAPPING[path]
        else:
            for prefix, dest in PREFIXES:
                if path.startswith(prefix):
                    self.path = "/" + dest + path[len(prefix) :]
                    break
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"dev server → http://127.0.0.1:{PORT}/  (fixtures: {', '.join(MAPPING)})")
        print(f"错误页样例 → http://127.0.0.1:{PORT}/read.php?tid=1&blocked=1")
        print(f"合集页样例 → http://127.0.0.1:{PORT}/thread.php?stid=47554235")
        httpd.serve_forever()
