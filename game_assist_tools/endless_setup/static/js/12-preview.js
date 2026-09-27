
// ============================================================
// 12. 更新预览和导出
// ============================================================
function setStatus(msg) {
    const el = document.getElementById('statusMsg');
    if (el) el.textContent = msg;   // 预览/状态栏已移除时静默忽略
}

function updatePreview() {
    const data = buildFullInstance();
    const _pt = document.getElementById('previewText');
    if (_pt) _pt.value = JSON.stringify(data, null, 2);   // 预览面板已移除
    const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'early';
    renderQuickSwitches(currentTab);
    updateRightPanelSwitches();

    const returnLateInput = document.getElementById('customReturnLate');
    if (returnLateInput) {
        const val = currentValues['frame_wj_custom_回到后期']?.data?.关卡 || '';
        returnLateInput.value = val;
    }
    const container = document.getElementById('optionTree');
    container.innerHTML = '';
    buildOptionUI(container, getRootOptionNames());
}

function exportSlotRemarks() {
    let content = '';
    content += '前期卡槽备注：\n';
    slotRemarksEarly.forEach((remark, idx) => {
        content += `卡槽${idx+1}：${remark || '无'}\n`;
    });
    content += '\n后期补卡备注：\n';
    slotRemarksLate.forEach((remark, idx) => {
        const slot = idx + 2;
        content += `补卡${slot}：${remark || '无'}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '卡槽备注.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function showExportNoteModal(onYes, onNo) {
    const modal = document.getElementById('exportNoteModal');
    modal.style.display = 'flex';
    const yesBtn = document.getElementById('exportNoteYes');
    const noBtn = document.getElementById('exportNoteNo');
    const noPromptCheck = document.getElementById('exportNoteNoPrompt');

    const cleanup = () => {
        modal.style.display = 'none';
        yesBtn.onclick = null;
        noBtn.onclick = null;
    };

    yesBtn.onclick = () => {
        const noPrompt = noPromptCheck.checked;
        if (noPrompt) {
            exportNoteChoice = 'yes';
        }
        cleanup();
        onYes();
    };

    noBtn.onclick = () => {
        const noPrompt = noPromptCheck.checked;
        if (noPrompt) {
            exportNoteChoice = 'no';
        }
        cleanup();
        onNo();
    };
}

function exportJSON() {
    const data = buildFullInstance();
    const _fn = document.getElementById('fileName');
    const name = (_fn && _fn.value.trim()) || data.InstanceName || "无尽配置";
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`✅ 已导出：${name}.json`);
    console.log('✅ exportJSON 被调用');
    try {
        const data = buildFullInstance();
        console.log('✅ 配置数据已生成');
        const jsonStr = JSON.stringify(data, null, 2);
        console.log('✅ JSON 长度:', jsonStr.length);

        fetch('/save_config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStr
        })
        .then(res => res.json())
        .then(result => {
            console.log('📦 响应:', result);
            setStatus(result.status === 'success' ? '✅ 配置已保存到本地 config.json' : '❌ 保存失败：' + result.msg);
        })
        .catch(err => {
            console.error('❌ 请求失败:', err);
            setStatus('❌ 请求失败：' + err);
        });
    } catch (e) {
        console.error('❌ 生成配置失败:', e);
        setStatus('❌ 生成配置失败：' + e.message);
    }
    // 检查是否需要导出备注
    const savedChoice = exportNoteChoice;
    if (savedChoice === 'yes') {
        exportSlotRemarks();
    } else if (savedChoice === 'no') {
        // 不导出备注
    } else {
        showExportNoteModal(
            () => {
                exportSlotRemarks();
                setStatus((document.getElementById('statusMsg')?.textContent || '') + '，备注已导出');
            },
            () => {
                // 用户选择否，不导出备注
            }
        );
    }
}

function loadDefaults() {
    undoStack = [];
    redoStack = [];
    initDefaultValues();
    slotRemarksEarly = Array(8).fill('');
    slotRemarksLate = Array(7).fill('');
    renderSlotRemarks();
    initBoards();
    renderAllBoards();
    clearSelected();
    updateSelectedUI();
    const container = document.getElementById('optionTree');
    container.innerHTML = '';
    buildOptionUI(container, getRootOptionNames());
    const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'early';
    renderQuickSwitches(currentTab);
    document.querySelector('.tab[data-tab="early"]').click();
    updatePreview();
    updateRightPanelSwitches();
    setTimeout(() => resetKeyboardNavigation(), 100);
    setStatus('↺ 已恢复默认');
}

function copyPreview() {
    const text = document.getElementById('previewText');
    text.select();
    navigator.clipboard.writeText(text.value).then(() => {
        setStatus('📋 已复制到剪贴板');
    }).catch(() => {
        document.execCommand('copy');
        setStatus('📋 已复制');
    });
}
