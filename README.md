# NGA 摸鱼插件 - Notion 风格伪装

将 NGA（ngabbs.com）伪装成 Notion 风格的文档界面，方便摸鱼。

## 功能特性

- **Notion 风格伪装**：将 NGA 页面转换为简洁的文档样式
- **一键切换**：点击扩展图标或使用快捷键快速切换摸鱼模式
- **无损体验**：保留所有帖子内容，只改变视觉样式

## 快速开始

### 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击 Tampermonkey 图标 → "添加新脚本"
3. 将 `src/nga-notion.user.js` 的内容复制到编辑器中
4. 保存即可

### 使用

1. 访问 https://ngabbs.com/
2. 点击浏览器地址栏右侧的 Tampermonkey 图标
3. 启用 "NGA Notion 模式"
4. 页面将转换为 Notion 风格的文档样式

## 项目结构

```
nga-extension/
├── README.md                 # 项目说明
├── src/
│   └── nga-notion.user.js    # 主脚本文件
├── docs/
│   └── ...                   # 文档和设计文件
└── .gitignore
```

## 开发

### 本地调试

1. 在 Tampermonkey 中创建新脚本
2. 将 `src/nga-notion.user.js` 内容复制进去
3. 修改后保存，刷新 NGA 页面即可查看效果

### 快捷键

- `Alt + N`：切换摸鱼模式

## 兼容性

- Chrome + Tampermonkey
- Edge + Tampermonkey
- Firefox + Tampermonkey

## License

MIT
