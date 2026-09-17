/**
 * board.js —— 板块页：帖子列表
 * 视觉上对应 aihot 的「日期列表」：编号 + 标题 + 一行元信息，细线分隔
 */

import { el, icon, compactTime, shortNumber } from '../core/dom.js';
import { pageHead, pager, button, emptyState, joinMeta } from './parts.js';

export function renderBoard(model, ctx) {
    const wrap = el('div', { class: 'ngr-page ngr-board' });
    const board = model.board || {};
    const starred = board.fid ? ctx.isFavorite(board.fid) : false;

    wrap.appendChild(
        pageHead({
            kicker: [
                // 合集（子集）页：把母版块放在前面，点一下就能回去
                board.parent ? { text: board.parent.name, url: board.parent.url } : null,
                board.name ? { text: board.name, url: '' } : { text: '板块' },
                model.page.max > 1 ? { time: `${model.page.current} / ${model.page.max} 页` } : null,
            ],
            title: board.name ? board.name : '帖子列表',
            meta: [
                `${model.threads.length} 个主题`,
                model.page.max > 1 ? `第 ${model.page.current} 页` : null,
                board.stid ? `stid ${board.stid}` : board.fid ? `fid ${board.fid}` : null,
            ],
            actions: [
                board.fid
                    ? button(starred ? '已收藏' : '收藏板块', {
                          icon: 'star',
                          active: starred,
                          onclick: () => ctx.toggleFavorite(board),
                      })
                    : null,
                button('刷新', { icon: 'refresh', onclick: () => ctx.reload() }),
            ],
        })
    );

    if (!model.threads.length) {
        wrap.appendChild(emptyState('这个板块当前页没有帖子'));
        return wrap;
    }

    const list = el('div', { class: 'ngr-threads' });
    model.threads.forEach((thread, index) => {
        const row = el('a', { class: 'ngr-thread', href: thread.url, title: thread.title });

        row.appendChild(el('span', { class: 'ngr-thread-marker', text: String(index + 1).padStart(2, '0') }));

        const body = el('div', { class: 'ngr-thread-body' });

        const top = el('div', { class: 'ngr-thread-top' });
        if (thread.isPinned) top.appendChild(el('span', { class: 'ngr-tag is-pinned', text: '置顶' }));
        if (thread.isSubset) {
            top.appendChild(
                el('span', {
                    class: 'ngr-tag is-subset',
                    text: '合集',
                    title: '这是一个合集（子版块），点开是它自己的主题列表',
                })
            );
        }
        if (thread.tag) top.appendChild(el('span', { class: 'ngr-tag', text: thread.tag }));
        if (top.childNodes.length) body.appendChild(top);

        body.appendChild(el('h2', { class: 'ngr-thread-title', text: thread.title }));

        const replies = el('span', { class: 'ngr-num' });
        replies.appendChild(icon('list', 12));
        replies.appendChild(el('span', { text: ` ${shortNumber(thread.replies)} 回复` }));

        const meta = el('div', { class: 'ngr-thread-meta' });
        joinMeta([
            thread.author ? el('span', { text: thread.author }) : null,
            thread.time ? el('time', { text: compactTime(thread.time) }) : null,
            thread.replies != null ? replies : null,
            thread.views ? el('span', { class: 'ngr-num', text: `${shortNumber(thread.views)} 阅` }) : null,
            thread.lastReply ? el('span', { class: 'ngr-num', text: `最后回复 ${thread.lastReply}` }) : null,
        ]).forEach((node) => meta.appendChild(node));
        if (meta.childNodes.length) body.appendChild(meta);

        if (thread.excerpt) body.appendChild(el('p', { class: 'ngr-thread-excerpt', text: thread.excerpt }));

        row.appendChild(body);
        list.appendChild(row);
    });
    wrap.appendChild(list);

    if (model.page.max > 1) {
        wrap.appendChild(
            pager({ current: model.page.current, max: model.page.max, baseUrl: model.url, window: 2 })
        );
    }

    return wrap;
}
