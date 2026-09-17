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

    // 主题列表页（thread.php）：实测 `#topicrows > tbody > tr.row1/.row2.topicrow`
    boardTable: ['#m_threads #topicrows', '#topicrows', 'table.forumbox'],
    boardRow: [
        '#topicrows > tbody > tr.topicrow',
        'tr.topicrow',
        '#topicrows tr',
        'table.forumbox tbody tr',
        '.topicrow',
    ],
    boardTitle: ['td.c2 a.topic', 'a.topic', 'td.c2 a[href*="read.php"]'],
    // 标签有两处：标题里的 span.t_k_c{n} 前缀、以及右侧 span.titleadd2 > a
    boardTag: ['td.c2 span.titleadd2 a', 'td.c2 span[class^="t_k_"]', 'span[class^="t_k_"]'],
    boardAuthor: ['td.c3 a.author', 'a.author', 'td.c3 a[href*="uid="]'],
    boardDate: ['td.c3 span.postdate', 'span.silver.postdate', '.postdate'],
    // 实测：回复数在 td.c1 的 a.replies 里，td.c4 是「最后回复」（时间 + 人）
    boardReplies: ['td.c1 a.replies', 'td.c1 .replies'],
    boardLastReply: ['td.c4 a.replydate', 'td.c4 .replydate'],
    boardLastReplyUser: ['td.c4 .replyer', 'td.c4 span.replyer'],

    // 帖子页（read.php）：实测 #m_posts_c > table.forumbox.postbox 是**整个**楼层列表，
    // 真正的「一层楼」是里面的 tr.postrow（首楼 id 为 post1strow0，其余无 id）
    postRow: [
        '#m_posts_c tr.postrow',
        'tr.postrow',
        '[id^="post1strow"]',
        '.postrow',
        'table.postrow',
    ],
    postContent: ['[id^="postcontent"]', '.postcontent', '.ubbcode', '.post_content'],
    postSubject: ['[id^="postsubject"]', '.postsubject'],
    postAuthorBlock: ['[id^="postauthor"]', '.posterInfoLine', '[id^="posterinfo"]', '.posterinfo', 'td.c1'],
    postAuthorName: ['.author', 'a.userlink', '.block_txt', '[name="uid"]'],
    postTime: ['[id^="postdate"]', '.postdatec', '.postdate', '.postInfo'],
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

/**
 * 正文元素的正主：`p#postcontent{N}.postcontent`。
 *
 * 坑：NGA 外面还有个包装元素 `span#postcontentandsubject{N}`，它同样会被
 * `[id^="postcontent"]` 命中，而且位置更靠前。早先用「前缀匹配」判断，
 * 结果把包装元素当成了正文，渲染出一块「锁定角标 + 标题 + 正文」的外壳。
 */
const CONTENT_ID_RE = /^postcontent\d+$/i;

export function findContentEl(node) {
    if (!isElement(node)) return null;
    if (CONTENT_ID_RE.test(node.id || '')) return node;

    const candidates = node.querySelectorAll('[id^="postcontent"], .postcontent');
    for (const candidate of candidates) {
        if (CONTENT_ID_RE.test(candidate.id || '') || candidate.classList.contains('postcontent')) {
            return candidate;
        }
    }
    return null;
}

/**
 * 帖子页：`commonui.postArg.data` 的每一项就是一层楼。
 * 2026-09 实测字段：i / pC / subjectC / contentC / signC / uInfoC / pInfoC / postBtnC /
 * pid / pAid / postTime（unix 秒）/ recommend（赞数）/ comment / score …
 *
 * 坑：NGA 自己渲染的过程中 contentC 会先指向容器（td），渲染完才变成正文元素，
 * 所以这里统一归一化 —— 只要不是正文元素，就往里找 `[id^=postcontent]`。
 */
/**
 * 楼层项：`postArg.data` 里除了楼层还混着贴条/其它东西，
 * 实测只有楼层同时满足「有 contentC 元素」和「有数字 i」。
 */
export function postArgFloors(doc) {
    const view = pageGlobals(doc);
    const arg = view && view.commonui && view.commonui.postArg;
    if (!arg || !arg.data) return [];
    return Object.values(arg.data).filter((item) => isElement(item && item.contentC) && 'i' in item);
}

