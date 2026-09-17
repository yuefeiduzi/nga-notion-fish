# dev/ —— 本地调试与参考资料

> **只在改代码时需要这里。** 单纯想用扩展：把 `extension/` 装进 Chrome（见仓库 [README](../README.md)）。
> 这里提供的是「没有 NGA 登录态也能改解析与排版」的环境：样例页的 URL 长得像 NGA（`/read.php`），
> 而且引用的就是 `extension/src/**` 的真实代码与 CSS，不存在第二份拷贝。

`extension/` 是产物，`dev/` 是干活的地方。这里不需要 NGA 账号就能跑通整套解析 + 排版。

## 1. 假 NGA 页面 + 静态服务器

```bash
python3 dev/server.py 8765
# 首页     http://127.0.0.1:8765/
# 板块页   http://127.0.0.1:8765/thread.php?fid=-7
# 帖子页   http://127.0.0.1:8765/read.php?tid=1234567
```

服务器把这三个 NGA 路径映射到 `dev/fixtures/*.html`，其余请求按仓库根目录提供，
并把 `/src/**`、`/popup/**` 指到 `extension/` 下 —— 所以样例页面里引用的是**扩展的真实代码和真实 CSS**。

样例页面用 `dev/harness-boot.js` 代替 `extension/src/boot.js` 启动：
它给 `chrome.storage` 打了个 localStorage 版模拟，然后走与扩展完全相同的
`boot → app.js → parse → sanitize → view` 路径。

| 文件 | 说明 |
| --- | --- |
| `fixtures/thread.html` | 按真实 read.php 仿写：`#m_posts > #m_posts_c > table.forumbox.postbox > tr.row1`，`td.c1 .posterInfoLine .author`，`td.c2 #postsubject{N}` / `#postcontent{N}` / `#postdate{N}` / `.stat > .recommendvalue`；含引用、嵌套引用、表格、代码块、折叠块、表情、懒加载图片、签名、贴条 |
| `fixtures/smile_ac11.png`、`fixtures/post/smile/ac15.png` | 表情样例（69×60，与真实 NGA 表情同尺寸）。一个靠 `class="smile_ac"` 认，一个只能靠 `/post/smile/` 地址认；页面底部还会模仿原站 JS 往图上写内联 `max-width:990px`/`min-width`/描边（真机就是这个把图撑到比正文栏宽的），用来回归验证 `app.css` 里的 `!important`；加 `?noadj=1` 可跳过这段模拟 |
| `fixtures/board.html` | 按真实 thread.php 仿写：`#topicrows > table.forumbox > tr.row1/.row2 > td.c1~c4`，`a.topic`、`span[class^=t_k_]`、`a.author`、`span.silver.postdate` |
| `fixtures/home.html` | `.catenew > .catetitle` + `a[href*=fid=]` |
| `fixtures/blocked.html` | 模仿 NGA 拒绝访客的 `(ERROR:15)` 页面，用 `?blocked=1` 触发，用来验证兜底界面与「复制诊断」 |

两个页面底部都会伪造 NGA 自己挂在 window 上的数据
（`commonui.postArg` / `commonui.topicArg` / `__PAGE`），用来验证「优先读站点数据」这条路径。
**加上 `?nopostarg=1` 就跳过伪造，强制走选择器兜底路径** —— 改解析后两条都要跑：

```
http://127.0.0.1:8765/read.php?tid=1234567&nopostarg=1
http://127.0.0.1:8765/thread.php?fid=-7&nopostarg=1
http://127.0.0.1:8765/read.php?tid=1234567&blocked=1   # 未登录/权限不足的兜底页
```

改 fixtures 的规矩：只加**真实存在**的类名/层级（出处见 `nga-dom-notes.md`），
不要为了好看编一个 NGA 没有的结构，否则测出来的通过是假的。

## 2. 参考资料

- [`nga-dom-notes.md`](nga-dom-notes.md) —— NGA 三类页面的真实结构、站点全局数据字段、已知坑，每条都带出处。
- [`reference/`](reference/) —— 8 个第三方 NGA 用户脚本源码（含最权威的《NGA优化摸鱼体验》），
  改选择器时用来核对；**不参与构建，不要 import**。`reference/refresh.sh` 可重新拉取。

## 3. 在真浏览器里看效果

扩展本身要用 Chrome 加载：`chrome://extensions/` → 开发者模式 → 加载已解压的扩展 → 选 `extension/`。

如果只是想看 UI，用浏览器打开上面三个本地地址就够了；
想要截图对比，`assets/preview-reading.png` 是帖子页样例的当前渲染结果。
