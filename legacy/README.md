# legacy/ —— 旧版用户脚本（历史存档）

这里的 `nga-notion.user.js` 是最早的 Tampermonkey 用户脚本版本（v0.2），已经被
`extension/` 里的 Chrome 扩展取代，**不再维护**，只作为参考保留：

- 它还记录了一批早期的选择器猜测（`table.forumbox`、`[id^="post1strow"]`、`[id*="postcontent"]`），
  改新解析器时能对照看看哪些想法被推翻了；
- `GREASYFORK.md` 是当时的发布文案。

新版见仓库根目录的 [README.md](../README.md)。真实 DOM 结构的可靠依据在
[dev/nga-dom-notes.md](../dev/nga-dom-notes.md)，不要以这里的旧脚本为准。
