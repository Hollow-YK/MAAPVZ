
// ============================================================
// 6. 快捷开关（左侧）
// ============================================================
const SWITCH_GROUPS = {
    early: {
        switches: [
            { optionName: '小关是否喂豆', label: '小关喂豆' },
            { optionName: 'fw_boss关是否需要喂豆', label: 'Boss喂豆' },
            { optionName: '小关是否加速', label: '小关加速' },
            { optionName: 'fw_boss关是否加速', label: 'Boss加速' },
            { optionName: 'frame_wj_custom_是否种守卫菇', label: '守卫菇启用', default: 0 },
            { optionName: 'frame_wj_custom_是否使用铲子1', label: '守卫菇前铲子', default: 0 },
            { optionName: 'frame_wj_custom_是否使用铲子2', label: '守卫菇后铲子', default: 0 },
        ],
        coords: []
    },
    late: {
        switches: [
            { optionName: '小关是否喂豆', label: '小关喂豆' },
            { optionName: '是否开局喂豆球果', label: '喂豆球果', default: 0 },
            { optionName: 'fw_boss关是否需要喂豆', label: 'Boss喂豆' },
            { optionName: '小关是否加速', label: '小关加速' },
            { optionName: 'fw_boss关是否加速', label: 'Boss加速' },
            { optionName: '是否抛花', label: '是否抛花' },
            { optionName: '小关是否抛花', label: '小关抛花', default: 0 },
            { optionName: 'boss关是否抛花', label: 'Boss抛花', default: 0 },
            { optionName: '是否魔甘收尾(牢玩家专属)', label: '魔甘收尾' },
            { optionName: '使用三叶草', label: '使用三叶草', default: 0 },
            { optionName: '铲除启用', label: '铲除启用', default: 0 },
            { optionName: 'fw_boss_补给智能选取', label: '智能补给' },
            { optionName: 'fw_boss_是否开相机神器', label: '相机神器' },
            { optionName: '识别魔甘卡槽位置', label: '识别魔甘' },
            { optionName: '识别三叶草卡槽位置', label: '识别三叶草' },
            { optionName: '识别能量花卡槽位置', label: '识别能量花' },
        ],
        coords: []
    }
};

const DEPENDENCY_RULES = {
    '识别能量花卡槽位置': { parent: '是否抛花' },
    '识别魔甘卡槽位置': { parent: '魔甘高级选项', grandparent: '是否魔甘收尾(牢玩家专属)' },
    '识别三叶草卡槽位置': { parent: '使用三叶草', grandparent: '是否魔甘收尾(牢玩家专属)' },
    '使用三叶草': { parent: '是否魔甘收尾(牢玩家专属)' },
    '是否开局喂豆球果': { parent: '小关是否喂豆' }
};

function applyDependency(optionName, checked) {
    const rule = DEPENDENCY_RULES[optionName];
    if (!rule) return;
    if (checked) {
        if (rule.parent && currentValues[rule.parent]?.index !== 1) {
            currentValues[rule.parent] = { index: 1 };
        }
        if (rule.grandparent && currentValues[rule.grandparent]?.index !== 1) {
            currentValues[rule.grandparent] = { index: 1 };
        }
    }
}

