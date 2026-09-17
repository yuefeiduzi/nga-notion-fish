# AGENTS.md

Guidance for AI agents working in this repo.

## 项目概览

一个零构建的 Chrome MV3 扩展「NGA 阅读器」：把 NGA 论坛（ngabbs.com / bbs.nga.cn）渲染成类似 [aihot.news](https://aihot.news/daily) 日报的阅读界面，方便上班时低调地看帖子。

- 主代码：`extension/`（无构建工具、无依赖、无打包，原生 ESM 动态 import）
- 本地调试：`dev/`（结构仿真的假 NGA 页面 + 静态服务器 + 真实结构笔记 + 第三方脚本索引）
- 历史：最初的 Tampermonkey 用户脚本已从仓库移除，需要时看 git 历史（`git log --all -- legacy/`）

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
| `TODO.md` | 人 | **进度与下一步**（顶部是「现在这一步」与快速自检表）、待办、技术笔记 |
| `AGENTS.md` | AI | 架构约定、分层职责、选择器入口、踩过的坑 |
| `dev/README.md` | 人 | 样例页怎么跑、fixtures 的规矩、商店截图怎么出 |
| `dev/nga-dom-notes.md` | 人 | NGA 真实结构与出处（改解析必看） |
| `dev/reference/README.md` | 人 | 第三方脚本索引（不参与构建） |
| `PRIVACY.md` | 用户 / 商店 | 数据与权限口径（上架必填的隐私政策） |
| `store/README.md` + `store/listing.md` | 人 | 上架流程与商品页文案（不参与扩展运行） |

状态类内容写在 `TODO.md`，不要散落在其它文档里。

## 结构

```
extension/
  manifest.json          MV3：content_scripts(document_start) + web_accessible_resources + popup + icons
  icons/                 扩展图标（由 store/make-icons.py 生成，与伪装 favicon 同一造型）
  src/boot.js            内容脚本入口：藏原站 → 读设置 → 动态 import app.js
  src/app.js             控制器：路由、取页、渲染调度、快捷键、伪装层
  src/core/settings.js   设置的唯一入口（chrome.storage.local，调试时降级 localStorage）
  src/core/dom.js        el()/append()/icon()/shortNumber()/compactTime()
  src/core/diagnose.js   一键导出诊断现场（选择器命中数 + 抽取字段 + 首楼 HTML）
  src/nga/parse.js       【核心】Document → 模型（站点数据优先 + 选择器兜底 + blocked 识别）
  src/nga/sanitize.js    【核心】正文克隆净化 → 可排版的 DOM
  src/nga/lazy-images.js 唤醒 NGA 图片懒加载（临时给原站布局 + scrollIntoView）
  src/view/lightbox.js   图片全屏预览（缩放/拖动/切换）
  src/view/shell.js      外壳：侧边栏、主题开关、应急伪装页、toast
  src/view/parts.js      页头 / 分页器 / 按钮 / 空态
  src/view/{home,board,thread}.js   三类页面的渲染
  src/styles/boot.css    只做一件事：接管前藏住原站、接管后让位
  src/styles/app.css     设计 token（--ng-*）与全部组件样式
  popup/                 扩展弹窗设置面板
  demo/                  离线演示页（给商店审核员/没登录的人看；走真实渲染路径）
```

数据流：`boot.js → app.js → nga/parse.js → view/*.js → DOM`，`nga/sanitize.js` 由 `view/thread.js` 调用。
站内跳转是**整页导航**（不是 SPA），新页面由 content script 重新接管。

`dev/` 是调试与参考资料：`dev/README.md` 说明样例页怎么跑；
`dev/nga-dom-notes.md` 是 NGA 真实结构笔记（每条带出处）；
`dev/reference/` 是第三方 NGA 脚本源码库，**仅供核对选择器，不要 import、不要打包**。

## 关键约定

- **先藏后画**：`boot.js` 在 `document_start` 给 `<html>` 加 `ngr-pending`（CSS 里 `visibility: hidden`），任何失败路径都必须把它摘掉，否则用户看到白屏（已有 4s 兜底）。
- **原站只当数据源**：接管后 `html.ngr-active` 会隐藏 body 下除 `#ngr-root` 以外的所有节点，并 `window.stop()` 中止剩余资源加载。
- **被藏起来的原站 JS 还活着**：它会在背后动手，必须按住 ——
  ①「上拉翻页」：滚到屏幕下端再往下滚，它会 AJAX 拉下一页并 `history.pushState` 把地址栏改成 `&page=2`
  （我们的滚动条是 `.ngr-main`、window 不滚，它判断「到底」永远成立）⇒ `app.js` 的 `muteHiddenGestures()`
  在捕获阶段 `stopPropagation()`（2026-09 真机复现并验证修复）；
  ②插播广告页 `/misc/adpage_insert_2.html?<原地址>`：整页被 `location.replace` 换掉，由 `adBounceUrl()` 弹回。
- **内容脚本在隔离世界**：`window.commonui` / `window.__PAGE` 在扩展里是 `undefined`
  （CDP 分世界验证过）。所以 `parse.js` 里「首选站点数据」只在 `dev/` 样例页生效，
  扩展里实际走的是选择器兜底；也别指望改原站函数（只能从事件层拦）。修法在 `TODO.md` 的「内容与解析」。
- **解析层只产出模型**（见 `parse.js` 末尾注释），绝不拼 HTML；排版全在 `view/` + `app.css`。
- **选择器一律写在 `parse.js` 的 `SEL` 表里**，用 `first()/all()` 多路兜底，不要散落在各处。
- **面包屑（`parseNav`）去重不能只看 pathname**：`thread.php?fid=422` 与 `thread.php?stid=…` 是两条，
  它们的区别全在 query 里（`navKey()` 只保留 `fid/stid/tid`）。
- **`sanitize.js` 的处理顺序不能改**：`convertQuotes/convertCollapse` 必须在 `scrubAttributes` 之前，否则 `.quote` / `.collapse` 类名会被洗掉。
- **幂等**：同一页会因「设置变更 / 自愈重渲染」被重复渲染，且跳转后 content script 会重新跑一遍；
  事件挂在文档级或渲染时重建的节点上，不要往 `window` 上反复绑定。
- **两个“名字”别搞混**：侧边栏品牌名是 `view/shell.js` 里的常量 `BRAND`（NGA 阅读器）；
  设置里的 `brandText` 只管应急伪装时的标签页标题（标题文案由 popup 里的「标签页标题」控制）。
- **样式必须能压住原站**：内容区的排版规则写在 `.ngr-content` 下，并显式重置 `div/span/font` 的继承属性；设计 token 用 `--ng-` 前缀，避免与原站变量撞名。
- **`web_accessible_resources` 只列会被动态 import 的目录**：`src/*.js` + `src/core|nga|view/*.js`。
  新增 `src/` 子目录要同步 manifest —— 实测漏了就是 `Failed to fetch dynamically imported module`，整个页面回落到原站。
- **图标与商店素材用脚本生成**（`store/make-icons.py` / `store/make-listing-images.py`），别手改 PNG；
  `extension/demo/` 是审核员唯一能看到界面的地方，改了 parse/渲染顺手跑一下。
- **图片的宽高规则必须 `!important`**：接管后原站 JS（`ubbcode.adjImgSize`）仍会给我们的图片副本写内联
  `max-width:<它自己布局的宽度>px`（实测 982~1030px，正文栏才 676px）。同理，克隆图上要把原站的图片钩子
  （`data-argi`/`data-nw`/`data-srcorg`/`data-srclazy`…）摘干净，见 `sanitize.js` 的 `IMAGE_HOOK_ATTRS`。
- 不引入依赖、不引入构建步骤、不发起与原站无关的网络请求。

## 常用 DOM 选择器（实测确认，详见 `dev/nga-dom-notes.md`）

- 首页 `/`：`.catenew` + `.catetitle`（**标题块与内容块是分离的**，要按文档顺序扫）+ `a[href*="fid="]`
- 列表页 `/thread.php`：`table#topicrows > tbody > tr.row1|row2.topicrow`；
  **合集（子版块）映射行的标题链到 `thread.php?stid=…`**（`tr.set_topic` + 「合集」标记），
  进这种页面后母版块在面包屑的上一级（侧边栏要把母版块列出来）
  回复数在 `td.c1 a.replies`、标题 `td.c2 a.topic`、标签 `span.titleadd2 a` 或标题内嵌 `span.t_k_c{n}`、
  作者 `td.c3 a.author`、时间 `td.c3 span.silver.postdate`、最后回复 `td.c4 a.replydate` + `.replyer`
- 帖子页 `/read.php`：`#m_posts_c > table.forumbox.postbox`（**整页共用一张表**），楼层是 `tr.postrow`；
  作者 `td.c1 span#posterinfo{N}.posterinfo > a#postauthor{N}.author`；正文是
  `p#postcontent{N}.postcontent.ubbcode`（**别用 `[id^=postcontent]`，会先命中包装层
  `#postcontentandsubject{N}`**）；时间 `span#postdate{N}`；标题 `h3#postsubject{N}`
- 正文里：`.quote`、`.collapse_btn` + `.collapse_content`（内容默认空）、`[id^="postsign"]`（签名，删）、
  `.comment_c_{1,2}`（贴条，删）、`#postattach`（附件按钮，删）
- 正文里的图：`img`（**表情与正式图片靠 `class` 含 `smile` 或地址含 `/post/smile/` 区分**：
  `[s:ac:11]` → `<img class="smile_ac" src="https://img4.nga.cn/ngabbs/post/smile/ac11.png" alt="咦">`，
  没有尺寸属性、原图 69×60 —— 所以不能只靠「小尺寸」判断）
- 分页：`[name="pageball"]` / `#pagebar a` / `a[href*="page="]`

### 两条取数路径（重要）

1. **站点数据（首选，只有当前页面有）**：`commonui.postArg.data`（楼层：`i`/`pC`/`contentC`/`uInfoC`/
   `postTime`(unix)/`recommend`/`pid`/`pAid`）、`commonui.topicArg.data`（主题列表数组）、`window.__PAGE`。
2. **选择器兜底**：站点数据缺失或畸形时用。

### 三条必须守住的时序约束

1. **不能 `window.stop()`**：首页与帖子页的正文都是 NGA 的 JS 注入的，提前掐掉 = 永远空壳。
2. **解析前要等就绪**：`app.js` 的 `waitForTarget()` —— 帖子页等的不是「行存在」，而是
   「`contentC` 已经是正文元素」（NGA 先给容器、后给正文）。
3. **解析后要自愈**：抓到包装层时 `selfHeal()` 会隔 600ms 重解析，最多 8 次。
4. **图片另说**：NGA 的图要滚进视口才写 `src`，而我们把原站 `display:none` 了 —— 所以
   「显示图片」要先走 `wakeLazyImages()`（把原站临时切成有布局但 opacity:0），再重渲染。
   这里有个 CSS 权重坑：覆盖 `.ngr-active body > *` 那条隐藏规则必须用 id 选择器。

## 注意事项

- NGA 对访客返回 `ERROR:15` / `ERROR:1`，解析层用 `detectBlocked()` 识别并给出引导登录的界面；本地开发没有账号时只能调 UI 与解析，真实结构靠 `dev/nga-dom-notes.md` 里的证据（来自多个在维护的 NGA 用户脚本源码）+ 登录态实测核对。
- 真机排查：遇到解析不对，先让用户点「复制诊断信息」（`core/diagnose.js`），里面有选择器命中数与第一楼 HTML，比截图有用；`dev/fixtures/blocked.html`（`?blocked=1`）可本地复现错误页。
- `dev/` 里的样例页面是**结构仿真**（按真实类名/层级写，并在页面底部伪造了 `commonui.postArg` / `topicArg` / `__PAGE`），改动解析选择器后请同步更新 fixtures。
- 涉及隐私的默认值：无图模式默认开、标签页标题中性、不做任何数据上报。
