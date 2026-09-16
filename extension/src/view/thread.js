/**
 * thread.js —— 帖子页：楼层正文
 * 视觉上对应 aihot 的日报正文：左侧数字编号 + 右侧正文，细线分隔
 */

import { el, icon, compactTime } from '../core/dom.js';
import { sanitizeContent } from '../nga/sanitize.js';
import { pageHead, pager, button, linkButton, emptyState } from './parts.js';

export function renderThread(model, ctx) {
    const wrap = el('div', { class: 'ngr-page ngr-reading' });
    const board = model.board || {};
    const hideImages = ctx.settings.hideImages;

    wrap.appendChild(
        pageHead({
            kicker: [
                board.name ? { text: board.name, url: board.url || '' } : { text: 'NGA' },
                model.page.max > 1 ? { time: `${model.page.current} / ${model.page.max} 页` } : null,
                model.onlyAuthor ? { text: '只看楼主' } : null,
            ],
            title: model.title || '帖子',
            meta: [
                model.totalReplies != null
                    ? `共 ${model.totalReplies} 条回复`
                    : model.page.max > 1
                      ? `本页 ${model.posts.length} 楼`
                      : `${model.posts.length} 楼`,
                model.totalReplies != null && model.page.max > 1 ? `本页 ${model.posts.length} 楼` : null,
                model.posts[0] && model.posts[0].time ? compactTime(model.posts[0].time) : null,
            ],
            actions: [
                button(hideImages ? '显示图片' : '无图模式', {
                    icon: 'image',
                    active: hideImages,
                    onclick: (event) => ctx.toggleImages(undefined, event.currentTarget),
                }),
                model.posts[0] && model.posts[0].uid
                    ? linkButton('只看楼主', onlyAuthorUrl(model), {
                          active: Boolean(model.onlyAuthor),
                      })
                    : null,
                linkButton('原站', model.url, { external: true, title: '在原站打开（可回复/点赞）' }),
                button('刷新', { icon: 'refresh', onclick: () => ctx.reload() }),
            ],
        })
    );

    if (!model.posts.length) {
        wrap.appendChild(emptyState('这一页没有楼层'));
    }

    const floors = el('div', { class: 'ngr-floors' });
    model.posts.forEach((post) => floors.appendChild(renderFloor(post, ctx, model)));
    wrap.appendChild(floors);

    if (model.page.max > 1) {
        wrap.appendChild(pager({ current: model.page.current, max: model.page.max, baseUrl: model.url, window: 2 }));
    }

    // 页码 > 1 时把首楼标题也带上，方便记住在读什么
    return wrap;
}

function onlyAuthorUrl(model) {
    const url = new URL(model.url, location.href);
    const uid = model.posts[0] && model.posts[0].uid;
    if (uid) url.searchParams.set('authorid', uid);
    return url.href;
}

function renderFloor(post, ctx, model) {
    const article = el('article', {
        class: 'ngr-floor' + (post.isOp ? ' is-op' : ''),
        id: post.pid ? `pid${post.pid}` : null,
    });

    article.appendChild(el('span', { class: 'ngr-floor-marker', text: String(post.floor).padStart(2, '0') }));

    const body = el('div', { class: 'ngr-floor-body' });

    // ---- 楼层元信息 ----
    const meta = el('div', { class: 'ngr-floor-meta' });
    if (post.authorUrl) {
        meta.appendChild(el('a', { class: 'ngr-floor-author', href: post.authorUrl, text: post.author }));
    } else {
        meta.appendChild(el('span', { class: 'ngr-floor-author', text: post.author }));
    }
    if (post.isOp) meta.appendChild(el('span', { class: 'ngr-pill', text: '楼主' }));
    if (post.time) meta.appendChild(el('time', { text: compactTime(post.time) }));
    if (post.recommend) {
        const recommend = el('span', { class: 'ngr-recommend', title: '赞同数' });
        recommend.appendChild(icon('heart', 12));
        recommend.appendChild(el('span', { text: String(post.recommend) }));
        meta.appendChild(recommend);
    }
    body.appendChild(meta);

    // ---- 小标题（首楼标题与帖子标题重复时不重复展示）----
    const subject = post.subject && post.subject !== model.title ? post.subject : '';
    if (subject) body.appendChild(el('h2', { class: 'ngr-floor-subject', text: subject }));

    // ---- 正文 ----
    const content = el('div', { class: 'ngr-content' });
    content.appendChild(
        sanitizeContent(post.sourceEl, {
            baseUrl: model.url,
            hideImages: ctx.settings.hideImages,
        })
    );
    if (!content.childNodes.length) {
        content.appendChild(el('p', { class: 'ngr-content-empty', text: '（本楼没有可显示的内容）' }));
    }
    body.appendChild(content);

    // ---- 悬停操作 ----
    const actions = el('div', { class: 'ngr-floor-actions' });

    const copyBtn = el('button', { class: 'ngr-floor-action', type: 'button', text: '复制楼层链接' });
    copyBtn.addEventListener('click', () => {
        const url = floorUrl(model, post);
        navigator.clipboard
            .writeText(url)
            .then(() => ctx.toast('楼层链接已复制'))
            .catch(() => ctx.toast(url));
    });
    actions.appendChild(copyBtn);

    if (post.authorUrl) {
        actions.appendChild(el('a', { class: 'ngr-floor-action', href: post.authorUrl, text: 'TA 的主题' }));
    }
    actions.appendChild(
        el('a', {
            class: 'ngr-floor-action',
            href: model.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            text: '原站位置',
        })
    );

    body.appendChild(actions);
    article.appendChild(body);
    return article;
}

function floorUrl(model, post) {
    const url = new URL(model.url, location.href);
    url.searchParams.delete('page');
    if (post.pid) url.searchParams.set('pid', post.pid);
    return url.href;
}
