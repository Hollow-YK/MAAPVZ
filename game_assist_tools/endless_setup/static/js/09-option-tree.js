
// ============================================================
// 9. 选项树
// ============================================================
let currentValues = {};
function initDefaultValues() {
    for (const [name, def] of Object.entries(OPTION_DEFS)) {
        if (def.type === 'select' || def.type === 'switch') {
            currentValues[name] = { index: (name === '无尽模式') ? 1 : 0 };
        } else if (def.type === 'input') {
            const data = {};
            if (def.inputs) def.inputs.forEach(inp => data[inp.name] = inp.default || '');
            currentValues[name] = { data };
        } else if (def.type === 'checkbox') {
            currentValues[name] = { selected_cases: [] };
        }
    }
}
initDefaultValues();

function buildOptionUI(container, optionNames) {
    const root = document.createElement('div');
    root.className = 'option-node option-node-root';
    container.appendChild(root);
    optionNames.forEach(name => {
        const def = OPTION_DEFS[name];
        if (!def) {
            const item = document.createElement('div');
            item.className = 'option-item';
            item.innerHTML = `<span class="label">❓ ${name}</span>`;
            root.appendChild(item);
            return;
        }
        const itemDiv = document.createElement('div');
        itemDiv.className = 'option-item';
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = def.label || name;
        if (def.description) label.title = def.description;
        itemDiv.appendChild(label);

        const controlDiv = document.createElement('div');
        controlDiv.className = 'control';
        if (def.type === 'select') {
            const sel = document.createElement('select');
            def.cases.forEach((c, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = c.label || c.name;
                sel.appendChild(opt);
            });
            sel.value = currentValues[name]?.index || 0;
            sel.addEventListener('change', function() {
                currentValues[name] = { index: parseInt(this.value) };
                rebuildChildren(itemDiv, name);
                updatePreview();
            });
            controlDiv.appendChild(sel);
            sel.setAttribute('data-tooltip', `选择 ${name} 的选项`);
            enableTooltip(sel);
        } else if (def.type === 'switch') {
            const group = document.createElement('div');
            group.className = 'switch-group';
            const cases = def.cases || [{name:'No'},{name:'Yes'}];
            cases.forEach((c, idx) => {
                const label2 = document.createElement('label');
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `switch_${name}`;
                radio.value = idx;
                if (currentValues[name]?.index === idx) radio.checked = true;
                radio.addEventListener('change', function() {
                    if (this.checked) {
                        currentValues[name] = { index: parseInt(this.value) };
                        rebuildChildren(itemDiv, name);
                        updatePreview();
                        const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'early';
                        renderQuickSwitches(currentTab);
                        updateRightPanelSwitches();
                    }
                });
                label2.appendChild(radio);
                label2.appendChild(document.createTextNode(c.label || c.name));
                group.appendChild(label2);
                radio.setAttribute('data-tooltip', `选择 ${name} 为 ${c.label || c.name}`);
                enableTooltip(radio);
            });
            controlDiv.appendChild(group);
        } else if (def.type === 'input') {
            const inputs = def.inputs || [{name:'value',default:''}];
            const container2 = document.createElement('div');
            container2.style.display = 'flex';
            container2.style.gap = '6px';
            container2.style.flexWrap = 'wrap';
            inputs.forEach(inp => {
                const wrapper = document.createElement('span');
                const lbl = document.createElement('label');
                lbl.textContent = (inp.label || inp.name) + ':';
                lbl.style.fontSize = '12px';
                const el = document.createElement('input');
                el.type = 'text';
                el.style.width = '70px';
                el.value = (currentValues[name]?.data?.[inp.name]) || inp.default || '';
                el.addEventListener('input', function() {
                    if (!currentValues[name]) currentValues[name] = { data: {} };
                    currentValues[name].data[inp.name] = this.value;
                    updatePreview();
                });
                wrapper.appendChild(lbl);
                wrapper.appendChild(el);
                container2.appendChild(wrapper);
                el.setAttribute('data-tooltip', `输入 ${name} 的 ${inp.label || inp.name}`);
                enableTooltip(el);
            });
            controlDiv.appendChild(container2);
        } else if (def.type === 'checkbox') {
            const group = document.createElement('div');
            group.className = 'checkbox-group';
            const cases = def.cases || [];
            const selected = currentValues[name]?.selected_cases || [];
            cases.forEach(c => {
                const label2 = document.createElement('label');
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = c.name;
                if (selected.includes(c.name)) cb.checked = true;
                cb.addEventListener('change', function() {
                    if (!currentValues[name]) currentValues[name] = { selected_cases: [] };
                    if (this.checked) {
                        if (!currentValues[name].selected_cases.includes(this.value))
                            currentValues[name].selected_cases.push(this.value);
                    } else {
                        const idx = currentValues[name].selected_cases.indexOf(this.value);
                        if (idx !== -1) currentValues[name].selected_cases.splice(idx, 1);
                    }
                    updatePreview();
                });
                label2.appendChild(cb);
                label2.appendChild(document.createTextNode(c.label || c.name));
                group.appendChild(label2);
                cb.setAttribute('data-tooltip', `勾选 ${c.label || c.name}`);
                enableTooltip(cb);
            });
            controlDiv.appendChild(group);
        }
        itemDiv.appendChild(controlDiv);
        root.appendChild(itemDiv);

        const childContainer = document.createElement('div');
        childContainer.className = 'children-container';
        root.appendChild(childContainer);
        itemDiv._childContainer = childContainer;
        itemDiv._optionName = name;
        rebuildChildren(itemDiv, name);
    });
}
function rebuildChildren(itemDiv, parentName) {
    const container = itemDiv._childContainer;
    container.innerHTML = '';
    const def = OPTION_DEFS[parentName];
    if (!def) return;
    let childNames = [];
    const val = currentValues[parentName];
    if (def.type === 'select' || def.type === 'switch') {
        const idx = val?.index ?? 0;
        const cases = def.cases || [];
        if (idx < cases.length && cases[idx].option) childNames = cases[idx].option;
    }
    if (childNames.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = '（无子选项）';
        container.appendChild(hint);
        return;
    }
    const sub = document.createElement('div');
    sub.className = 'option-tree';
    container.appendChild(sub);
    buildOptionUI(sub, childNames);
}
function getRootOptionNames() {
    const modeDef = OPTION_DEFS["无尽模式"];
    if (!modeDef || modeDef.type !== 'select') return [];
    const caseObj = modeDef.cases.find(c => c.name === '无尽通用框架');
    return caseObj ? caseObj.option || [] : [];
}
