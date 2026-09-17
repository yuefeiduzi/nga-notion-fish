# 商店文案与填写口径

Chrome Web Store / Edge Add-ons 的表单字段都在这里备好，直接复制即可。
**不要**把 NGA 账号密码写进任何文件（CWS 的 Test instructions 里也不建议放真账号）。

## 一句话信息

| 字段 | 填写内容 |
| --- | --- |
| 名称 | `NGA 阅读器` |
| 短描述（Chrome 取 manifest 的 `description`，Edge 同） | 把 NGA 论坛（ngabbs.com / bbs.nga.cn）读成一份资讯日报：侧边栏导航 + 数字编号的楼层正文，支持暗色模式、无图模式与图片全屏预览。 |
| 类别 | Chrome：`生产工具`／Edge：`生产力`（备选：`新闻与天气`、`社交`） |
| 语言 | 中文（简体）· 可选补 English |
| 网站 / 主页 | https://github.com/yuefeiduzi/nga-notion-fish |
| 支持 / 反馈 | https://github.com/yuefeiduzi/nga-notion-fish/issues |
| 隐私政策 URL | https://github.com/yuefeiduzi/nga-notion-fish/blob/main/PRIVACY.md |

## 详细描述（中文）

NGA 阅读器把 NGA 论坛（ngabbs.com / bbs.nga.cn）的页面重排成一份「资讯日报」式的阅读界面，方便在办公场景里安静地看帖子。

**它做了什么**

- **整站接管**：页面一开始加载就换成阅读界面，不会先闪一下原站。
- **阅读页**：楼层按 `01 / 02 / 03` 编号，保留楼主标记、发帖时间、赞同数、引用与嵌套引用、表格、代码块、折叠块；表情按原样行内显示，与正文大图区分。
- **板块页与首页**：主题列表带标签、作者、时间、回复数与最后回复；板块目录按分组平铺，悬停即可 ☆ 收藏到侧边栏。
- **图片**：默认不加载（省流量、也更低调），正文里显示占位按钮，点一下就能全屏查看——支持滚轮缩放、拖动、同一层楼多图切换；点侧边栏「显示图片」可以整页加载（会自动唤醒原站的懒加载）。
- **主题**：浅色 / 深色 / 跟随系统三档。
- **应急伪装**：标签页图标与标题变成中性文案（标题可自定义），连按两下 `Esc` 立刻切到一份假的「项目进度」页面，再按两下切回。
- **最近浏览与收藏**：只存在你自己的浏览器里，从扩展图标打开设置面板即可管理。

**使用前提**

- 需要你自己已经登录 NGA：阅读模式只是重排你本来就能看到的内容，不提供、也不试图提供任何绕过登录或权限的能力。
- 只读：回复、点赞等操作请点页面上的「原站」按钮回原站完成。

**隐私**

不收集、不上报任何数据，没有统计与广告；设置与「最近浏览」只保存在本机。详见隐私政策。

**说明**

第三方非官方工具，与 NGA 官方没有关系。解析出错时可以用侧边栏的「更多 → 复制诊断信息」把现场反馈到 issue。

## Detailed description (English, optional)

NGA Reader re-renders NGA forum pages (ngabbs.com / bbs.nga.cn) as a clean, newspaper-style reading view:
numbered floors, quotes, tables, code blocks, inline forum emoji, dark mode, and an image mode that loads
nothing until you ask for it. Images open in a full-screen viewer (zoom, pan, switch between a floor's images),
and a "boss key" swaps the tab for a neutral page. It is read-only: replying and upvoting still happen on the
original site. No data collection, no analytics, no remote code — settings and the local "recently viewed" list
stay on your device. Unofficial third-party tool, not affiliated with NGA.

## 隐私实践（两家问的都一样）

| 问题 | 回答 |
| --- | --- |
| 单用途说明（Single purpose） | 在 NGA 论坛页面上把原站界面渲染成阅读界面（含正文净化、图片占位与预览、主题与伪装）。 |
| 远程代码（Remote code） | **No** —— 所有代码都随扩展包分发，不从网络下载或执行任何脚本。 |
| 数据收集（Data usage） | **不勾选任何一类**。设置、收藏与「最近浏览」只写入本机 `chrome.storage.local`，不上传、不共享、不用于广告。 |
| 认证信息 | 不读取、不保存、不上传登录凭据或 Cookie。 |
| 网页内容 | 仅在本地用于渲染阅读界面，不传输。 |
| 剪贴板 | 只在用户主动点「复制诊断信息」时写入。 |

### 权限理由（逐条）

| 权限 | 理由 |
| --- | --- |
| `storage` | 保存用户偏好（主题、无图模式、正文字号、伪装标题）以及本地收藏板块与最近浏览列表。 |
| `https://ngabbs.com/*`、`https://*.ngabbs.com/*`、`https://bbs.nga.cn/*`、`https://*.nga.cn/*` | 扩展的唯一功能就是在 NGA 页面上替换界面，因此需要在这些域名注入内容脚本；这些权限不用于读取或上传任何数据。 |
| `web_accessible_resources`（`src/**.js`） | 内容脚本用原生 ESM 动态加载自己的模块（零构建），需要让这些模块可被页面上下文取到；已收窄到具体的几个目录。 |

## Test instructions（给审核员，CWS 有专门的填写页；Edge 填在提交备注里）

> 本扩展只在 NGA 论坛（ngabbs.com / bbs.nga.cn）上生效，而 NGA 对未登录访客返回 `(ERROR:15)`，因此审核时请任选一种方式：
>
> **1) 离线演示页（推荐，不需要账号）**
> 安装后打开 `chrome-extension://<扩展 ID>/demo/index.html`。
> 这是随包附带的本地示例页：数据是示例内容，但渲染走的是与真实站点完全相同的代码路径（解析 → 净化 → 排版）。
> 点侧边栏「显示图片」可以看到示例图与表情的加载效果；侧边栏底部可切换深色主题。
>
> **2) 使用 NGA 账号**
> 在 https://ngabbs.com/ 登录后打开任意帖子（`/read.php?tid=...`）。
> 未登录时扩展会显示「请先登录」的引导页——这是预期行为，不是故障。
>
> **其它可检查项**
> - 点工具栏图标 → 设置弹窗（总开关 / 无图模式 / 应急伪装 / 主题 / 字号 / 收藏与最近浏览）。
> - 阅读页侧边栏「更多 → 复制诊断信息」会把当前页面的解析现场写入剪贴板。
> - 非 NGA 页面不会被接管，保持原样。

## 素材清单

| 文件 | 尺寸 | 用在哪 |
| --- | --- | --- |
| `images/screenshot-1-reading.png` | 1280×800 | 两家通用（阅读页，默认无图模式） |
| `images/screenshot-2-images.png` | 1280×800 | 两家通用（图片模式：大图 + 表情 + 表格） |
| `images/screenshot-3-dark.png` | 1280×800 | 两家通用（深色主题） |
| `images/screenshot-4-board.png` | 1280×800 | 两家通用（板块列表页） |
| `images/promo-440x280.png` | 440×280 | Chrome 小宣传图（**必填**）、Edge 小宣传磁贴（可选） |
| `images/logo-300x300.png` | 300×300 | Edge 商品页 logo（Chrome 的 128×128 图标在 zip 里：`extension/icons/128.png`） |
| `../extension/icons/128.png` | 128×128 | Chrome 扩展图标（随包提交，商店自动读取） |

截图列在 `dev/README.md` 有重新生成的做法（样例页 + 1280×800 视口；**截图前先清空「最近浏览」**，
别把真人浏览记录截进去）。
