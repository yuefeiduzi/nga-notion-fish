/**
 * sanitize.js —— 原站正文 → 干净 DOM（第二个核心模块）
 *
 * 思路不是「把 HTML 重新拼一遍」（那样必然丢掉嵌套、列表、表格），
 * 而是「克隆 → 拆掉杂质 → 就地改写」：保留原始结构，只把危险/无用的东西拿掉，
 * 剩下的交给 CSS 排版。这是 Reader Mode 的经典做法，代码量小、保真度高。
 */

import { icon } from '../core/dom.js';

/** 直接删掉的节点（签名 / 贴条 / 广告 / 站内控件都在这里） */
const STRIP_SELECTORS = [
    'script',
    'style',
    'noscript',
    'link',
    'meta',
    'iframe',
    'embed',
    'object',
    'applet',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    '[hidden]',
    '[aria-hidden="true"]',
    '.postBtnPos',
    '.postInfo',
    '.posterinfo',
    '.posterInfoLine',
    '.recommendvalue',
    '.goodbad',
    '[class*="goodbad"]',
    '.postsign',
    '.postsignC',
    // 正文里若还混着楼层标题 / 锁定角标，去掉（标题已在上层单独展示）
    '[id^="postsubject"]',
    '.vertmod',
    '.signature',
    '.sigline',
    '[id^="postsign"]',
    '.ubbcode-tips',
    '#ubbcode_tips',
    '.postTips',
    '.tip',
    '.tip_s',
    '.ad',
    '.ad_',
    '[class*="adsbygoogle"]',
    '[class*="advert"]',
    '.pager',
    '.post_medal',
    '.user_tag',
    '.r_container',
    // 贴条（楼层内的小评论）：结构杂、信息密度低，清理掉保持版面干净
    '.comment_c',
    '.comment_c_1',
    '.comment_c_2',
    // 附件区的标题与「展开附件」按钮（真正的附件图片已经在正文里了）
    '.postbodysubtitle',
    '.contentFullWidthButton',
];

const INLINE_IMAGE_RE = /(smilie|smiley|post_smiley|e\d{2}\.gif|\/emot)/i;

/**
 * @param {Element} sourceEl  原站正文容器
 * @param {object}  options   { baseUrl, hideImages }
 * @returns {DocumentFragment}
 */
export function sanitizeContent(sourceEl, options = {}) {
    const fragment = document.createDocumentFragment();
    if (!sourceEl) return fragment;

    const baseUrl = options.baseUrl || location.href;
    const hideImages = options.hideImages !== false;

    // 换一个文档来源时（DOMParser），importNode 会把节点搬到当前 document
    const working = document.importNode(sourceEl, true);

    // 顺序有讲究：
    // 1. 折叠块必须先转 —— NGA 用 style="display:none" 藏内容，先走 removeNoise 会把正文删掉
    // 2. 引用/折叠的类名转换必须在 scrubAttributes 之前 —— 后者会把 .quote/.collapse 洗掉
    convertCollapse(working);
    convertQuotes(working, baseUrl);
    removeNoise(working);
    unwrapLegacyTags(working);
    convertVideos(working, baseUrl);
    scrubAttributes(working, baseUrl);
    processImages(working, baseUrl, hideImages, options);
    processLinks(working, baseUrl);
    tidyWhitespace(working);

    while (working.firstChild) fragment.appendChild(working.firstChild);
    return fragment;
}

/* --------------------------------------------------------------------------
   1. 删除
   -------------------------------------------------------------------------- */

function removeNoise(root) {
    for (const selector of STRIP_SELECTORS) {
        let nodes;
        try {
            nodes = root.querySelectorAll(selector);
        } catch {
            continue;
        }
        nodes.forEach((node) => node.remove());
    }
    // 隐藏元素：原站用 style 藏起来的内容（如重复的标题）没有阅读价值
    root.querySelectorAll('[style]').forEach((node) => {
        const style = node.getAttribute('style') || '';
        if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) node.remove();
    });
}

/** NGA 老页面会混用 <font>，直接摊平保留文字 */
function unwrapLegacyTags(root) {
    root.querySelectorAll('font, marquee, center').forEach((node) => {
        if (node.tagName === 'CENTER') return;
        node.replaceWith(...Array.from(node.childNodes));
    });
}

/* --------------------------------------------------------------------------
   2. 属性清洗（含链接/图片地址补全）
   -------------------------------------------------------------------------- */

function scrubAttributes(root, baseUrl) {
    const nodes = [root, ...root.querySelectorAll('*')];
    for (const node of nodes) {
        Array.from(node.attributes || []).forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on')) {
                node.removeAttribute(attr.name);
                return;
            }
            // 内联样式一律丢掉：暗色模式下原站颜色几乎必然出戏
            if (name === 'style' || name === 'color' || name === 'bgcolor' || name === 'face') {
                node.removeAttribute(attr.name);
                return;
            }
            if (name === 'class') {
                const kept = (attr.value || '')
                    .split(/\s+/)
                    .filter((item) => item && !/^(quote|collapse|postcontent|ubbcode|postrow|postsubject)/.test(item));
                if (kept.length) node.setAttribute('class', kept.join(' '));
                else node.removeAttribute('class');
            }
        });
    }
    return baseUrl;
}

