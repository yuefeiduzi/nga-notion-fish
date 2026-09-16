/**
 * fetch.js —— 页面加载与缓存
 *
 * 阅读模式是「先拿到 HTML，再自己渲染」，所以需要一个统一的取页入口：
 * 同源 fetch（自动带 cookie）+ DOMParser + 短缓存（前进/后退秒开）。
 */

const cache = new Map(); // url -> { doc, ts }
const TTL = 60 * 1000;

let inflight = null;

/**
 * 拉取并解析一个 NGA 页面
 * @param {string} url
 * @param {{ force?: boolean, signal?: AbortSignal }} options
 * @returns {Promise<Document>}
 */
export async function loadDocument(url, options = {}) {
    const cached = cache.get(url);
    if (!options.force && cached && Date.now() - cached.ts < TTL) {
        return cached.doc;
    }

    if (inflight && inflight.url === url && !options.force) return inflight.promise;

    const promise = (async () => {
        const response = await fetch(url, {
            credentials: 'include',
            signal: options.signal,
            redirect: 'follow',
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');

        // DOMParser 出来的文档没有 baseURI，塞一个 <base> 让相对链接可以还原
        const base = doc.createElement('base');
        base.setAttribute('href', response.url || url);
        if (doc.head) doc.head.prepend(base);

        cache.set(url, { doc, ts: Date.now() });
        return doc;
    })();

    inflight = { url, promise };
    try {
        return await promise;
    } finally {
        if (inflight && inflight.url === url) inflight = null;
    }
}

/** 首页/板块页可以放心缓存；帖子页第一次访问时强制刷新 */
export function invalidate(url) {
    if (url) cache.delete(url);
    else cache.clear();
}
