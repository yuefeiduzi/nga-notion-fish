# NGA 页面结构笔记

**证据等级**：下面标 ✅ 的是 **2026-09 在登录态真机上实测确认**的（Chrome + 本扩展，ngabbs.com）；
标 ⚠️ 的是从第三方用户脚本源码推断、尚未逐条核对的。

> 复现方法：Chrome 登录 NGA → 打开目标页 → DevTools Console 里跑
> `document.querySelectorAll(...)`；或者用 `?ngr=off` 跳过本扩展接管后再看原站 DOM。

## 0. 三条会影响架构的实测结论（最重要）

1. **正文是 JS 注入的，fetch 回来的 HTML 里没有内容** ✅
   - `/`（首页）：服务端 HTML 15KB，里面 **0 个 `.catenew`**（渲染后才 13 个）。
   - `/read.php`：服务端 HTML 里没有楼层，渲染完成后才有 `#m_posts_c`。
   - `/thread.php`：列表**是**服务端渲染的（46 个 `topicrow` 直接在 HTML 里）。
   ⇒ 所以「fetch + DOMParser 自己渲染」这条路对首页与帖子页**不可行**，站内跳转必须交给浏览器整页导航，
   由 content script 在新页面上重新接管。`nga/fetch.js` 已删除。
2. **不能 `window.stop()`** ✅ 提前中止加载会把上面那些 JS 注入的内容一起掐死，页面永远停在空壳上
   （表现：`body.innerText` 为空、`#ngr-root` 在但没内容）。
3. **NGA 的渲染是异步且分阶段的** ✅ 行/容器先出现、正文元素后出现，
   `commonui.postArg` 比楼层行更晚。所以解析前必须等信号（见 §3 的就绪判据）。

## 1. 帖子页 read.php ✅

```
#m_posts.module_wrap
└── #m_posts_c.w100
    └── table.forumbox.postbox            ← 注意：**整页所有楼层共用一张表**
        └── tbody > tr.postrow.row1|row2  ← 「一层楼」是 tr；首楼 id=post1strow0，其余无 id
            ├── td.c1
            │   └── span#posterinfo{N}.posterinfo
            │       ├── a#postauthor{N}.userlink.author > b.block_txt   ← 昵称
            │       ├── img#posteravatar{N}.avatar
            │       └── .stat / .userval / .medalimg / .stat_spacer     ← 发帖数、勋章…
            └── td#postcontainer{N}.c2
                ├── a#pid{N}Anchor                     ← 空锚点，pid 不在 DOM 里
                ├── div#postBtnPos{N}.postBtnPos       ← 赞踩按钮（JS 后填，常常是空的）
                ├── div#postInfo{N}.postInfo
                │   ├── a.postinfot                     ← 所属版面链接
                │   └── span#postdate{N}.postinfot.postdatec.stxt   ← 时间
                ├── h3#postsubject{N}                   ← 楼层标题（首楼=帖子标题）
                └── span#postcontentandsubject{N}       ← **包装层，别当正文！**
                    ├── div（锁定角标 + h3）
                    ├── br
                    └── p#postcontent{N}.postcontent.ubbcode   ← 真正的正文元素
```

**踩过的坑** ✅

- `[id^="postcontent"]` 会先命中包装层 `#postcontentandsubject{N}`，而且它在文档序里更靠前。
  判定正文必须精确到 `^postcontent\d+$`（`parse.js` 的 `CONTENT_ID_RE`），
  否则渲染出来的是「锁定角标 + 标题 + 正文」的外壳。
- 正文里的块级元素（`.quote`、`table`、`pre`）是 NGA 用 JS `innerHTML` 写进 `<p>` 的，
  静态 HTML 里做不到（HTML parser 会把 `<p>` 自动闭合）。**写 fixture 时必须用 template + innerHTML 复刻**，
  否则会得到假的失败。

其它元素：

