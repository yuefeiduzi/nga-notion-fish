# TODO - NGA 阅读器

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
- [ ] 用真实 NGA 页面核对 `parse.js` 的 `SEL` 表：楼层号、发帖时间、赞同数的真实位置
- [ ] 核对 NGA 的图片懒加载属性与附件框（`file=` / `data-src` / `img.nga.178.com`）
- [ ] 核对板块页列结构（`td.c4` 是「回复/查看」还是别的顺序）
- [ ] 核对「只看楼主」`authorid=` 与分页真实上限
- 参考：`docs/nga-dom-notes.md`（调研笔记，gitignore）

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

### 远期
- [ ] 支持搜索页、用户页、收藏页的自渲染
- [ ] 多站点适配（其它论坛/资讯站共用同一套阅读外壳）
- [ ] 键盘流：`n/p` 翻页、楼层间 `J/K` 跳转

## 技术笔记

### 页面判断
- `/` → 首页；`/thread.php?fid=` → 板块页；`/read.php?tid=` → 帖子页；其它 → 保持原站
- 访客被拦：标题为「未登录」/「访客不能直接访问」，正文含 `ERROR:1` / `ERROR:15`

### 存储
- `chrome.storage.local` 单键 `reader-settings`：`enabled / theme / hideImages / stealth / bossKey / fontScale / brandText / favorites / recents`
- 本地调试时 `dev/harness-boot.js` 提供 localStorage 版模拟

### 快捷键
- `Esc Esc` 假页面 · `i` 无图 · `t` 主题 · `g` 首页 · `r` 刷新 · `j/k` 滚动

### 可访问性/摸鱼相关
- `sessionStorage['ngr-skip']`：本次会话跳过接管（用于「以原站方式打开」）
- URL 上加 `?ngr=off` 也会跳过接管
