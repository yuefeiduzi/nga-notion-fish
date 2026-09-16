/**
 * diagnose.js —— 一键导出诊断信息
 *
 * 为什么需要它：登录态下的真实 NGA 页面我拿不到，解析失败时只能靠猜。
 * 有了这个，用户在真机上遇到问题时点一下，就能把「NGA 实际渲染出了什么」
 * 变成一段可以贴给开发者的文本 —— 比截图和口头描述有用得多。
 */

import { routeKind, cleanText } from '../nga/parse.js';

const INTERESTING = [
    '#mmc',
    '#m_posts',
    '#m_posts_c',
    '#m_threads',
    '#topicrows',
    'table.forumbox',
    'table.postbox',
    '.postrow',
    '.topicrow',
    '.row1',
    '.row2',
    '.posterInfoLine',
    '.posterinfo',
    '.avatar',
    '#postdate0',
    '#postcontent0',
    '#postsubject0',
    '.postcontent',
    '.ubbcode',
    '.recommendvalue',
    '.postBtnPos',
    '.quote',
    '.collapse_content',
    '.comment_c_1',
    '[id^="postsign"]',
    '.sigline',
    '#pagebar',
    '[name="pageball"]',
    '.nav_link',
    '.catenew',
];

function countSelector(selector) {
    try {
        return document.querySelectorAll(selector).length;
    } catch {
        return -1;
    }
}

function snippet(node, limit = 1200) {
    if (!node) return '';
    const html = node.outerHTML || '';
    return html.length > limit ? `${html.slice(0, limit)}…（截断，共 ${html.length} 字符）` : html;
}

/** 收集可复制的诊断文本 */
export function collectDiagnostics() {
    const view = typeof window === 'undefined' ? null : window;
    const postArg = view && view.commonui && view.commonui.postArg && view.commonui.postArg.data;
    const topicArg = view && view.commonui && view.commonui.topicArg && view.commonui.topicArg.data;

    const hits = {};
    for (const selector of INTERESTING) {
        const count = countSelector(selector);
        if (count > 0) hits[selector] = count;
    }

    const firstContent = document.querySelector('#postcontent0, [id^="postcontent"], .postcontent, .ubbcode');
    const firstRow = document.querySelector('#m_posts_c > table.postbox, table.postbox, .postrow, .topicrow');
    const firstTitle = document.querySelector('td.c2 a.topic, a[href*="read.php?tid="]');
    const firstAuthor = document.querySelector('.posterInfoLine .author, a.author, a.userlink');
    const firstDate = document.querySelector('#postdate0, .postdate, .silver.postdate');

    const lines = [
        '=== NGA 阅读器诊断 ===',
        `时间: ${new Date().toISOString()}`,
        `url: ${location.href}`,
        `routeKind: ${routeKind(location.href)}`,
        `document.title: ${document.title}`,
        `readyState: ${document.readyState}`,
        `__PAGE: ${JSON.stringify(view && view.__PAGE)}`,
        `commonui: ${view && view.commonui ? '有' : '无'}；postArg.data: ${
            postArg ? Object.keys(postArg).length : '无'
        } 项；topicArg.data: ${topicArg ? Object.keys(topicArg).length : '无'} 项`,
        `扩展状态: html.ngr-active=${document.documentElement.classList.contains('ngr-active')}, #ngr-root=${
            document.getElementById('ngr-root') ? '有' : '无'
        }`,
        '',
        '--- 关键选择器命中数 ---',
        JSON.stringify(hits, null, 0),
        '',
        '--- 抽取到的字段 ---',
        `标题: ${cleanText(firstTitle && firstTitle.textContent)}`,
        `作者: ${cleanText(firstAuthor && firstAuthor.textContent)}`,
        `时间: ${cleanText(firstDate && firstDate.textContent)}`,
        `首楼正文文本: ${cleanText(firstContent && firstContent.textContent).slice(0, 200)}`,
        '',
        '--- 第一行 HTML（截断）---',
        snippet(firstRow),
        '',
        '--- 第一段正文 HTML（截断）---',
        snippet(firstContent),
        '',
        '--- body 文本开头 ---',
        cleanText(document.body ? document.body.textContent : '').slice(0, 300),
    ];

    return lines.join('\n');
}

/** 复制到剪贴板；失败时回退到 prompt，保证一定能拿到文本 */
export async function copyDiagnostics() {
    const text = collectDiagnostics();
    try {
        await navigator.clipboard.writeText(text);
        return { ok: true, text };
    } catch {
        try {
            window.prompt('复制下面的诊断信息发给开发者（Ctrl/Cmd+C）', text);
        } catch {
            /* 忽略 */
        }
        return { ok: false, text };
    }
}
