/**
 * lightbox.js —— 图片全屏预览
 *
 * 职责：把正文里的图片放大看。不做其它任何事（不解析、不取图）。
 * 交互：点击图片打开；Esc / 点空白关闭；←/→ 或两侧按钮看上一张下一张；
 *       滚轮或 +/− 缩放；放大后可以拖拽平移；点图片本身在「适应屏幕 / 放大」之间切换。
 *
 * 注意：监听器只在创建时绑一次，渲染重绘不影响它（挂在这个固定层上，不是挂在内容节点上）。
 */

import { el, icon } from '../core/dom.js';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const STEP = 1.25;

export function createLightbox() {
    const node = el('div', { class: 'ngr-lightbox', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': '图片预览' });

    const counter = el('span', { class: 'ngr-lb-counter' });
    const btn = (name, title, act) => {
        const button = el('button', { class: 'ngr-lb-btn', type: 'button', title, 'aria-label': title, 'data-act': act });
        button.appendChild(icon(name, 16));
        return button;
    };
    const zoomOutBtn = btn('zoomOut', '缩小（-）', 'zoom-out');
    const fitBtn = btn('fit', '适应屏幕（0）', 'fit');
    const zoomInBtn = btn('zoomIn', '放大（+）', 'zoom-in');
    const closeBtn = btn('close', '关闭（Esc）', 'close');

    const bar = el('div', { class: 'ngr-lb-bar' }, [counter, zoomOutBtn, fitBtn, zoomInBtn, closeBtn]);

    const image = el('img', { class: 'ngr-lb-img', alt: '' });
    const stage = el('div', { class: 'ngr-lb-stage' }, [image]);
    const prevBtn = el('button', { class: 'ngr-lb-nav is-prev', type: 'button', title: '上一张（←）', 'aria-label': '上一张' }, [icon('chevronLeft', 22)]);
    const nextBtn = el('button', { class: 'ngr-lb-nav is-next', type: 'button', title: '下一张（→）', 'aria-label': '下一张' }, [icon('chevronRight', 22)]);
    const hint = el('div', { class: 'ngr-lb-hint', text: '滚轮缩放 · 拖动平移 · Esc 关闭' });

    node.append(bar, prevBtn, stage, nextBtn, hint);

    let list = [];
    let index = 0;
    let scale = 1;
    let pan = { x: 0, y: 0 };
    let dragging = null;

    const open = () => !node.hidden;

    function paint() {
        image.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
        image.classList.toggle('is-zoomed', scale > MIN_SCALE);
        node.classList.toggle('is-zoomed', scale > MIN_SCALE);
        counter.textContent = list.length > 1 ? `${index + 1} / ${list.length}` : '';
        fitBtn.title = scale > MIN_SCALE ? '适应屏幕（0）' : '原尺寸（0）';
        const many = list.length > 1;
        prevBtn.hidden = !many;
        nextBtn.hidden = !many;
    }

    function apply(entry) {
        index = Math.max(0, Math.min(list.length - 1, entry));
        scale = MIN_SCALE;
        pan = { x: 0, y: 0 };
        image.src = list[index] || '';
        image.alt = `图片 ${index + 1}`;
        paint();
    }

    function reset() {
        scale = MIN_SCALE;
        pan = { x: 0, y: 0 };
        paint();
    }

    function zoom(factor) {
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
        if (scale === MIN_SCALE) pan = { x: 0, y: 0 };
        paint();
    }

    function toggleZoom() {
        if (scale > MIN_SCALE) reset();
        else {
            // 粗略估一个「原尺寸」倍数：自然宽度 / 当前显示宽度
            const shown = image.getBoundingClientRect().width / scale || 0;
            const target = shown ? image.naturalWidth / shown : 2;
            scale = Math.min(MAX_SCALE, Math.max(1.5, Number.isFinite(target) ? target : 2));
            paint();
        }
    }

    function show(entry) {
        if (entry < 0) entry = list.length - 1;
        if (entry >= list.length) entry = 0;
        apply(entry);
    }

    function close() {
        if (!open()) return;
        node.hidden = true;
        list = [];
        index = 0;
        reset();
        image.removeAttribute('src');
        document.documentElement.classList.remove('ngr-preview-open');
    }

    function open_(sources, start = 0) {
        list = sources.filter(Boolean);
        if (!list.length) return false;
        node.hidden = false;
        apply(start);
        // 打开时给主区域一个"预览中"的状态（CSS 里用它隐藏滚动条）
        document.documentElement.classList.add('ngr-preview-open');
        return true;
    }

    /* ---- 事件：按钮 ---- */

    node.addEventListener('click', (event) => {
        const action = event.target.closest && event.target.closest('[data-act]');
        if (action) {
            event.stopPropagation();
            const act = action.dataset.act;
            if (act === 'close') close();
            else if (act === 'zoom-in') zoom(STEP);
            else if (act === 'zoom-out') zoom(1 / STEP);
            else if (act === 'fit') reset();
            return;
        }
        if (event.target === prevBtn || prevBtn.contains(event.target)) {
            show(index - 1);
            return;
        }
        if (event.target === nextBtn || nextBtn.contains(event.target)) {
            show(index + 1);
            return;
        }
        if (event.target === image) {
            event.stopPropagation();
            toggleZoom();
            return;
        }
        // 其余位置（背景）→ 关闭
        close();
    });

    /* ---- 事件：滚轮缩放 ---- */

    stage.addEventListener(
        'wheel',
        (event) => {
            event.preventDefault();
            zoom(event.deltaY < 0 ? STEP : 1 / STEP);
        },
        { passive: false }
    );

    /* ---- 事件：拖拽平移 ---- */

    stage.addEventListener('pointerdown', (event) => {
        if (scale <= MIN_SCALE || event.button !== 0) return;
        dragging = { x: event.clientX, y: event.clientY, pan: { ...pan } };
        stage.setPointerCapture(event.pointerId);
        node.classList.add('is-dragging');
    });

    stage.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        pan = {
            x: dragging.pan.x + (event.clientX - dragging.x),
            y: dragging.pan.y + (event.clientY - dragging.y),
        };
        paint();
    });

    const endDrag = () => {
        dragging = null;
        node.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    /* ---- 对外 API ---- */

    /** 处理键盘；返回 true 表示这个按键被预览层吃掉了 */
    function handleKey(key) {
        if (!open()) return false;
        if (key === 'Escape') {
            close();
            return true;
        }
        if (key === 'ArrowLeft') {
            show(index - 1);
            return true;
        }
        if (key === 'ArrowRight') {
            show(index + 1);
            return true;
        }
        if (key === '+' || key === '=') {
            zoom(STEP);
            return true;
        }
        if (key === '-' || key === '_') {
            zoom(1 / STEP);
            return true;
        }
        if (key === '0') {
            reset();
            return true;
        }
        return true; // 预览打开时，其它页面快捷键一律不响应
    }

    return {
        node,
        open: open_,
        close,
        handleKey,
        isOpen: open,
        /** 当前页面里可预览的图片（同一层楼内），供点击时收集 */
        collect(source) {
            const scope = source.closest('.ngr-floor, .ngr-page') || document;
            return Array.from(scope.querySelectorAll('.ngr-content img'))
                .filter((img) => !img.classList.contains('ngr-inline-img'))
                .map((img) => img.currentSrc || img.src)
                .filter((src) => src && !src.startsWith('data:image/gif'));
        },
    };
}
