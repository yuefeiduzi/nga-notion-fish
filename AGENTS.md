# AGENTS.md

Guidance for AI agents working in this repo.

## 项目概览

一个零构建的 Chrome MV3 扩展：把 NGA 论坛（ngabbs.com / bbs.nga.cn）渲染成类似 [aihot.news](https://aihot.news/daily) 日报的阅读界面，方便上班时低调地看帖子。

- 主代码：`extension/`（无构建工具、无依赖、无打包，原生 ESM 动态 import）
- 旧版：`legacy/nga-notion.user.js`（Tampermonkey 用户脚本，已被扩展取代，仅作参考）
- 本地调试：`dev/`（结构仿真的假 NGA 页面 + 静态服务器）

## 开发方式

改完 `extension/src/**` 后，在 `chrome://extensions/` 点「重新加载」并刷新 NGA 页面，没有构建步骤。

调 UI 不需要 NGA 账号：

```bash
python3 dev/server.py 8765     # 然后打开 http://127.0.0.1:8765/read.php?tid=1234567
```

`dev/fixtures/*.html` 是仿 NGA 结构的样例页，通过 `dev/harness-boot.js` 以与扩展完全相同的方式启动 `src/` 代码。改解析或排版后应当在这里先跑通（可用浏览器截图对比 `assets/preview-reading.png`）。

代码风格：4 空格缩进、中文注释、模块顶部写清「这个模块负责什么/不负责什么」、优先小函数而不是参数开关。

## 结构

```
extension/
  manifest.json          MV3：content_scripts(document_start) + web_accessible_resources + popup
  src/boot.js            内容脚本入口：藏原站 → 读设置 → 动态 import app.js
  src/app.js             控制器：路由、取页、渲染调度、快捷键、伪装层
  src/core/settings.js   设置的唯一入口（chrome.storage.local，调试时降级 localStorage）
  src/core/dom.js        el()/append()/icon()/shortNumber()/compactTime()
  src/nga/parse.js       【核心】Document → 模型（选择器表 + 多路兜底 + blocked 识别）
  src/nga/sanitize.js    【核心】正文克隆净化 → 可排版的 DOM
  src/nga/fetch.js       同源 fetch + DOMParser + 60s 缓存
  src/view/shell.js      外壳：侧边栏、主题开关、应急伪装页、toast
  src/view/parts.js      页头 / 分页器 / 按钮 / 空态
  src/view/{home,board,thread}.js   三类页面的渲染
  src/styles/boot.css    只做一件事：接管前藏住原站、接管后让位
  src/styles/app.css     设计 token（--ng-*）与全部组件样式
  popup/                 扩展弹窗设置面板
```

数据流：`boot.js → app.js → nga/fetch.js → nga/parse.js → view/*.js → DOM`，`nga/sanitize.js` 由 `view/thread.js` 调用。

## 关键约定

- **先藏后画**：`boot.js` 在 `document_start` 给 `<html>` 加 `ngr-pending`（CSS 里 `visibility: hidden`），任何失败路径都必须把它摘掉，否则用户看到白屏（已有 4s 兜底）。
- **原站只当数据源**：接管后 `html.ngr-active` 会隐藏 body 下除 `#ngr-root` 以外的所有节点，并 `window.stop()` 中止剩余资源加载。
- **解析层只产出模型**（见 `parse.js` 末尾注释），绝不拼 HTML；排版全在 `view/` + `app.css`。
- **选择器一律写在 `parse.js` 的 `SEL` 表里**，用 `first()/all()` 多路兜底，不要散落在各处。
- **`sanitize.js` 的处理顺序不能改**：`convertQuotes/convertCollapse` 必须在 `scrubAttributes` 之前，否则 `.quote` / `.collapse` 类名会被洗掉。
- **幂等**：站内跳转是 SPA（fetch + 重渲染），任何渲染都必须能重复执行；事件挂在文档级或渲染时重建的节点上，不要往 `window` 上反复绑定。
- **样式必须能压住原站**：内容区的排版规则写在 `.ngr-content` 下，并显式重置 `div/span/font` 的继承属性；设计 token 用 `--ng-` 前缀，避免与原站变量撞名。
- 不引入依赖、不引入构建步骤、不发起与原站无关的网络请求。

## 常用 DOM 选择器（详见 `parse.js` 的 SEL 表）

- 首页 `/`：`.catenew`、`.catetitle`、`a[href*="fid="]`
- 列表页 `/thread.php`：`table.forumbox`、`tr.topicrow`、`td.c2 a.topic`、`td.c2 span[class^="t_k_"]`、`td.c3 a.author`、`td.c3 span.postdate`、`td.c4`（回复/浏览）
- 详情页 `/read.php`：`[id^="post1strow"]`、`[class*="postrow"]`、`[id*="postauthor"]`、`[id*="postcontent"]`、`[id*="postsubject"]`、`.recommendvalue`、`.quote`、`.postInfo`
- 导航：`.nav a.nav_link`
- 分页：`#pagebar a` / `a[href*="page="]`

## 注意事项

- NGA 对访客返回 `ERROR:15` / `ERROR:1`，解析层用 `detectBlocked()` 识别并给出引导登录的界面；本地开发没有账号时只能调 UI 与解析，真实结构需在登录态下核对（`docs/nga-dom-notes.md` 是调研笔记）。
- `dev/` 里的样例页面是**结构仿真**而非真实抓取，改动解析选择器后请同步更新 fixtures。
- 涉及隐私的默认值：无图模式默认开、标签页标题中性、不做任何数据上报。
