# 隐私政策 · Privacy Policy

**NGA 阅读器（NGA Reader）** 是一个浏览器扩展：把 NGA 论坛（ngabbs.com / bbs.nga.cn）的页面
渲染成干净的阅读界面。它**不收集、不上报、不统计**任何数据。

最后更新：2026-09 · 商店「隐私政策 URL」填这个文件的链接即可。

## 会存什么（只存在你自己的浏览器里）

| 存的东西 | 用途 | 位置 |
| --- | --- | --- |
| 设置：总开关、主题、无图模式、应急伪装、正文字号、标签页标题 | 记住你的偏好 | `chrome.storage.local` |
| 收藏的板块；最近浏览（帖子标题 + 链接 + 时间，最多 24 条） | 侧边栏快捷入口 | `chrome.storage.local` |
| 本次会话「以原站方式打开」的标记 | 跳过接管，不再替换页面 | `sessionStorage` |

这些数据不会离开你的设备。卸载扩展即全部删除；popup 里也能单独「清空最近浏览」。

## 不会做什么

- 没有任何统计、埋点、广告或第三方 SDK，不向开发者或任何第三方发送数据。
- 不读取、不保存、不上传你的 NGA 账号、Cookie 或登录凭据。
- 不含远程代码：包里的代码都随扩展一起分发，不会从网络下载脚本再执行。

## 权限说明

- `storage`：存上表里的设置与收藏。
- 站点访问权限（`ngabbs.com`、`nga.cn`）：只在这些页面上把原站界面替换成阅读界面。
  扩展读的是**浏览器已经拿到的**页面内容，不会额外去请求 NGA 的接口。

## 网络请求

扩展自身不发起任何与 NGA 无关的请求。你点「显示图片」时，浏览器会按图片的原始地址
（NGA 自己的图床）去取图——与直接浏览原站时完全一样，受 NGA 自己的隐私政策约束。

## 剪贴板

只有你主动点「复制诊断信息」时，扩展才会把当前页面的解析现场（URL、选择器命中数、第一楼 HTML）
写入剪贴板；内容发给谁由你自己决定。

## 联系方式

问题与建议：<https://github.com/yuefeiduzi/nga-notion-fish/issues>

---

## English summary

NGA Reader is a browser extension that re-renders pages of the NGA forum
(ngabbs.com / bbs.nga.cn) as a clean reading view. It does **not** collect,
transmit, or analyze any user data.

- Settings, favorites, and a local "recently viewed" list (title + URL, at most 24 entries)
  are stored **on your device only** (`chrome.storage.local`) and never leave it.
- No analytics, no ads, no third-party SDKs, and no remote code.
- The only network requests are for the page and image resources your browser would
  load anyway while you browse NGA; images come from NGA's own image hosts.
- Nothing is written to your clipboard unless you click "copy diagnostics".
- Permissions: `storage` (to keep your settings) and host access to `ngabbs.com` /
  `nga.cn` (to replace the site's UI with the reading view on those pages).
