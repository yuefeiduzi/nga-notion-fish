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

## 文档分工（改东西前先确定该写哪）

| 文件 | 写给谁 | 放什么 |
| --- | --- | --- |
| `README.md` | 用户 | 装与用、特性、出问题怎么办、已知限制 |
| `TODO.md` | 人 | **进度与下一步**（顶部是真机验收清单）、待办、技术笔记 |
| `AGENTS.md` | AI | 架构约定、分层职责、选择器入口、踩过的坑 |
| `dev/README.md` | 人 | 样例页怎么跑、fixtures 的规矩 |
| `dev/nga-dom-notes.md` | 人 | NGA 真实结构与出处（改解析必看） |
| `dev/reference/README.md` | 人 | 第三方脚本索引（不参与构建） |
| `legacy/` | 无 | 旧用户脚本存档，只做参考，不要以它为准 |

状态类内容写在 `TODO.md`，不要散落在其它文档里。

## 结构

```
extension/
  manifest.json          MV3：content_scripts(document_start) + web_accessible_resources + popup
  src/boot.js            内容脚本入口：藏原站 → 读设置 → 动态 import app.js
  src/app.js             控制器：路由、取页、渲染调度、快捷键、伪装层
  src/core/settings.js   设置的唯一入口（chrome.storage.local，调试时降级 localStorage）
  src/core/dom.js        el()/append()/icon()/shortNumber()/compactTime()
  src/core/diagnose.js   一键导出诊断现场（选择器命中数 + 抽取字段 + 首楼 HTML）
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

`dev/` 是调试与参考资料：`dev/README.md` 说明样例页怎么跑；
`dev/nga-dom-notes.md` 是 NGA 真实结构笔记（每条带出处）；
`dev/reference/` 是第三方 NGA 脚本源码库，**仅供核对选择器，不要 import、不要打包**。

## 关键约定

- **先藏后画**：`boot.js` 在 `document_start` 给 `<html>` 加 `ngr-pending`（CSS 里 `visibility: hidden`），任何失败路径都必须把它摘掉，否则用户看到白屏（已有 4s 兜底）。
- **原站只当数据源**：接管后 `html.ngr-active` 会隐藏 body 下除 `#ngr-root` 以外的所有节点，并 `window.stop()` 中止剩余资源加载。
- **解析层只产出模型**（见 `parse.js` 末尾注释），绝不拼 HTML；排版全在 `view/` + `app.css`。
- **选择器一律写在 `parse.js` 的 `SEL` 表里**，用 `first()/all()` 多路兜底，不要散落在各处。
- **`sanitize.js` 的处理顺序不能改**：`convertQuotes/convertCollapse` 必须在 `scrubAttributes` 之前，否则 `.quote` / `.collapse` 类名会被洗掉。
- **幂等**：站内跳转是 SPA（fetch + 重渲染），任何渲染都必须能重复执行；事件挂在文档级或渲染时重建的节点上，不要往 `window` 上反复绑定。
- **样式必须能压住原站**：内容区的排版规则写在 `.ngr-content` 下，并显式重置 `div/span/font` 的继承属性；设计 token 用 `--ng-` 前缀，避免与原站变量撞名。
- 不引入依赖、不引入构建步骤、不发起与原站无关的网络请求。

## 常用 DOM 选择器（详见 `parse.js` 的 SEL 表与 `dev/nga-dom-notes.md`）

- 首页 `/`：`.catenew`、`.catetitle`、`a[href*="fid="]`
- 列表页 `/thread.php`：`#topicrows` > `table.forumbox`，行 `tr.topicrow` / `tr.row1|row2`，`td.c2 a.topic`（标题）、`td.c2 span[class^="t_k_"]`（标签）、`td.c3 a.author`、`span.silver.postdate`、`td.c4`（回复/浏览）
- 帖子页 `/read.php`：`#m_posts_c` > `table.postbox`，行 `tr.row1`，作者栏 `td.c1 .posterInfoLine .author` + `[name=uid]`，内容栏 `td.c2` 里的 `#postsubject{N}` / `#postcontent{N}` / `.ubbcode` / `.recommendvalue` / `#postdate{N}`
- 正文里的：`.quote`（引用）、`.collapse_btn` + `.collapse_content`（折叠）、`[id^="postsign"]` / `.sigline`（签名，要删）、`.comment_c_1|2`（贴条，要删）
- 导航：`.nav_root` / `.nav_spr` / `.nav_link`
- 分页：`[name="pageball"]` / `#pagebar a` / `a[href*="page="]`

### 两条取数路径（重要）

1. **站点数据（首选，只有当前页面有）**：`window.commonui.postArg.data`（楼层）与 `window.commonui.topicArg.data`（主题列表）直接给出元素与 pid/uid/fid/tid；`window.__PAGE` 给总页数。
2. **选择器兜底（常态）**：SPA 跳转是 `fetch + DOMParser`，拿不到 `defaultView`，所以没有站点数据。改解析时两条路都要跑：`read.php?...&nopostarg=1` 可以强制走兜底路径。

## 注意事项

- NGA 对访客返回 `ERROR:15` / `ERROR:1`，解析层用 `detectBlocked()` 识别并给出引导登录的界面；本地开发没有账号时只能调 UI 与解析，真实结构靠 `dev/nga-dom-notes.md` 里的证据（来自多个在维护的 NGA 用户脚本源码）+ 登录态实测核对。
- 真机排查：遇到解析不对，先让用户点「复制诊断信息」（`core/diagnose.js`），里面有选择器命中数与第一楼 HTML，比截图有用；`dev/fixtures/blocked.html`（`?blocked=1`）可本地复现错误页。
- `dev/` 里的样例页面是**结构仿真**（按真实类名/层级写，并在页面底部伪造了 `commonui.postArg` / `topicArg` / `__PAGE`），改动解析选择器后请同步更新 fixtures。
- 涉及隐私的默认值：无图模式默认开、标签页标题中性、不做任何数据上报。
