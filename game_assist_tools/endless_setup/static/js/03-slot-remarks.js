
// ============================================================
// 3. 卡槽备注
// ============================================================
let slotRemarksEarly = Array(8).fill('');
let slotRemarksLate = Array(7).fill(''); // 补卡2~补卡8
function renderSlotRemarks() {
    const container = document.getElementById('slotRemarks');
    if (!container) return;   // 卡槽备注面板已移除
    container.innerHTML = '';

    const currentTab = document.querySelector('.tab.active')?.dataset.tab;

    if (currentTab === 'early') {
        // 前期卡槽备注
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:600; font-size:12px; margin-top:6px; margin-bottom:4px;';
        title.textContent = '前期卡槽';
        container.appendChild(title);

        for (let i=0; i<8; i++) {
            const div = document.createElement('div');
            div.className = 'slot-remark';
            const num = document.createElement('span');
            num.className = 'num';
            num.textContent = `卡${i+1}`;
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = '备注';
            inp.value = slotRemarksEarly[i] || '';
            inp.setAttribute('data-tooltip', `为前期卡槽${i+1}添加备注`);
            inp.addEventListener('input', function() {
                slotRemarksEarly[i] = this.value.trim();
                updatePreview();
            });
            div.appendChild(num);
            div.appendChild(inp);
            container.appendChild(div);
            enableTooltip(inp);
        }
    } else if (currentTab === 'late') {
        // 后期补卡备注
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:600; font-size:12px; margin-top:6px; margin-bottom:4px;';
        title.textContent = '后期补卡';
        container.appendChild(title);

        for (let i=0; i<7; i++) {
            const slot = i + 2;
            const div = document.createElement('div');
            div.className = 'slot-remark';
            const num = document.createElement('span');
            num.className = 'num';
            num.textContent = `补卡${slot}`;
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = '备注';
            inp.value = slotRemarksLate[i] || '';
            inp.setAttribute('data-tooltip', `为后期补卡${slot}添加备注`);
            inp.addEventListener('input', function() {
                slotRemarksLate[i] = this.value.trim();
                updatePreview();
            });
            div.appendChild(num);
            div.appendChild(inp);
            container.appendChild(div);
            enableTooltip(inp);
        }
    }
}
