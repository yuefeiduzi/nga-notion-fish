# TODO - NGA 阅读器

## 继续开发从这里开始（下次开工先看这个）

**已经完成的验证**：`dev/` 样例页上，三条页面渲染、SPA 跳转、前进/后退、分页、亮/暗主题、
快捷键（`Esc Esc` / `i` / `t` / `r` / `j` / `k`）、图片单张与整页加载、两条解析路径（站点数据 / 选择器兜底）全部跑通。

**只有人工能做的两件事（卡在这里）**：

1. 把扩展装进真 Chrome：`chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序 → 选 `extension/` 目录，
   然后开 `https://ngabbs.com/`（需已登录）。有报错就抳控制台第一条红字。
2. 登录态下核对真实 DOM（见下一节清单）。在 ego-browser 里登录一次 NGA 即可让我接手核对，
   或者把某个 `read.php` 页面另存为 HTML 丢进 `dev/fixtures/`。

**开工命令**：

```bash
python3 dev/server.py 8765   # 本地样例，改解析/排版先在这里跑通
git log --oneline -5         # 上一次干到哪
cat dev/nga-dom-notes.md     # 真实结构 + 出处
```

**优先修的三个风险点**（都是因为没登录态而无法实测的）：
发帖时间的真实位置（`#postdate{N}` 还是 `.postInfo`）、赞同数形态（`.recommendvalue` 里面到底有没有 `+`）、
图片懒加载属性（`data-src` / `file=`）与附件框要不要保留。

## 已完成 ✓

### 架构（v0.3，Chrome 扩展）
- [x] 从 Tampermonkey 用户脚本迁移到 Chrome MV3 扩展（零构建、原生 ESM）
- [x] 不再「原站上盖一层」：`document_start` 藏住原站，只把它当数据源
- [x] 分层：`parse.js`（Document → 模型）/ `sanitize.js`（正文净化）/ `view/*`（渲染）/ `app.css`（设计 token）
- [x] 站内跳转改为 `fetch + 自渲染`，无整页刷新、无原站加载闪烁
- [x] 失败兜底：解析失败/未登录/加载失败都有可操作的提示页，且能一键回原站
- [x] 本地调试器：`dev/server.py` + 结构仿真的假 NGA 页面（无需登录即可调 UI）

### 视觉（参考 aihot.news 日报）
- [x] 暖纸底 + 细线分隔 + 数字编号的阅读版式
- [x] 侧边栏：品牌 / 内容 / 板块（收藏）/ 最近 / 更多，含三段式主题开关
- [x] 阅读页：kicker（板块 + 页码）、32px 大标题、2px 分隔线、楼层 `01/02/…` 编号
- [x] 列表页：编号 + 标签 + 标题 + 作者/时间/回复/浏览
- [x] 首页：板块分组网格 + ☆ 收藏
- [x] 深色 / 跟随系统 / 浅色三档主题
- [x] 无图模式（占位按钮 + 单张/整页加载）
- [x] 应急伪装：中性标题与图标、连按两下 Esc 的假页面

### 内容保真
- [x] 引用块（含嵌套引用）转 `<blockquote>` 并保留作者/时间/链接
- [x] 折叠块 `[collapse]` → `<details>`
- [x] 表格、代码块、列表、表情（小图行内保留）
- [x] 懒加载图片 `data-src` 还原、外链 `target=_blank`、内联脚本/样式/广告/签名过滤

## 待办

### 需要登录态核对（优先级最高）
- [ ] 用真实 NGA 页面核对 `parse.js` 的两条取数路径（`commonui.postArg.data` / 选择器兜底）
- [ ] 核对 `#postdate{N}` 是否每层楼都有、赞同数 `.recommendvalue` 的展示形态
- [ ] 核对图片懒加载属性（`data-src` / `file=`）与附件框、`img.nga.178.com` 图床
- [ ] 核对「只看楼主」`authorid=` 与分页真实上限（`__PAGE[1]` 的口径）
- [ ] 核对列表页 `td.c4` 是「回复/浏览」还是反过来，`.replydate` 要不要展示成「最后回复」
- [ ] 老页面 GBK 编码是否还会遇到（`fetch.js` 已做 charset 推断）
- 参考：`dev/nga-dom-notes.md`（逐条出处）+ `dev/reference/`（8 个在维护的第三方脚本源码）

### 体验
- [ ] 楼层锚点跳转（`#pid` / 跳楼输入框）与「本页楼层目录」
- [ ] 收藏板块支持分组排序、拖拽调整
- [ ] 阅读进度记忆（记住上次读到的楼层）
- [ ] 图片查看器（点击放大、多图切换）
- [ ] 帖子内搜索 / 只看有图楼层

### 工程
- [ ] `parse.js` 的 fixture 快照测试（保存真实 HTML 样本，回归时对比模型输出）
- [ ] 扩展图标（当前用默认图标 + 中性名字）
- [ ] 打包 zip 供离线安装 / 上架 Edge Add-ons
- [ ] 定期跑 `bash dev/reference/refresh.sh` 看上游选择器有无变化（改版预警）

### 远期
- [ ] 支持搜索页、用户页、收藏页的自渲染
- [ ] 多站点适配（其它论坛/资讯站共用同一套阅读外壳）
- [ ] 键盘流：`n/p` 翻页、楼层间 `J/K` 跳转

## 技术笔记

### 页面判断
- `/` → 首页；`/thread.php?fid=` → 板块页；`/read.php?tid=` → 帖子页；其它 → 保持原站
- 访客被拦：标题为「未登录」/「访客不能直接访问」，正文含 `ERROR:1` / `ERROR:15`

### NGA 自带数据（当前页面才有）
- `window.commonui.postArg.data[i]`：`pid` / `pAid` / `i`（楼层序号）/ `contentC` / `subjectC` / `uInfoC`
- `window.commonui.topicArg.data[i]`：数组，`[1]` 标题元素、`[2]` 作者元素、`[7]` fid、`[8]` tid
- `window.__PAGE = [url, 总页数, 当前页, …]`
- 加 `?nopostarg=1` 打开样例页可强制走选择器兜底路径

### 存储
- `chrome.storage.local` 单键 `reader-settings`：`enabled / theme / hideImages / stealth / bossKey / fontScale / brandText / favorites / recents`
- 本地调试时 `dev/harness-boot.js` 提供 localStorage 版模拟

### 快捷键
- `Esc Esc` 假页面 · `i` 无图 · `t` 主题 · `g` 首页 · `r` 刷新 · `j/k` 滚动

### 可访问性/摸鱼相关
- `sessionStorage['ngr-skip']`：本次会话跳过接管（用于「以原站方式打开」）
- URL 上加 `?ngr=off` 也会跳过接管
