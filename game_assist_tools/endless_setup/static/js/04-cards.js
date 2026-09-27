
// ============================================================
// 4. 操作项定义
// ============================================================
const EARLY_CARDS = [];
for (let i=1; i<=8; i++) {
    const maxCount = (i === 1 || i === 2) ? 25 : 10;
    EARLY_CARDS.push({ id: `card${i}`, label: `卡${i}`, type: 'card', phase: 'early', single: false, maxCount: maxCount });
}

const EARLY_GUARD = [ { id: 'guard', label: '守卫菇', type: 'guard', phase: 'early', single: false, maxCount: 5 } ];
const EARLY_SHOVEL_BEFORE = [ { id: 'shovel_before', label: '铲子(前5)', type: 'shovel', phase: 'early', single: false, maxCount: 5 } ];
const EARLY_SHOVEL_AFTER = [ { id: 'shovel_after', label: '铲子(后5)', type: 'shovel', phase: 'early', single: false, maxCount: 5 } ];
const EARLY_FEED = [ { id: 'feed', label: '小关喂豆', type: 'feed', phase: 'early', single: true } ];
const EARLY_BOSS_FEED = [ { id: 'bossfeed', label: 'Boss喂豆', type: 'bossfeed', phase: 'early', single: true } ];

// 补植物操作项：卡槽2~8
const LATE_PATCH = [];
for (let slot=2; slot<=8; slot++) {
    const maxCount = (slot === 2 || slot === 3) ? 15 : 5;
    LATE_PATCH.push({
        id: `patch_slot${slot}`,
        label: `补卡${slot}`,
        type: 'patch',
        phase: 'late',
        single: false,
        maxCount: maxCount,
        slot: slot
    });
}

const LATE_SHOVEL = [ { id: 'shovel_late', label: '铲除', type: 'shovel', phase: 'late', single: false, maxCount: 5 } ];
const LATE_FEED = [ { id: 'feed_late', label: '小关喂豆', type: 'feed', phase: 'late', single: true } ];
const LATE_FEED_BALL = [ { id: 'feed_ball_late', label: '喂豆球果', type: 'feed', phase: 'late', single: true } ];
const LATE_BOSS_FEED = [
    { id: 'bossfeed_late', label: 'Boss喂豆', type: 'bossfeed', phase: 'late', single: true },
    { id: 'bossfeed2_late', label: 'Boss喂豆2', type: 'bossfeed', phase: 'late', single: true }
];
const LATE_FLOWER = [ { id: 'flower', label: '小关抛花', type: 'flower', phase: 'late', single: false, maxCount: 2 } ];
const LATE_BOSS_FLOWER = [ { id: 'bossflower', label: 'Boss抛花', type: 'bossflower', phase: 'late', single: false, maxCount: 4 } ];
const LATE_MAGIC = [
    { id: 'sweet1', label: '甜薯1', type: 'sweet', phase: 'late', single: true },
    { id: 'sweet2', label: '甜薯2', type: 'sweet', phase: 'late', single: true },
    { id: 'ganlan1', label: '甘蓝1', type: 'ganlan', phase: 'late', single: true },
    { id: 'ganlan2', label: '甘蓝2', type: 'ganlan', phase: 'late', single: true },
    { id: 'magicfeed', label: '魔甘前喂豆', type: 'magicfeed', phase: 'late', single: true }
];

const ALL_OPS = [
    ...EARLY_CARDS, ...EARLY_GUARD, ...EARLY_SHOVEL_BEFORE, ...EARLY_SHOVEL_AFTER,
    ...EARLY_FEED, ...EARLY_BOSS_FEED,
    ...LATE_PATCH, ...LATE_SHOVEL, ...LATE_FEED, ...LATE_FEED_BALL,
    ...LATE_BOSS_FEED, ...LATE_FLOWER, ...LATE_BOSS_FLOWER, ...LATE_MAGIC
];

let selectedOp = null;
let isBatchMode = true;

let opItemsList = [];
let keyboardSelectedIndex = -1;

// ===== 撤销/重做 =====
let undoStack = [];
let redoStack = [];

function saveBoardState() {
    const copyEarly = JSON.parse(JSON.stringify(boardEarly));
    const copyLate = JSON.parse(JSON.stringify(boardLate));
    undoStack.push({ early: copyEarly, late: copyLate });
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
}

