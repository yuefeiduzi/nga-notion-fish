/**
 * app.js —— 控制器
 *
 * 把「取页 → 解析 → 渲染 → 路由」串起来，并负责主题、快捷键、应急伪装。
 * 这一层不做任何 DOM 解析（在 nga/parse.js）也不做任何排版（在 view/）。
 */

import { parsePage, routeKind, detectBlocked, cleanText, PAGE } from './nga/parse.js';
import { renderHome } from './view/home.js';
import { renderBoard } from './view/board.js';
import { renderThread } from './view/thread.js';
import { createShell } from './view/shell.js';
import { button, notice, skeletonPage } from './view/parts.js';
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

    // 先把壳和骨架屏画出来：NGA 的正文要等它自己的 JS 注入，
    // 与其让用户盯着白屏，不如先让他们看到我们的界面（这里也是摘掉 ngr-pending 的时机）
    showSkeleton();

    // 注意：这里千万不能 window.stop()。
    // 实测（ngabbs.com 登录态）：首页与帖子页的正文都是 NGA 自己的 JS 后注入的，
    // 提前掐掉加载会让页面永远停在空壳上（body.innerText 为空的“加载中”页）。
    // 反正原站已经被 CSS 藏起来了，多下几张图不值得拿白屏去换。

    // 等原站把内容渲染出来，再用当前页面的 DOM 解析（不额外发请求）
    await waitForTarget(kind);
    const model = await parseLive(location.href);
    render(model);
    selfHeal(kind);

    bindEvents();
    state.unsubscribe = onSettingsChanged(handleExternalSettingsChange);
}

/**
 * 自愈：NGA 的渲染时序不稳定，偶尔会解析到「还没填内容的容器」。
 * 表现为正文里混着 `#postsubject` 这类本该在外面的东西 —— 发现就隔一会儿重解析，
 * 直到拿到干净的模型（最多试 8 次）。
 */
function selfHeal(kind, attempt = 0) {
    if (kind !== PAGE.THREAD) return;
    // 脏的标志：正文里又套了一个 #postcontent（说明抓到的是包装层/容器）
    const dirty = state.shell.inner.querySelector('.ngr-content [id^="postcontent"]');
    if (!dirty) return;
    if (attempt > 8) return;

    setTimeout(() => {
        const model = parsePage(document, location.href);
        const stillDirty =
            model.kind !== PAGE.THREAD ||
            model.posts.some(
                (post) =>
                    post.sourceEl &&
                    post.sourceEl.querySelector &&
                    post.sourceEl.querySelector('[id^="postcontent"]')
            );

        if (!stillDirty) {
            console.debug('[Reader] 内容渲染未完成，免费重渲染一次');
            render(model, { keepScroll: true });
            return;
        }
        selfHeal(kind, attempt + 1);
    }, 600);
}

/** 摘掉 ngr-pending 并先画骨架屏，避免用户盯着白屏等原站渲染 */
function showSkeleton() {
    document.documentElement.classList.remove('ngr-pending');
    state.shell.inner.appendChild(skeletonPage());
    state.shell.main.focus({ preventScroll: true });
    applyTitle(null);
}

function whenDomReady() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 各类页面「内容已就绪」的标志物（都是实测确认过的容器） */
const READY_SELECTORS = {
    [PAGE.HOME]: '.catenew, a[href*="fid="]',
    [PAGE.BOARD]: '#topicrows .topicrow, .topicrow',
    [PAGE.THREAD]: '#m_posts .postrow, tr.postrow, [id^="postcontent"]',
};

/**
 * 帖子页的「真的好了」判断。
 * 实测：tr.postrow 出现得早，但此时 `commonui.postArg.data[i].contentC` 还指向容器（td），
 * NGA 要再过一拍才把正文元素（p#postcontent{N}）塞进去。只看行存在就会拿到一坨没用的外壳。
 * 所以这里直接问站点数据：每一层的 contentC 是不是正文元素（或者里面已经有正文元素了）。
 */
