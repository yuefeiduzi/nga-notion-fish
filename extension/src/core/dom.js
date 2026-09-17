/**
 * dom.js —— 极简 DOM 工具 + 图标
 * 不引入任何框架，只是把「创建元素」这件事写短一点。
 */

/** el('div', { class: 'x', onclick: fn }, '文本', childNode) */
export function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
        for (const [key, value] of Object.entries(props)) {
            if (value === null || value === undefined || value === false) continue;
            if (key === 'class') node.className = value;
            else if (key === 'text') node.textContent = value;
            else if (key === 'html') node.innerHTML = value;
            else if (key === 'dataset') Object.assign(node.dataset, value);
            else if (key === 'style') Object.assign(node.style, value);
            else if (key.startsWith('on') && typeof value === 'function') {
                node.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (value === true) node.setAttribute(key, '');
            else node.setAttribute(key, String(value));
        }
    }
    append(node, children);
    return node;
}

export function append(parent, children) {
    for (const child of children.flat(4)) {
        if (child === null || child === undefined || child === false) continue;
        parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return parent;
}

export function svg(paths, size = 16) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 24 24');
    node.setAttribute('width', String(size));
    node.setAttribute('height', String(size));
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', '1.8');
    node.setAttribute('stroke-linecap', 'round');
    node.setAttribute('stroke-linejoin', 'round');
    node.setAttribute('aria-hidden', 'true');
    for (const d of [].concat(paths)) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        node.appendChild(p);
    }
    return node;
}

export const ICONS = {
    home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
    star: 'M12 3.5l2.7 5.6 6.1.85-4.45 4.3 1.07 6.1L12 17.5l-5.42 2.85 1.07-6.1L3.2 9.95l6.1-.85L12 3.5Z',
    book: ['M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z', 'M20 16H6.5A2.5 2.5 0 0 0 4 18.5'],
    image: ['M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-13Z', 'M3 16.5 8 12l4 3.5 3-2.5 6 5', 'M9 8.5h.01'],
    moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
    sun: ['M12 4V2', 'M12 22v-2', 'M4 12H2', 'M22 12h-2', 'M5.6 5.6 4.2 4.2', 'M19.8 19.8l-1.4-1.4', 'M18.4 5.6l1.4-1.4', 'M4.2 19.8l1.4-1.4', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
    auto: ['M12 3a9 9 0 0 1 0 18Z', 'M12 3a9 9 0 0 0 0 18Z'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    chevronLeft: 'm15 5-7 7 7 7',
    chevronRight: 'm9 5 7 7-7 7',
    zoomIn: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'M20 20l-4.5-4.5', 'M11 8v6', 'M8 11h6'],
    zoomOut: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'M20 20l-4.5-4.5', 'M8 11h6'],
    fit: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
    up: 'm5 15 7-7 7 7',
    heart: 'M12 20.3 4.7 13a4.7 4.7 0 0 1 6.6-6.7l.7.7.7-.7A4.7 4.7 0 0 1 19.3 13Z',
    refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 3v5h-5'],
    link: ['M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1'],
};

/** 当前站点的 origin（ngabbs.com 与 bbs.nga.cn 是两套 cookie，必须跟随当前域） */
export function origin() {
    return location.origin + '/';
}

export function icon(name, size) {
    return svg(ICONS[name] || ICONS.list, size);
}

/** 数字：1234 -> 1.2k */
export function shortNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return value == null ? '' : String(value);
    if (num < 1000) return String(num);
    if (num < 10000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return (num / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
}

/** 解析各种时间文本，输出「09-14 12:33」这种紧凑格式 */
export function compactTime(raw) {
    if (!raw) return '';
    const text = String(raw).trim();
    const full = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T]*(\d{1,2}):(\d{2})/);
    if (full) {
        const now = new Date();
        const sameYear = Number(full[1]) === now.getFullYear();
        const stamp = `${pad(full[2])}-${pad(full[3])} ${pad(full[4])}:${full[5]}`;
        return sameYear ? stamp : `${full[1]}-${stamp}`;
    }
    const short = text.match(/(\d{1,2})-(\d{1,2})[ T]*(\d{1,2}):(\d{2})/);
    if (short) return `${pad(short[1])}-${pad(short[2])} ${pad(short[3])}:${short[4]}`;
    const timeOnly = text.match(/^(\d{1,2}):(\d{2})$/);
    if (timeOnly) return text;
    return text.slice(0, 24);
}

function pad(value) {
    return String(value).padStart(2, '0');
}
