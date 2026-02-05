# TODO - NGA Notion 摸鱼模式

## 已完成 ✓

- [x] 详情页基础样式（纯白背景、简洁灰度）
- [x] 图片显示支持
- [x] 翻页功能（右侧悬浮、显示多页数字）
- [x] 点赞数显示（SVG 心形图标）
- [x] 引用内容样式
- [x] 文章列表页解析（table.forumbox）
- [x] 板块导航 breadcrumbs
- [x] 列表页分页功能
- [x] 详情页元素过滤（移除 .recommendvalue 等冗余内容）
- [x] 板块首页解析（.catenew + .catetitle）
- [x] 页面跳转支持（无需刷新即可切换页面）
- [x] 跳转等待原站内容加载

## 待开发

### 其他优化
- [ ] 夜间模式切换
- [ ] 设置页面支持

## 技术笔记

### DOM 选择器

**首页（/）**：
- `.catenew` - 板块容器
- `.catenew .catetitle` - 分组标题
- `a[href*="fid="]` - 板块链接

**列表页（thread.php）**：
- `table.forumbox` - 帖子列表容器
- `tr.topicrow` - 帖子行
- `td.c2 a.topic` - 标题
- `td.c2 span[class^="t_k_"]` - 板块标签
- `td.c3 a.author` - 作者
- `td.c3 span.postdate` - 发布时间

**详情页（read.php）**：
- `[id^="post1strow"], [class*="postrow"]` - 帖子行
- `[id*="postauthor"], a.userlink` - 作者
- `[id*="postcontent"]` - 帖子内容
- `.recommendvalue` - 点赞数
- `[id*="postsubject"]` - 帖子标题

**板块导航**：
- `.nav a.nav_link` - 导航链接

### 页面判断
- `pathname === '/read.php'` - 详情页
- `pathname === '/thread.php'` - 列表页
- `pathname === '/'` - 首页
- `table.forumbox` 存在 - 列表页
- `.catenew` 存在 - 首页

### 快捷键
- `Q` - 切换摸鱼模式

### 状态存储
- `localStorage.getItem('nga-notion-mode')` - 存储摸鱼模式开关状态
