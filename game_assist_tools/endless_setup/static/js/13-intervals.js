
// ============================================================
// 13. 动态间隔区域相关函数
//
// ⏱️ 「喂豆间隔设置」面板（小关 / Boss关 / Boss关2）已整体移除，用不到了。
//    下面两个函数保留为空实现，只是为了不打断既有的调用点
//    （tab 切换、棋盘重渲染等处会调），避免 window.onload 里抛错。
// ============================================================
function initLateFeedIntervals() {
    // 面板已移除，无需初始化
}

function updateLateFeedIntervalsVisibility() {
    // 面板已移除，无需更新可见性
}
// ===== 前期自定义Boss喂豆间隔动态显示 =====
function initEarlyFeedIntervals() {
    const inp = document.getElementById('earlyBossFeedIntervalInput');
    if (!inp) return;
    inp.value = currentValues['frame_wj_boss_custom_喂豆间隔']?.data?.秒数 || '3';
    inp.addEventListener('input', function() {
        let val = this.value.trim();
        if (val === '') val = '3';
        if (!currentValues['frame_wj_boss_custom_喂豆间隔']) {
            currentValues['frame_wj_boss_custom_喂豆间隔'] = { data: {} };
        }
        currentValues['frame_wj_boss_custom_喂豆间隔'].data.秒数 = val;
        updatePreview();
    });
}

function updateEarlyFeedIntervalsVisibility() {
    const container = document.getElementById('earlyFeedIntervals');
    if (!container) return;
    const currentTab = document.querySelector('.tab.active')?.dataset.tab;
    if (currentTab !== 'early') {
        container.style.display = 'none';
        return;
    }

    // 检测前期棋盘上是否有自定义Boss喂豆操作
    let hasBossFeed = false;
    for (let r = 0; r < boardEarly.length; r++) {
        for (let c = 0; c < boardEarly[r].length; c++) {
            const cell = boardEarly[r][c];
            for (let item of cell) {
                if (item.id === 'bossfeed' || item.id === 'bossfeed_late') {
                    hasBossFeed = true;
                    break;
                }
            }
            if (hasBossFeed) break;
        }
        if (hasBossFeed) break;
    }

    const shouldShow = hasBossFeed;

    container.style.display = shouldShow ? 'block' : 'none';

    if (shouldShow) {
        const inp = document.getElementById('earlyBossFeedIntervalInput');
        if (inp) inp.value = currentValues['frame_wj_boss_custom_喂豆间隔']?.data?.秒数 || '3';
    }
}

// 在 renderAllBoards 中同时更新前期和后期
const originalRenderAllBoards2 = renderAllBoards;
renderAllBoards = function() {
    originalRenderAllBoards2();
    updateLateFeedIntervalsVisibility();
    updateEarlyFeedIntervalsVisibility();
};

// Tab 切换时同时更新
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
        setTimeout(() => {
            updateLateFeedIntervalsVisibility();
            updateEarlyFeedIntervalsVisibility();
        }, 50);
    });
});

// 初始化
initEarlyFeedIntervals();
updateEarlyFeedIntervalsVisibility();

// 覆盖 renderAllBoards 使其自动更新显示
const originalRenderAllBoards = renderAllBoards;
renderAllBoards = function() {
    originalRenderAllBoards();
    updateLateFeedIntervalsVisibility();
};

// Tab 切换时更新
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
        setTimeout(updateLateFeedIntervalsVisibility, 50);
        // 补给入口只在 boss tab 显示，并刷新卡片数据（每个阵容独立）
        setTimeout(function () {
            jobSyncSupplyVisibility();
            jobRenderSupply();
        }, 60);
    });
});

