// ==UserScript==
// @name         NGA Notion 摸鱼模式
// @namespace    https://ngabbs.com/
// @version      1.0.0
// @description  将 NGA 伪装成 Notion 风格的文档界面，方便摸鱼
// @author       Ross
// @match        https://ngabbs.com/*
// @match        https://*.ngabbs.com/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        enabled: false,
        styleVersion: '1.0.0',
    };

    // ==================== Notion 风格样式 ====================
    const NOTION_STYLES = `
        /* 基础重置 */
        * {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
            background-color: #ffffff !important;
            color: #37352f !important;
            line-height: 1.5 !important;
        }

        /* 隐藏原站元素 */
        .header, .nav, .footer, .sidebar, .ads, .banner,
        [class*="ad-"], [class*="banner"], [id*="ad-"],
        .menu, .toolbar, .quick-reply, .signature,
        #footer, #header, #nv_forum, .modac, .pop.win {
            display: none !important;
        }

        /* 主容器 - Notion 风格 */
        #notion-container {
            display: block !important;
            max-width: 900px !important;
            margin: 0 auto !important;
            padding: 48px 96px !important;
        }

        /* 页面标题 */
        .notion-title {
            font-size: 40px !important;
            font-weight: 700 !important;
            color: #37352f !important;
            margin-bottom: 24px !important;
            padding-bottom: 8px !important;
            border-bottom: none !important;
        }

        /* 帖子列表伪装成文档块 */
        .notion-block {
            padding: 8px 0 !important;
            border-bottom: 1px solid #e9e9e8 !important;
            transition: background-color 0.1s ease;
        }

        .notion-block:hover {
            background-color: rgba(55, 53, 47, 0.04) !important;
        }

        /* 帖子标题 - 类似 Notion 标题块 */
        .notion-block-title {
            font-size: 16px !important;
            font-weight: 600 !important;
            color: #37352f !important;
            margin-bottom: 4px !important;
        }

        .notion-block-title a {
            color: #37352f !important;
            text-decoration: none !important;
        }

        .notion-block-title a:hover {
            color: #9b9a97 !important;
        }

        /* 帖子摘要 - 类似 Notion 文本块 */
        .notion-block-content {
            font-size: 14px !important;
            color: #787774 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
        }

        /* 作者信息 */
        .notion-block-author {
            font-size: 12px !important;
            color: #9b9a97 !important;
            margin-top: 4px !important;
        }

        /* 时间戳 */
        .notion-block-time {
            font-size: 12px !important;
            color: #9b9a97 !important;
        }

        /* 分类标签 - 伪装成面包屑 */
        .notion-block-tag {
            display: inline-block !important;
            font-size: 12px !important;
            color: #787774 !important;
            margin-right: 8px !important;
        }

        /* 帖子内容页样式 */
        .notion-post-content {
            font-size: 16px !important;
            line-height: 1.6 !important;
            color: #37352f !important;
        }

        .notion-post-content p {
            margin-bottom: 16px !important;
        }

        .notion-post-content img {
            max-width: 100% !important;
            border-radius: 4px !important;
        }

        /* 评论区伪装 */
        .notion-comments {
            margin-top: 48px !important;
            padding-top: 32px !important;
            border-top: 1px solid #e9e9e8 !important;
        }

        .notion-comment {
            padding: 12px 0 !important;
            border-bottom: 1px solid #f4f4f3 !important;
        }

        /* 分页伪装 */
        .notion-pagination {
            display: flex !important;
            gap: 8px !important;
            margin-top: 32px !important;
            padding-top: 24px !important;
        }

        .notion-pagination a,
        .notion-pagination span {
            padding: 6px 12px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            color: #37352f !important;
            text-decoration: none !important;
            background: transparent !important;
        }

        .notion-pagination a:hover {
            background: rgba(55, 53, 47, 0.08) !important;
        }

        .notion-pagination .current {
            background: rgba(55, 53, 47, 0.08) !important;
            font-weight: 500 !important;
        }

        /* 状态提示 */
        #notion-status {
            position: fixed !important;
            top: 16px !important;
            right: 16px !important;
            padding: 8px 16px !important;
            background: #37352f !important;
            color: #ffffff !important;
            font-size: 13px !important;
            border-radius: 4px !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease !important;
            z-index: 999999 !important;
        }

        #notion-status.show {
            opacity: 1 !important;
        }

        /* 返回按钮 */
        #notion-back {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            padding: 4px 8px !important;
            margin-bottom: 24px !important;
            font-size: 14px !important;
            color: #787774 !important;
            cursor: pointer !important;
            border-radius: 4px !important;
        }

        #notion-back:hover {
            background: rgba(55, 53, 47, 0.08) !important;
        }

        /* 移除 NGA 原有样式影响 */
        #spacePage, #pacePage, #topic_rows, .post-row {
            all: unset !important;
        }
    `;

    // ==================== DOM 转换函数 ====================

    // 转换帖子列表页面
    function transformThreadList() {
        const container = document.querySelector('#topic_rows, .threadlist, .post-list, .forum-list');

        if (!container) return null;

        const notionContainer = document.createElement('div');
        notionContainer.id = 'notion-container';

        // 标题
        const title = document.createElement('h1');
        title.className = 'notion-title';
        title.textContent = document.title.replace(' - NGA玩家社区', '') || 'NGA 帖子列表';
        notionContainer.appendChild(title);

        // 遍历帖子
        const threads = container.querySelectorAll('tr, .thread, .post, li');
        threads.forEach(thread => {
            const block = createThreadBlock(thread);
            if (block) {
                notionContainer.appendChild(block);
            }
        });

        // 分页
        const pagination = createPagination();
        if (pagination) {
            notionContainer.appendChild(pagination);
        }

        return notionContainer;
    }

    // 创建帖子块
    function createThreadBlock(thread) {
        const titleEl = thread.querySelector('a, .title, .subject');
        const authorEl = thread.querySelector('.author, .username, .uid');
        const timeEl = thread.querySelector('.time, .posttime');
        const tagEl = thread.querySelector('.tag, .forum, .board');

        if (!titleEl) return null;

        const block = document.createElement('div');
        block.className = 'notion-block';

        const title = document.createElement('div');
        title.className = 'notion-block-title';
        title.innerHTML = `<a href="${titleEl.href || '#'}">${titleEl.textContent}</a>`;
        block.appendChild(title);

        if (tagEl) {
            const tag = document.createElement('span');
            tag.className = 'notion-block-tag';
            tag.textContent = tagEl.textContent;
            block.appendChild(tag);
        }

        const author = document.createElement('div');
        author.className = 'notion-block-author';
        author.textContent = authorEl ? authorEl.textContent : '匿名';
        block.appendChild(author);

        return block;
    }

    // 创建分页
    function createPagination() {
        const paginationEl = document.querySelector('.pages, .page, .pagination');
        if (!paginationEl) return null;

        const pagination = document.createElement('div');
        pagination.className = 'notion-pagination';
        pagination.innerHTML = paginationEl.innerHTML;

        return pagination;
    }

    // 转换帖子内容页
    function transformPostPage() {
        const postContent = document.querySelector('.post, .post-content, .topic-content');

        if (!postContent) return null;

        const notionContainer = document.createElement('div');
        notionContainer.id = 'notion-container';

        // 返回按钮
        const backBtn = document.createElement('div');
        backBtn.id = 'notion-back';
        backBtn.innerHTML = '← 返回列表';
        backBtn.onclick = () => history.back();
        notionContainer.appendChild(backBtn);

        // 标题
        const title = document.createElement('h1');
        title.className = 'notion-title';
        title.textContent = document.querySelector('h1, .title, .subject')?.textContent || '帖子详情';
        notionContainer.appendChild(title);

        // 内容
        const content = document.createElement('div');
        content.className = 'notion-post-content';
        content.innerHTML = postContent.innerHTML;
        notionContainer.appendChild(content);

        return notionContainer;
    }

    // ==================== 状态管理 ====================
    function saveState() {
        localStorage.setItem('nga-notion-mode', CONFIG.enabled);
    }

    function loadState() {
        const saved = localStorage.getItem('nga-notion-mode');
        if (saved !== null) {
            CONFIG.enabled = saved === 'true';
        }
    }

    function showStatus(message) {
        let status = document.getElementById('notion-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'notion-status';
            document.body.appendChild(status);
        }
        status.textContent = message;
        status.classList.add('show');
        setTimeout(() => status.classList.remove('show'), 2000);
    }

    // ==================== 切换功能 ====================
    function toggleMode() {
        CONFIG.enabled = !CONFIG.enabled;
        saveState();
        applyMode();
        showStatus(CONFIG.enabled ? '摸鱼模式已开启' : '摸鱼模式已关闭');
    }

    function applyMode() {
        // 移除旧样式
        const oldStyle = document.getElementById('notion-custom-style');
        if (oldStyle) oldStyle.remove();

        // 移除旧容器
        const oldContainer = document.getElementById('notion-container');
        if (oldContainer) oldContainer.remove();

        if (!CONFIG.enabled) return;

        // 注入样式
        const style = document.createElement('style');
        style.id = 'notion-custom-style';
        style.textContent = NOTION_STYLES;
        document.head.appendChild(style);

        // 转换页面
        let container;
        if (window.location.pathname.includes('read.php') || document.querySelector('.post, .post-content')) {
            container = transformPostPage();
        } else {
            container = transformThreadList();
        }

        if (container) {
            // 隐藏原站内容
            document.body.style.visibility = 'hidden';
            document.body.appendChild(container);
            setTimeout(() => {
                document.body.style.visibility = 'visible';
            }, 100);
        }
    }

    // ==================== 初始化 ====================
    function init() {
        loadState();

        // 注册菜单命令
        GM_registerMenuCommand('切换摸鱼模式', toggleMode);

        // 快捷键: Ctrl/Cmd + Shift + N (跨平台)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                toggleMode();
            }
        });

        // 页面加载完成后应用状态
        if (CONFIG.enabled) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', applyMode);
            } else {
                applyMode();
            }
        }

        console.log('NGA Notion 摸鱼模式已加载 v' + CONFIG.styleVersion);
    }

    init();
})();
