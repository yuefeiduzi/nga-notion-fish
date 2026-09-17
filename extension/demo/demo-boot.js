/**
 * demo-boot.js —— 演示页的启动器（给商店审核员、以及没登录 NGA 的人看）
 *
 * 只在 extension/demo/index.html 里用。正式入口是 `src/boot.js`（content script），
 * 这里做的是同一件事的两步：读设置 → 让 app.js 接管当前文档。
 *
 * 之所以要有它：商店审核员没有 NGA 账号，真站点只会给出「请先登录」的引导页，
 * 他们看不到阅读界面。这个页面用本地示例数据走完全相同的渲染路径
 * （parse → sanitize → view），点侧边栏「显示图片」也能真的把示例图取出来。
 */

import { getSettings } from '../src/core/settings.js';
import { start } from '../src/app.js';

document.documentElement.classList.add('ngr-pending');
try {
    await start(await getSettings());
} finally {
    // 与 boot.js 一样：任何路径都要把这层「先藏后画」的标记摘掉
    document.documentElement.classList.remove('ngr-pending');
}
