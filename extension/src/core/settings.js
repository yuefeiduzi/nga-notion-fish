/**
 * settings.js —— 读写设置的唯一入口
 *
 * 说明：内容脚本、popup 都通过这里访问 chrome.storage.local；
 * 在开发用的本地 harness 里没有 chrome.*，会自动降级到 localStorage，
 * 这样同一份代码既能跑在扩展里，也能在普通网页里调试。
 */

export const DEFAULTS = {
    enabled: true, // 总开关
    theme: 'auto', // auto | light | dark
    hideImages: true, // 无图模式（摸鱼 + 省流量）
    stealth: true, // 中性标签页标题 / 图标
    bossKey: true, // 连按两下 Esc 快速伪装
    fontScale: 100, // 正文字号百分比
    brandText: '阅读器',
    favorites: [], // [{ fid, name }] 收藏的板块
    recents: [], // [{ tid, title, board, url, ts }]
};

const RECENT_LIMIT = 24;
const STORAGE_KEY = 'reader-settings';

/* --------------------------------------------------------------------------
   存储适配层
   -------------------------------------------------------------------------- */

function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

function readRaw() {
    if (hasChromeStorage()) {
        return chrome.storage.local.get(STORAGE_KEY).then((data) => data[STORAGE_KEY] || {});
    }
    try {
        return Promise.resolve(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
        return Promise.resolve({});
    }
}

function writeRaw(value) {
    if (hasChromeStorage()) {
        return chrome.storage.local.set({ [STORAGE_KEY]: value });
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
        /* 隐私模式下可能失败，忽略 */
    }
    return Promise.resolve();
}

/* --------------------------------------------------------------------------
   对外 API
   -------------------------------------------------------------------------- */

export async function getSettings() {
    const raw = await readRaw();
    return Object.assign({}, DEFAULTS, raw);
}

export async function patchSettings(patch) {
    const current = await getSettings();
    const next = Object.assign({}, current, patch);
    await writeRaw(next);
    return next;
}

/** 订阅设置变化（popup 改动即时生效） */
export function onSettingsChanged(callback) {
    if (hasChromeStorage()) {
        const listener = (changes, area) => {
            if (area === 'local' && changes[STORAGE_KEY]) {
                callback(Object.assign({}, DEFAULTS, changes[STORAGE_KEY].newValue || {}));
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }
    const listener = (event) => {
        if (event.key === STORAGE_KEY) {
            callback(Object.assign({}, DEFAULTS, JSON.parse(event.newValue || '{}')));
        }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
}

/** 记录最近浏览的帖子 */
export async function rememberThread(entry) {
    const settings = await getSettings();
    const recents = settings.recents.filter((item) => item.tid !== entry.tid);
    recents.unshift(Object.assign({ ts: Date.now() }, entry));
    return patchSettings({ recents: recents.slice(0, RECENT_LIMIT) });
}

/** 收藏 / 取消收藏板块 */
export async function toggleFavorite(forum) {
    const settings = await getSettings();
    const fid = String(forum.fid);
    const exists = settings.favorites.some((item) => String(item.fid) === fid);
    const favorites = exists
        ? settings.favorites.filter((item) => String(item.fid) !== fid)
        : settings.favorites.concat([{ fid, name: forum.name }]).slice(-40);
    await patchSettings({ favorites });
    return !exists;
}

/** 当前系统偏好的主题 */
export function resolveTheme(theme) {
    if (theme !== 'auto') return theme;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/** 把主题写到 <html data-ngr-theme>，并跟随系统变化 */
let themeMedia = null;
let themePaint = null;

export function applyTheme(theme) {
    const paint = () => document.documentElement.setAttribute('data-ngr-theme', resolveTheme(theme));
    paint();

    // 清掉上一次注册的监听，避免设置反复切换时泄漏
    if (themeMedia && themePaint) themeMedia.removeEventListener('change', themePaint);
    themeMedia = null;
    themePaint = null;

    if (theme === 'auto' && typeof matchMedia === 'function') {
        themeMedia = matchMedia('(prefers-color-scheme: dark)');
        themePaint = paint;
        themeMedia.addEventListener('change', paint);
    }
    return paint;
}
