/**
 * parts.js —— 页面通用零件：页头、分页器、空态
 */

import { el, append, icon } from '../core/dom.js';

/** 阅读页/列表页的头部（kicker + 大标题 + 元信息 + 操作区） */
export function pageHead(options) {
    const head = el('header', { class: 'ngr-head' });

    const kicker = el('div', { class: 'ngr-kicker' });
    (options.kicker || []).forEach((item) => {
        if (!item) return;
        if (typeof item === 'string') {
            kicker.appendChild(el('span', { text: item }));
        } else if (item.url) {
            kicker.appendChild(el('a', { href: item.url, text: item.text }));
        } else if (item.time) {
            kicker.appendChild(el('time', { text: item.time }));
        } else {
            kicker.appendChild(el('span', { text: item.text }));
        }
    });
    head.appendChild(kicker);

    head.appendChild(el('h1', { class: 'ngr-title', text: options.title || '' }));

    if (options.meta && options.meta.length) {
        const meta = el('div', { class: 'ngr-head-meta' });
        options.meta.filter(Boolean).forEach((item, index) => {
            if (index) meta.appendChild(el('span', { text: '·', 'aria-hidden': 'true' }));
            append(meta, [item]);
        });
        head.appendChild(meta);
    }

    if (options.actions && options.actions.length) {
        const actions = el('div', { class: 'ngr-head-actions' });
        options.actions.filter(Boolean).forEach((node) => actions.appendChild(node));
        head.appendChild(actions);
    }

    return head;
}

/** 圆角按钮 */
export function button(label, options = {}) {
    const node = el('button', {
        class: 'ngr-btn' + (options.active ? ' is-active' : '') + (options.iconOnly ? ' ngr-btn-icon' : ''),
        type: 'button',
        title: options.title || label,
    });
    if (options.icon) node.appendChild(icon(options.icon, 14));
    if (label) node.appendChild(el('span', { text: label }));
    if (options.onclick) node.addEventListener('click', options.onclick);
    return node;
}

/** 链接样式按钮 */
export function linkButton(label, href, options = {}) {
    const node = el('a', {
        class: 'ngr-btn' + (options.active ? ' is-active' : ''),
        href,
        title: options.title || label,
    });
    if (options.icon) node.appendChild(icon(options.icon, 14));
    if (label) node.appendChild(el('span', { text: label }));
    if (options.external) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
    return node;
}

/**
 * 分页器：真实链接（可中键新标签打开），点击交给路由拦截
 * @param {{current:number,max:number,baseUrl:string,window?:number}} options
 */
export function pager(options) {
    const current = Math.max(1, options.current || 1);
    const max = Math.max(current, options.max || 1);
    const span = options.window || 2;
    const wrap = el('nav', { class: 'ngr-pager', 'aria-label': '翻页' });

    const pageUrl = (page) => {
        const url = new URL(options.baseUrl, location.href);
        url.searchParams.set('page', String(page));
        return url.href;
    };

    const chip = (page, label, extraClass) => {
        const node = el('a', {
            class: 'ngr-chip' + (extraClass ? ' ' + extraClass : '') + (page === current ? ' is-active' : ''),
            href: pageUrl(page),
            text: label == null ? String(page) : label,
        });
        if (page === current) node.setAttribute('aria-current', 'page');
        return node;
    };

    if (max > 1) {
        if (current > 1) wrap.appendChild(chip(current - 1, '‹ 上一页'));
        const from = Math.max(1, current - span);
        const to = Math.min(max, current + span);
        if (from > 1) {
            wrap.appendChild(chip(1));
            if (from > 2) wrap.appendChild(el('span', { class: 'ngr-chip is-disabled', text: '…' }));
        }
        for (let page = from; page <= to; page += 1) wrap.appendChild(chip(page));
        if (to < max) {
            if (to < max - 1) wrap.appendChild(el('span', { class: 'ngr-chip is-disabled', text: '…' }));
            wrap.appendChild(chip(max, '末页'));
        }
        if (current < max) wrap.appendChild(chip(current + 1, '下一页 ›'));

        if (max > 12) {
            const jump = el('label', { class: 'ngr-chip-jump' });
            jump.appendChild(el('span', { text: '跳至' }));
            const input = el('input', {
                type: 'number',
                min: '1',
                max: String(max),
                placeholder: String(current),
                'aria-label': '跳转到指定页',
            });
            const go = () => {
                const page = Math.min(max, Math.max(1, Number(input.value) || 1));
                location.href = pageUrl(page);
            };
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') go();
            });
            jump.appendChild(input);
            jump.appendChild(el('span', { text: `/ ${max}` }));
            wrap.appendChild(jump);
        }
    }

    return wrap;
}

export function emptyState(text) {
    return el('div', { class: 'ngr-empty', text });
}

export function notice(text) {
    const node = el('div', { class: 'ngr-notice' });
    node.appendChild(el('span', { text }));
    return node;
}
