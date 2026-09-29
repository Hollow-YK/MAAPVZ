
// ============================================================
// 补给选取（boss 关专属，每个阵容独立）
//
// 每张卡 = 一个补给选项，顺序即「优先拿哪个」。
// 拖拽调整顺序；数据存在 t.supplyPicks（每个阵容一份）。
// 导出 JSON 暂不接，先把 UI 做出来。
// ============================================================

// 默认补给项（与 static/supply/ 下的中文名图片一一对应）
const SUPPLY_DEFAULTS = [
    { id: 'all',      name: '全部植物', img: '全部植物.png' },
    { id: 'orange',   name: '橙色植物', img: '橙色植物.png' },
    { id: 'purple',   name: '紫色植物', img: '紫色植物.png' },
    { id: 'blue',     name: '蓝色植物', img: '蓝色植物.png' },
    { id: 'green',    name: '绿色植物', img: '绿色植物.png' },
    { id: 'white',    name: '白色植物', img: '白色植物.png' },
    { id: 'artifact', name: '神器',     img: '神器.png' },
    { id: 'sun',      name: '能量豆',   img: '能量豆.png' }
];

// 补给图片目录（Flask static 挂在 /static/...，见 HANDOFF 约定）
const SUPPLY_IMG_DIR = 'static/supply/';

// 候选补给项（「可选补给项」图库里能选的全部图片）
// 「查看」放在最后，且是**固定项**：点它只会置顶，不能移除（见 jobToggleSupplyItem）
const SUPPLY_CANDIDATES = SUPPLY_DEFAULTS.concat([
    { id: 'cucumber', name: '黄瓜', img: 'bomb.png' },
    { id: 'view',     name: '查看', img: '查看.png', pinned: true }
]);

// 「查看」是固定项：点它 = 放到链首（已在首位则不动），不能删
const SUPPLY_PINNED_ID = 'view';

// 取当前阵容的补给列表（没有就按默认初始化）
function jobSupplyList(t) {
    if (!t) return [];
    if (!Array.isArray(t.supplyPicks)) {
        // 默认给前 5 项（与参考实现的 5 张卡一致）
        t.supplyPicks = SUPPLY_DEFAULTS.slice(0, 5).map(function (d) {
            return { id: d.id, name: d.name, img: d.img };
        });
    }
    return t.supplyPicks;
}

function jobSupplyIsPinned(it) {
    return !!it && (it.id === SUPPLY_PINNED_ID || it.pinned === true);
}

// 点图库项：固定项 -> 置顶；普通项 -> 添加／移除切换
function jobToggleSupplyItem(cand) {
    const t = jobTables[currentTable];
    if (!t) return;
    const list = jobSupplyList(t);
    const key = jobSupplyItemKey(cand);
    const at = list.findIndex(function (x) { return jobSupplyItemKey(x) === key; });

    if (cand.pinned) {
        // 「查看」是固定项，但允许取消：
        //   · 不在列表里        -> 插到最前面（置顶）
        //   · 在列表里但不在首位 -> 移到最前面
        //   · 已在首位          -> 再点一次取消（移除）
        if (at < 0) {
            list.unshift({ id: cand.id, name: cand.name, img: cand.img, pinned: true });
            setStatus('📌 已把「' + cand.name + '」固定到最前');
        } else if (at > 0) {
            list.splice(at, 1);
            list.unshift({ id: cand.id, name: cand.name, img: cand.img, pinned: true });
            setStatus('📌 已把「' + cand.name + '」固定到最前');
        } else {
            list.splice(at, 1);
            setStatus('－ 已取消「' + cand.name + '」');
        }
    } else if (at >= 0) {
        list.splice(at, 1);
        setStatus('－ 已移除补给项：' + cand.name);
    } else {
        list.push({ id: cand.id, name: cand.name, img: cand.img });
        setStatus('＋ 已添加补给项：' + cand.name);
    }
    jobSaveLocal();
    jobRenderSupply();
    jobRenderSupplyPicker();
}

