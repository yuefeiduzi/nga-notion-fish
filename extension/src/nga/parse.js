/**
 * parse.js —— NGA 页面 → 结构化模型（本项目最核心的模块）
 *
 * 设计原则：
 * 1. 输入永远是「一个 Document」：既可以是当前页面的 document，也可以是 fetch 回来
 *    用 DOMParser 解析的文档。调用方不关心里面是什么。
 * 2. 两条获取路径：
 *    - 首选 NGA 自己挂在页面上的数据（`commonui.postArg.data` / `commonui.topicArg.data`），
 *      它直接给出「正文元素 / 作者元素 / pid / uid」，比猜选择器可靠得多；
 *      只有当前页面（live document）才有，SPA 抓回来的文档没有。
 *    - 兜底走选择器，多路匹配 + 结构校验。
 * 3. 只提取「语义」，不生成任何 HTML —— 排版交给 sanitize.js + view/。
 * 4. 解析失败不抛错，返回 blocked / unknown 状态，调用方负责给一个体面的界面。
 *
 * NGA 真实结构笔记（来自多个在维护的用户脚本，见 docs/nga-dom-notes.md）：
 *   帖子页： #m_posts / #m_posts_c > table.postbox（class="forumbox postbox"）
 *            .postrow 的 .c1 = 作者栏（.posterInfoLine / .avatar / .author / [name=uid]）
 *            .c2 = 内容栏（#postsubject{N} / #postcontent{N} / .ubbcode / .subtitle / .stat）
 *            签名 [id^=postsign] / .sigline，折叠 .collapse_btn + .collapse_content
 *            贴条 .comment_c_1 / .comment_c_2，引用 .quote
 *   列表页： #topicrows > table.forumbox，行 tr.row1/.row2，单元格 .c1~.c4
 *            a.topic 标题、span[class^=t_k_] 标签、a.author、span.silver.postdate
 *   全局：   window.__PAGE = [url, 总页数, 当前页, ...]
 */

export const PAGE = {
    HOME: 'home',
    BOARD: 'board',
    THREAD: 'thread',
    BLOCKED: 'blocked',
    UNKNOWN: 'unknown',
};

const NGA_HOSTS = /(^|\.)(ngabbs\.com|nga\.cn|178\.com)$/i;

/* --------------------------------------------------------------------------
   选择器表
   -------------------------------------------------------------------------- */

const SEL = {
    homeGroup: ['.catenew', '.cate', '#maincate .cate', '.catelist'],
    homeGroupTitle: ['.catetitle', ':scope > h2', ':scope > .cate_title', ':scope > strong'],
    navLinks: ['.nav_link', '.nav a.nav_link', '.nav_root', '#nav a', '.nav a'],

    // 帖子列表页（thread.php）
    boardTable: ['#topicrows', 'table.forumbox', '#threadlist table', '.forumbox'],
    boardRow: ['tr.topicrow', '#topicrows > tbody > tr', '#topicrows tr', 'table.forumbox tbody tr', '.topicrow'],
    boardTitle: ['td.c2 a.topic', 'a.topic', 'td.c2 a[href*="read.php"]', 'a[href*="read.php?tid="]'],
    boardTag: ['td.c2 span[class^="t_k_"]', 'span[class^="t_k_"]', '.topic_tag', '.topic_tag_normal'],
    boardAuthor: ['td.c3 a.author', 'a.author', 'td.c3 a[href*="uid="]', 'a[href*="uid="]'],
    boardDate: ['td.c3 span.postdate', 'span.silver.postdate', '.postdate', 'td.c3 time'],
    boardStats: ['td.c4', '.replies', '.reply_count'],

    // 帖子页（read.php）
    postRow: [
        '#m_posts_c > table.postbox',
        'table.postbox',
        '.forumbox.postbox',
        '[id^="post1strow"]',
        'table.postrow',
        '[class*="postrow"]',
    ],
    postContent: ['[id^="postcontent"]', '.postcontent', '.ubbcode', '.post_content'],
    postSubject: ['[id^="postsubject"]', '.postsubject'],
    postAuthorBlock: ['.posterInfoLine', '[id^="postauthor"]', '.posterinfo', 'td.c1'],
    postAuthorName: ['.author', 'a.userlink', '[name="uid"]', 'a[href*="uid="]'],
    postTime: ['[id^="postdate"]', '.postdate', '.silver'],
    postFloor: ['[id^="postnum"]', '.postfloor', '[class*="postfloor"]'],
    postRecommend: ['.recommendvalue', '[id^="recommendvalue"]', '.post_recommend'],

    pager: ['#pagebar a', '.pagination a', '.pagebar a', 'a[href*="page="]'],
};