/**
 * 站点数据里每层楼的正文元素是否已经就位。
 * 实测 NGA 是分阶段渲染：楼层行/容器先出现，正文元素后出现（contentC 一度指向容器）。
 * @returns {boolean|null} null 表示页面还没有站点数据，调用方自己用 DOM 判断
 */
export function isPostContentReady(doc) {
    const floors = postArgFloors(doc);
    if (!floors.length) return null;
    return floors.every((item) => Boolean(findContentEl(item.contentC)));
}

function readPostArg(doc) {
    const items = postArgFloors(doc);
    if (!items.length) return null;

    return items.map((item, index) => {
        const raw = item.contentC;
        const inner = findContentEl(raw);
        const recommend = Number(item.recommend);

        return {
            pid: item.pid ? String(item.pid) : '',
            uid: item.pAid != null ? String(item.pAid) : '',
            index: typeof item.i === 'number' ? item.i : index,
            contentEl: inner || raw,
            subjectEl: isElement(item.subjectC) ? item.subjectC : null,
            authorEl: isElement(item.uInfoC) ? item.uInfoC : null,
            containerEl: isElement(item.pC) ? item.pC : null,
            time: formatStamp(item.postTime),
            recommend: Number.isFinite(recommend) ? recommend : null,
        };
    });
}