/* --------------------------------------------------------------------------
   3. 引用块
   -------------------------------------------------------------------------- */

function convertQuotes(root, baseUrl) {
    // 从内到外处理，保证嵌套引用也被转换
    const quotes = Array.from(root.querySelectorAll('div.quote, .quote, blockquote')).reverse();
    for (const node of quotes) {
        if (node.tagName === 'BLOCKQUOTE') continue;

        const quote = document.createElement('blockquote');
        quote.className = 'ngr-quote';

        // 头部：Post by 某某 (时间) —— NGA 用 <b> 或 <div class="quote_head">
        const headNode = node.querySelector(':scope > b, :scope > strong, :scope > .quote_head, :scope > div.quote_head');
        if (headNode) {
            const head = document.createElement('div');
            head.className = 'ngr-quote-head';
            // 保留原文（作者名会带链接、时间会保留），只是把 <b> 这层壳摊平
            while (headNode.firstChild) head.appendChild(headNode.firstChild);
            headNode.remove();
            if (clean(head.textContent)) quote.appendChild(head);
        }

        // 去掉开头的换行
        while (node.firstChild && node.firstChild.nodeType === 3 && !node.firstChild.textContent.trim()) {
            node.firstChild.remove();
        }
        if (node.firstChild && node.firstChild.nodeName === 'BR') node.firstChild.remove();

        while (node.firstChild) quote.appendChild(node.firstChild);
        node.replaceWith(quote);
    }
    return baseUrl;
}

/* --------------------------------------------------------------------------
   4. 折叠块 [collapse]
   -------------------------------------------------------------------------- */

/**
 * 实测结构（ngabbs.com）：
 *   <div class="collapse_btn"><button name="collapseSwitchButton">+</button> 标题文字</div>
 *   <div class="collapse_content" style="display:none"></div>   ← 内容通常是空的！
 * 真正的内容是用户点击时由 NGA 的 JS 去拉的（ubbcode.collapse.load），
 * 所以别假装能展开：内容为空就渲染一行「需在原站展开」的提示，有内容才转 <details>。
 */
function convertCollapse(root) {
    Array.from(root.querySelectorAll('.collapse_content')).forEach((node) => {
        const btn = node.previousElementSibling;
        const hasButton = Boolean(btn && btn.classList && btn.classList.contains('collapse_btn'));
        const label = hasButton ? buttonLabel(btn) : '';
        const hasContent = Boolean(clean(node.textContent)) || Boolean(node.querySelector('img, table, pre'));

        if (!hasContent) {
            const note = document.createElement('div');
            note.className = 'ngr-collapse-note';
            note.textContent = `${label ? label + ' ' : ''}（折叠内容需在原站展开）`;
            if (hasButton) btn.replaceWith(note);
            else node.replaceWith(note);
            node.remove();
            return;
        }

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = label || '展开';
        details.appendChild(summary);
        while (node.firstChild) details.appendChild(node.firstChild);
        if (hasButton) {
            btn.replaceWith(details);
            node.remove();
        } else {
            node.replaceWith(details);
        }
    });

    // 老结构与残留的折叠按钮
    root.querySelectorAll('div.collapse').forEach((node) => {
        const titleNode = node.querySelector(':scope > .collapse_title, :scope > .collapse_head, :scope > b');
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = (titleNode && clean(titleNode.textContent)) || '展开';
        if (titleNode) titleNode.remove();
        details.appendChild(summary);
        while (node.firstChild) details.appendChild(node.firstChild);
        node.replaceWith(details);
    });
    root.querySelectorAll('.collapse_btn').forEach((node) => node.remove());
}

/** 折叠按钮的文字：去掉那个「+」按钮和图标 */
function buttonLabel(btn) {
    const clone = btn.cloneNode(true);
    clone.querySelectorAll('button, img, svg').forEach((node) => node.remove());
    return clean(clone.textContent);
}

/* --------------------------------------------------------------------------
   5. 视频 / Flash
   -------------------------------------------------------------------------- */

function convertVideos(root, baseUrl) {
    root.querySelectorAll('div.video, .video_wrap, .ubbcode_video').forEach((node) => {
        const link = document.createElement('a');
        link.className = 'ngr-video';
        link.href = node.getAttribute('data-src') || node.getAttribute('href') || baseUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '视频内容（点击在原站查看）';
        node.replaceWith(link);
    });
}

/* --------------------------------------------------------------------------
   6. 图片
   -------------------------------------------------------------------------- */

