
// ============================================================
// 5. 渲染操作项
// ============================================================
function renderOps(phase) {
    if (!document.getElementById('opEarlyCards')) return;   // 布阵操作面板已移除
    const earlyCards = document.getElementById('opEarlyCards');
    const earlyGuard = document.getElementById('opEarlyGuard');
    const earlyShovelBefore = document.getElementById('opEarlyShovelBefore');
    const earlyShovelAfter = document.getElementById('opEarlyShovelAfter');
    const earlyFeed = document.getElementById('opEarlyFeed');
    const earlyBossFeed = document.getElementById('opEarlyBossFeed');
    const latePatch = document.getElementById('opLatePatch');
    const lateShovel = document.getElementById('opLateShovel');
    const lateFeed = document.getElementById('opLateFeed');
    const lateBossFeed = document.getElementById('opLateBossFeed');
    const lateFlower = document.getElementById('opLateFlower');
    const lateBossFlower = document.getElementById('opLateBossFlower');
    const lateMagic = document.getElementById('opLateMagic');

    earlyCards.innerHTML = ''; earlyGuard.innerHTML = ''; earlyShovelBefore.innerHTML = ''; earlyShovelAfter.innerHTML = '';
    earlyFeed.innerHTML = ''; earlyBossFeed.innerHTML = '';
    latePatch.innerHTML = ''; lateShovel.innerHTML = ''; lateFeed.innerHTML = ''; lateBossFeed.innerHTML = '';
    lateFlower.innerHTML = ''; lateBossFlower.innerHTML = ''; lateMagic.innerHTML = '';

    // 面板已移除 → 空值保护（不要直接 .style，缺元素会抛错中断后续逻辑）
    const _opES = document.getElementById('opEarlySection');
    if (_opES) _opES.style.display = (phase === 'early') ? 'block' : 'none';
    const _opLS = document.getElementById('opLateSection');
    if (_opLS) _opLS.style.display = (phase === 'late') ? 'block' : 'none';

    EARLY_CARDS.forEach(op => { const el = createOpElement(op); earlyCards.appendChild(el); });
    EARLY_GUARD.forEach(op => { const el = createOpElement(op); earlyGuard.appendChild(el); });
    EARLY_SHOVEL_BEFORE.forEach(op => { const el = createOpElement(op); earlyShovelBefore.appendChild(el); });
    EARLY_SHOVEL_AFTER.forEach(op => { const el = createOpElement(op); earlyShovelAfter.appendChild(el); });
    EARLY_FEED.forEach(op => { const el = createOpElement(op); earlyFeed.appendChild(el); });
    EARLY_BOSS_FEED.forEach(op => { const el = createOpElement(op); earlyBossFeed.appendChild(el); });
    LATE_PATCH.forEach(op => { const el = createOpElement(op); latePatch.appendChild(el); });
    LATE_SHOVEL.forEach(op => { const el = createOpElement(op); lateShovel.appendChild(el); });
    LATE_FEED.forEach(op => { const el = createOpElement(op); lateFeed.appendChild(el); });

    const lateFeedBall = document.getElementById('opLateFeedBall');
    lateFeedBall.innerHTML = '';
    LATE_FEED_BALL.forEach(op => { const el = createOpElement(op); lateFeedBall.appendChild(el); });

    LATE_BOSS_FEED.forEach(op => { const el = createOpElement(op); lateBossFeed.appendChild(el); });
    LATE_FLOWER.forEach(op => { const el = createOpElement(op); lateFlower.appendChild(el); });
    LATE_BOSS_FLOWER.forEach(op => { const el = createOpElement(op); lateBossFlower.appendChild(el); });
    LATE_MAGIC.forEach(op => { const el = createOpElement(op); lateMagic.appendChild(el); });

    clearSelected();
    updateSelectedUI();
    setTimeout(() => resetKeyboardNavigation(), 50);
}

function createOpElement(op) {
    const div = document.createElement('div');
    div.className = 'op-item';
    div.draggable = true;
    div.dataset.id = op.id;
    let labelText = op.label;
    if (op.type === 'card') {
        const idx = parseInt(op.id.replace('card','')) - 1;
        const remark = slotRemarksEarly[idx] || '';
        labelText = op.label + (remark ? `(${remark})` : '');
    } else if (op.type === 'patch') {
        const idx = op.slot - 2; // patch_slot2 -> 0
        const remark = slotRemarksLate[idx] || '';
        labelText = op.label + (remark ? `(${remark})` : '');
    }
    div.textContent = labelText;

    let tip = '';
    if (op.type === 'card') tip = `点击或拖拽放置卡${op.id.replace('card','')}，最多${op.maxCount}次`;
    else if (op.type === 'guard') tip = '种植守卫菇，最多5次，种完喂豆后铲掉';
    else if (op.type === 'shovel' && op.id === 'shovel_before') tip = '铲除过渡植物（前5次）';
    else if (op.type === 'shovel' && op.id === 'shovel_after') tip = '铲除守卫菇（后5次）';
    else if (op.id === 'feed') tip = '布完阵容后，在指定位置喂能量豆';
    else if (op.id === 'feed_late') tip = '在指定位置循环喂能量豆';
    else if (op.id === 'bossfeed') tip = '在指定位置循环喂能量豆';
    else if (op.id === 'bossfeed_late') tip = '在指定位置循环喂能量豆';
    else if (op.id === 'bossfeed2_late') tip = 'Boss关第二个喂豆位置';
    else if (op.type === 'patch') tip = `补种卡槽${op.slot}的植物，最多5次`;
    else if (op.type === 'flower') tip = '抛花收集能量豆，最多2次';
    else if (op.type === 'bossflower') tip = 'Boss关抛花，最多4次';
    else if (op.type === 'sweet') tip = '种植甜薯';
    else if (op.type === 'ganlan') tip = '种植飓风甘蓝';
    else if (op.type === 'magicfeed') tip = '魔甘前喂能量豆';
    else tip = '点击或拖拽放置';
    div.setAttribute('data-tooltip', tip);

    div.addEventListener('click', function(e) {
        e.stopPropagation();
        if (selectedOp && selectedOp.id === op.id) {
            clearSelected();
        } else {
            setSelected(op);
            const idx = opItemsList.findIndex(el => el.dataset.id === op.id);
            if (idx >= 0) {
                keyboardSelectedIndex = idx;
                updateKeyboardSelection();
            }
        }
        updateSelectedUI();
    });
    div.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', 'op_' + op.id);
        this.classList.add('dragging');
    });
    div.addEventListener('dragend', function(e) { this.classList.remove('dragging'); });
    enableTooltip(div);
    return div;
}

function setSelected(op) { selectedOp = op; updateSelectedUI(); }
function clearSelected() { selectedOp = null; updateSelectedUI(); }
function updateSelectedUI() {
    document.querySelectorAll('.op-item').forEach(el => {
        el.classList.toggle('selected', selectedOp && el.dataset.id === selectedOp.id);
    });
}
