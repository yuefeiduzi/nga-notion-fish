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
        const buffer = await response.arrayBuffer();
        const text = decode(buffer, response.headers.get('content-type') || '');
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

/**
 * 解码响应体。
 * 现代 ngabbs.com 是 UTF-8，但老页面/部分接口是 GBK，
 * 而 fetch 的 response.text() 只认 HTTP 头里的 charset，遇到「charset 只写在 HTML meta 里」
 * 的老页面就会变成乱码，所以自己识别一次。
 */
function decode(buffer, contentType) {
    const bytes = new Uint8Array(buffer);
    const headerCharset = (contentType.match(/charset=([\w-]+)/i) || [])[1] || '';
    const sniff = new TextDecoder('utf-8').decode(bytes.subarray(0, 4096));
    const metaCharset = (sniff.match(/charset\s*=\s*["']?([\w-]+)/i) || [])[1] || '';
    const charset = (headerCharset || metaCharset || 'utf-8').toLowerCase();

    try {
        if (/gbk|gb2312|gb18030/.test(charset)) return new TextDecoder('gb18030').decode(bytes);
        return new TextDecoder('utf-8').decode(bytes);
    } catch {
        return new TextDecoder('utf-8').decode(bytes);
    }
}
