
// ============================================================
// 2. Tooltip 系统
// ============================================================
const tooltipEl = document.getElementById('tooltip');
let tooltipTimer = null;
let tooltipTarget = null;

function showTooltip(text, x, y) {
    tooltipEl.textContent = text;
    tooltipEl.style.left = (x + 12) + 'px';
    tooltipEl.style.top = (y + 8) + 'px';
    tooltipEl.classList.add('visible');
}

function hideTooltip() {
    tooltipEl.classList.remove('visible');
}

function handleMouseEnter(e) {
    const target = e.currentTarget;
    const text = target.getAttribute('data-tooltip');
    if (!text) return;
    tooltipTarget = target;
    clearTimeout(tooltipTimer);
    const delay = parseInt(target.getAttribute('data-tooltip-delay')) || 500;
    tooltipTimer = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        showTooltip(text, rect.left, rect.top);
    }, delay);
}

function handleMouseLeave(e) {
    clearTimeout(tooltipTimer);
    hideTooltip();
    tooltipTarget = null;
}

function handleMouseMove(e) {
    if (tooltipTarget && tooltipEl.classList.contains('visible')) {
        tooltipEl.style.left = (e.clientX + 12) + 'px';
        tooltipEl.style.top = (e.clientY + 8) + 'px';
    }
}

function enableTooltip(el) {
    if (!el || el._tooltipEnabled) return;
    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mousemove', handleMouseMove);
    el._tooltipEnabled = true;
}

function enableTooltips(selector) {
    document.querySelectorAll(selector).forEach(el => enableTooltip(el));
}

function observeNewElements() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.hasAttribute && node.hasAttribute('data-tooltip')) {
                        enableTooltip(node);
                    }
                    node.querySelectorAll && node.querySelectorAll('[data-tooltip]').forEach(el => enableTooltip(el));
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
