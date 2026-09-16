/**
 * parse.js —— NGA 页面 → 结构化模型（本项目最核心的模块）
 *
 * 设计原则：
 * 1. 输入永远是「一个 Document」：既可以是当前页面的 document，也可以是 fetch 回来
 *    用 DOMParser 解析的文档。调用方不关心里面是什么。
 * 2. 所有选择器都是多路兜底（NGA 的 DOM 结构这些年改过好几轮，本地/移动端也不一样）。
 * 3. 只提取「语义」，不生成任何 HTML —— 排版交给 sanitize.js + view/。
 * 4. 解析失败不抛错，返回 blocked / unknown 状态，调用方负责给用户一个体面的界面。
 *
 * 模型定义见文件末尾注释。
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
    navLinks: ['.nav a.nav_link', '.nav a', '#nav a', '.nav_link'],

    boardTable: ['table.forumbox', '#threadlist table', 'table.topiclist', '.forumbox'],
    boardRow: ['tr.topicrow', 'tr.topicrow_top', 'table.forumbox tbody tr', '.topicrow'],
    boardTitle: ['td.c2 a.topic', 'td.c2 a[href*="read.php"]', 'a.topic', 'a[href*="read.php?tid="]'],
    boardTag: ['td.c2 span[class^="t_k_"]', 'span[class^="t_k_"]', '.topic_tag', '.topic_tag_normal'],
    boardAuthor: ['td.c3 a.author', 'td.c3 a[href*="uid="]', 'a.author', 'a[href*="uid="]'],
    boardDate: ['td.c3 span.postdate', 'td.c3 .postdate', 'td.c3 time', '.postdate'],
    boardReplies: ['td.c4', '.replies', '.reply_count'],

    postRow: [
        '[id^="post1strow"]',
        'table.postrow',
        'tr.postrow',
        'div.postrow',
        '[class*="postrow"]',
        '[id^="post"]',
    ],
    postContent: ['[id^="postcontent"]', '.postcontent', '.ubbcode', '.post_content'],
    postSubject: ['[id^="postsubject"]', '.postsubject', 'h2.postsubject'],
    postAuthor: ['[id^="postauthor"] a[href*="uid="]', '[id^="postauthor"] .author', 'a.userlink', '[id^="postauthor"]', '.posterinfo a'],
    postTime: ['[id^="postdate"]', '.postInfo', '.postdate', '.date', '.post_info'],
    postFloor: ['[id^="postnum"]', '.postfloor', '[class*="postfloor"]', '[id*="floor"]'],
    postRecommend: ['.recommendvalue', '[id^="recommendvalue"]', '.post_recommend', '.likevalue'],

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
    if (path === '/' || /^\/(index\.php)?$/.test(path) || path === '/index.php') return PAGE.HOME;
    if (/\/thread\.php$/.test(path)) return PAGE.BOARD;
    if (/\/read\.php$/.test(path)) return PAGE.THREAD;
    if (/\/thread\.php/.test(path)) return PAGE.BOARD;
    if (/\/read\.php/.test(path)) return PAGE.THREAD;
    return PAGE.UNKNOWN;
}

/** NGA 站内链接？（需要由我们的路由接管） */
export function isInternal(url) {
    const host = hostOf(url);
    return NGA_HOSTS.test(host);
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
    if (/ERROR:\d+/.test(combined) && /(权限|不能|失败)/.test(combined)) {
        const code = (combined.match(/ERROR:(\d+)/) || [])[1];
        return { kind: PAGE.BLOCKED, reason: 'denied', message: `NGA 返回了错误页（ERROR:${code}），可能是权限不足或帖子已被删除。` };
    }
    if (/需要登录|请登录|登录后/.test(combined) && !doc.querySelector('table.forumbox, [id^="postcontent"], .catenew')) {
        return { kind: PAGE.BLOCKED, reason: 'login', message: 'NGA 要求登录后才能浏览，请先登录再打开阅读模式。' };
    }
    return null;
}

/* --------------------------------------------------------------------------
   面包屑
   -------------------------------------------------------------------------- */