function undoBoard() {
    if (undoStack.length === 0) return;
    const currentState = {
        early: JSON.parse(JSON.stringify(boardEarly)),
        late: JSON.parse(JSON.stringify(boardLate))
    };
    redoStack.push(currentState);
    const prevState = undoStack.pop();
    boardEarly = prevState.early;
    boardLate = prevState.late;
    renderAllBoards();
    updatePreview();
    setStatus('↩ 已撤销');
}

function redoBoard() {
    if (redoStack.length === 0) return;
    const currentState = {
        early: JSON.parse(JSON.stringify(boardEarly)),
        late: JSON.parse(JSON.stringify(boardLate))
    };
    undoStack.push(currentState);
    const nextState = redoStack.pop();
    boardEarly = nextState.early;
    boardLate = nextState.late;
    renderAllBoards();
    updatePreview();
    setStatus('↪ 已重做');
}

function getVisibleOpItems() {
    const container = document.getElementById('opPanel');
    // opPanel 已在早期 UI 清理中移除 —— 这里返回空数组而不是抛错，
    // 避免调用方（键盘导航等）中断 window.onload 后续的事件绑定。
    if (!container) return [];
    const items = container.querySelectorAll('.op-item');
    const visible = [];
    items.forEach(el => {
        let parent = el.closest('.op-section');
        if (parent && parent.style.display !== 'none') {
            visible.push(el);
        }
    });
    return visible;
}

function updateKeyboardSelection() {
    document.querySelectorAll('.op-item').forEach(el => {
        el.classList.remove('keyboard-selected');
    });
    if (keyboardSelectedIndex >= 0 && keyboardSelectedIndex < opItemsList.length) {
        const el = opItemsList[keyboardSelectedIndex];
        el.classList.add('keyboard-selected');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const opId = el.dataset.id;
        const op = ALL_OPS.find(o => o.id === opId);
        if (op) {
            if (!selectedOp || selectedOp.id !== opId) {
                setSelected(op);
                updateSelectedUI();
            }
        }
    }
}

function moveKeyboardSelection(delta) {
    opItemsList = getVisibleOpItems();
    if (opItemsList.length === 0) {
        keyboardSelectedIndex = -1;
        updateKeyboardSelection();
        return;
    }
    if (keyboardSelectedIndex < 0 || keyboardSelectedIndex >= opItemsList.length) {
        keyboardSelectedIndex = delta > 0 ? 0 : opItemsList.length - 1;
    } else {
        keyboardSelectedIndex += delta;
        if (keyboardSelectedIndex < 0) keyboardSelectedIndex = opItemsList.length - 1;
        if (keyboardSelectedIndex >= opItemsList.length) keyboardSelectedIndex = 0;
    }
    updateKeyboardSelection();
}

function resetKeyboardNavigation() {
    opItemsList = getVisibleOpItems();
    if (selectedOp) {
        const foundIdx = opItemsList.findIndex(el => el.dataset.id === selectedOp.id);
        if (foundIdx >= 0) keyboardSelectedIndex = foundIdx;
        else keyboardSelectedIndex = opItemsList.length > 0 ? 0 : -1;
    } else {
        keyboardSelectedIndex = opItemsList.length > 0 ? 0 : -1;
    }
    updateKeyboardSelection();
}

document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        const key = e.key.toLowerCase();

    // 撤销/重做快捷键
    if (e.ctrlKey && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoBoard();
        return;
    }
    if (e.ctrlKey && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoBoard();
        return;
    }

    if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        moveKeyboardSelection(-1);
        return;
    }
    if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        moveKeyboardSelection(1);
        return;
    }
    if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        const tabEarly = document.querySelector('.tab[data-tab="early"]');
        if (tabEarly && !tabEarly.classList.contains('active')) {
            tabEarly.click();
            setTimeout(() => resetKeyboardNavigation(), 50);
        }
        return;
    }
    if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        const tabLate = document.querySelector('.tab[data-tab="late"]');
        if (tabLate && !tabLate.classList.contains('active')) {
            tabLate.click();
            setTimeout(() => resetKeyboardNavigation(), 50);
        }
        return;
    }
    if (key === 'enter' || key === ' ') {
        e.preventDefault();
        if (selectedOp) {
            clearSelected();
            updateSelectedUI();
        }
        return;
    }
});