// 渲染卡片堆叠
function jobRenderSupply() {
    const stage = document.getElementById('supplyStage');
    const badge = document.getElementById('supplyCount');
    if (!stage) return;

    const t = jobTables[currentTable];
    stage.innerHTML = '';
    if (!t) return;

    const list = jobSupplyList(t);
    if (badge) badge.textContent = String(list.length);

    if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'supply-empty';
        empty.textContent = '还没有补给项，点下面的图库添加';
        stage.appendChild(empty);
        return;
    }

    // ★「查看」不参与排序 —— 单独放在旁边固定显示（见 jobRenderSupplyPinned）
    const sortable = list.filter(function (it) { return !jobSupplyIsPinned(it); });
    jobRenderSupplyPinned(list);

    sortable.forEach(function (item, i) {
        const card = document.createElement('div');
        const isPinned = jobSupplyIsPinned(item);
        // 固定项加 sp-pinned -> 蓝色描边（见 CSS）
        card.className = 'supply-card' + (isPinned ? ' sp-pinned' : '');
        // 固定项不许拖走（拖了也会被置顶逻辑拉回来，不如直接禁用）
        card.draggable = !isPinned;
        card.dataset.idx = String(i);
        // ★ 关键：把序号写进 CSS 变量，位移由 CSS 一次算出
        card.style.setProperty('--i', String(i));
        card.title = isPinned
            ? (item.name + '（固定项，始终在最前）')
            : (item.name + '（拖拽调整顺序）');

        const img = document.createElement('div');
        img.className = 'sc-img';
        if (item.img) {
            const el = document.createElement('img');
            el.src = SUPPLY_IMG_DIR + encodeURIComponent(item.img);
            el.alt = item.name || '';
            el.draggable = false;          // 让拖拽事件落在卡片上，不是图片上
            el.onerror = function () {
                // 图片缺失时退化成 emoji，不显示破图
                this.style.display = 'none';
                img.textContent = item.icon || '📦';
            };
            img.appendChild(el);
        } else {
            img.textContent = item.icon || '📦';
        }
        card.appendChild(img);

        const ord = document.createElement('span');
        ord.className = 'sc-order';
        ord.textContent = isPinned ? '📌' : String(i + 1);
        card.appendChild(ord);

        // 固定项（「查看」）不给删除按钮 —— 它的取消入口在弹窗图库里
        // （再点一次「查看」= 取消），避免误触把置顶项删掉
        if (!isPinned) {
            const del = document.createElement('button');
            del.className = 'sc-del';
            del.textContent = '×';
            del.title = '删除这一项';
            del.addEventListener('click', function (e) {
                e.stopPropagation();
                list.splice(i, 1);
                jobSaveLocal();
                jobRenderSupply();
                jobRenderSupplyPicker();
            });
            card.appendChild(del);
        }

        const nm = document.createElement('div');
        nm.className = 'sc-name';
        nm.textContent = item.name;
        card.appendChild(nm);

        // ---- 拖拽排序 ----
        card.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/plain', String(i));
            e.dataTransfer.effectAllowed = 'move';
            card.style.opacity = '0.4';
        });
        card.addEventListener('dragend', function () { card.style.opacity = ''; });
        card.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        card.addEventListener('drop', function (e) {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const to = i;
            if (isNaN(from) || from === to) return;
            // ★ 注意：这里操作的是 sortable（已剔除固定项），
            //   但真正要改的是 list —— 先按 sortable 算好新顺序，再写回 list。
            const moved = sortable.splice(from, 1)[0];
            sortable.splice(to, 0, moved);
            jobCommitSupplyOrder(list, sortable);
            setStatus('↔ 已调整补给顺序：' + moved.name + ' → 第 ' + (to + 1) + ' 位');
        });

        // 悬停时按「距离」给所有卡下发位移：离得越远退得越多（扇子张开）
        // 被悬停那张单独加 .sc-lifted（上浮 + 微旋 + 放大）
        card.addEventListener('mouseenter', function () { jobSupplyHover(i, true); });
        card.addEventListener('mouseleave', function () { jobSupplyHover(i, false); });

        // 点卡片 -> 打开选择弹窗（便于换掉这一项）
        card.addEventListener('click', function () {
            jobOpenSupplyPicker();
        });

        stage.appendChild(card);
    });

    // 空白区提示
    const hint = document.getElementById('supplyHint');
    if (hint) hint.textContent = list.length ? '拖拽卡片可调整顺序' : '';
}

