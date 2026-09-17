/**
 * shell.js —— 应用外壳：侧边栏 + 滚动主区 + 主题开关 + 应急伪装层
 *
 * 只负责「框」和导航，不知道 NGA 的任何细节；页面内容由 view/*.js 填进 main。
 */

import { el, append, icon, origin } from '../core/dom.js';
import { copyDiagnostics } from '../core/diagnose.js';

/** 侧边栏左上角的品牌名。注意：设置里的 `brandText` 是另一件事——那是应急伪装用的标签页标题 */
const BRAND = 'NGA 阅读器';

/** 板块链接：去掉 page —— 侧边栏里的板块名应该回到第一页，而不是停在当前页 */
function boardHref(board) {
    if (!board || !board.url) return '';
    try {
        const url = new URL(board.url, location.href);
        url.searchParams.delete('page');
        return url.href;
    } catch {
        return board.url;
    }
}

export function createShell(ctx) {
    const root = el('div', { id: 'ngr-root' });
    const side = el('aside', { class: 'ngr-side' });
    const main = el('main', { class: 'ngr-main', tabindex: '-1', id: 'ngr-main' });
    const inner = el('div', { class: 'ngr-main-inner' });
    const topButton = el(
        'button',
        { class: 'ngr-top', type: 'button', title: '回到顶部', onclick: () => scrollToTop() },
        icon('up', 16)
    );
    const toastNode = el('div', { class: 'ngr-toast' });

    main.appendChild(inner);
    append(root, [side, main, topButton, toastNode]);
    document.body.appendChild(root);

    const boss = createBossLayer();
    root.appendChild(boss.node);

    let toastTimer = 0;
    let currentModel = null;

    function scrollToTop() {
        main.scrollTo({ top: 0, behavior: 'smooth' });
    }

    main.addEventListener('scroll', () => {
        topButton.classList.toggle('is-visible', main.scrollTop > 900);
    });

    function toast(message) {
        toastNode.textContent = message;
        toastNode.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastNode.classList.remove('is-visible'), 1800);
    }

    /** 侧边栏：内容 / 板块 / 更多 */
    function renderSidebar(model) {
        currentModel = model;
        const settingsNow = ctx.settings;
        side.textContent = '';

        const brand = el(
            'a',
            { class: 'ngr-brand', href: '/', title: '回到板块首页' },
            el('span', { class: 'ngr-brand-mark', text: 'R' }),
            el('span', { text: BRAND })
        );
        brand.addEventListener('click', (event) => {
            event.preventDefault();
            ctx.navigate('/');
        });
        side.appendChild(brand);

        // ---- 内容 ----
        side.appendChild(el('div', { class: 'ngr-side-group', text: '内容' }));
        const navBox = el('nav', { class: 'ngr-side-nav' });
        navBox.appendChild(sideLink({ iconName: 'home', label: '板块首页', href: '/', active: model.kind === 'home' }));
        side.appendChild(navBox);

        // ---- 板块 ----
        side.appendChild(el('div', { class: 'ngr-side-group', text: '板块' }));
        const boardBox = el('nav', { class: 'ngr-side-nav' });

        const favorites = settingsNow.favorites.slice().reverse();
        const currentBoard = model.board && model.board.name ? model.board : null;
        const parentBoard = model.board && model.board.parent && model.board.parent.name ? model.board.parent : null;
        const isCurrentFavorite =
            currentBoard && favorites.some((item) => String(item.fid) === String(currentBoard.fid));

        // 合集（子版块）页：母版块也列出来，否则用户从这里回不到上一个版面
        if (parentBoard && !favorites.some((item) => String(item.fid) === String(parentBoard.fid))) {
            boardBox.appendChild(
                sideLink({ iconName: 'list', label: parentBoard.name, href: boardHref(parentBoard) })
            );
        }

        if (currentBoard && !isCurrentFavorite) {
            boardBox.appendChild(
                sideLink({
                    iconName: 'list',
                    label: currentBoard.name,
                    href: boardHref(currentBoard),
                    active: true,
                    // 合集页没有自己的 fid，收藏按钮留着也没用（点下去什么都不会发生）
                    star: currentBoard.fid
                        ? { on: false, onclick: () => ctx.toggleFavorite(currentBoard) }
                        : null,
                })
            );
        }

        if (!favorites.length && !currentBoard && !parentBoard) {
            boardBox.appendChild(el('div', { class: 'ngr-side-empty', text: '还没有收藏板块，在板块页点 ☆ 收藏' }));
        }

        favorites.forEach((item) => {
            boardBox.appendChild(
                sideLink({
                    iconName: 'list',
                    label: item.name,
                    href: `${origin()}thread.php?fid=${item.fid}`,
                    active: Boolean(currentBoard && String(currentBoard.fid) === String(item.fid)),
                    star: { on: true, onclick: () => ctx.toggleFavorite(item) },
                })
            );
        });
        side.appendChild(boardBox);

        // ---- 最近浏览 ----
        if (settingsNow.recents.length) {
            side.appendChild(el('div', { class: 'ngr-side-group', text: '最近' }));
            const recentsBox = el('nav', { class: 'ngr-side-nav' });
            settingsNow.recents.slice(0, 6).forEach((item) => {
                recentsBox.appendChild(
                    sideLink({
                        iconName: 'book',
                        label: item.title || item.tid,
                        href: item.url,
                        active: Boolean(model.tid && String(model.tid) === String(item.tid)),
                    })
                );
            });
            side.appendChild(recentsBox);
        }

        // ---- 更多 ----
        const foot = el('div', { class: 'ngr-side-foot' });
        foot.appendChild(
            sideLink({
                iconName: 'image',
                label: '无图模式',
                active: settingsNow.hideImages,
                onclick: () => ctx.toggleImages(),
            })
        );
        foot.appendChild(
            sideLink({
                iconName: 'moon',
                label: '应急伪装',
                active: settingsNow.stealth,
                title: '开启后标签页标题变得人畜无害，连按两下 Esc 可立刻切到假页面',
                onclick: () => ctx.toggleStealth(),
            })
        );
        foot.appendChild(
            sideLink({
                iconName: 'link',
                label: '复制诊断信息',
                title: '解析不对时点这里，把现场复制给开发者',
                onclick: async () => {
                    const { ok } = await copyDiagnostics();
                    ctx.toast(ok ? '诊断信息已复制' : '诊断信息已生成');
                },
            })
        );
        foot.appendChild(sideLink({ iconName: 'refresh', label: '退出阅读模式', onclick: () => ctx.disable() }));

        foot.appendChild(themeToggle(settingsNow.theme, (theme) => ctx.setTheme(theme)));
        side.appendChild(foot);
    }

    function sideLink(options) {
        const node = el('a', {
            class: 'ngr-side-link' + (options.active ? ' is-active' : ''),
            href: options.href || '#',
            title: options.title || options.label,
        });
        node.appendChild(icon(options.iconName || 'list', 17)).setAttribute('class', 'ngr-side-icon');
        node.appendChild(el('span', { class: 'ngr-side-link-text', text: options.label }));
        if (options.count) node.appendChild(el('span', { class: 'ngr-side-count', text: options.count }));
        if (options.star) {
            const star = el('button', {
                class: 'ngr-star' + (options.star.on ? ' is-on' : ''),
                type: 'button',
                title: options.star.on ? '取消收藏' : '收藏板块',
            });
            star.appendChild(icon('star', 14));
            star.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                options.star.onclick();
            });
            node.appendChild(star);
        }
        if (options.onclick && !options.href) {
            node.addEventListener('click', (event) => {
                event.preventDefault();
                options.onclick();
            });
        }
        return node;
    }

    function themeToggle(current, onChange) {
        const wrap = el('div', { class: 'ngr-theme-toggle', role: 'group', 'aria-label': '主题' });
        const thumb = el('span', { class: 'ngr-theme-thumb' });
        thumb.dataset.pos = current || 'auto';
        wrap.appendChild(thumb);

        [
            { key: 'dark', iconName: 'moon', label: '深色' },
            { key: 'auto', iconName: 'auto', label: '跟随系统' },
            { key: 'light', iconName: 'sun', label: '浅色' },
        ].forEach((item) => {
            const button = el('button', {
                class: 'ngr-theme-opt' + (current === item.key ? ' is-active' : ''),
                type: 'button',
                title: item.label,
                'aria-label': item.label,
            });
            button.appendChild(icon(item.iconName, 15));
            button.addEventListener('click', () => onChange(item.key));
            wrap.appendChild(button);
        });
        return wrap;
    }

    function createBossLayer() {
        const node = el('div', { class: 'ngr-boss', hidden: true });
        node.appendChild(el('h1', { text: 'Q3 项目进度对齐（内部资料）' }));
        node.appendChild(
            el('p', {
                text: '本周重点：完成接口联调与回归测试。风险项：依赖服务灰度窗口延后，需与平台组确认排期。',
            })
        );
        const table = el('table');
        const head = el('tr');
        ['模块', '负责人', '状态'].forEach((text) => head.appendChild(el('th', { text })));
        table.appendChild(head);
        [
            ['数据同步', 'Ross', '进行中'],
            ['权限模块', 'Ross', '待评审'],
            ['埋点上报', 'Ross', '已完成'],
        ].forEach((row) => {
            const tr = el('tr');
            row.forEach((cell) => tr.appendChild(el('td', { text: cell })));
            table.appendChild(tr);
        });
        node.appendChild(table);
        node.appendChild(el('p', { text: '按 Esc Esc 可切回。' }));
        return {
            node,
            show() {
                node.hidden = false;
            },
            hide() {
                node.hidden = true;
            },
            toggle() {
                node.hidden = !node.hidden;
                return !node.hidden;
            },
            get visible() {
                return !node.hidden;
            },
        };
    }

    return {
        root,
        side,
        main,
        inner,
        boss,
        toast,
        renderSidebar,
        scrollToTop,
        clear() {
            inner.textContent = '';
        },
    };
}
