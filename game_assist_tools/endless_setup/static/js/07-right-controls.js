
// ============================================================
// 7. 右侧快速控制
// ============================================================
const RIGHT_SWITCHES = [
    { optionName: '是否抛花', label: '是否抛花' },
    { optionName: '是否魔甘收尾(牢玩家专属)', label: '魔甘收尾' },
    { optionName: '小关是否加速', label: '小关加速' },
    { optionName: 'fw_boss关是否加速', label: 'Boss加速' },
    { optionName: 'fw_boss_补给智能选取', label: '智能补给' },
    { optionName: 'fw_boss_是否开相机神器', label: '相机神器' },
    { optionName: '使用三叶草', label: '使用三叶草' },
    { optionName: '识别魔甘卡槽位置', label: '识别魔甘' },
    { optionName: '识别三叶草卡槽位置', label: '识别三叶草' },
    { optionName: '识别能量花卡槽位置', label: '识别能量花' }
];

let rightCheckboxes = {};
let exportNoteChoice = 'no'; // 卡槽备注已移除：不再提示导出备注

function renderRightPanelSwitches() {
    if (!document.getElementById('rightQuickControls')) return;   // 右侧快速控制已移除
    const container = document.getElementById('rightQuickControls');
    container.innerHTML = '';
    const currentTab = document.querySelector('.tab.active')?.dataset.tab;

    // 常规开关只在后期显示
    if (currentTab === 'late') {
        RIGHT_SWITCHES.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ctrl-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = 'right_' + item.optionName;
            if (currentValues[item.optionName] === undefined) currentValues[item.optionName] = { index: 0 };
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
            }
            cb.disabled = disabled;
            cb.addEventListener('change', function() {
                if (cb.disabled) return;
                const newVal = this.checked ? 1 : 0;
                applyDependency(item.optionName, this.checked);
                currentValues[item.optionName] = { index: newVal };
                const currentTab2 = document.querySelector('.tab.active')?.dataset.tab || 'early';
                renderQuickSwitches(currentTab2);
                updatePreview();
                renderRightPanelSwitches();
            });
            const label = document.createElement('label');
            label.htmlFor = cb.id;
            label.textContent = item.label;
            div.appendChild(cb);
            div.appendChild(label);
            div.setAttribute('data-tooltip-delay', '1000');
            container.appendChild(div);

            let tip = '';
            if (item.optionName === '是否抛花') tip = '开启抛花功能';
            else if (item.optionName === '是否魔甘收尾(牢玩家专属)') tip = '开启魔甘收尾（小关喂豆将失效）';
            else if (item.optionName === '小关是否加速') tip = '小关自动加速';
            else if (item.optionName === 'fw_boss关是否加速') tip = 'Boss关自动加速';
            else if (item.optionName === 'fw_boss_补给智能选取') tip = '智能选取补给';
            else if (item.optionName === 'fw_boss_是否开相机神器') tip = 'Boss关开启相机神器';
            else if (item.optionName === '使用三叶草') tip = '魔甘时使用三叶草';
            else if (item.optionName === '识别魔甘卡槽位置') tip = '自动识别魔甘卡槽';
            else if (item.optionName === '识别三叶草卡槽位置') tip = '自动识别三叶草卡槽';
            else if (item.optionName === '识别能量花卡槽位置') tip = '自动识别能量花卡槽';
            else tip = `开关: ${item.label}`;
            div.setAttribute('data-tooltip', tip);
            enableTooltip(div);
            rightCheckboxes[item.optionName] = cb;
        });
    }

    // 球果切换形态控件（只在前期显示）
    if (currentTab === 'early') {
        const ballDiv = document.createElement('div');
        ballDiv.className = 'ctrl-item';
        const ballCb = document.createElement('input');
        ballCb.type = 'checkbox';
        ballCb.id = 'right_ball_switch';
        ballCb.checked = (currentValues['frame_wj_custom_球果切换形态']?.index === 1);
        ballCb.addEventListener('change', function() {
            const checked = this.checked;
            currentValues['frame_wj_custom_球果切换形态'] = { index: checked ? 1 : 0 };
            updatePreview();
        });
        const ballLabel = document.createElement('label');
        ballLabel.htmlFor = ballCb.id;
        ballLabel.textContent = '球果切换';
        ballDiv.appendChild(ballCb);
        ballDiv.appendChild(ballLabel);

        if (currentValues['frame_wj_custom_球果切换形态']?.index === 1) {
            const radioContainer = document.createElement('span');
            radioContainer.style.display = 'inline-flex';
            radioContainer.style.gap = '6px';
            radioContainer.style.marginLeft = '8px';
            const cases = OPTION_DEFS['frame_wj_custom_球果位置']?.cases || [];
            cases.forEach((c, idx) => {
                const radioLabel = document.createElement('label');
                radioLabel.style.fontSize = '12px';
                radioLabel.style.display = 'flex';
                radioLabel.style.alignItems = 'center';
                radioLabel.style.gap = '2px';
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'right_ball_form';
                radio.value = idx;
                radio.checked = (currentValues['frame_wj_custom_球果位置']?.index === idx);
                radio.addEventListener('change', function() {
                    if (this.checked) {
                        currentValues['frame_wj_custom_球果位置'] = { index: parseInt(this.value) };
                        updatePreview();
                    }
                });
                radioLabel.appendChild(radio);
                radioLabel.appendChild(document.createTextNode(c.name || c.label || '选项'));
                radioContainer.appendChild(radioLabel);
            });
            ballDiv.appendChild(radioContainer);
        }

        container.appendChild(ballDiv);
    }
}

function updateRightPanelSwitches() {
    renderRightPanelSwitches();
    renderTeamSwitchControls();
}
