/**
 * popup.js —— 扩展图标弹窗：设置面板
 * 复用 src/core/settings.js，popup 与内容脚本共享同一份存储。
 */

import { getSettings, patchSettings, toggleFavorite } from '../src/core/settings.js';

const settings = await getSettings();

/* ---- 开关 / 输入 ---- */

document.querySelectorAll('[data-key]').forEach((node) => {
    const key = node.dataset.key;
    const value = settings[key];

    if (node.type === 'checkbox') {
        node.checked = Boolean(value);
    } else {
        node.value = value;
    }

    const commit = async () => {
        const next =
            node.type === 'checkbox' ? node.checked : node.type === 'range' ? Number(node.value) : node.value;
        await patchSettings({ [key]: next });
    };

    node.addEventListener('change', commit);
    if (node.type === 'range' || node.type === 'text') node.addEventListener('input', commit);
});

/* ---- 主题 ---- */

const themeBox = document.getElementById('theme');
function paintTheme(current) {
    themeBox.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.theme === current);
    });
}
paintTheme(settings.theme);
themeBox.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-theme]');
    if (!button) return;
    paintTheme(button.dataset.theme);
    await patchSettings({ theme: button.dataset.theme });
});

/* ---- 收藏板块 ---- */

function renderFavorites(list) {
    const box = document.getElementById('favorites');
    const counter = document.getElementById('fav-count');
    box.textContent = '';
    counter.textContent = list.length ? `(${list.length})` : '（暂无）';

    if (!list.length) {
        box.appendChild(document.createTextNode('在板块页或首页点 ☆ 收藏，收藏后会出现在侧边栏。'));
        return;
    }

    list
        .slice()
        .reverse()
        .forEach((forum) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'pop-fav';
            chip.textContent = `${forum.name} ×`;
            chip.title = '点击取消收藏';
            chip.addEventListener('click', async () => {
                await toggleFavorite(forum);
                renderFavorites((await getSettings()).favorites);
            });
            box.appendChild(chip);
        });
}

renderFavorites(settings.favorites);

/* ---- 底部行为 ---- */

document.getElementById('open-nga').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://ngabbs.com/' });
    window.close();
});

document.getElementById('clear-recents').addEventListener('click', async () => {
    await patchSettings({ recents: [] });
    const button = document.getElementById('clear-recents');
    button.textContent = '已清空';
    setTimeout(() => {
        button.textContent = '清空最近浏览';
    }, 1400);
});
