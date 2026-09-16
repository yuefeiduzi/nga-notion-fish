/**
 * app.js —— 控制器
 *
 * 把「取页 → 解析 → 渲染 → 路由」串起来，并负责主题、快捷键、应急伪装。
 * 这一层不做任何 DOM 解析（在 nga/parse.js）也不做任何排版（在 view/）。
 */

import { parsePage, routeKind, detectBlocked, PAGE } from './nga/parse.js';
import { loadDocument } from './nga/fetch.js';
import { renderHome } from './view/home.js';
import { renderBoard } from './view/board.js';
import { renderThread } from './view/thread.js';
import { createShell } from './view/shell.js';
import { button, notice } from './view/parts.js';
import { copyDiagnostics } from './core/diagnose.js';
import { revealAllImages } from './nga/sanitize.js';
import {
    getSettings,
    patchSettings,
    onSettingsChanged,
    applyTheme,
    toggleFavorite as storeToggleFavorite,
    rememberThread,
} from './core/settings.js';
import { origin } from './core/dom.js';

const SKIP_KEY = 'ngr-skip';
const DARK_FAVICON =
    'data:image/svg+xml,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#176b75"/><path d="M9 8h11a3 3 0 0 1 3 3v13H12a3 3 0 0 1-3-3V8Z" fill="#fff" opacity=".92"/><path d="M13 13h7M13 17h7M13 21h4" stroke="#176b75" stroke-width="1.6" stroke-linecap="round"/></svg>'
    );

const state = {
    settings: null,
    model: null,
    shell: null,
    originalTitle: '',
    faviconNodes: [],
    lastEscape: 0,
    unsubscribe: null,
};

/* --------------------------------------------------------------------------
   入口
   -------------------------------------------------------------------------- */

export async function start(settings) {
    // 用户主动跳过 / 上次选择「以原站方式打开」
    const params = new URLSearchParams(location.search);
    if (params.get('ngr') === 'off' || sessionStorage.getItem(SKIP_KEY) === '1') {
        if (params.get('ngr') === 'off') sessionStorage.setItem(SKIP_KEY, '1');
        return;
    }

    const kind = routeKind(location.href);
    if (kind === PAGE.UNKNOWN) return; // 不支持的页面：保持原站

    await whenDomReady();

    state.settings = settings;
    state.originalTitle = document.title;
    document.documentElement.classList.add('ngr-active');
    applyTheme(settings.theme);
    applyScale(settings);
    applyStealth(settings);
    applyFontScale(settings);

    state.shell = createShell(buildContext());

    // 原站可以停止加载了：图片/脚本/样式都不需要
    try {
        window.stop();
    } catch {
        /* 忽略 */
    }

    // 首次渲染直接用当前页面的 DOM，不额外发请求
    await waitForTarget(kind);
    const model = await parseLive(location.href);
    render(model, { push: false, useLive: true });

    bindEvents();
    state.unsubscribe = onSettingsChanged(handleExternalSettingsChange);
}

function whenDomReady() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 各类页面「内容已就绪」的标志物 */
const READY_SELECTORS = {
    [PAGE.HOME]: '.catenew, a[href*="fid="]',
    [PAGE.BOARD]: '#m_threads .topicrow, .topicrow, #topicrows tr',
    [PAGE.THREAD]: '#m_posts .postrow, .forumbox.postbox, [id^="postcontent"]',
};

/**
 * 等原站把内容渲染出来。
 * NGA 的楼层/列表有一部分是 DOMContentLoaded 之后由它的 JS 插进来的
 * （参照 NGA优化摸鱼体验 的做法：它会等 .small_colored_text_btn 出现再渲染），
 * 所以不能一到 DOMContentLoaded 就解析。
 */
function waitForTarget(kind, timeout = 3000) {
    const selector = READY_SELECTORS[kind];
    if (!selector || document.querySelector(selector)) return Promise.resolve(false);

    return new Promise((resolve) => {
        const started = Date.now();
        const timer = setInterval(() => {
            const ready = Boolean(document.querySelector(selector));
            const blocked = Boolean(detectBlocked(document));
            const expired = Date.now() - started > timeout;
            if (ready || blocked || expired) {
                clearInterval(timer);
                resolve(blocked);
            }
        }, 120);
    });
}

/**
 * 解析当前文档。等过就绪信号之后偶尔还会差一点，所以再短重试几次才认输。
 */
async function parseLive(url, attempts = 5, delay = 400) {
    let model = parsePage(document, url);
    for (let index = 1; index < attempts && model.kind === PAGE.UNKNOWN; index += 1) {
        await sleep(delay);
        model = parsePage(document, url);
    }
    return model;
}

/* --------------------------------------------------------------------------
   渲染
   -------------------------------------------------------------------------- */

function render(model, options = {}) {
    const shell = state.shell;
    const previousUrl = state.model && state.model.url;
    if (options.rememberScroll !== false) shell.rememberScroll(previousUrl);

    state.model = model;

    shell.clear();
    shell.renderSidebar(model);

    const content = buildPage(model);
    shell.inner.appendChild(content);

    if (options.push) {
        const url = model.url || location.href;
        if (url !== location.href) history.pushState({ ngr: true }, '', url);
    }

    const remembered = options.keepScroll ? shell.rememberScroll(model.url) || 0 : 0;
    shell.main.scrollTop = remembered;
    shell.main.focus({ preventScroll: true });

    applyTitle(model);
    recordVisit(model);
}

