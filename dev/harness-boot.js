/**
 * harness-boot.js —— 本地调试用的「假 content script」
 *
 * 在样例页面里它代替 boot.js：补一个 chrome.storage 的模拟实现，
 * 然后按正常路径启动应用。这样没有 NGA 登录也能验证解析 + 排版。
 */

// 开发用：把页面上的报错收集起来，方便一把抓（window.__ngrErrors）
globalThis.__ngrErrors = [];
globalThis.addEventListener('error', (event) => {
    globalThis.__ngrErrors.push(`error: ${event.message} @ ${event.filename}:${event.lineno}`);
});
globalThis.addEventListener('unhandledrejection', (event) => {
    globalThis.__ngrErrors.push(`rejection: ${event.reason && event.reason.stack ? event.reason.stack : event.reason}`);
});

if (!globalThis.chrome) {
    const KEY = 'reader-settings';
    const listeners = [];
    const read = () => {
        try {
            return JSON.parse(localStorage.getItem(KEY) || '{}');
        } catch {
            return {};
        }
    };
    const write = (value) => {
        localStorage.setItem(KEY, JSON.stringify(value));
        listeners.forEach((fn) => fn({ [KEY]: { newValue: value } }, 'local'));
    };
    globalThis.chrome = {
        runtime: { getURL: (path) => '/' + String(path).replace(/^\//, '') },
        storage: {
            local: {
                get: (key) => Promise.resolve({ [key]: read()[key] }),
                set: (patch) => {
                    write(Object.assign({}, read(), patch));
                    return Promise.resolve();
                },
            },
            onChanged: {
                addListener: (fn) => listeners.push(fn),
                removeListener: (fn) => {
                    const index = listeners.indexOf(fn);
                    if (index >= 0) listeners.splice(index, 1);
                },
            },
        },
    };
}

const boot = async () => {
    document.documentElement.classList.add('ngr-pending');
    try {
        const { getSettings } = await import('/src/core/settings.js');
        const { start } = await import('/src/app.js');
        await start(await getSettings());
    } finally {
        document.documentElement.classList.remove('ngr-pending');
    }
};

boot();