/** unix 秒 → 「2026-09-14 12:33」（后面的 compactTime 认这个格式） */
function formatStamp(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return '';
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (part) => String(part).padStart(2, '0');
    return (
        date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
        ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
    );
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

/**
 * 首页：板块目录。
 *
 * 实测结构（ngabbs.com 首页）是「标题块 + 内容块」分离的：
 *   <div class="catenew"><h2 class="catetitle">:: 网事杂谈 ::</h2></div>   ← 只有标题，没有链接
 *   <div class="catenew"> …46 个 fid 链接… <h2 class="catetitle">:: IT软硬件 ::</h2> … </div>
 * 所以不能「一个 .catenew 一组」，改成按文档顺序走：遇到 .catetitle 就开新组，
 * 之后的 fid 链接都归它，直到下一个标题。这样标题块、子标题、混排三种情况都能覆盖。
 */
function parseHome(doc, url) {
    const groups = [];
    const seen = new Set();
    let current = null;

    const walker = doc.createTreeWalker(
        doc.body || doc.documentElement,
        NodeFilter.SHOW_ELEMENT,
        null
    );

    const flush = () => {
        if (current && current.forums.length) groups.push(current);
    };

    let node = walker.currentNode;
    while (node) {
        if (node.classList && node.classList.contains('catetitle')) {
            flush();
            const name = cleanText(node.textContent).replace(/^[:：\s]+/, '').replace(/[:：\s]+$/, '');
            // 首页有一块占位标题是字面量 "undefined"，忽略它，继续归到上一组
            current = name && name !== 'undefined' ? { name, forums: [] } : null;
        } else if (node.tagName === 'A' && current) {
            const href = node.getAttribute('href') || '';
            const fid = href.match(/fid=(-?\d+)/);
            const label = cleanText(node.textContent).replace(/\s+/g, '');
            if (fid && label) {
                const id = Number(fid[1]);
                if (!seen.has(id)) {
                    seen.add(id);
                    current.forums.push({ fid: id, name: label, url: absolute(href, url) });
                }
            }
        }
        node = walker.nextNode();
    }
    flush();

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

/**
 * 标题处理：
 * 1. 标题里内嵌的 `span.t_k_c{n}` 前缀（NGA 用来上色的小标签）要去掉，单独当标签用；
 * 2. 实测还有一部分主题的标签是**纯文本前缀**（`[本赛区赛事]标题…`），一并摘出来。
 */
function pickTitle(titleEl) {
    if (!titleEl) return { title: '', inlineTag: '' };
    const clone = titleEl.cloneNode(true);
    const inline = clone.querySelector('span[class^="t_k_"]');
    const inlineTag = cleanText(inline && inline.textContent);
    if (inline) inline.remove();

    let title = cleanText(clone.textContent);
    let prefix = '';
    const match = title.match(/^[[【]([^\]】]{1,12})[\]】]\s*/);
    if (match) {
        prefix = match[1];
        title = title.slice(match[0].length);
    }

    return { title: title || cleanText(titleEl.textContent), inlineTag: inlineTag || prefix };
}

/** 标签去掉方括号：[联盟赛事] -> 联盟赛事 */
function cleanTag(value) {
    return cleanText(value).replace(/^[[【]|[】\]]$/g, '').trim();
}

/** 把 replies / views 这类「数字或者没」统一成数字 */
function statNumber(node) {
    const value = digits(node && node.textContent);
    return Number.isFinite(value) ? value : null;
}

/**
 * 把一行主题变成模型。两条取数路径（站点数据 / 选择器兜底）共用这一份，
 * 免得两边逻辑跑偏。
 */
function buildThread({ row, titleEl, tid, authorEl, url }) {
    const { title, inlineTag } = pickTitle(titleEl);
    const href = absolute(titleEl.getAttribute('href'), url);
    const tidFromHref = (href.match(/tid=(\d+)/) || [])[1] || '';
    const tagEl = first(row, SEL.boardTag);
    const tag = cleanTag(cleanText(tagEl && tagEl.textContent) || inlineTag);
    const authorNode = authorEl || first(row, SEL.boardAuthor);
    const dateEl = first(row, SEL.boardDate);
    const lastReplyEl = first(row, SEL.boardLastReply);
    const lastReplyUserEl = first(row, SEL.boardLastReplyUser);
    const repliesNode = first(row, SEL.boardReplies);

    // 实测：回复数在 td.c1 a.replies；只有老结构才把「回复/查看」放在 td.c4
    let replies = statNumber(repliesNode);
    let views = null;
    if (replies === null) {
        const cells = Array.from(row.querySelectorAll('td'));
        const statText = cleanText(cells.length >= 4 ? cells[3].textContent : '');
        const statNumbers = statText.match(/\d+/g) || [];
        if (statNumbers.length) replies = Number(statNumbers[0]);
        if (statNumbers.length > 1) views = Number(statNumbers[1]);
    }

    const lastReplyTime = cleanText(
        (lastReplyEl && (lastReplyEl.getAttribute('title') || lastReplyEl.textContent)) || ''
    );
    const lastReplyUser = cleanText(lastReplyUserEl && lastReplyUserEl.textContent);

    return {
        tid: String(tid || tidFromHref),
        title,
        url: href || `read.php?tid=${tid}`,
        tag,
        author: cleanText(authorNode && authorNode.textContent),
        authorUrl: absolute(authorNode && authorNode.getAttribute('href'), url),
        time: cleanText(dateEl && dateEl.textContent),
        replies,
        views,
        lastReply: [lastReplyTime, lastReplyUser].filter(Boolean).join(' · ').slice(0, 40),
        excerpt: cleanText(
            (first(row, ['td.c2 .topic_content', '.topic_content', '.topic_desc']) || {}).textContent || ''
        ),
        isPinned: isPinnedRow(row, titleEl, tag),
    };
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
            const built = buildThread({
                row,
                titleEl: item.titleEl,
                tid: item.tid,
                authorEl: item.authorEl,
                url,
            });
            pushThread(built);
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
            pushThread(buildThread({ row, titleEl, url }));
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
                item.containerEl ||
                (item.authorEl && item.authorEl.closest('tr')) ||
                item.contentEl.closest('tr') ||
                item.contentEl.parentElement;
            const author = pickAuthor(container, item.authorEl);
            // 赞数优先用站点数据，没有再去 DOM 里找
            const recommend =
                item.recommend != null
                    ? item.recommend
                    : digits(cleanText((first(container, SEL.postRecommend) || {}).textContent || ''));

            posts.push({
                pid: item.pid,
                floor: offset + index + 1,
                isOp: index === 0,
                author: author.name || '匿名',
                authorUrl: author.url,
                uid: item.uid || author.uid,
                time: item.time || pickTime(container),
                recommend,
                subject: pickSubject(item.subjectEl),
                sourceEl: item.contentEl,
            });
        });
        return posts;
    }

    const rawRows = all(doc, SEL.postRow).filter((row) => findContentEl(row) || first(row, SEL.postContent));
    // 去掉被其他行包住的嵌套行（table.postbox 的 tr 会被两条选择器同时命中）
    const rows = rawRows.filter((row) => !rawRows.some((other) => other !== row && other.contains(row)));

    rows.forEach((row, index) => {
        // 这里同样要用精确查找：`[id^="postcontent"]` 会先命中包装元素
        const contentEl = findContentEl(row) || first(row, SEL.postContent);
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