function buildPage(model) {
    switch (model.kind) {
        case PAGE.HOME:
            return renderHome(model, buildContext());
        case PAGE.BOARD:
            return renderBoard(model, buildContext());
        case PAGE.THREAD:
            return renderThread(model, buildContext());
        case PAGE.BLOCKED:
            return blockedPage(model);
        default:
            return unknownPage(model);
    }
}

/** 「复制诊断信息」按钮：真机上解析失败时用它把现场发回来 */
function diagnoseButton() {
    return button('复制诊断', {
        icon: 'link',
        title: '把这页的解析现场复制到剪贴板，方便排查/反馈',
        onclick: async () => {
            const { ok } = await copyDiagnostics();
            state.shell.toast(ok ? '诊断信息已复制' : '诊断信息已生成');
        },
    });
}

function blockedPage(model) {
    const wrap = document.createElement('div');
    wrap.className = 'ngr-page';
    wrap.appendChild(
        notice(model.message || 'NGA 没有返回正常内容，可能需要在原站登录后再试。')
    );
    const actions = document.createElement('div');
    actions.className = 'ngr-head-actions';
    actions.appendChild(
        button('去登录', {
            icon: 'link',
            onclick: () => {
                location.href = `${origin()}nuke.php?func=ucp_login`;
            },
        })
    );
    actions.appendChild(button('重新加载', { icon: 'refresh', onclick: () => location.reload() }));
    actions.appendChild(button('以原站方式打开', { onclick: () => openOriginal(model.url) }));
    actions.appendChild(diagnoseButton());
    wrap.appendChild(actions);
    return wrap;
}

function unknownPage(model) {
    const wrap = document.createElement('div');
    wrap.className = 'ngr-page';
    wrap.appendChild(notice(model.message || '这个页面暂不支持阅读模式。'));
    const actions = document.createElement('div');
    actions.className = 'ngr-head-actions';
    actions.appendChild(button('以原站方式打开', { onclick: () => openOriginal(model.url) }));
    actions.appendChild(button('回到首页', { onclick: () => navigate(origin()) }));
    actions.appendChild(diagnoseButton());
    wrap.appendChild(actions);
    return wrap;
}

function errorPage(url, error) {
    const wrap = document.createElement('div');
    wrap.className = 'ngr-page';
    wrap.appendChild(notice(`页面加载失败：${error && error.message ? error.message : error}`));
    const actions = document.createElement('div');
    actions.className = 'ngr-head-actions';
    actions.appendChild(button('重试', { icon: 'refresh', onclick: () => navigate(url, { force: true }) }));
    actions.appendChild(button('以原站方式打开', { onclick: () => openOriginal(url) }));
    return wrap;
}

/* --------------------------------------------------------------------------
   导航
   -------------------------------------------------------------------------- */

async function navigate(url, options = {}) {
    // 注意：要用「当前渲染的是哪一页」判断，而不是 location.href ——
    // 浏览器后退时 location 已经变了，但界面还停在上一页
    if (!options.force && state.model && state.model.url === url) return;
    const shell = state.shell;
    shell.setLoading(true);
    try {
        const doc = await loadDocument(url, { force: options.force });
        const model = parsePage(doc, url);
        render(model, { push: options.push !== false, keepScroll: options.keepScroll });
    } catch (error) {
        console.warn('[Reader] 加载失败', error);
        shell.clear();
        shell.renderSidebar(state.model || { kind: PAGE.UNKNOWN, url });
        shell.inner.appendChild(errorPage(url, error));
    } finally {
        shell.setLoading(false);
    }
}

function openOriginal(url) {
    sessionStorage.setItem(SKIP_KEY, '1');
    const target = new URL(url || location.href, location.href);
    target.searchParams.set('ngr', 'off');
    location.href = target.href;
}

/** 拦截站内链接，改成「取 HTML + 自己渲染」，页面不再整页刷新 */
function onClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#')) return;
    if (anchor.target && anchor.target !== '_self') return;

    let url;
    try {
        url = new URL(anchor.href, location.href);
    } catch {
        return;
    }
    if (url.origin !== location.origin) return;
    if (routeKind(url.href) === PAGE.UNKNOWN) return; // 非阅读页交给浏览器

    event.preventDefault();
    navigate(url.href);
}

function onPopState() {
    const url = location.href;
    const model = state.model;
    if (model && model.url === url) return;
    navigate(url, { push: false, keepScroll: true });
}

/* --------------------------------------------------------------------------
   快捷键
   -------------------------------------------------------------------------- */