export function pickImageSrc(img) {
    const candidates = [
        img.getAttribute('data-src'),
        img.getAttribute('data-original'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-srcorg'),
        img.getAttribute('file'),
        img.getAttribute('src'),
    ];
    for (const value of candidates) {
        if (!value) continue;
        if (/^(about:blank|data:image\/gif)/i.test(value)) continue;
        return value;
    }
    return '';
}

function processImages(root, baseUrl, hideImages, options) {
    root.querySelectorAll('img, [data-src][class*="img"]').forEach((node) => {
        if (node.tagName !== 'IMG') return;

        const rawSrc = pickImageSrc(node);
        const src = absolute(rawSrc, baseUrl);
        const width = Number(node.getAttribute('width')) || 0;
        const height = Number(node.getAttribute('height')) || 0;
        const isSmall = (width && width <= 28) || (height && height <= 28) || INLINE_IMAGE_RE.test(rawSrc);
        const alt = node.getAttribute('alt') || node.getAttribute('title') || '';

        if (!src) {
            // 拿不到地址：NGA 的图片是懒加载的，没滚动到就一直是 about:blank。
            // 不要静默删掉（会凭空少内容），给一个能点回原站的占位。
            const fallback = document.createElement('a');
            fallback.className = 'ngr-img-ph';
            fallback.href = options.url || options.baseUrl || location.href;
            fallback.target = '_blank';
            fallback.rel = 'noopener noreferrer';
            fallback.title = '这张图在原站是懒加载的，需要滚动才会加载';
            fallback.appendChild(icon('image', 14));
            fallback.appendChild(document.createTextNode('图片（懒加载，点原站查看）'));
            node.replaceWith(fallback);
            return;
        }

        // 表情：保持行内小图标，不受无图模式影响
        if (isSmall) {
            node.setAttribute('src', src);
            node.setAttribute('alt', alt);
            node.classList.add('ngr-inline-img');
            node.removeAttribute('width');
            node.removeAttribute('height');
            ['data-src', 'data-original', 'data-lazy-src', 'file'].forEach((attr) => node.removeAttribute(attr));
            return;
        }

        if (!hideImages) {
            node.setAttribute('src', src);
            node.setAttribute('loading', 'lazy');
            node.setAttribute('decoding', 'async');
            node.setAttribute('alt', alt);
            return;
        }

        // 无图模式：换成占位按钮，点击可单独加载
        const holder = document.createElement('button');
        holder.type = 'button';
        holder.className = 'ngr-img-ph';
        holder.dataset.src = src;
        holder.dataset.alt = alt;
        holder.title = alt || src;
        holder.appendChild(icon('image', 14));
        holder.appendChild(document.createTextNode(alt ? `图片 · ${alt.slice(0, 40)}` : '图片（点击加载）'));
        holder.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            revealPlaceholder(holder);
        });
        node.replaceWith(holder);
    });
}

/** 把单个占位符换成真图 */
export function revealPlaceholder(placeholder) {
    const img = document.createElement('img');
    img.setAttribute('src', placeholder.dataset.src || '');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    if (placeholder.dataset.alt) img.setAttribute('alt', placeholder.dataset.alt);
    placeholder.replaceWith(img);
    return img;
}

/** 整页「显示图片」：把当页所有占位符替换为真图 */
export function revealAllImages(root) {
    const placeholders = Array.from(root.querySelectorAll('.ngr-img-ph'));
    placeholders.forEach((item) => revealPlaceholder(item));
    root.classList.remove('ngr-hide-images');
    return placeholders.length;
}

/* --------------------------------------------------------------------------
   7. 链接
   -------------------------------------------------------------------------- */

function processLinks(root, baseUrl) {
    root.querySelectorAll('a[href]').forEach((node) => {
        const href = absolute(node.getAttribute('href'), baseUrl);
        if (!href) {
            node.replaceWith(...Array.from(node.childNodes));
            return;
        }
        node.setAttribute('href', href);
        node.setAttribute('title', clean(node.textContent).slice(0, 80) || href);
        if (/^https?:/i.test(href) && !/(^|\.)(ngabbs\.com|nga\.cn|178\.com)$/i.test(new URL(href).hostname)) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });
}

/* --------------------------------------------------------------------------
   8. 收尾
   -------------------------------------------------------------------------- */

function tidyWhitespace(root) {
    // 连续 <br> 合并成两个
    let brRun = 0;
    root.querySelectorAll('br').forEach((node) => {
        brRun += 1;
        if (brRun > 2) node.remove();
        else if (node.nextSibling && node.nextSibling.nodeName !== 'BR') brRun = 0;
    });

    // 干掉空白元素
    root.querySelectorAll('div, p, span').forEach((node) => {
        if (node.children.length) return;
        if (clean(node.textContent)) return;
        node.remove();
    });
}

function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function absolute(href, baseUrl) {
    if (!href) return '';
    if (/^(javascript:|#)/i.test(href)) return '';
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return '';
    }
}