| 用途 | 实测选择器 | 备注 |
| --- | --- | --- |
| 引用 | `.quote`（可嵌套） | 头部通常是首个 `<b>Post by 某人 (时间):</b>` |
| 折叠 | `.collapse_btn`（含 `<button name="collapseSwitchButton">`）+ `.collapse_content` | **内容默认是空的**，点击才由 `ubbcode.collapse.load()` 去拉；别假装能展开 |
| 签名 | `div#postsign{N}.postsignC > span.sigline + div#postsigncontent{N}.sign.ubbcode` | 整块删掉 |
| 贴条 | `.comment_c_1` / `.comment_c_2` | 整块删掉 |
| 附件 | `h4.postbodysubtitle`（「附件」）+ `#postattach{N}` 里的 `a.contentFullWidthButton` | 都删；真正的附件图已在正文里 |
| 图片（懒加载） | `img[src="about:blank"]`，真地址要滚动才填进 `src` | 宿主是 `img.nga.cn`；属性有 `data-argi` / `data-srcorg` / `data-iw` / `data-ih` |
| 小表情 | `img` 且 `class` 含 smilie 或尺寸 ≤28 | 行内保留 |
| 面包屑 | `.nav_root` → `.nav_spr` → `.nav_link`（末级是帖子标题） | |
| 翻页 | `[name="pageball"]` + `commonui.pageBtn()` 渲染；链接带 `page=` | |

## 2. 主题列表页 thread.php ✅

```
table#topicrows.forumbox > tbody > tr.row1|row2.topicrow     ← 每行一个主题
├── td.c1 > a#t_rc1_{n}.replies                ← **回复数在这里**（不是 c4！）
├── td.c2
│   ├── span.t_k_c{n}                          ← 内嵌在标题里的标签前缀
│   ├── a#t_tt1_{n}.topic                      ← 标题（可能带 [标签] 纯文本前缀）
│   ├── span#t_pc1_{n}                         ← 分页小链接
│   └── span.titleadd2 > a.silver              ← 右侧标签（[联盟赛事] 这种）
├── td.c3
│   ├── a#t_ta1_{n}.author > b.block_txt       ← 作者
│   └── span#t_pt1_{n}.silver.postdate         ← 发布时间
└── td.c4
    ├── a#t_rt1_{n}.silver.replydate           ← 最后回复：text 是相对时间（"5 分钟前"），title 是绝对时间
    └── span.replyer#t_tr1_{n} > b.block_txt   ← 最后回复人
```

- 标签有两种形态：**内嵌**在标题里的 `span.t_k_c{n}`，以及**纯文本前缀** `[本赛区赛事]标题…`。
  两种都要摘出来当标签，否则标题会带着方括号。
- `row1`/`row2` 是奇偶行的底色类，不要用 `/top/` 去匹配置顶（`topicrow` 里就含 "top"）。

## 3. 站点数据（最可靠，但只有当前页面有）✅

NGA 自己的 JS 会把数据挂在 window 上：

- `commonui.postArg.data` —— 每层楼一项（贴条也在里面，用 `'i' in item` 过滤）。实测字段：
  `i`（页内序号）/ `pC`（楼层 td）/ `subjectC` / `contentC` / `signC` / `uInfoC` / `pInfoC` / `postBtnC` /
  `pid` / `pAid`（作者 uid）/ **`postTime`（unix 秒）** / **`recommend`（赞数）** /
  `comment` / `score` / `cLength` / `ip` / `orgFid` / `fromClient`
  ⚠️ `contentC` 在渲染过程中会先指向容器，稳定后才是 `p#postcontent{N}` —— 用 `findContentEl()` 兜住。
- `commonui.topicArg.data` —— 列表页每项是数组：`[1]` 标题元素、`[2]` 作者元素、`[7]` fid、`[8]` tid。
- `window.__PAGE = [url, 总页数, 当前页, …]`。

**就绪判据**（`app.js` 的 `waitForTarget`）：帖子页要等「每一层的 `contentC` 都已经是正文元素」，
或退一步「首楼正文元素真的有内容」；列表页等 `.topicrow`；首页等 `.catenew`。最多 8 秒。