function onKeyDown(event) {
    const target = event.target;
    if (target && /input|textarea|select/i.test(target.tagName)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    // 连按两下 Esc：应急伪装
    if (event.key === 'Escape') {
        const now = Date.now();
        if (state.settings.bossKey && now - state.lastEscape < 700) {
            state.shell.boss.toggle();
            state.lastEscape = 0;
        } else {
            state.lastEscape = now;
        }
        return;
    }
    if (state.shell.boss.visible && (event.key === 'q' || event.key === 'Q')) {
        state.shell.boss.hide();
        return;
    }
    if (state.shell.boss.visible) return;

    switch (event.key) {
        case 'i':
        case 'I':
            toggleImages();
            break;
        case 't':
        case 'T':
            cycleTheme();
            break;
        case 'g':
            navigate(origin());
            break;
        case 'q':
            disable();
            break;
        case 'r':
            if (state.model) navigate(state.model.url, { force: true, push: false });
            break;
        case 'j':
            scrollBy(320);
            break;
        case 'k':
            scrollBy(-320);
            break;
        default:
            break;
    }
}

function scrollBy(delta) {
    state.shell.main.scrollBy({ top: delta, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   主题 / 图片 / 伪装
   -------------------------------------------------------------------------- */

function applyScale(settings) {
    document.documentElement.style.setProperty('--ng-scale', String((settings.fontScale || 100) / 100));
}

function applyFontScale(settings) {
    applyScale(settings);
}

function applyStealth(settings) {
    if (!settings.stealth) return;
    state.faviconNodes = Array.from(document.querySelectorAll('link[rel*="icon"]'));
    state.faviconNodes.forEach((node) => node.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = DARK_FAVICON;
    link.dataset.ngrIcon = '1';
    document.head.appendChild(link);
}

function applyTitle(model) {
    if (state.settings.stealth) {
        document.title = state.settings.brandText || '阅读器';
        return;
    }
    const name = model && model.title;
    document.title = name ? `${name} · NGA` : state.originalTitle;
}

async function cycleTheme() {
    const order = ['light', 'dark', 'auto'];
    const next = order[(order.indexOf(state.settings.theme) + 1) % order.length];
    await updateSettings({ theme: next });
    state.shell.toast(`主题：${{ light: '浅色', dark: '深色', auto: '跟随系统' }[next]}`);
}

async function toggleImages(force, buttonNode) {
    const next = typeof force === 'boolean' ? force : !state.settings.hideImages;
    if (!next) {
        const count = revealAllImages(state.shell.root);
        await updateSettings({ hideImages: false });
        state.shell.toast(count ? `已加载 ${count} 张图片` : '已切换为显示图片');
    } else {
        await updateSettings({ hideImages: true });
        state.shell.toast('已切换为无图模式');
    }
    return next;
}

async function updateSettings(patch) {
    state.settings = await patchSettings(patch);
    applyTheme(state.settings.theme);
    return state.settings;
}

async function handleExternalSettingsChange(next) {
    const previous = state.settings || {};
    state.settings = next;
    applyTheme(next.theme);
    applyScale(next);

    const needsRender =
        previous.hideImages !== next.hideImages ||
        previous.brandText !== next.brandText ||
        Boolean(previous.stealth) !== Boolean(next.stealth);

    if (needsRender && state.model && state.model.kind) {
        render(state.model, { push: false, rememberScroll: false, keepScroll: true });
    } else {
        applyTitle(state.model);
    }
}

function disable() {
    sessionStorage.setItem(SKIP_KEY, '1');
    patchSettings({ enabled: false }).then(() => location.reload());
}

async function recordVisit(model) {
    if (model.kind !== PAGE.THREAD) return;
    const settings = await rememberThread({
        tid: model.tid,
        title: model.title,
        board: model.board ? model.board.name : '',
        url: model.url,
    });
    state.settings = settings;
    state.shell.renderSidebar(model);
}

/* --------------------------------------------------------------------------
   上下文（交给 view/* 用的回调集合）
   -------------------------------------------------------------------------- */

function buildContext() {
    return {
        get settings() {
            return state.settings;
        },
        navigate,
        reload: () => state.model && navigate(state.model.url, { force: true, push: false }),
        toast: (message) => state.shell.toast(message),
        isFavorite: (fid) =>
            Boolean(
                fid &&
                    state.settings.favorites.some((item) => String(item.fid) === String(fid))
            ),
        toggleFavorite: async (forum) => {
            if (!forum || !forum.fid) return;
            const added = await storeToggleFavorite(forum);
            state.settings = await getSettings();
            state.shell.renderSidebar(state.model || { kind: PAGE.UNKNOWN, url: location.href });
            state.shell.toast(added ? `已收藏「${forum.name}」` : `已取消收藏「${forum.name}」`);
        },
        toggleImages,
        toggleStealth: async () => {
            const next = !state.settings.stealth;
            await updateSettings({ stealth: next });
            state.shell.toast(next ? '应急伪装已开启（连按两下 Esc 唤起假页面）' : '应急伪装已关闭');
        },
        setTheme: async (theme) => {
            await updateSettings({ theme });
            state.shell.renderSidebar(state.model || { kind: PAGE.UNKNOWN, url: location.href });
        },
        disable,
    };
}

/* --------------------------------------------------------------------------
   事件绑定
   -------------------------------------------------------------------------- */

function bindEvents() {
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('keydown', onKeyDown);
}
