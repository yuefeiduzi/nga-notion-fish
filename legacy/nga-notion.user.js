// ==UserScript==
// @name         NGA 摸鱼模式
// @namespace    https://ngabbs.com/
// @version      0.2
// @description  将 NGA 转换为简洁的阅读界面，方便摸鱼浏览
// @license      MIT
// @author       Ross
// @match        https://ngabbs.com/*
// @match        https://*.ngabbs.com/*
// @match        https://bbs.nga.cn/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        enabled: false,
        styleVersion: '2.0.0',
    };

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

    // ==================== DOM 创建工具 ====================
    function createDom(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.childNodes[0];
    }

    // ==================== 样式定义 ====================
    const NOTION_STYLES = `
        #notion-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: #ffffff !important;
            z-index: 2147483647 !important;
            overflow-y: auto !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol" !important;
        }

        #notion-overlay * {
            box-sizing: border-box !important;
        }

        .notion-doc {
            max-width: 900px !important;
            margin: 0 auto !important;
            padding: 64px 96px !important;
        }

        .notion-title {
            font-size: 40px !important;
            font-weight: 700 !important;
            color: #37352f !important;
            line-height: 1.2 !important;
            margin-bottom: 4px !important;
            outline: none !important;
        }

        .notion-meta {
            font-size: 14px !important;
            color: #787774 !important;
            margin-bottom: 48px !important;
        }

        .notion-hr {
            border: none !important;
            border-top: 1px solid #e9e9e8 !important;
            margin: 24px 0 !important;
        }

        .notion-item {
            padding: 8px 0 !important;
            border-bottom: 1px solid #f4f4f3 !important;
            transition: background-color 0.1s ease !important;
        }

        .notion-item:hover {
            background-color: #f7f7f5 !important;
        }

        .notion-item-title {
            font-size: 16px !important;
            font-weight: 500 !important;
            color: #37352f !important;
            margin-bottom: 2px !important;
        }

        .notion-item-title a {
            color: inherit !important;
            text-decoration: none !important;
        }

        .notion-item-title a:hover {
            color: #787774 !important;
        }

        .notion-item-meta {
            font-size: 13px !important;
            color: #9b9a97 !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .notion-item-meta .tag {
            background: #f4f4f3 !important;
            padding: 2px 6px !important;
            border-radius: 3px !important;
            font-size: 12px !important;
        }

        .notion-item-meta .author::before {
            content: "by" !important;
            margin-right: 4px !important;
            color: #9b9a97 !important;
        }

        .notion-back {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 6px 12px !important;
            margin-bottom: 32px !important;
            font-size: 14px !important;
            color: #787774 !important;
            cursor: pointer !important;
            border-radius: 4px !important;
            transition: background-color 0.1s ease !important;
        }

        .notion-back:hover {
            background-color: #f7f7f5 !important;
        }

        .notion-comment {
            padding: 16px 0 !important;
            border-bottom: 1px solid #f4f4f3 !important;
        }

        .notion-comment:first-child {
            border-top: 1px solid #e9e9e8 !important;
            margin-top: 24px !important;
            padding-top: 24px !important;
        }

        .notion-comment-header {
            font-size: 13px !important;
            color: #9b9a97 !important;
            margin-bottom: 8px !important;
        }

        .notion-comment-content {
            font-size: 16px !important;
            line-height: 1.6 !important;
            color: #37352f !important;
        }

        .notion-comment-content p {
            margin: 0 0 12px 0 !important;
        }

        .notion-comment-content p:last-child {
            margin-bottom: 0 !important;
        }

        .notion-comment-content img {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 4px !important;
            margin: 8px 0 !important;
            display: block !important;
        }

        .notion-comment-content h3 {
            font-size: 1.125em !important;
            font-weight: 600 !important;
            margin: 0 0 8px 0 !important;
            color: #37352f !important;
        }

        .notion-comment-content blockquote {
            border-left: 3px solid #e9e9e8 !important;
            margin: 0 0 12px 0 !important;
            padding-left: 16px !important;
            color: #787774 !important;
            font-style: italic !important;
        }

        .notion-quote {
            border-left: 3px solid #e9e9e8 !important;
            background: #f9f9f8 !important;
            padding: 12px 16px !important;
            margin: 12px 0 !important;
            color: #787774 !important;
            font-size: 14px !important;
            border-radius: 0 4px 4px 0 !important;
        }

        .notion-comment-content a {
            color: #37352f !important;
            text-decoration: underline !important;
        }

        .notion-comment-content a:hover {
            color: #787774 !important;
        }

        .notion-comment-content .ubbcode {
            all: unset !important;
        }

        .notion-comment-content .goodbad {
            display: none !important;
        }

        .notion-comment-content .postBtnPos,
        .notion-comment-content .postInfo,
        .notion-comment-content .posterinfo {
            display: none !important;
        }

        .notion-comment-content [style*="display:none"] {
            display: none !important;
        }

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
            z-index: 2147483647 !important;
            pointer-events: none !important;
        }

        #notion-status.show {
            opacity: 1 !important;
        }

        .notion-pagination {
            display: none !important;
        }

        .notion-pagination-fixed {
            position: fixed !important;
            right: 24px !important;
            bottom: 50% !important;
            transform: translateY(50%) !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
            z-index: 2147483647 !important;
            background: #ffffff !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important;
        }

        .notion-pagination-fixed a,
        .notion-pagination-fixed span {
            padding: 6px 12px !important;
            border-radius: 4px !important;
            font-size: 13px !important;
            color: #37352f !important;
            text-decoration: none !important;
            background: transparent !important;
            cursor: pointer !important;
            transition: background-color 0.1s ease !important;
            text-align: center !important;
        }

        .notion-pagination-fixed a:hover {
            background: #f7f7f5 !important;
        }

        .notion-pagination-fixed .current {
            background: #37352f !important;
            color: #ffffff !important;
            font-weight: 500 !important;
        }

        .notion-pagination-fixed .prev,
        .notion-pagination-fixed .next {
            font-size: 12px !important;
            color: #9b9a97 !important;
        }

        .notion-page-info {
            text-align: center !important;
            font-size: 13px !important;
            color: #9b9a97 !important;
            margin-top: 16px !important;
        }

        .notion-breadcrumb {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            gap: 4px !important;
            margin-bottom: 16px !important;
            font-size: 14px !important;
        }

        .notion-breadcrumb a {
            color: #787774 !important;
            text-decoration: none !important;
            transition: color 0.1s ease !important;
        }

        .notion-breadcrumb a:hover {
            color: #37352f !important;
        }

        .breadcrumb-sep {
            color: #9b9a97 !important;
        }

        .notion-group-title {
            font-size: 14px !important;
            font-weight: 600 !important;
            color: #37352f !important;
            margin: 32px 0 12px 0 !important;
            padding-bottom: 8px !important;
            border-bottom: 1px solid #e9e9e8 !important;
        }

        .notion-forum-group {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            margin-bottom: 24px !important;
        }

        .notion-forum-item {
            display: inline-block !important;
            padding: 6px 12px !important;
            background: #f7f7f5 !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            color: #37352f !important;
            text-decoration: none !important;
            transition: background-color 0.1s ease !important;
        }

        .notion-forum-item:hover {
            background: #f0f0ee !important;
            color: #37352f !important;
        }
    `;

    // ==================== 帖子列表页处理 ====================
    function transformThreadList() {
        const root = createDom('<div id="notion-overlay"></div>');
        const doc = createDom('<div class="notion-doc"></div>');
        root.appendChild(doc);

        // 板块导航 - 首页 + 只取第一个 nav
        const breadcrumb = createDom('<div class="notion-breadcrumb"></div>');

        // 首页链接
        const homeLink = createDom('<a href="/">首页</a>');
        breadcrumb.appendChild(homeLink);

        const firstNav = document.querySelector('.nav');
        const navLinks = firstNav?.querySelectorAll('a.nav_link') || [];
        navLinks.forEach((link) => {
            const separator = createDom('<span class="breadcrumb-sep">/</span>');
            breadcrumb.appendChild(separator);
            const a = createDom(`<a href="${link.href}"></a>`);
            a.textContent = link.textContent?.trim() || '';
            breadcrumb.appendChild(a);
        });
        doc.appendChild(breadcrumb);

        // 板块名称
        const boardEl = document.querySelector('.nav_link:last-of-type, .nav a:last-of-type');
        const boardName = boardEl?.textContent?.trim() || 'NGA';

        // 标题
        const title = createDom('<h1 class="notion-title" contenteditable="false"></h1>');
        const pageTitle = document.querySelector('title')?.textContent?.replace(/ NGA.*$/, '') || boardName;
        title.textContent = pageTitle;
        doc.appendChild(title);

        // 查找帖子列表 - NGA 使用 table.forumbox
        const forumTable = document.querySelector('table.forumbox');
        let rows = [];
        if (forumTable) {
            rows = Array.from(forumTable.rows).slice(1);
        }

        if (rows.length === 0) {
            doc.appendChild(createDom('<div class="notion-item">暂无帖子</div>'));
            document.body.appendChild(root);
            return root;
        }

        rows.forEach((row) => {
            const item = createThreadItem(row);
            if (item) doc.appendChild(item);
        });

        // 添加分页功能
        const currentPage = getListCurrentPage();
        const pagination = createListPagination(currentPage);
        if (pagination) {
            root.appendChild(pagination);
        }

        // 页码信息
        const pageInfo = createDom('<div class="notion-page-info"></div>');
        pageInfo.textContent = `第 ${currentPage} 页`;
        doc.appendChild(pageInfo);

        document.body.appendChild(root);
        return root;
    }

    // 列表页分页功能
    function getListCurrentPage() {
        const match = location.search.match(/[?&]page=(\d+)/);
        return match ? parseInt(match[1]) : 1;
    }

    function createListPagination(currentPage) {
        // 查找所有分页链接
        const pageLinks = [];
        document.querySelectorAll('a[href*="page="]').forEach((a) => {
            const match = a.href.match(/[?&]page=(\d+)/);
            if (match) {
                const page = parseInt(match[1]);
                if (!pageLinks.includes(page)) {
                    pageLinks.push(page);
                }
            }
        });

        if (pageLinks.length === 0) return null;

        pageLinks.sort((a, b) => a - b);
        const maxPage = Math.max(...pageLinks, currentPage);

        // 创建固定在右侧的翻页器
        const pagination = createDom('<div class="notion-pagination-fixed"></div>');

        // 显示前后几页的数字
        const pageRange = 3;
        const startPage = Math.max(1, currentPage - pageRange);
        const endPage = Math.min(maxPage, currentPage + pageRange);

        // 上一页
        if (currentPage > 1) {
            const prevLink = createDom(`<a class="prev">←</a>`);
            prevLink.title = '上一页';
            prevLink.onclick = () => goToListPage(currentPage - 1);
            pagination.appendChild(prevLink);
        }

        // 页码数字
        for (let page = startPage; page <= endPage; page++) {
            if (page === currentPage) {
                const span = createDom(`<span class="current">${page}</span>`);
                pagination.appendChild(span);
            } else {
                const link = createDom(`<a>${page}</a>`);
                link.onclick = () => goToListPage(page);
                pagination.appendChild(link);
            }
        }

        // 下一页
        if (currentPage < maxPage) {
            const nextLink = createDom(`<a class="next">→</a>`);
            nextLink.title = '下一页';
            nextLink.onclick = () => goToListPage(currentPage + 1);
            pagination.appendChild(nextLink);
        }

        return pagination;
    }

    function goToListPage(page) {
        const url = new URL(location.href);
        url.searchParams.set('page', page.toString());
        location.href = url.toString();
    }

    function createThreadItem(row) {
        // 获取标题链接 - td.c2 里的 a.topic
        const titleEl = row.querySelector('td.c2 a.topic');
        if (!titleEl) return null;

        const item = createDom('<div class="notion-item"></div>');

        // 标题 - 需要提取完整标题（包含标签）
        const title = createDom('<div class="notion-item-title"></div>');
        const link = createDom(`<a href="${titleEl.href || '#'}"></a>`);
        link.textContent = titleEl.textContent?.trim() || '';
        title.appendChild(link);
        item.appendChild(title);

        // 元信息
        const meta = createDom('<div class="notion-item-meta"></div>');

        // 板块标签 - td.c2 里的颜色标签 span[class^="t_k_"]
        const tagEl = row.querySelector('td.c2 span[class^="t_k_"]');
        if (tagEl) {
            const tag = createDom('<span class="tag"></span>');
            tag.textContent = tagEl.textContent?.trim() || '';
            meta.appendChild(tag);
        }

        // 作者 - td.c3 里的 a.author
        const authorEl = row.querySelector('td.c3 a.author');
        if (authorEl) {
            const author = createDom('<span class="author"></span>');
            author.textContent = authorEl.textContent?.trim() || '';
            meta.appendChild(author);
        }

        // 时间 - td.c3 里的 span.postdate
        const timeEl = row.querySelector('td.c3 span.postdate');
        if (timeEl) {
            const time = createDom('<span class="time"></span>');
            time.textContent = timeEl.textContent?.trim() || '';
            meta.appendChild(time);
        }

        item.appendChild(meta);
        return item;
    }

    // ==================== 帖子详情页处理 ====================
    function transformPostPage() {
        const root = createDom('<div id="notion-overlay"></div>');
        const doc = createDom('<div class="notion-doc"></div>');
        root.appendChild(doc);

        // 板块导航 - 首页 + 只取第一个 nav，移除最后一个（文章标题）
        const breadcrumb = createDom('<div class="notion-breadcrumb"></div>');

        // 首页链接
        const homeLink = createDom('<a href="/">首页</a>');
        breadcrumb.appendChild(homeLink);

        const firstNav = document.querySelector('.nav');
        const navLinks = firstNav?.querySelectorAll('a.nav_link') || [];
        // 移除最后一个（文章标题）
        const boardLinks = Array.from(navLinks).slice(0, -1);
        boardLinks.forEach((link, index) => {
            const separator = createDom('<span class="breadcrumb-sep">/</span>');
            breadcrumb.appendChild(separator);
            const a = createDom(`<a href="${link.href}"></a>`);
            a.textContent = link.textContent?.trim() || '';
            breadcrumb.appendChild(a);
        });
        doc.appendChild(breadcrumb);

        // 获取当前页码和帖子行
        const currentPage = getCurrentPage();
        const postRows = document.querySelectorAll('[id^="post1strow"], [class*="postrow"]');

        postRows.forEach((row) => {
            const comment = createPostComment(row);
            if (comment) doc.appendChild(comment);
        });

        // 添加翻页控件（固定在右侧悬浮）
        const pagination = createPagination(currentPage);
        if (pagination) {
            root.appendChild(pagination);
        }

        // 页码信息（显示在底部）
        const pageInfo = createDom('<div class="notion-page-info"></div>');
        const tid = getTidFromUrl();
        pageInfo.textContent = `帖子 ID: ${tid} · 第 ${currentPage} 页`;
        doc.appendChild(pageInfo);

        document.body.appendChild(root);
        return root;
    }

    function getCurrentPage() {
        const match = location.search.match(/[?&]page=(\d+)/);
        return match ? parseInt(match[1]) : 1;
    }

    function getTidFromUrl() {
        const match = location.search.match(/[?&]tid=(\d+)/);
        return match ? match[1] : '';
    }

    function createPagination(currentPage) {
        // 查找所有分页链接
        const pageLinks = [];
        document.querySelectorAll('a[href*="page="]').forEach((a) => {
            const match = a.href.match(/[?&]page=(\d+)/);
            if (match) {
                const page = parseInt(match[1]);
                if (!pageLinks.includes(page)) {
                    pageLinks.push(page);
                }
            }
        });

        if (pageLinks.length === 0) return null;

        pageLinks.sort((a, b) => a - b);
        const maxPage = Math.max(...pageLinks, currentPage);

        // 创建固定在右侧的翻页器
        const pagination = createDom('<div class="notion-pagination-fixed"></div>');

        // 显示前后几页的数字
        const pageRange = 3; // 显示前后各3页
        const startPage = Math.max(1, currentPage - pageRange);
        const endPage = Math.min(maxPage, currentPage + pageRange);

        // 上一页
        if (currentPage > 1) {
            const prevLink = createDom(`<a class="prev">↑</a>`);
            prevLink.title = '上一页';
            prevLink.onclick = () => goToPage(currentPage - 1);
            pagination.appendChild(prevLink);
        }

        // 页码数字
        for (let page = startPage; page <= endPage; page++) {
            if (page === currentPage) {
                const span = createDom(`<span class="current">${page}</span>`);
                pagination.appendChild(span);
            } else {
                const link = createDom(`<a>${page}</a>`);
                link.onclick = () => goToPage(page);
                pagination.appendChild(link);
            }
        }

        // 下一页
        if (currentPage < maxPage) {
            const nextLink = createDom(`<a class="next">↓</a>`);
            nextLink.title = '下一页';
            nextLink.onclick = () => goToPage(currentPage + 1);
            pagination.appendChild(nextLink);
        }

        return pagination;
    }

    function goToPage(page) {
        const url = new URL(location.href);
        url.searchParams.set('page', page.toString());
        location.href = url.toString();
    }

    function createPostComment(row) {
        // 获取作者
        const authorEl = row.querySelector('[id*="postauthor"], a.userlink');
        const authorName = authorEl?.innerText?.trim() || '匿名';

        // 获取点赞点踩数
        const recommendEl = row.querySelector('.recommendvalue');
        const recommendCount = recommendEl?.textContent?.trim() || '';

        // 获取内容容器
        const contentContainer = row.querySelector('[id*="postcontent"]');
        if (!contentContainer) return null;

        const comment = createDom('<div class="notion-comment"></div>');

        // 头部：作者 + 点赞数
        const header = createDom('<div class="notion-comment-header"></div>');
        let headerText = authorName;
        if (recommendCount) {
            headerText += ` · <svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:middle;margin-bottom:2px"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> ${recommendCount}`;
        }
        header.innerHTML = headerText;
        comment.appendChild(header);

        // 内容区域
        const content = createDom('<div class="notion-comment-content"></div>');

        // 提取标题
        const subjectEl = row.querySelector('[id*="postsubject"]');
        if (subjectEl && subjectEl.textContent?.trim()) {
            const subject = createDom('<h3></h3>');
            subject.textContent = subjectEl.textContent?.trim();
            content.appendChild(subject);
        }

        // 提取内容：支持文本和图片
        extractContent(content, contentContainer);

        comment.appendChild(content);
        return comment;
    }

    function extractContent(container, sourceEl) {
        let currentPara = null;

        // 需要跳过的元素
        const skipSelectors = [
            '.recommendvalue',
            '.postBtnPos',
            '.postInfo',
            '.posterinfo',
            '[class*="goodbad"]',
            '[style*="display:none"]'
        ];

        // 递归处理所有子节点
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                // 文本节点
                const text = node.textContent?.trim();
                if (text) {
                    if (!currentPara) {
                        currentPara = createDom('<p></p>');
                        container.appendChild(currentPara);
                    }
                    if (currentPara.firstChild) {
                        currentPara.textContent += ' ' + text;
                    } else {
                        currentPara.textContent = text;
                    }
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 检查是否需要跳过
                if (node.matches && skipSelectors.some(sel => node.matches(sel))) {
                    return;
                }

                const tagName = node.tagName?.toLowerCase();

                if (node.classList?.contains('quote')) {
                    // 引用 - 用特殊样式显示
                    currentPara = null;
                    const quoteDiv = createDom('<div class="notion-quote"></div>');
                    quoteDiv.textContent = '引用: ' + node.textContent?.trim() || '';
                    container.appendChild(quoteDiv);
                } else if (tagName === 'img') {
                    // 图片 - 获取 src
                    currentPara = null;
                    const img = createDom('<img>');
                    img.src = getImgSrc(node);
                    img.alt = node.alt || '';
                    img.title = node.title || '';
                    container.appendChild(img);
                } else if (tagName === 'br') {
                    // 换行
                    currentPara = null;
                } else if (tagName === 'p' || tagName === 'div') {
                    // 段落或 div，递归处理
                    currentPara = null;
                    node.childNodes.forEach(processNode);
                } else if (tagName === 'a') {
                    // 链接
                    const link = createDom('<a></a>');
                    link.href = node.href || '#';
                    link.textContent = node.textContent?.trim() || node.innerText?.trim() || '';
                    if (!currentPara) {
                        currentPara = createDom('<p></p>');
                        container.appendChild(currentPara);
                    }
                    currentPara.appendChild(link);
                } else {
                    // 其他元素，递归处理子节点
                    node.childNodes?.forEach(processNode);
                }
            }
        }

        // 处理所有子节点
        sourceEl.childNodes.forEach(processNode);

        // 清理空段落
        const paras = container.querySelectorAll('p');
        paras.forEach((p) => {
            if (!p.textContent?.trim()) {
                p.remove();
            }
        });
    }

    function getImgSrc(imgEl) {
        // 尝试多种方式获取图片 src
        return imgEl.src ||
            imgEl.dataset?.src ||
            imgEl.dataset?.lazySrc ||
            imgEl.getAttribute('data-src') ||
            imgEl.getAttribute('data-lazy-src') ||
            imgEl.getAttribute('data-original') ||
            '';
    }

    // ==================== 切换功能 ====================
    function toggleMode() {
        CONFIG.enabled = !CONFIG.enabled;
        saveState();
        applyMode();
        showStatus(CONFIG.enabled ? '摸鱼模式已开启' : '摸鱼模式已关闭');
    }

    function applyMode() {
        // 移除旧内容
        const oldOverlay = document.getElementById('notion-overlay');
        if (oldOverlay) oldOverlay.remove();

        const oldStyle = document.getElementById('notion-style');
        if (oldStyle) oldStyle.remove();

        // 显示原站内容
        const mmc = document.getElementById('mmc');
        if (mmc) mmc.style.display = '';

        if (!CONFIG.enabled) return;

        // 隐藏原站
        if (mmc) mmc.style.display = 'none';

        // 注入样式
        const style = document.createElement('style');
        style.id = 'notion-style';
        style.textContent = NOTION_STYLES;
        document.head.appendChild(style);

        // 判断页面类型 - 使用更精确的匹配
        const pathname = window.location.pathname;
        const isPostPage = pathname === '/read.php' || pathname.startsWith('/read.php?');
        const hasForumbox = document.querySelector('table.forumbox') !== null;

        if (isPostPage) {
            transformPostPage();
        } else if (hasForumbox) {
            transformThreadList();
        } else {
            transformHomepage();
        }
    }

    // ==================== 板块首页处理 ====================
    function transformHomepage() {
        const root = createDom('<div id="notion-overlay"></div>');
        const doc = createDom('<div class="notion-doc"></div>');
        root.appendChild(doc);

        // 标题
        const title = createDom('<h1 class="notion-title" contenteditable="false">NGA 游戏论坛</h1>');
        doc.appendChild(title);

        // 遍历所有板块容器
        const forumContainers = document.querySelectorAll('.catenew');

        forumContainers.forEach((container) => {
            // 获取分类标题（在容器内）
            const titleEl = container.querySelector(':scope > .catetitle, :scope > h2.catetitle');
            const groupName = titleEl?.textContent?.trim()?.replace(/::/g, '').trim() || '';

            // 获取板块链接
            const forumLinks = container.querySelectorAll('a[href*="fid="]');
            if (forumLinks.length === 0) return;

            // 添加分组标题
            if (groupName) {
                const groupTitle = createDom('<div class="notion-group-title"></div>');
                groupTitle.textContent = groupName;
                doc.appendChild(groupTitle);
            }

            // 添加板块列表
            const group = createDom('<div class="notion-forum-group"></div>');
            forumLinks.forEach((link) => {
                const fidMatch = link.href.match(/fid=(-?\d+)/);
                if (!fidMatch) return;

                const forumItem = createDom('<a class="notion-forum-item"></a>');
                forumItem.href = link.href;
                forumItem.textContent = link.textContent?.trim() || '';
                group.appendChild(forumItem);
            });
            doc.appendChild(group);
        });

        document.body.appendChild(root);
    }

    // ==================== 初始化 ====================
    function init() {
        loadState();

        GM_registerMenuCommand('切换摸鱼模式', toggleMode);

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'q') {
                if (/textarea|input/i.test(e.target.tagName)) return;
                e.preventDefault();
                toggleMode();
            }
        });

        if (!CONFIG.enabled) {
            console.log('NGA Notion 摸鱼模式 v' + CONFIG.styleVersion);
            return;
        }

        // 注入样式
        const style = document.createElement('style');
        style.id = 'notion-style';
        style.textContent = NOTION_STYLES;
        document.head.appendChild(style);

        // 根据页面类型等待不同元素
        const pathname = window.location.pathname;
        const isPostPage = pathname === '/read.php' || pathname.startsWith('/read.php?');
        const isThreadPage = pathname === '/thread.php' || pathname.startsWith('/thread.php?');
        const isHomePage = pathname === '/';

        let waitSelector = '';
        if (isPostPage) {
            waitSelector = '[id^="post1strow"], [class*="postrow"]';
        } else if (isThreadPage) {
            waitSelector = 'table.forumbox';
        } else if (isHomePage) {
            waitSelector = '.catenew';
        }

        // 等待原站内容加载完成后应用模式
        function waitAndApply() {
            if (document.querySelector(waitSelector)) {
                applyMode();
            } else {
                setTimeout(waitAndApply, 50);
            }
        }

        // 立即隐藏原站
        const mmc = document.getElementById('mmc');
        if (mmc) mmc.style.display = 'none';

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitAndApply);
        } else {
            waitAndApply();
        }

        console.log('NGA Notion 摸鱼模式 v' + CONFIG.styleVersion);
    }

    if (window.location.pathname === '/'
        || window.location.pathname === '/thread.php'
        || window.location.pathname === '/read.php'
        || window.location.pathname.includes('thread.php')
        || window.location.pathname.includes('read.php')) {
        init();
    }
})();