// 把排序结果写回列表：固定项保持原位，其余按 sortable 的新顺序铺进去
function jobCommitSupplyOrder(list, sortable) {
    let k = 0;
    for (let i = 0; i < list.length; i++) {
        if (jobSupplyIsPinned(list[i])) continue;      // 固定项不动
        list[i] = sortable[k++];
    }
    jobSaveLocal();
    jobRenderSupply();
}

// 「查看」这类固定项：不参与排序，单独画在堆叠区旁边
function jobRenderSupplyPinned(list) {
    const box = document.getElementById('supplyPinned');
    if (!box) return;
    box.innerHTML = '';
    const pinned = (list || []).filter(jobSupplyIsPinned);
    box.style.display = pinned.length ? '' : 'none';
    if (!pinned.length) return;

    const lab = document.createElement('div');
    lab.className = 'sp-pin-label';
    lab.textContent = '固定';
    box.appendChild(lab);

    pinned.forEach(function (item) {
        const card = document.createElement('div');
        card.className = 'supply-card sp-pinned sp-static';
        card.title = item.name + '（固定项，不参与排序）';
        card.style.setProperty('--i', '0');

        const img = document.createElement('div');
        img.className = 'sc-img';
        const el = document.createElement('img');
        el.src = SUPPLY_IMG_DIR + encodeURIComponent(item.img);
        el.alt = item.name || '';
        el.draggable = false;
        el.onerror = function () { this.style.display = 'none'; };
        img.appendChild(el);
        card.appendChild(img);

        const nm = document.createElement('div');
        nm.className = 'sc-name';
        nm.textContent = item.name;
        card.appendChild(nm);

        // 点它 -> 打开图库（在那边可以取消固定）
        card.addEventListener('click', function () { jobOpenSupplyPicker(); });
        box.appendChild(card);
    });
}

// 悬停/离开时重算所有卡片的让位
//   hoverIdx 那张：加 .sc-lifted（CSS 负责上浮+旋转+放大）
//   其余：shift = (自己的序号 - hoverIdx) * 基准位移
//         负数往左退、正数往右退，越远退越多 -> 整叠像扇子张开
//
// ⚠️ 为什么用 left 而不是 transform：
//   实测 `transition: transform` + JS 写 transform 时，inline 值虽然对了，
//   但卡片在屏幕上的渲染位置完全不变（Chromium 的合成层问题）。
//   改成过渡 `left`（布局属性）实测可靠，且视觉上同样是平滑位移。
function jobSupplyHover(hoverIdx, on) {
    const stage = document.getElementById('supplyStage');
    if (!stage) return;
    const sec = document.getElementById('supplySection');
    let shiftBase = 34;
    if (sec) {
        const parsed = parseFloat(getComputedStyle(sec).getPropertyValue('--sc-shift'));
        if (!isNaN(parsed)) shiftBase = parsed;
    }

    Array.from(stage.querySelectorAll('.supply-card')).forEach(function (c) {
        const i = parseInt(c.style.getPropertyValue('--i'), 10) || 0;
        if (!on || i === hoverIdx) {
            // 复位；抽出那张的位移交给 .sc-lifted
            if (on && i === hoverIdx) c.classList.add('sc-lifted');
            else c.classList.remove('sc-lifted');
            c.style.setProperty('--shift-x', '0px');
        } else {
            c.classList.remove('sc-lifted');
            c.style.setProperty('--shift-x', ((i - hoverIdx) * shiftBase) + 'px');
        }
    });
}
