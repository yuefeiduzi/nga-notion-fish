# TODO - NGA Notion 摸鱼模式

## 已完成 ✓

- [x] 详情页基础样式（纯白背景、简洁灰度）
- [x] 图片显示支持
- [x] 翻页功能（右侧悬浮、显示多页数字）
- [x] 点赞数显示（SVG 心形图标）
- [x] 引用内容样式
- [x] 返回按钮改为返回列表

## 待开发

### 1. 板块页（首页）
- [ ] 板块入口样式
- [ ] 板块分类显示

### 2. 文章列表页（thread.php）
- [ ] 帖子列表样式
- [ ] 帖子信息（标题、作者、时间、回复数）
- [ ] 分页功能

### 3. 文章详情页
- [x] 返回列表（根据 fid 跳转）

## 技术笔记

### DOM 选择器

**列表页**：
- `tr.topicrow` - 帖子行
- `td.c2 a.topic` - 标题
- `td.c2 .titleadd2 a` - 板块标签
- `td.c3 a.author` - 作者
- `td.c3 .postdate` - 发布时间

**详情页**：
- `[id^="post1strow"], [class*="postrow"]` - 帖子行
- `[id*="postauthor"], a.userlink` - 作者
- `[id*="postcontent"]` - 帖子内容
- `.recommendvalue` - 点赞数
- `[id*="postsubject"]` - 帖子标题

### 快捷键
- `Q` - 切换摸鱼模式
