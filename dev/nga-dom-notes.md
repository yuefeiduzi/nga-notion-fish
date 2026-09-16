# NGA 页面结构笔记（写解析器用的）

来源：GreasyFork 上长期在维护的 NGA 用户脚本源码（见文末），都是真实跑在 ngabbs.com / bbs.nga.cn 上的选择器。
因为我自己没有登录态，这些是「二手但一手」的证据：宁可相信维护者在用的选择器，也不去猜。

## 1. 帖子页 read.php

```
#m_posts
└── #m_posts_c                                  ← 楼层容器
    ├── table.forumbox.postbox                   ← 一层楼 = 一个表格（class="forumbox postbox"）
    │   └── tbody > tr.row1 / tr.row2            ← 行（交替底色）
    │       ├── td.c1                            ← 作者栏（宽 17%）
    │       │   ├── .posterInfoLine
    │       │   │   ├── .avatar > img
    │       │   │   ├── a.author                 ← 昵称
    │       │   │   └── [name="uid"]             ← uid
    │       │   └── .stat / .stat_spacer          ← 发帖数、注册时间等
    │       └── td.c2                            ← 内容栏
    │           ├── #postsubject{N} / .postsubject ← 楼层标题（非首楼多为 display:none 或 Re:）
    │           ├── #postcontent{N} / .postcontent / .ubbcode
    │           ├── #postdate{N} / span.silver.postdate
    │           ├── .subtitle                     ← “本帖最后由 … 编辑”
    │           └── .stat > .recommendvalue       ← 赞同数（形如 +128）
    └── （贴条）table.comment_c / .comment_c_1 / .comment_c_2
```

其它关键类名：

| 用途 | 选择器 |
| --- | --- |
| 签名 | `[id^="postsign"]`、`.sigline`、`.postsign` |
| 引用 | `.quote`（内部首个 `<b>` 或 `.quote_head` 是 “Post by 某人 (时间)”） |
| 折叠 | `.collapse_btn`（按钮）+ `.collapse_content`（内容，`style="display:none"`） |
| 贴条 | `.comment_c_1` / `.comment_c_2` |
| 点赞/踩 | `.recommendvalue`、`.goodbad`、`.block_txt_c0` / `.block_txt_c2` |
| 头像 | `.avatar` |
| 经验条 | `.r_container` |
| 快速回复 | `#fast_post_c`、`a.rep.uitxt1` |
| 翻页 | `[name="pageball"]` + `commonui.pageBtn()` 渲染，链接带 `page=` |

**站点全局数据（最可靠）**：NGA 自己的 JS 会挂上 `window.commonui`：

- `commonui.postArg.data` —— 每个元素对应一层楼，字段：
  `pid`（帖子 id）、`pAid`（作者 uid）、`i`（页内楼层序号，数字；贴条没有）、
  `contentC`（正文元素）、`subjectC`（标题元素）、`uInfoC`（作者栏元素）、`lite`（精简渲染）、`nFilter`。
  贴条也在 `data` 里，用 `typeof item.i === 'number'` 区分楼层与贴条。
- `commonui.topicArg.data` —— 主题列表页的数据，每项是**数组**：
  `[1]` 标题元素（`a.topic`）、`[2]` 作者元素、`[7]` fid、`[8]` tid；`title.closest('tr')` 是所在行。
- `window.__PAGE = [url, 总页数, 当前页, …]` —— 翻页信息（`__PAGE[2]` 是当前页，翻页脚本会对它自增）。

> 这些对象**只在真实页面**上存在。用 `fetch + DOMParser` 抓回来的文档没有 `defaultView`，
> 所以解析器必须以选择器路径为常态、站点数据为加分项 —— 两条路都要能跑。

## 2. 主题列表页 thread.php

```
#topicrows                                  ← 列表容器（table.forumbox）
└── tr.topicrow / tr.row1 / tr.row2
    ├── td.c1                                ← 置顶/精华图标，标签 span.t_k_1 …
    ├── td.c2 > a.topic                      ← 标题；标签 span[class^="t_k_"]
    ├── td.c3 > a.author + span.silver.postdate
    └── td.c4                                ← “回复数/查看数”
```

- 置顶行：行 class 含 `topicrow_top`，或标签文字为「置顶/公告/锁定」。
- 分页：`#pagebar` / `[name="pageball"]` / `a[href*="page="]`，另有 `a.uitxt1[title="加载下一页"]`。
- 老脚本里出现过的 `#topicrows`、`tr.row1/.row2`、`td.c1~c4`、`span.silver.postdate` 都在用。

## 3. 首页 /

- 板块分组：`.catenew`（内部 `.catetitle` 是分组名），组内 `a[href*="fid="]`。
- 相关类名：`.catenew .b2`、`.catenew .b3`、`#sub_forums`（子版块）。

## 4. 面包屑

`.nav_root`（NGA）→ `.nav_spr`（分隔）→ `.nav_link`（各级），最后一级在帖子页是帖子标题。

## 5. 已知坑

