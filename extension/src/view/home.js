/**
 * home.js —— 首页：板块目录
 */

import { el, icon } from '../core/dom.js';
import { pageHead, emptyState } from './parts.js';

export function renderHome(model, ctx) {
    const wrap = el('div', { class: 'ngr-page ngr-home' });
    const total = model.groups.reduce((sum, group) => sum + group.forums.length, 0);

    wrap.appendChild(
        pageHead({
            kicker: [{ text: 'NGA' }, { text: '板块目录' }],
            title: '今天逛哪个板块',
            meta: [`${total} 个板块`, `${model.groups.length} 个分组`],
        })
    );

    model.groups.forEach((group) => {
        const box = el('section', { class: 'ngr-forum-group' });
        box.appendChild(el('div', { class: 'ngr-forum-group-title', text: group.name }));
        const grid = el('div', { class: 'ngr-forum-grid' });

        group.forums.forEach((forum) => {
            const item = el('a', { class: 'ngr-forum-item', href: forum.url, title: forum.name });
            item.appendChild(el('span', { class: 'ngr-forum-name', text: forum.name }));

            const starred = ctx.isFavorite(forum.fid);
            const star = el('button', {
                class: 'ngr-star' + (starred ? ' is-on' : ''),
                type: 'button',
                title: starred ? '取消收藏' : '收藏板块',
            });
            star.appendChild(icon('star', 14));
            star.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                ctx.toggleFavorite(forum);
            });
            item.appendChild(star);
            grid.appendChild(item);
        });

        box.appendChild(grid);
        wrap.appendChild(box);
    });

    if (!model.groups.length) wrap.appendChild(emptyState('没有找到板块'));
    return wrap;
}