function threadContentReady() {
    const view = window;
    const arg = view.commonui && view.commonui.postArg;
    const items = arg && arg.data ? Object.values(arg.data) : [];

    if (items.length) {
        return items.every((item) => {
            const node = item && item.contentC;
            if (!node || node.nodeType !== 1) return false;
            if (node.id && /^postcontent/i.test(node.id)) return true;
            return Boolean(node.querySelector && node.querySelector('[id^="postcontent"], .postcontent'));
        });
    }

    // 站点数据还没挂上（它比楼层行晚）—— 退一步只看 DOM：首楼正文得真的有东西
    const content = document.querySelector('[id^="postcontent"]');
    if (!content) return false;
    return content.childNodes.length > 1 || cleanText(content.textContent).length > 40;
}

/**
 * 等原站把内容渲染出来。
 * NGA 的首页与帖子页列表都是 DOMContentLoaded 之后由它的 JS 插进来的
 * （实测：read.php 的服务端 HTML 里没有楼层，nga-optimize 也在等 `.small_colored_text_btn`），
 * 所以不能一到 DOMContentLoaded 就解析。用 MutationObserver 等信号，最多 8 秒。
 *
 * 返回 true 表示「认定这是错误页，别再等了」。
 */
function waitForTarget(kind, timeout = 8000) {
    const selector = READY_SELECTORS[kind];

    const ready = () => {
        if (!selector || !document.querySelector(selector)) return false;
        // 帖子页再额外等站点数据/正文变成熟（避免只拿到没渲染完的外壳）
        if (kind === PAGE.THREAD) return threadContentReady();
        return true;
    };

    if (ready()) return Promise.resolve(false);
    if (detectBlocked(document)) return Promise.resolve(true);

    return new Promise((resolve) => {
        const started = Date.now();
        let timer = 0;

        const finish = (blocked) => {
            observer.disconnect();
            clearInterval(timer);
            resolve(blocked);
        };

        const check = () => {
            if (ready()) return finish(false);
            if (detectBlocked(document)) return finish(true);
            if (Date.now() - started > timeout) return finish(false);
            return false;
        };

        const observer = new MutationObserver(() => check());
        observer.observe(document.documentElement, { childList: true, subtree: true });
        timer = setInterval(check, 250);
        check();
    });
}

/**
 * 解析当前文档。等过就绪信号之后偶尔还会差一点，所以再短重试几次才认输。
 */
async function parseLive(url, attempts = 4, delay = 500) {
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

/** 滚动位置：只在「同一页重渲染」（改设置、切主题）时保留 */
let savedScrollTop = 0;

function render(model, options = {}) {
    const shell = state.shell;
    if (options.keepScroll) savedScrollTop = shell.main.scrollTop;

    state.model = model;

    shell.clear();
    shell.renderSidebar(model);
    shell.inner.appendChild(buildPage(model));

    shell.main.scrollTop = options.keepScroll ? savedScrollTop : 0;
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

/* --------------------------------------------------------------------------
   导航
   --------------------------------------------------------------------------
   为什么不做成 SPA：实测（ngabbs.com 登录态）用 fetch 回来的 HTML 里
   首页没有 .catenew、read.php 没有楼层 —— 这些内容都是 NGA 自己的 JS 后注入的。
   所以站内跳转一律交给浏览器整页导航，新页面由 content script 重新接管；
   代价是每次多下一次原站 HTML，换来的是「不会渲染出空页面」+ 浏览器自带前进/后退。
   -------------------------------------------------------------------------- */

function navigate(url) {
    location.assign(url);
}

function openOriginal(url) {
    sessionStorage.setItem(SKIP_KEY, '1');
    const target = new URL(url || location.href, location.href);
    target.searchParams.set('ngr', 'off');
    location.href = target.href;
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
            location.reload();
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
        render(state.model, { keepScroll: true });
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
        reload: () => location.reload(),
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
    document.addEventListener('keydown', onKeyDown);
}