- **内容可能是异步渲染的**：`NGA优化摸鱼体验` 的 `renderForms()` 会先检查
  `$el.find('.small_colored_text_btn').length == 0` 并 return，注释写的是「等待 NGA 页面渲染完成」——
  也就是说到了 `DOMContentLoaded` 时楼层表格可能还不完整。扩展里对应的是
  `app.js` 的 `waitForTarget()`（等 `#m_posts .postrow` / `.forumbox.postbox` / `.topicrow`，最多 3s）。
- 访客直接访问：`(ERROR:15) 访客不能直接访问`；未登录：标题「未登录」+ `(ERROR:1)`。
- 登录入口：`nuke.php?func=ucp_login`。
- 老页面可能是 **GBK**（老脚本用 `readAsText(blob, 'gbk')` 读 AJAX 结果），新页面是 UTF-8。
- 楼层 id 用的是「页内序号」（`postcontent0`、`postcontent1`…），**不是 pid**，
  不要把 id 里的数字当 pid 用；pid 从 `commonui.postArg.data[i].pid` 或行上的 `data-pid` 取。
- 外部环境：GitHub API（未登录 403）、searchcode / archive.org（大量 429）都容易限流，
  抓源码优先走 GreasyFork 的 `update.greasyfork.org`。

## 6. 证据来源

**① `NGA优化摸鱼体验`（GreasyFork 393991，264KB，最权威的一个）** ——
直接下 `https://update.greasyfork.org/scripts/393991/NGA%E4%BC%98%E5%8C%96%E6%91%B8%E9%B1%BC%E4%BD%93%E9%AA%8C.user.js`，
搜 `renderThreads` / `renderForms` / `#m_posts` 即可验证下面每一条：

| 结论 | 出处 |
| --- | --- |
| 列表页行 = `.topicrow` | `renderThreads(){ $('.topicrow[hld-threads-render!=ok]') … }` |
| 楼层容器 = `.forumbox.postbox` | `renderForms(){ $('.forumbox.postbox[hld-forms-render!=ok]') … }` |
| 页面类型标志 | `#m_threads`（列表页）/ `#m_posts`（帖子页）/ `#m_nav`（面包屑容器 `#m_nav a.nav_link`） |
| 楼层行 = `#m_posts .postrow` | 深色模式 CSS：`#m_posts .postrow .posterInfoLine` |
| 作者头像 | `.posterinfo .avatar+img`（`.avatar` 后面那个 img） |
| 列表页时间列 | `.topicrow .postdate` / `.topicrow .replydate`（最后回复） |
| 附件 | 「附件」按钮的下一个元素 id 含 `postattach` |
| 站点 API | `unsafeWindow.commonui.userInfo.users[uid]`、`commonui.mainMenu.menuOpen()`、`commonui.favor(e, null, tid)` |
| 异步渲染 | `renderForms()` 等到 `.small_colored_text_btn` 出现才处理 |

**② 其它 GreasyFork 脚本**（在各自页面里搜 `postArg` / `post1strow` / `recommendvalue` 可见）：

| 脚本 | 用到的证据 |
| --- | --- |
| `nga dark clean mode`（#491021） | `.forumbox .postrow .c1/.c2/.stat`、`#m_posts`、`.quote`、`.collapse_btn/.collapse_content`、`[id^=postsign]`、`.sigline`、`.catenew .b2/.b3`、`.nav_root/.nav_link/.nav_spr` |
| `NGA Filter`（#389620，169KB） | `commonui.topicArg.data` 数组下标含义、`commonui.postArg.data` 字段、`.posterInfoLine .author`、`[name=uid]`、`.comment_c` |
| `NGA UserInfo Enhance`（#416741） | `item.pAid` / `item.uInfoC` / `item.pC`、`.postbox`、`.avatar`、`[name=honor]` |
| `NGA Fast View Post Fix`（#482017） | `#postsubject0` / `#postcontent0`、`.recommendvalue` 的用法 |
| `NGA Auto Pager V2`（#23009） | `#topicrows`、`#m_posts`、`#m_posts_c`、`.postbox`、`window.__PAGE[1..2]`、`pageball`、GBK 读取 |
| `NGA Excel`（#40576） | `#topicrows`、`#postdate{i}` / `#postcontent{i}`（id 是页内序号） |
| `NGA ++`（#386552） | `#m_posts_c > table.postbox`、`span.posterinfo` |

复现方式（需要代理）：在 GreasyFork 脚本页拿 `update.greasyfork.org/scripts/<id>/<name>.user.js`，
再用 `grep -nE "postArg|post1strow|postcontent|recommendvalue|forumbox|topicrow"` 挖选择器。

> 没拿到的东西：真实登录态下的 `read.php` 快照。NGA 对访客返回 ERROR:15，
> Wayback 抓到的也是错误页，所以「`.recommendvalue` 具体长什么样」「图片懒加载属性到底是哪个」
> 这类问题仍需在登录态下实测（headless Chrome 跟访客挑战会挂住，别用）。
