/**
 * lazy-images.js —— 唤醒 NGA 的图片懒加载
 *
 * 实测（ngabbs.com 登录态）：帖子里的图一开始是 `<img src="about:blank">`，
 * 只有当它**滚进视口**时 NGA 才会把真地址写进 `src`（实测滚到 40% 才从 3 张变 5 张；
 * 光派发 scroll 事件、或滚一点点没用）。
 *
 * 而阅读模式用 CSS 把原站 `display:none` 了 —— 元素没有布局，永远进不了视口，
 * 图片永远加载不出来。所以「显示图片」时先把原站临时切成「有布局但看不见」，
 * 分步滚一遍把图催出来，再还原现场。
 *
 * 只在用户明确要图的时候调用（默认的无图模式不该浪费流量）。
 */

const BLANK = 'img[src="about:blank"], img[src=""]';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 只关心楼层区域的图（签名/贴条/头像那些我们本来就不显示） */
function scopeRoot() {
    return document.querySelector('#m_posts_c') || document.querySelector('#m_posts') || document.body;
}

function blanks() {
    const root = scopeRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll(BLANK)).filter((img) => {
        // 引用块里的图在原站是被裁掉的，催也催不出来（而且我们也不缺那点内容）
        if (img.closest('.quote')) return false;
        // 1px 的占位/间隔图（实测 NGA 大量用 179x1 这种）
        const w = Number(img.getAttribute('data-nw') || img.getAttribute('width') || 0);
        const h = Number(img.getAttribute('data-nh') || img.getAttribute('height') || 0);
        if (w && h && w <= 4 && h <= 4) return false;
        return true;
    });
}

function pendingImages() {
    return blanks().length;
}

/** 等这一张真的拿到地址（NGA 是异步写 src 的，固定等待容易抢跑） */
async function waitForFill(img, before, timeout = 800) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (img.getAttribute('src') !== before) return true;
        await sleep(70);
    }
    return false;
}

/**
 * @param {{ timeout?: number, signal?: {aborted:boolean} }} options
 * @returns {Promise<number>} 新加载出来的图片数量
 */
export async function wakeLazyImages(options = {}) {
    const timeout = options.timeout || 6000;
    const html = document.documentElement;
    const pendingBefore = pendingImages();
    if (!pendingBefore) return 0;

    html.classList.add('ngr-waking');
    const startScroll = window.scrollY || 0;

    try {
        const started = Date.now();

        // 不做「整页匀速滚一遍」：直接把每一张还没加载的图滚到视口中间，
        // 再等它真的拿到地址（实测 NGA 是「元素进视口」才异步写 src）。
        for (let round = 0; round < 3; round += 1) {
            const queue = blanks();
            if (!queue.length) break;

            let progressed = 0;
            for (const img of queue) {
                if (options.signal && options.signal.aborted) break;
                if (Date.now() - started > timeout) break;
                const before = img.getAttribute('src');
                try {
                    img.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
                } catch {
                    /* 某些元素不支持参数，忽略 */
                }
                if (await waitForFill(img, before)) progressed += 1;
            }

            if (Date.now() - started > timeout) break;
            if (progressed === 0) break; // 这一轮一张都没催出来，再滚也没用
        }
    } catch (error) {
        console.warn('[Reader] 唤醒图片失败', error);
    } finally {
        window.scrollTo(0, startScroll);
        html.classList.remove('ngr-waking');
    }

    return Math.max(0, pendingBefore - pendingImages());
}

/** 页面里还有多少张没加载出来的图（用于决定要不要提示用户） */
export function pendingImageCount() {
    return pendingImages();
}
