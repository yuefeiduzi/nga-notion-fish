/**
 * boot.js —— 内容脚本入口（document_start 执行）
 *
 * 职责只有三件事：
 * 1. 立刻给 <html> 打上 ngr-pending 标记，用 CSS 把原站藏起来（防止闪烁）
 * 2. 读取设置，决定是否接管本页
 * 3. 动态 import 真正的应用模块（ESM，零构建）
 *
 * 任何一步失败都要把 ngr-pending 摘掉，保证最差情况下用户还能看到原站。
 */
(function () {
    'use strict';

    var root = document.documentElement;

    // 兜底：4 秒内没有完成接管，就还原成原站，避免白屏
    var failsafe = setTimeout(function () {
        root.classList.remove('ngr-pending');
    }, 4000);

    function restore() {
        clearTimeout(failsafe);
        root.classList.remove('ngr-pending');
        // 万一已经在接管中途失败，也要把原站放出来
        root.classList.remove('ngr-active');
        var takeover = document.getElementById('ngr-root');
        if (takeover) takeover.remove();
    }

    if (!/^https?:$/.test(location.protocol)) {
        restore();
        return;
    }

    // 立刻隐藏，先斩后奏：设置读取是异步的，但页面已经被藏住了
    root.classList.add('ngr-pending');

    (async function () {
        try {
            var settingsUrl = chrome.runtime.getURL('src/core/settings.js');
            var settingsModule = await import(settingsUrl);
            var settings = await settingsModule.getSettings();

            if (!settings.enabled) {
                restore();
                return;
            }

            var appUrl = chrome.runtime.getURL('src/app.js');
            var app = await import(appUrl);
            await app.start(settings);
            restore();
        } catch (error) {
            console.error('[Reader] 启动失败', error);
            restore();
        }
    })();
})();
