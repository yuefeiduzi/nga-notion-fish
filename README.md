# NGA 摸鱼模式

将 NGA（ngabbs.com）游戏论坛转换为简洁的阅读界面，方便摸鱼看游戏攻略和帖子。

## 功能特性

- **一键切换**：使用快捷键 `Q` 快速切换摸鱼模式
- **完整浏览体验**：支持首页、板块列表、文章详情三级页面
- **无损体验**：保留所有帖子内容，只改变视觉样式

## 支持的游戏板块

### Moba / MOBA
- 英雄联盟、英雄联盟手游、云顶之弈
- DOTA2、刀塔霸业
- 无畏契约

### 暴雪游戏
- 魔兽世界、炉石传说、守望先锋
- 暗黑破坏神、星际争霸、风暴英雄

### 主机游戏
- 艾尔登法环、塞尔达传说、动物森友会
- 黑神话:悟空、博德之门、怪物猎人
- PlayStation、XBOX、Nintendo

### 手游
- 原神、明日方舟、崩坏:星穹铁道
- 王者荣耀、碧蓝航线、阴阳师
- 绝区零、鸣潮、少女前线

### 更多板块
- 二次元、游戏王、东方Project
- Vtuber、GalGame、Fate
- Steam Deck、PS5、Xbox Series

## 快速开始

### 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击 Tampermonkey 图标 → "添加新脚本"
3. 将 `src/nga-notion.user.js` 的内容复制到编辑器中
4. 保存即可

### 使用

1. 访问 https://bbs.nga.cn/
2. 按 `Q` 键切换摸鱼模式
3. 页面将转换为 Notion 风格的文档样式

## 项目结构

```
nga-extension/
├── README.md                 # 项目说明
├── CLAUDE.md                 # AI 开发指南
├── TODO.md                   # 开发计划
├── src/
│   └── nga-notion.user.js    # 主脚本文件
└── docs/
    └── ...                   # 文档和参考资料
```

## 开发

### 本地调试

1. 在 Tampermonkey 中创建新脚本
2. 将 `src/nga-notion.user.js` 内容复制进去
3. 修改后保存，刷新 NGA 页面即可查看效果

### 快捷键

- `Q`：切换摸鱼模式

## 兼容性

- Chrome + Tampermonkey
- Edge + Tampermonkey
- Safari + Tampermonkey
- Firefox + Tampermonkey

## License

MIT