/* --------------------------------------------------------------------------
   基础工具
   -------------------------------------------------------------------------- */

function first(root, selectors) {
    for (const selector of selectors) {
        try {
            const node = root.querySelector(selector);
            if (node) return node;
        } catch {
            /* 忽略非法选择器 */
        }
    }
    return null;
}

function all(root, selectors) {
    const out = [];
    for (const selector of selectors) {
        try {
            root.querySelectorAll(selector).forEach((node) => {
                if (!out.includes(node)) out.push(node);
            });
        } catch {
            /* 忽略非法选择器 */
        }
    }
    return out;
}

export function cleanText(value) {
    return String(value == null ? '' : value)
        .replace(/[\u200b\u200e\u200f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function digits(value) {
    const match = String(value == null ? '' : value).match(/\d+/);
    return match ? Number(match[0]) : null;
}

function absolute(href, baseUrl) {
    if (!href) return '';
    if (/^(javascript|#)/i.test(href)) return '';
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return '';
    }
}

export function hostOf(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

function isElement(node) {
    return Boolean(node && node.nodeType === 1);
}

/* --------------------------------------------------------------------------
   NGA 自带的页面数据（比选择器可靠，但只在 live document 上有）
   -------------------------------------------------------------------------- */

function pageGlobals(doc) {
    // DOMParser 出来的文档没有 defaultView，也就没有 NGA 的全局对象
    const view = doc.defaultView || null;
    if (!view) return null;
    if (typeof view.commonui === 'undefined' && typeof view.__PAGE === 'undefined') return null;
    return view;
}

/** 帖子页：commonui.postArg.data 里每项含 pid / pAid / contentC / subjectC / uInfoC / i */
function readPostArg(doc) {
    const view = pageGlobals(doc);
    const arg = view && view.commonui && view.commonui.postArg;
    if (!arg || !arg.data) return null;

    const items = Object.values(arg.data).filter((item) => isElement(item && item.contentC));
    if (!items.length) return null;

    return items.map((item, index) => ({
        pid: item.pid ? String(item.pid) : '',
        uid: item.pAid != null ? String(item.pAid) : '',
        index: typeof item.i === 'number' ? item.i : index,
        contentEl: item.contentC,
        subjectEl: isElement(item.subjectC) ? item.subjectC : null,
        authorEl: isElement(item.uInfoC) ? item.uInfoC : null,
    }));
}

/** 列表页：commonui.topicArg.data 里每项是数组，[1] 标题元素、[2] 作者元素、[7] fid、[8] tid */
function readTopicArg(doc) {
    const view = pageGlobals(doc);
    const arg = view && view.commonui && view.commonui.topicArg;
    if (!arg || !arg.data) return null;

    const items = Object.values(arg.data).filter(
        (item) => Array.isArray(item) && isElement(item[1]) && item[1].tagName === 'A'
    );
    if (!items.length) return null;

    return items.map((item) => ({
        titleEl: item[1],
        authorEl: isElement(item[2]) ? item[2] : null,
        fid: item[7] != null ? String(item[7]) : '',
        tid: item[8] != null ? String(item[8]) : '',
    }));
}

/* --------------------------------------------------------------------------
   路由判断
   -------------------------------------------------------------------------- */

export function routeKind(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return PAGE.UNKNOWN;
    }
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '/index.php') return PAGE.HOME;
    if (/\/thread\.php$/.test(path)) return PAGE.BOARD;
    if (/\/read\.php$/.test(path)) return PAGE.THREAD;
    return PAGE.UNKNOWN;
}

/** NGA 站内链接？（需要由我们的路由接管） */
export function isInternal(url) {
    return NGA_HOSTS.test(hostOf(url));
}

/* --------------------------------------------------------------------------
   错误页 / 权限页识别
   -------------------------------------------------------------------------- */

export function detectBlocked(doc) {
    const title = cleanText(doc.title);
    const body = cleanText(doc.body ? doc.body.textContent : '').slice(0, 600);
    const combined = title + ' ' + body;

    if (/ERROR:1\b/.test(combined) || /未登录/.test(title)) {
        return { kind: PAGE.BLOCKED, reason: 'login', message: 'NGA 要求登录后才能浏览，请先登录再打开阅读模式。' };
    }
    if (/ERROR:15\b/.test(combined) || /访客不能直接访问/.test(combined)) {
        return { kind: PAGE.BLOCKED, reason: 'guest', message: 'NGA 拒绝了访客访问（ERROR:15），登录后即可正常阅读。' };
    }
    if (/ERROR:\d+/.test(combined) && /(权限|不能|失败|删除)/.test(combined)) {
        const code = (combined.match(/ERROR:(\d+)/) || [])[1];
        return { kind: PAGE.BLOCKED, reason: 'denied', message: `NGA 返回了错误页（ERROR:${code}），可能是权限不足或帖子已被删除。` };
    }
    if (
        /需要登录|请登录|登录后/.test(combined) &&
        !doc.querySelector('#topicrows, table.forumbox, [id^="postcontent"], .catenew')
    ) {
        return { kind: PAGE.BLOCKED, reason: 'login', message: 'NGA 要求登录后才能浏览，请先登录再打开阅读模式。' };
    }
    return null;
}

/* --------------------------------------------------------------------------
   面包屑 / 分页
   -------------------------------------------------------------------------- */

function parseNav(doc, baseUrl) {
    const links = all(doc, SEL.navLinks)
        // .nav_root 是「NGA」这一级，跳过
        .filter((node) => !(node.classList && node.classList.contains('nav_root')))
        .map((node) => ({
            name: cleanText(node.textContent),
            url: absolute(node.getAttribute('href'), baseUrl),
        }))
        .filter((item) => item.name && item.url && !/^(首页|论坛首页|NGA)$/.test(item.name));

    const seen = new Set();
    return links.filter((item) => {
        const key = item.url.replace(/[?#].*$/, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parsePageInfo(doc, url) {
    const current = Math.max(1, Number(new URL(url).searchParams.get('page')) || 1);
    let max = current;

    // NGA 全局变量：__PAGE = [url, 总页数, 当前页, ...]
    const view = pageGlobals(doc);
    if (view && Array.isArray(view.__PAGE)) {
        const total = Number(view.__PAGE[1]);
        if (Number.isFinite(total) && total >= 1 && total < 100000) max = Math.max(max, total);
    }

    for (const node of all(doc, SEL.pager)) {
        const href = absolute(node.getAttribute('href'), url);
        const pageFromHref = href ? digits(new URL(href).searchParams.get('page')) : null;
        if (pageFromHref) max = Math.max(max, pageFromHref);
        const text = cleanText(node.textContent);
        if (/^\d+$/.test(text)) max = Math.max(max, Number(text));
    }

    const titleMatch = cleanText(doc.title).match(/-\s*(\d+)\s*页/);
    if (titleMatch) max = Math.max(max, Number(titleMatch[1]));

    return { current, max };
}

function withPage(url, page) {
    const parsed = new URL(url);
    parsed.searchParams.set('page', String(page));
    return parsed.href;
}

/* --------------------------------------------------------------------------
   首页：板块目录
   -------------------------------------------------------------------------- */

function parseHome(doc, url) {
    const groups = [];

    for (const container of all(doc, SEL.homeGroup)) {
        const titleNode = first(container, SEL.homeGroupTitle);
        const name = cleanText(titleNode ? titleNode.textContent : '')
            .replace(/^[:：\s]+/, '')
            .replace(/[:：\s]+$/, '');
        const forums = [];
        container.querySelectorAll('a[href*="fid="]').forEach((link) => {
            const fid = (link.getAttribute('href') || '').match(/fid=(-?\d+)/);
            const label = cleanText(link.textContent);
            if (!fid || !label) return;
            forums.push({
                fid: Number(fid[1]),
                name: label.replace(/\s+/g, ''),
                url: absolute(link.getAttribute('href'), url),
            });
        });
        if (forums.length) groups.push({ name: name || '板块', forums });
    }

    if (!groups.length) {
        const forums = [];
        doc.querySelectorAll('a[href*="fid="]').forEach((link) => {
            const fid = (link.getAttribute('href') || '').match(/fid=(-?\d+)/);
            const label = cleanText(link.textContent);
            if (fid && label) {
                forums.push({ fid: Number(fid[1]), name: label, url: absolute(link.getAttribute('href'), url) });
            }
        });
        if (forums.length) groups.push({ name: '全部板块', forums });
    }

    return { kind: PAGE.HOME, url, groups };
}

/* --------------------------------------------------------------------------
   板块页：帖子列表
   -------------------------------------------------------------------------- */

function isPinnedRow(row, titleEl, tagText) {
    const className = String(row.className || '');
    const titleClass = String((titleEl && titleEl.className) || '');
    // 必须按词匹配：class 里的 topicrow 含 "top"，否则整页都会变成置顶
    const wordHit = /(^|\s)(topicrow_top|topic_top|top|pinned|digest|sticky)(\s|$)/i.test(
        className + ' ' + titleClass
    );
    return wordHit || /置顶|锁定|公告/.test(tagText);
}

function parseBoard(doc, url) {
    const threads = [];
    const seen = new Set();
    const topicArg = readTopicArg(doc);

    const pushThread = (thread) => {
        if (!thread || !thread.tid || seen.has(thread.tid)) return;
        seen.add(thread.tid);
        threads.push(thread);
    };

    if (topicArg) {
        // 优先用 NGA 自己的数据：标题/作者元素直接给，tid/fid 直接给
        for (const item of topicArg) {
            const row = item.titleEl.closest('tr') || item.titleEl;
            const tagEl = first(row, SEL.boardTag);
            const tagText = cleanText(tagEl && tagEl.textContent);
            const dateEl = first(row, SEL.boardDate);
            const cells = Array.from(row.querySelectorAll('td'));
            const statText = cleanText(cells.length >= 4 ? cells[3].textContent : '');
            const statNumbers = statText.match(/\d+/g) || [];

            pushThread({
                tid: item.tid,
                title: cleanText(item.titleEl.textContent),
                url: absolute(item.titleEl.getAttribute('href'), url),
                tag: tagText,
                author: cleanText(item.authorEl && item.authorEl.textContent),
                authorUrl: absolute(item.authorEl && item.authorEl.getAttribute('href'), url),
                time: cleanText(dateEl && dateEl.textContent),
                replies: statNumbers.length ? Number(statNumbers[0]) : null,
                views: statNumbers.length > 1 ? Number(statNumbers[1]) : null,
                lastReply: cleanText(cells.length ? cells[cells.length - 1].textContent : '').slice(0, 40),
                excerpt: '',
                isPinned: isPinnedRow(row, item.titleEl, tagText),
            });
        }
    }

    if (!threads.length) {
        const rows = all(doc, SEL.boardRow).filter((row) => {
            if (row.querySelector('th')) return false;
            return Boolean(first(row, SEL.boardTitle));
        });

        rows.forEach((row) => {
            const titleEl = first(row, SEL.boardTitle);
            if (!titleEl) return;
            const href = absolute(titleEl.getAttribute('href'), url);
            const tidMatch = href.match(/tid=(\d+)/);
            if (!tidMatch) return;

            const tagEl = first(row, SEL.boardTag);
            const authorEl = first(row, SEL.boardAuthor);
            const dateEl = first(row, SEL.boardDate);
            const tagText = cleanText(tagEl && tagEl.textContent);
            const cells = Array.from(row.querySelectorAll('td'));
            const statText = cleanText(
                (cells.length >= 4 && cells[3].textContent) || (first(row, SEL.boardStats) || {}).textContent || ''
            );
            const statNumbers = statText.match(/\d+/g) || [];
            const lastCell = cells.length ? cells[cells.length - 1] : null;

            pushThread({
                tid: tidMatch[1],
                title: cleanText(titleEl.textContent),
                url: href,
                tag: tagText,
                author: cleanText(authorEl && authorEl.textContent),
                authorUrl: absolute(authorEl && authorEl.getAttribute('href'), url),
                time: cleanText(dateEl && dateEl.textContent),
                replies: statNumbers.length ? Number(statNumbers[0]) : null,
                views: statNumbers.length > 1 ? Number(statNumbers[1]) : null,
                lastReply: cleanText(lastCell ? lastCell.textContent : '').slice(0, 40),
                excerpt: cleanText(
                    (first(row, ['td.c2 .topic_content', '.topic_content', '.topic_desc']) || {}).textContent || ''
                ),
                isPinned: isPinnedRow(row, titleEl, tagText),
            });
        });
    }

    const nav = parseNav(doc, url);
    const fidParam = new URL(url).searchParams.get('fid');
    const boardNav = nav[nav.length - 1] || null;
    const fidFromArg = topicArg && topicArg.length ? Number(topicArg[0].fid) : null;

    return {
        kind: PAGE.BOARD,
        url,
        nav,
        board: {
            fid: fidParam ? Number(fidParam) : Number.isFinite(fidFromArg) ? fidFromArg : null,
            name: boardNav ? boardNav.name : cleanText(doc.title).replace(/[-|].*$/, ''),
            url,
        },
        threads,
        page: parsePageInfo(doc, url),
    };
}

/* --------------------------------------------------------------------------
   帖子页：楼层
   -------------------------------------------------------------------------- */

const DATE_RE = /(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})|(\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})/;

function pickTime(row) {
    if (!row) return '';
    const node = first(row, SEL.postTime);
    const fallback = Array.from(row.querySelectorAll('span, div'))
        .map((item) => cleanText(item.textContent))
        .find((item) => DATE_RE.test(item) && item.length < 40);
    const text = cleanText((node && node.textContent) || fallback || '');
    const match = text.match(DATE_RE);
    return match ? match[0] : '';
}

function pickAuthor(row, preferEl) {
    const block = preferEl || (row ? first(row, SEL.postAuthorBlock) : null);
    const nameEl = block ? first(block, SEL.postAuthorName) : row ? first(row, SEL.postAuthorName) : null;
    const link =
        (nameEl && nameEl.tagName === 'A' && nameEl) ||
        (block && first(block, ['a[href*="uid="]', 'a.userlink'])) ||
        (row && first(row, ['a[href*="uid="]', 'a.userlink'])) ||
        null;
    return {
        name: cleanText(nameEl && nameEl.textContent) || cleanText(block && block.textContent).slice(0, 24),
        url: absolute(link && link.getAttribute('href'), row && row.baseURI ? row.baseURI : location.href),
        uid: ((link && link.getAttribute('href')) || '').match(/uid=(-?\d+)/)?.[1] || '',
    };
}

/**
 * 楼层小标题。
 * NGA 除首楼外的 .postsubject 基本是「Re: 原标题」甚至干脆是 display:none 的壳，
 * 直接展示会变成一排重复标题，所以隐藏的和 Re: 开头的一律不要。
 */
function pickSubject(el) {
    if (!isElement(el)) return '';
    const style = String(el.getAttribute('style') || '').toLowerCase();
    if (el.hasAttribute('hidden') || /display\s*:\s*none/.test(style)) return '';
    const text = cleanText(el.textContent);
    if (!text) return '';
    if (/^(re|回复|回復)\s*[:：]/i.test(text)) return '';
    return text;
}

function parsePosts(doc, url, page) {
    const posts = [];
    const offset = (page.current - 1) * 20;
    const argItems = readPostArg(doc);

    if (argItems) {
        // NGA 自己的数据：floor 索引在同一页内递增，pid/uid/元素都是现成的
        argItems.forEach((item, index) => {
            const container =
                (item.authorEl && item.authorEl.closest('tr')) ||
                item.contentEl.closest('tr') ||
                item.contentEl.closest('table.postbox') ||
                item.contentEl.parentElement;
            const author = pickAuthor(container, item.authorEl);
            const recommendText = cleanText((first(container, SEL.postRecommend) || {}).textContent || '');

            posts.push({
                pid: item.pid,
                floor: offset + index + 1,
                isOp: index === 0,
                author: author.name || '匿名',
                authorUrl: author.url,
                uid: item.uid || author.uid,
                time: pickTime(container),
                recommend: digits(recommendText),
                subject: pickSubject(item.subjectEl),
                sourceEl: item.contentEl,
            });
        });
        return posts;
    }

    const rawRows = all(doc, SEL.postRow).filter((row) => first(row, SEL.postContent));
    // 去掉被其他行包住的嵌套行（table.postbox 的 tr 会被两条选择器同时命中）
    const rows = rawRows.filter((row) => !rawRows.some((other) => other !== row && other.contains(row)));

    rows.forEach((row, index) => {
        const contentEl = first(row, SEL.postContent);
        if (!contentEl) return;

        // 楼层 id 在不同版本里是「页内序号」或「pid」，两种都试
        const pidNode = first(row, ['[data-pid]']);
        const idSource = [
            row.id,
            contentEl.id,
            row.getAttribute('data-pid'),
            pidNode ? pidNode.getAttribute('data-pid') : '',
        ]
            .filter(Boolean)
            .join(' ');
        const pidMatch = idSource.match(/(\d{6,})/);

        const author = pickAuthor(row);
        const floorNode = first(row, SEL.postFloor);
        const floorDigits = digits(floorNode && floorNode.textContent);
        const subjectEl = first(row, SEL.postSubject);
        const recommendText = cleanText((first(row, SEL.postRecommend) || {}).textContent || '');

        posts.push({
            pid: pidMatch ? pidMatch[1] : '',
            floor: floorDigits || offset + index + 1,
            isOp: index === 0 || /post1strow/i.test(row.id || ''),
            author: author.name || '匿名',
            authorUrl: author.url,
            uid: author.uid,
            time: pickTime(row),
            recommend: digits(recommendText),
            subject: pickSubject(subjectEl),
            sourceEl: contentEl,
        });
    });

    return posts;
}

function parseThread(doc, url) {
    const page = parsePageInfo(doc, url);
    const posts = parsePosts(doc, url, page);
    const nav = parseNav(doc, url);

    // 最后一层面包屑是帖子标题，去掉它拿到板块
    const last = nav[nav.length - 1] || null;
    const normalNav = last && /read\.php/.test(last.url) ? nav.slice(0, -1) : nav.slice();
    const board = normalNav[normalNav.length - 1] || null;

    const firstSubject = posts[0] && posts[0].subject;
    const titleFromDoc = cleanText(doc.title)
        .replace(/[-|]\s*(NGA|艾泽拉斯|玩家社区).*$/i, '')
        .trim();

    const tid = new URL(url).searchParams.get('tid') || '';
    const replyMatch = cleanText(doc.body ? doc.body.textContent.slice(0, 3000) : '').match(
        /(?:回复|帖子)\s*[:：]?\s*(\d+)|共\s*(\d+)\s*(?:条回复|回复)/
    );

    return {
        kind: PAGE.THREAD,
        url,
        nav: normalNav,
        tid,
        title: firstSubject || titleFromDoc,
        board: {
            fid: board ? Number((board.url.match(/fid=(-?\d+)/) || [])[1] || 0) || null : null,
            name: board ? board.name : '',
            url: board ? board.url : '',
        },
        posts,
        page,
        totalReplies: replyMatch ? Number(replyMatch[1] || replyMatch[2]) : null,
        onlyAuthor: new URL(url).searchParams.get('authorid') || '',
    };
}

/* --------------------------------------------------------------------------
   入口
   -------------------------------------------------------------------------- */

/**
 * @param {Document} doc   当前页面或 fetch 得到的文档
 * @param {string}   url   该文档对应的真实 URL（DOMParser 文档没有 baseURI）
 * @returns {object} 见文件末尾模型说明
 */
export function parsePage(doc, url) {
    const blocked = detectBlocked(doc);
    if (blocked) return Object.assign({ url }, blocked);

    switch (routeKind(url)) {
        case PAGE.HOME: {
            const model = parseHome(doc, url);
            return model.groups.length
                ? model
                : { kind: PAGE.UNKNOWN, url, message: '没有在本页找到板块列表。' };
        }
        case PAGE.BOARD: {
            const model = parseBoard(doc, url);
            return model.threads.length
                ? model
                : { kind: PAGE.UNKNOWN, url, message: '没有在本页找到帖子列表。' };
        }
        case PAGE.THREAD: {
            const model = parseThread(doc, url);
            return model.posts.length
                ? model
                : { kind: PAGE.UNKNOWN, url, message: '没有在本页找到帖子内容。' };
        }
        default:
            return { kind: PAGE.UNKNOWN, url, message: '这个页面暂不支持阅读模式。' };
    }
}

export { withPage, parsePageInfo };

/* --------------------------------------------------------------------------
   模型说明
   --------------------------------------------------------------------------
   home   : { kind, url, groups: [{ name, forums: [{ fid, name, url }] }] }
   board  : { kind, url, nav, board: { fid, name, url },
              threads: [{ tid, title, url, tag, author, authorUrl, time,
                          replies, views, lastReply, excerpt, isPinned }],
              page: { current, max } }
   thread : { kind, url, nav, tid, title, board: { fid, name, url },
              posts: [{ pid, floor, isOp, author, authorUrl, uid, time,
                        recommend, subject, sourceEl }],
              page: { current, max }, totalReplies, onlyAuthor }
   blocked: { kind, url, reason, message }
   unknown: { kind, url, message }
   -------------------------------------------------------------------------- */