## 4. 首页 / ✅

- 结构是「**标题块 + 内容块**」分离的：
  - `<div class="catenew"><h2 class="catetitle">:: 网事杂谈 ::</h2></div>`（只有标题，0 个链接）
  - `<div class="catenew">…21 个 fid 链接…</div>`
  - 最后那个「游戏专版」大块有 **254 个链接且没有任何标题**，卡片是 `.b3/.b4 > .a > .b > a.uitxt1`。
- 所以解析要**按文档顺序**走：遇 `.catetitle` 开新组，之后的 `a[href*=fid=]` 归它，直到下一个标题；
  按 fid 去重（收藏版面里出现的板块就不再重复列）。
- 标题里有一块占位是字面量 `undefined`，要跳过。
- 相关类名：`.catenew`、`.catetitle`、`.headline`、`.contentBlock`、`#sub_forums`。

## 5. 错误页 / 编码 ⚠️实测过一部分

- 访客：`(ERROR:15) 访客不能直接访问`；未登录：标题「未登录」+ `(ERROR:1)`；
  无效/过期帖子：`(ERROR:5)`（"连接服务器响应时间超长"）。
- 登录入口：`nuke.php?func=ucp_login`。
- **编码是 GBK**（`Content-Type: text/html; charset=GBK`，meta 里写 GB18030）✅
  fetch 时 `response.text()` 认 HTTP 头所以没问题，但自己解码时要按 GB18030 处理。
- 图片是**滚动才加载**的 ✅：`window.scrollTo` + scroll 事件后真地址才会填进 `src`
  （实测 3 → 5 张）。本扩展接管后原站不再滚动，所以拿不到地址的图会显示
  「图片（懒加载，点原站查看）」占位。

## 6. 参考脚本（第三方源码，仅作对照）

放在 [`reference/`](reference/)，用 `bash reference/refresh.sh` 可以重新拉。

| 脚本 | 价值 |
| --- | --- |
| `nga-optimize__393991.user.js`（《NGA优化摸鱼体验》4.5.7，MIT） | 最权威：`renderThreads()` 遍历 `.topicrow`、`renderForms()` 遍历 `.forumbox.postbox` 并等 `.small_colored_text_btn`（异步渲染的第一个线索）、页面标志 `#m_threads`/`#m_posts`/`#m_nav` |
| `nga-filter__389620.user.js`（MIT） | `commonui.topicArg.data` 下标含义、`commonui.postArg.data` 字段用法 |
| `nga-userinfo-enhance__416741.user.js`（MIT） | `item.pAid` / `item.uInfoC` / `item.pC` |
| `nga-auto-pager-v2__23009.user.js`（GPL-3） | `#topicrows`/`#m_posts_c`/`.postbox`、`__PAGE` 语义、GBK 读取 |
| `nga-dark-clean-mode__491021.user.js`（MIT） | 一份现成的结构 CSS 速查（`.c1/.c2/.stat`、`.quote`、`.collapse_*`、`.sigline`） |
| `nga-fast-view-post-fix__482017.user.js` | `#postsubject0` / `#postcontent0` 的用法 |
| `nga-excel__40576.user.js` | 楼层 id 里是**页内序号**而不是 pid 的证据 |
| `nga-plus-plus__386552.user.js` | `#m_posts_c > table.postbox` |

## 7. 没解决的 / 待观察

- 图片懒加载：能不能在解析前「唤醒」原站的懒加载（例如临时给原站容器布局并滚动）—— 未验证。
- SPA 化：现在每次跳转都是整页导航。若要做无刷新，只能走隐藏 iframe（让原站 JS 完整跑一遍再读它的 DOM），
  代价与风险都不小。
- 楼层号：目前按 20 楼/页推算 + `postArg.data[i].i` 兜底，尚未在「第 N 页」上核对过。
