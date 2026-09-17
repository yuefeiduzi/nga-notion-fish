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
        undo();
    }, 4000);

    /** 成功接管之后：只掲掉「藏起来」的标记，应用本身要留着 */
    function done() {
        clearTimeout(failsafe);
        root.classList.remove('ngr-pending');
    }

    /**
     * 失败 / 不接管：把页面还原成原站。
     * 注意不能和 done() 合成一个函数 —— 之前就是因为在成功路径上调了这里，
     * 把刚渲染好的 #ngr-root 又删了一次，表现为“一闪而过回到原站”。
     */
    function undo() {
        clearTimeout(failsafe);
        root.classList.remove('ngr-pending');
        root.classList.remove('ngr-active');
        var takeover = document.getElementById('ngr-root');
        if (takeover) takeover.remove();
    }

    if (!/^https?:$/.test(location.protocol)) {
        undo();
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
                undo();
                return;
            }

            var appUrl = chrome.runtime.getURL('src/app.js');
            var app = await import(appUrl);
            await app.start(settings);
            done();
        } catch (error) {
            console.error('[Reader] 启动失败', error);
            undo();
        }
    })();
})();