function renderQuickSwitches(phase) {
    const container = document.getElementById('quickSwitchContainer');
    if (!container) return;   // 快捷开关面板已移除
    container.innerHTML = '';
    const group = SWITCH_GROUPS[phase];
    if (!group) return;

    group.switches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'sw-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        if (currentValues[item.optionName] === undefined) currentValues[item.optionName] = { index: item.default || 0 };
        cb.checked = (currentValues[item.optionName]?.index === 1) || false;
        let disabled = false;
        if (item.optionName === '识别能量花卡槽位置') {
            disabled = (currentValues['是否抛花']?.index !== 1);
        } else if (item.optionName === '识别魔甘卡槽位置') {
            disabled = (currentValues['是否魔甘收尾(牢玩家专属)']?.index !== 1);
        } else if (item.optionName === '使用三叶草') {
            disabled = (currentValues['是否魔甘收尾(牢玩家专属)']?.index !== 1);
        } else if (item.optionName === '识别三叶草卡槽位置') {
            disabled = (currentValues['是否魔甘收尾(牢玩家专属)']?.index !== 1 || currentValues['使用三叶草']?.index !== 1);
        } else if (item.optionName === '是否开局喂豆球果') {
            disabled = (currentValues['小关是否喂豆']?.index !== 1);
        }
        cb.disabled = disabled;
        cb.addEventListener('change', function() {
            if (cb.disabled) return;
            const newVal = this.checked ? 1 : 0;
            applyDependency(item.optionName, this.checked);
            currentValues[item.optionName] = { index: newVal };
            const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'early';
            renderQuickSwitches(currentTab);
            updatePreview();
            updateRightPanelSwitches();
        });
        const label = document.createElement('span');
        label.textContent = item.label;
        div.appendChild(cb);
        div.appendChild(label);
        container.appendChild(div);

        let tip = '';
        if (item.optionName === '小关是否喂豆') tip = '开启后小关喂豆生效';
        else if (item.optionName === 'fw_boss关是否需要喂豆') tip = '开启后Boss关喂豆生效';
        else if (item.optionName === '小关是否加速') tip = '小关自动加速';
        else if (item.optionName === 'fw_boss关是否加速') tip = 'Boss关自动加速';
        else if (item.optionName === 'frame_wj_custom_是否种守卫菇') tip = '启用守卫菇种植';
        else if (item.optionName === 'frame_wj_custom_是否使用铲子1') tip = '启用前5次铲子';
        else if (item.optionName === 'frame_wj_custom_是否使用铲子2') tip = '启用后5次铲子';
        else if (item.optionName === '是否抛花') tip = '开启抛花功能';
        else if (item.optionName === '小关是否抛花') tip = '小关抛花';
        else if (item.optionName === 'boss关是否抛花') tip = 'Boss关抛花';
        else if (item.optionName === '是否魔甘收尾(牢玩家专属)') tip = '开启魔甘收尾（小关喂豆将失效）';
        else if (item.optionName === '使用三叶草') tip = '魔甘时使用三叶草';
        else if (item.optionName === '铲除启用') tip = '启用补植物中的铲除';
        else if (item.optionName === 'fw_boss_补给智能选取') tip = '智能选取补给';
        else if (item.optionName === 'fw_boss_是否开相机神器') tip = 'Boss关开启相机神器';
        else if (item.optionName === '识别魔甘卡槽位置') tip = '自动识别魔甘卡槽';
        else if (item.optionName === '识别三叶草卡槽位置') tip = '自动识别三叶草卡槽';
        else if (item.optionName === '识别能量花卡槽位置') tip = '自动识别能量花卡槽';
        else tip = `开关: ${item.label}`;
        div.setAttribute('data-tooltip', tip);
        enableTooltip(div);
    });

    group.coords.forEach(coord => {
        const optName = coord.optName;
        if (optName === 'frame_wj_custom_回到后期') {
            const div = document.createElement('div');
            div.className = 'coord-input';
            const label = document.createElement('label');
            label.textContent = coord.label + ':';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = '关卡数';
            inp.value = currentValues[optName]?.data?.关卡 || '';
            const regex = coord.regex || /.*/;
            function validate() {
                const v = inp.value.trim();
                if (v === '') { inp.classList.remove('error'); return true; }
                if (regex.test(v)) { inp.classList.remove('error'); return true; }
                else { inp.classList.add('error'); setStatus('⚠️ 请输入1~149中不是5的倍数的数'); return false; }
            }
            inp.addEventListener('input', function() {
                const valid = validate();
                if (valid) {
                    if (!currentValues[optName]) currentValues[optName] = { data: {} };
                    currentValues[optName].data.关卡 = this.value.trim();
                    updatePreview();
                }
            });
            inp.addEventListener('blur', validate);
            div.appendChild(label);
            div.appendChild(inp);
            container.appendChild(div);
            div.setAttribute('data-tooltip', '设置在第几关切换布阵（1~149，非5的倍数）');
            enableTooltip(div);
            setTimeout(validate, 100);
            return;
        }

        const def = OPTION_DEFS[optName];
        if (!def || def.type !== 'input') return;
        const inputs = def.inputs || [];
        const colKey = inputs[0]?.name || '列';
        const rowKey = inputs[1]?.name || '行';
        let disabled = false, hint = '';
        if (coord.depends) {
            const depState = currentValues[coord.depends]?.index;
            if (depState !== 1) { disabled = true; hint = `（请先开启“${coord.depends}”）`; }
        }
        const div = document.createElement('div');
        div.className = 'coord-input';
        const label = document.createElement('label');
        label.textContent = coord.label + ':';
        const colInput = document.createElement('input');
        colInput.type = 'text';
        colInput.placeholder = '列';
        colInput.value = currentValues[optName]?.data?.[colKey] || '';
        colInput.disabled = disabled;
        const rowInput = document.createElement('input');
        rowInput.type = 'text';
        rowInput.placeholder = '行';
        rowInput.value = currentValues[optName]?.data?.[rowKey] || '';
        rowInput.disabled = disabled;
        if (disabled) {
            const hintSpan = document.createElement('span');
            hintSpan.className = 'disabled-hint';
            hintSpan.textContent = hint;
            div.appendChild(label);
            div.appendChild(colInput);
            div.appendChild(document.createTextNode('-'));
            div.appendChild(rowInput);
            div.appendChild(hintSpan);
        } else {
            colInput.addEventListener('input', function() {
                if (!currentValues[optName]) currentValues[optName] = { data: {} };
                currentValues[optName].data[colKey] = this.value;
                updatePreview();
            });
            rowInput.addEventListener('input', function() {
                if (!currentValues[optName]) currentValues[optName] = { data: {} };
                currentValues[optName].data[rowKey] = this.value;
                updatePreview();
            });
            div.appendChild(label);
            div.appendChild(colInput);
            div.appendChild(document.createTextNode('-'));
            div.appendChild(rowInput);
        }
        container.appendChild(div);
        div.setAttribute('data-tooltip', `设置${coord.label}的坐标`);
        enableTooltip(div);
    });
}

// 批量放置开关已移除：isBatchMode 保持默认 true
