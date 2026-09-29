
// ============================================================
// 种植顺序链条：拖动整块，决定「先种哪个槽」
// 顺序存放在 t.slotOrder（该表专属），运行时按此顺序执行
// ============================================================
let seqDrag = null;   // { kind, key, which, ... } 正在拖动的槽 / 等待 / 单株
let jobSeqSel = {};   // 顺序链里勾选的落点：{ 'once:card1#3': {key,gidx,which}, ... }（用于批量拖出）

// 一个槽的稳定标识：植物槽是 'card<N>'，另外两条是 'feed' / 'shovel'
function jobSlotKeyOf(s) { return (s === 'feed' || s === 'shovel') ? s : ('card' + s); }

// 该槽在棋盘上是否落了子
function jobSlotHasPlacement(board, key) {
    return jobCollectSlot(board, key).length > 0;
}

// 某槽已落点数量
function jobSlotCount(board, key) { return jobCollectSlot(board, key).length; }

// 收集某槽在棋盘上的全部落点（按当前 seq 排序）
function jobCollectSlot(board, scopeId) {
    const out = [];
    if (!board) return out;
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            (board[r][c] || []).forEach((it, i) => {
                if (it.id === scopeId) out.push({ r: r, c: c, idx: i, item: it });
            });
        }
    }
    out.sort(function (a, b) {
        const qa = (typeof a.item.seq === 'number') ? a.item.seq : 9999;
        const qb = (typeof b.item.seq === 'number') ? b.item.seq : 9999;
        return qa - qb;
    });
    return out;
}

// 全部槽位键：槽1~8 + 喂豆 + 铲子
function jobAllSlotKeys() {
    const a = [];
    for (let s = 1; s <= 8; s++) a.push('card' + s);
    a.push('feed');
    a.push('shovel');
    return a;
}

// 该槽当前的放置形态：'once'（单次）| 'loop'（循环，默认）| 'end'（收尾）
// ★ 普通关与 boss 关各自独立的形态表（跟当前编辑的 tab 走）
// ★ boss 关不能有收尾：boss 棋盘下 end 一律归一化回 loop。
function jobSlotMode(t, key) {
    const f = jobModesField();
    const m = (t && t[f]) ? t[f][key] : null;
    const modes = jobIsBossBoard() ? ['once', 'loop'] : JOB_SLOT_MODES;
    return modes.indexOf(m) === -1 ? 'loop' : m;
}
// 三个形态是各自独立的摆放；形态决定棋盘标记颜色与所属链
function jobInOnce(t, key) { return jobSlotMode(t, key) === 'once'; }
function jobInLoop(t, key) { return jobSlotMode(t, key) === 'loop'; }
function jobInEnd(t, key)  { return jobSlotMode(t, key) === 'end'; }

// 右键：切换放置形态。
// 普通关在「单次 → 循环 → 收尾」之间循环；
// boss 关**没有收尾**，只在「单次 ↔ 循环」之间切换（end 会先归一化回 loop）。
function jobToggleSlotMode(t, key) {
    const f = jobModesField();
    if (!t[f]) t[f] = {};
    const modes = jobIsBossBoard() ? ['once', 'loop'] : JOB_SLOT_MODES;
    const cur = jobSlotMode(t, key);          // 已经归一化（boss 下 end→loop）
    const i = modes.indexOf(cur);
    const next = modes[(i + 1) % modes.length];
    t[f][key] = next;
    return next;
}

// 归一化 boss 关槽位形态：把残留的「收尾」形态改回「循环」（上一个合法形态）。
// 切换到 boss 关 tab 时立即调用，确保 boss 关槽位不再有收尾形态。
// 返回是否有改动（true = 改了，调用方需要 saveLocal 重存）。
function jobNormalizeBossEndModes() {
    const t = jobTables[currentTable];
    if (!t) return false;
    const modes = t.bossSlotModes;
    if (!modes || typeof modes !== 'object') return false;
    const keys = jobAllSlotKeys();
    let any = false;
    keys.forEach(function (key) {
        if (modes[key] === 'end') {
            modes[key] = 'loop';   // 回到上一个（循环）
            any = true;
        }
    });
    return any;
}

function jobModeLabel(m) {
    if (m === 'once') return '单次';
    if (m === 'end') return '收尾';
    return '循环';
}

// 棋盘落点的形态：item.mode（'once' | 'loop' | 'end'）
function jobItemMode(it) {
    const m = it && it.mode;
    return JOB_SLOT_MODES.indexOf(m) !== -1 ? m : 'loop';
}