function parseNav(doc, baseUrl) {
    const links = all(doc, SEL.navLinks)
        .map((node) => ({
            name: cleanText(node.textContent),
            url: absolute(node.getAttribute('href'), baseUrl),
        }))
        .filter((item) => item.name && item.url && !/^(首页|论坛首页|NGA)$/.test(item.name));

    // 去重（同一级可能被多个选择器命中）
    const seen = new Set();
    return links.filter((item) => {
        const key = item.url.replace(/[?#].*$/, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/* --------------------------------------------------------------------------
   分页
   -------------------------------------------------------------------------- */

function parsePageInfo(doc, url) {
    const current = Math.max(1, Number(new URL(url).searchParams.get('page')) || 1);
    let max = current;

    for (const node of all(doc, SEL.pager)) {
        const page = digits(new URL(absolute(node.getAttribute('href'), url) || 'http://x/').searchParams.get('page'));
        if (page) max = Math.max(max, page);
        const text = cleanText(node.textContent);
        if (/^\d+$/.test(text)) max = Math.max(max, Number(text));
    }
    // 「下一页」到不了最后一页时，兜底用标题里的总页数
    const titleMatch = cleanText(doc.title).match(/-\s*(\d+)\s*页/);
    if (titleMatch) max = Math.max(max, Number(titleMatch[1]));

    return { current, max };
}

/** 拼一个同 url 但指定 page 的链接 */
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
        const name = cleanText(titleNode ? titleNode.textContent : '').replace(/^[:：\s]+|[:：\s]+$/g, '');
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
        // 兜底：整页所有 fid 链接塞进一组
        const forums = [];
        doc.querySelectorAll('a[href*="fid="]').forEach((link) => {
            const fid = (link.getAttribute('href') || '').match(/fid=(-?\d+)/);
            const label = cleanText(link.textContent);
            if (fid && label) forums.push({ fid: Number(fid[1]), name: label, url: absolute(link.getAttribute('href'), url) });
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
    // 注意：class 里必须按词匹配，否则 topicrow 会被 /top/ 误判
    const wordHit = /(^|\s)(topicrow_top|topic_top|top|pinned|digest|sticky)(\s|$)/i.test(
        className + ' ' + titleClass
    );
    return wordHit || /置顶|锁定|公告/.test(tagText);
}

function parseBoard(doc, url) {
    const rows = all(doc, SEL.boardRow).filter((row) => {
        if (row.querySelector('th')) return false;
        return Boolean(first(row, SEL.boardTitle));
    });

    const threads = [];
    const seen = new Set();

    rows.forEach((row) => {
        const titleEl = first(row, SEL.boardTitle);
        if (!titleEl) return;
        const href = absolute(titleEl.getAttribute('href'), url);
        const tidMatch = href.match(/tid=(\d+)/);
        if (!tidMatch || seen.has(tidMatch[1])) return;
        seen.add(tidMatch[1]);

        const tagEl = first(row, SEL.boardTag);
        const authorEl = first(row, SEL.boardAuthor);
        const dateEl = first(row, SEL.boardDate);
        const repliesEl = first(row, SEL.boardReplies);
        const tagText = cleanText(tagEl && tagEl.textContent);

        const cells = Array.from(row.querySelectorAll('td'));
        const repliesCell = cells.length >= 4 ? cells[3] : null;
        const lastCell = cells.length ? cells[cells.length - 1] : null;
        const statText = cleanText(repliesCell ? repliesCell.textContent : repliesEl && repliesEl.textContent);
        const statNumbers = statText.match(/\d+/g) || [];

        threads.push({
            tid: Number(tidMatch[1]),
            title: cleanText(titleEl.textContent),
            url: href,
            tag: tagText,
            author: cleanText((authorEl && authorEl.textContent) || ''),
            authorUrl: absolute(authorEl && authorEl.getAttribute('href'), url),
            time: cleanText((dateEl && dateEl.textContent) || ''),
            replies: statNumbers.length ? Number(statNumbers[0]) : null,
            views: statNumbers.length > 1 ? Number(statNumbers[1]) : null,
            lastReply: cleanText(lastCell ? lastCell.textContent : '').slice(0, 40),
            excerpt: cleanText((first(row, ['td.c2 .topic_content', '.topic_content', '.topic_desc']) || {}).textContent || ''),
            isPinned: isPinnedRow(row, titleEl, tagText),
        });
    });

    const nav = parseNav(doc, url);
    const fidMatch = new URL(url).searchParams.get('fid');
    const boardNav = nav[nav.length - 1] || null;

    return {
        kind: PAGE.BOARD,
        url,
        nav,
        board: {
            fid: fidMatch ? Number(fidMatch) : null,
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
    const node = first(row, SEL.postTime);
    const text = cleanText(
        (node && node.textContent) ||
            Array.from(row.querySelectorAll('span, div'))
                .map((item) => cleanText(item.textContent))
                .find((item) => DATE_RE.test(item)) ||
            ''
    );
    const match = text.match(DATE_RE);
    return match ? match[0] : '';
}

function parsePosts(doc, url, page) {
    const rawRows = all(doc, SEL.postRow).filter((row) => first(row, SEL.postContent));
    // 去掉被包含在其他行里的嵌套行，以及重复命中
    const rows = rawRows.filter((row) => !rawRows.some((other) => other !== row && other.contains(row)));

    const posts = [];
    const pageSizeGuess = 20;
    const offset = (page.current - 1) * pageSizeGuess;

    rows.forEach((row, index) => {
        const contentEl = first(row, SEL.postContent);
        if (!contentEl) return;

        const idSource = [row.id, contentEl.id, row.getAttribute('data-pid')].filter(Boolean).join(' ');
        const pid = (idSource.match(/(\d{4,})/) || [])[1] || '';

        const authorEl = first(row, SEL.postAuthor);
        const authorLink = authorEl && authorEl.tagName === 'A' ? authorEl : first(row, ['a[href*="uid="]', 'a.userlink']);
        const uidMatch = (authorLink && authorLink.getAttribute('href') || '').match(/uid=(-?\d+)/);

        const floorNode = first(row, SEL.postFloor);
        const floorDigits = digits(floorNode && floorNode.textContent);
        const floor = floorDigits || offset + index + 1;

        const subjectEl = first(row, SEL.postSubject);
        const recommendText = cleanText((first(row, SEL.postRecommend) || {}).textContent || '');

        posts.push({
            pid,
            floor,
            isOp: floor === 1 || /post1strow/i.test(row.id || ''),
            author: cleanText((authorEl && authorEl.textContent) || '匿名'),
            authorUrl: absolute(authorLink && authorLink.getAttribute('href'), url),
            uid: uidMatch ? uidMatch[1] : '',
            time: pickTime(row),
            recommend: digits(recommendText),
            subject: cleanText(subjectEl && subjectEl.textContent),
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
    const boardNav = nav.length > 1 ? nav[nav.length - 1] : null;
    const normalNav = boardNav && /read\.php/.test(boardNav.url) ? nav.slice(0, -1) : nav.slice();
    const board = normalNav[normalNav.length - 1] || null;

    const firstSubject = posts[0] && posts[0].subject;
    const titleFromDoc = cleanText(doc.title)
        .replace(/[-|]\s*NGA.*$/i, '')
        .replace(/[-|]\s*艾泽拉斯.*$/i, '')
        .trim();

    const tid = new URL(url).searchParams.get('tid') || '';
    const replyMatch = cleanText(doc.body ? doc.body.textContent.slice(0, 2000) : '').match(
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
            return model.groups.length ? model : { kind: PAGE.UNKNOWN, url, message: '没有在本页找到板块列表。' };
        }
        case PAGE.BOARD: {
            const model = parseBoard(doc, url);
            return model.threads.length ? model : { kind: PAGE.UNKNOWN, url, message: '没有在本页找到帖子列表。' };
        }
        case PAGE.THREAD: {
            const model = parseThread(doc, url);
            return model.posts.length ? model : { kind: PAGE.UNKNOWN, url, message: '没有在本页找到帖子内容。' };
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
                          replies, lastReply, excerpt, isPinned }],
              page: { current, max } }
   thread : { kind, url, nav, tid, title, board: { fid, name, url },
              posts: [{ pid, floor, isOp, author, authorUrl, uid, time,
                        recommend, subject, sourceEl }],
              page: { current, max }, totalReplies, onlyAuthor }
   blocked: { kind, url, reason, message }
   unknown: { kind, url, message }
   -------------------------------------------------------------------------- */
