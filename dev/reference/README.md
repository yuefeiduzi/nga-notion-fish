# dev/reference —— NGA 结构证据库

这里放的是**第三方 NGA 用户脚本源码**，只为两件事存在：

1. 写/改 `extension/src/nga/parse.js` 时，能对着真实跑在 NGA 上的选择器核对，而不是靠猜；
2. NGA 改版导致解析失效时，能快速比对「别人现在用什么选择器」。

**这些文件不参与扩展构建，不打包进产物，不要在扩展里 `import` 它们。**
版权归各自作者（见脚本头 `@license` / `@author`），保留原样只为结构参考。

## 索引：想看什么去哪找

| 文件 | 作者 / 版本 | 价值 |
| --- | --- | --- |
| `nga-optimize__393991.user.js` | kisshang1993 / 4.5.7 / MIT | **最权威**。《NGA优化摸鱼体验》维护多年：`renderThreads()` 遍历 `.topicrow`，`renderForms()` 遍历 `.forumbox.postbox` 且**会等 `.small_colored_text_btn` 出现才处理**（楼层异步渲染的铁证）；`#m_threads` / `#m_posts` / `#m_nav` 页面标志；`.posterinfo .avatar+img`；`.topicrow .postdate` / `.replydate`；`#postattach` |
| `nga-filter__389620.user.js` | snyssss / 2.8.2 / MIT | `commonui.topicArg.data` 数组下标含义（`[1]` 标题元素、`[2]` 作者元素、`[7]` fid、`[8]` tid），`commonui.postArg.data` 字段（`pid` / `pAid` / `i` / `contentC` / `subjectC` / `uInfoC` / `lite`），`.posterInfoLine .author` |
| `nga-userinfo-enhance__416741.user.js` | snyssss / 2.0.10 / MIT | `item.pAid` / `item.uInfoC` / `item.pC` 的用法，`.postbox`，`.avatar`，`[name=honor]` |
| `nga-auto-pager-v2__23009.user.js` | 2.40 / GPL-3.0 | `#topicrows` / `#m_posts` / `#m_posts_c` / `.postbox`，`window.__PAGE[1..2]` 的语义，`[name=pageball]` 翻页，**GBK 读取**（`readAsText(blob,'gbk')`） |
| `nga-dark-clean-mode__491021.user.js` | 1.0.0 / MIT | 一份真实结构 CSS 速查：`.forumbox .postrow .c1/.c2/.stat`、`.quote`、`.collapse_btn` + `.collapse_content`、`[id^=postsign]`、`.sigline`、`.catenew .b2/.b3`、`.nav_root/.nav_link/.nav_spr` |
| `nga-fast-view-post-fix__482017.user.js` | snyssss / 1.1.1 / MIT | `#postsubject0` / `#postcontent0` 的用法，`.recommendvalue` 的读写 |
| `nga-excel__40576.user.js` | 1.1.3 | `#topicrows`，`#postdate{i}` / `#postcontent{i}` —— 证明楼层 id 里的是**页内序号**而不是 pid |
| `nga-plus-plus__386552.user.js` | shfeat / 0.1.1 | `#m_posts_c > table.postbox`、`span.posterinfo` |

结论汇总（含每条出处的逐行说明）写在 [`../nga-dom-notes.md`](../nga-dom-notes.md)。

## 怎么快速挖

```bash
# 单文件里找结构证据
grep -nE "postArg|topicArg|post1strow|postcontent|recommendvalue|forumbox|topicrow|posterInfoLine" \
  dev/reference/*.user.js

# 找某个类名是在什么语境下用的（带上下文）
grep -n -B3 -A3 "renderForms" dev/reference/nga-optimize__393991.user.js
```

## 重新下载 / 扩充

`refresh.sh` 会用代理把这一批从 GreasyFork 重新拉一遍（原始文件名是 `update.greasyfork.org/scripts/<id>/<name>.user.js`）：

```bash
bash dev/reference/refresh.sh            # 默认用 http://127.0.0.1:7897
PROXY= bash dev/reference/refresh.sh     # 直连
```

想找新脚本：`https://greasyfork.org/zh-CN/scripts?q=nga`，翻页后拿 `href="/zh-CN/scripts/<id>-<slug>"`
再访问 `/zh-CN/scripts/<id>-<slug>/code` 提取上面的 raw 链接。

## 注意

- **不要**用 headless Chrome 去抓 NGA 页面：访客挑战（`guestJs` cookie）会让它一直挂着不返回
  （上次有个调研 agent 就是这么卡死 28 分钟的）。要真实结构就人工登录一次再存 HTML。
- GitHub API 未登录会 403，searchcode / archive.org 容易 429，别指望它们。
