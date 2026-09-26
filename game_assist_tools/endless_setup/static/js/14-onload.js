
// ============================================================
// 14. 事件绑定与初始化
// ============================================================
window.onload = function() {
    enableTooltips('[data-tooltip]');
    observeNewElements();

    slotRemarksEarly = Array(8).fill('');
    slotRemarksLate = Array(7).fill('');
    renderSlotRemarks();
    initBoards();
    renderAllBoards();
    initTabs();

    const container = document.getElementById('optionTree');
    buildOptionUI(container, getRootOptionNames());
    const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'early';
    renderQuickSwitches(currentTab);
    document.querySelector('.tab[data-tab="early"]').click();

    isBatchMode = true;   // 批量放置开关已移除

    renderRightPanelSwitches();
    updateRightPanelSwitches();

    const returnLateInput = document.getElementById('customReturnLate');
    if (returnLateInput) {
        returnLateInput.value = currentValues['frame_wj_custom_回到后期']?.data?.关卡 || '';
        returnLateInput.addEventListener('input', function() {
            const val = this.value.trim();
            if (!currentValues['frame_wj_custom_回到后期']) {
                currentValues['frame_wj_custom_回到后期'] = { data: {} };
            }
            currentValues['frame_wj_custom_回到后期'].data.关卡 = val;
            if (val !== '') {
                currentValues['自定义布阵'] = { index: 1 };
            }
            updatePreview();
        });
    }

    // 导入按钮事件（导入/导出/复制等旧工具栏按钮已移除，保留空值保护）
    const _impBtn = document.getElementById('importBtn');
    if (_impBtn) _impBtn.addEventListener('click', function() {
        const f = document.getElementById('importFileInput');
        if (f) f.click();
    });
    const _impFile = document.getElementById('importFileInput');
    if (_impFile) _impFile.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            importFromJSONText(ev.target.result);
        };
        reader.readAsText(file);
        this.value = '';
    });

    // 撤销/重做按钮
    const _undo = document.getElementById('undoBtn');
    if (_undo) _undo.addEventListener('click', undoBoard);
    const _redo = document.getElementById('redoBtn');
    if (_redo) _redo.addEventListener('click', redoBoard);

    // 旧工具栏的 导出/默认选项/复制 已移除；对应的输入框也没了，
    // 这里一律补空值保护，避免任何一个缺失元素中断 onload（后面所有绑定都会失效）
    const _exp = document.getElementById('exportBtn');
    if (_exp) _exp.addEventListener('click', exportJSON);
    const _def = document.getElementById('loadDefaultBtn');
    if (_def) _def.addEventListener('click', loadDefaults);
    const _cp = document.getElementById('copyBtn');
    if (_cp) _cp.addEventListener('click', copyPreview);

    ['configName','controllerName','resourceName','taskEntry'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePreview);
    });

    currentValues['无尽模式'] = { index: 1 };

    // 初始化间隔区域
    initLateFeedIntervals();
    updateLateFeedIntervalsVisibility();
    initEarlyFeedIntervals();
    updateEarlyFeedIntervalsVisibility();

    // 初始渲染
    updatePreview();
    loadDefaults();

    // 作业集初始化放在最后：loadDefaults 会重置棋盘，必须在其之后再恢复本地缓存
    jobInit();
};