// 初始化
initLateFeedIntervals();
updateLateFeedIntervalsVisibility();
// ===== 右侧编队切换控件（仅在前期棋盘显示）- 紧凑版 =====
function renderTeamSwitchControls() {
    const container = document.getElementById('teamSwitchControls');
    if (!container) return;
    const currentTab = document.querySelector('.tab.active')?.dataset.tab;
    if (currentTab !== 'early') {
        container.innerHTML = '';
        return;
    }

    const switches = [
        { id: 'frame_wj_custom_前期使用编队', label: '普通关切换编队', inputId: 'frame_wj_custom_前期切换到第几编队', icon: '🎯' },
        { id: 'frame_wj_custom_回到后期切换编队', label: 'boss关切换编队', inputId: 'frame_wj_custom_切换到第几编队', icon: '🔄' }
    ];

    let html = `
        <div style="background:#f8fafc; border-radius:8px; padding:6px 10px; margin-top:2px; border:1px solid #e2e8f0;">
            <div style="font-size:12px; font-weight:600; color:#1e293b; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
                <span>📋</span> 编队切换
                <span style="font-size:10px; font-weight:400; color:#94a3b8;">（仅普通关）</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:3px;">
    `;

    switches.forEach(sw => {
        const isChecked = currentValues[sw.id]?.index === 1;
        const inputVal = currentValues[sw.inputId]?.data?.编队 || '';
        const borderColor = isChecked ? '#3b82f6' : '#e2e8f0';
        const bgColor = isChecked ? '#eff6ff' : '#ffffff';

        html += `
            <div style="display:flex; align-items:center; gap:4px; background:${bgColor}; border:1px solid ${borderColor}; border-radius:5px; padding:3px 6px; transition:all 0.2s ease;">
                <span style="font-size:12px; line-height:1;">${sw.icon}</span>
                <label style="font-size:12px; font-weight:500; color:#1e293b; display:flex; align-items:center; gap:4px; cursor:pointer; user-select:none; white-space:nowrap;">
                    <input type="checkbox" id="chk_${sw.id}" ${isChecked?'checked':''} style="width:14px; height:14px; cursor:pointer; accent-color:#2d7aff; flex-shrink:0; margin:0;">
                    ${sw.label}
                </label>
                <div style="display:${isChecked ? 'inline-flex' : 'none'}; align-items:center; gap:2px; margin-left:2px;">
                    <input type="text" id="inp_${sw.inputId}" placeholder="1-6" value="${inputVal}" style="width:36px; padding:1px 2px; border:1px solid #3b82f6; border-radius:3px; font-size:11px; font-weight:500; text-align:center; background:#fff; outline:none;" />
                    <span style="font-size:10px; color:#94a3b8;">号</span>
                </div>
                ${!isChecked ? `<span style="font-size:10px; color:#94a3b8; margin-left:4px;">未启用</span>` : ''}
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;
    container.innerHTML = html;

    switches.forEach(sw => {
        const chk = document.getElementById(`chk_${sw.id}`);
        const inp = document.getElementById(`inp_${sw.inputId}`);
        if (chk) {
            chk.addEventListener('change', function() {
                const checked = this.checked;
                currentValues[sw.id] = { index: checked ? 1 : 0 };
                const parentDiv = this.closest('div[style*="display:flex"]');
                if (checked) {
                    if (!currentValues[sw.inputId]) currentValues[sw.inputId] = { data: {} };
                    const inputWrapper = parentDiv.querySelector('div[style*="inline-flex"]');
                    if (inputWrapper) {
                        inputWrapper.style.display = 'inline-flex';
                        const hint = parentDiv.querySelector('span:last-child');
                        if (hint && hint.textContent === '未启用') hint.remove();
                    }
                    parentDiv.style.borderColor = '#3b82f6';
                    parentDiv.style.background = '#eff6ff';
                } else {
                    const inputWrapper = parentDiv.querySelector('div[style*="inline-flex"]');
                    if (inputWrapper) {
                        inputWrapper.style.display = 'none';
                        const existingHint = parentDiv.querySelector('span:last-child');
                        if (!existingHint || existingHint.textContent !== '未启用') {
                            const hint = document.createElement('span');
                            hint.style.cssText = 'font-size:10px; color:#94a3b8; margin-left:4px;';
                            hint.textContent = '未启用';
                            parentDiv.appendChild(hint);
                        }
                    }
                    if (currentValues[sw.inputId]) currentValues[sw.inputId].data = {};
                    parentDiv.style.borderColor = '#e2e8f0';
                    parentDiv.style.background = '#ffffff';
                }
                updatePreview();
            });
        }
        if (inp) {
            inp.addEventListener('input', function() {
                if (!currentValues[sw.inputId]) currentValues[sw.inputId] = { data: {} };
                currentValues[sw.inputId].data.编队 = this.value;
                updatePreview();
            });
            inp.addEventListener('focus', function() { this.select(); });
        }
    });
}

// 在切换 Tab 时更新编队控件
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
        setTimeout(renderTeamSwitchControls, 50);
    });
});

// 初始化调用
renderTeamSwitchControls();
