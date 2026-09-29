
// ============================================================
// 11. 导入 JSON 相关
// ============================================================
function importFromJSONText(jsonText) {
    let data;
    try {
        data = JSON.parse(jsonText);
    } catch (e) {
        alert('JSON 解析失败，请检查文件内容');
        return;
    }

    // 清空撤销重做栈
    undoStack = [];
    redoStack = [];

    // 重置 currentValues 为默认
    initDefaultValues();

    // 填充基本字段（旧输入框已移除 → 空值保护）
    const _setv = function (id, v) {
        const el = document.getElementById(id);
        if (el) el.value = v;
    };
    _setv('configName', data.InstanceName || '');
    _setv('controllerName', data.CurrentControllerName || '');
    _setv('taskEntry', (data.TaskItems && data.TaskItems[0] && data.TaskItems[0].entry) || '');

    // 查找无尽模式的 option 树：遍历 TaskItems，找到包含 '无尽模式' 选项的任务项
    let optionTree = null;
    if (Array.isArray(data.TaskItems)) {
        for (const task of data.TaskItems) {
            if (task && Array.isArray(task.option)) {
                const found = task.option.find(opt => opt && opt.name === '无尽模式');
                if (found) {
                    optionTree = found;
                    break;
                }
            }
        }
    }
    if (optionTree) {
        function fillValues(node) {
            if (!node || !node.name) return;
            const name = node.name;
            const def = OPTION_DEFS[name];
            if (!def) return;

            if (def.type === 'select' || def.type === 'switch') {
                let idx = node.index !== undefined ? node.index : 0;
                // 识别类开关需要反转索引（因为导出时反转了）
                const isRecog = name === '识别能量花卡槽位置' || name === '识别魔甘卡槽位置' || name === '识别三叶草卡槽位置' || name === '是否开局喂豆球果';
                if (isRecog) {
                    idx = idx === 1 ? 0 : 1;
                }
                currentValues[name] = { index: idx };
            } else if (def.type === 'input') {
                currentValues[name] = { data: node.data || {} };
            } else if (def.type === 'checkbox') {
                currentValues[name] = { selected_cases: node.selected_cases || [] };
            }

            if (node.sub_options) {
                node.sub_options.forEach(child => fillValues(child));
            }
        }
        fillValues(optionTree);
    }

    // 重置棋盘尺寸为默认 9×5，防止之前调整导致坐标映射错误
    cols = 9;
    rows = 5;
    const _cn = document.getElementById('colN'); if (_cn) _cn.value = cols;
    const _rn = document.getElementById('rowN'); if (_rn) _rn.value = rows;

    // 清空棋盘并重建
    initBoards();
    rebuildBoardsFromValues();

    // 更新所有 UI
    renderSlotRemarks();
    renderAllBoards();
    const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'early';
    renderQuickSwitches(currentTab);
    renderRightPanelSwitches();
    const container = document.getElementById('optionTree');
    container.innerHTML = '';
    buildOptionUI(container, getRootOptionNames());
    updatePreview();
    setStatus('📂 导入成功');
    console.log('导入后的前期棋盘 boardEarly:', JSON.parse(JSON.stringify(boardEarly)));
    console.log('导入后的后期棋盘 boardLate:', JSON.parse(JSON.stringify(boardLate)));
}

function rebuildBoardsFromValues() {
    // 辅助：放置操作到指定棋盘（不使用 placeOp，避免触发撤销记录）
    function placeImportedOp(board, opId, col, row, slotPos) {
        const opItem = ALL_OPS.find(o => o.id === opId);
        if (!opItem) return;
        const itemData = { id: opId, label: opItem.label, type: opItem.type, col, row, opData: opItem };
        if (!opItem.single && slotPos) {
            itemData.slotPos = slotPos;
            itemData.label = `${opItem.label}-${slotPos}`;
        }
        const r = row - 1, c = col - 1;
        if (board === boardEarly && boardEarly[r] && boardEarly[r][c]) {
            boardEarly[r][c].push(itemData);
        } else if (board === boardLate && boardLate[r] && boardLate[r][c]) {
            boardLate[r][c].push(itemData);
        }
    }

    // 卡槽种植（前期）
    for (let s = 1; s <= 8; s++) {
        const prefix = `卡${s}`;
        const maxTimes = (s === 1 || s === 2) ? 25 : 10;
        if (currentValues[`${prefix}种植`]?.index === 1) {
            for (let i = 1; i <= maxTimes; i++) {
                // 只导入真正开启的种植次数
                if (currentValues[`${prefix}种第${i}次`]?.index !== 1) continue;
                const coord = currentValues[`${prefix}种第${i}次坐标`]?.data;
                if (coord && coord['列'] && coord['行']) {
                    const col = parseInt(coord['列']);
                    const row = parseInt(coord['行']);
                    if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                        placeImportedOp(boardEarly, `card${s}`, col, row, i);
                    }
                }
            }
        }
    }

    // 守卫菇（前期）
    if (currentValues['frame_wj_custom_是否种守卫菇']?.index === 1) {
        for (let i = 1; i <= 5; i++) {
            const coord = currentValues[`frame_wj_custom_种守卫菇位置${i}坐标`]?.data;
            if (coord && coord['列'] && coord['行']) {
                const col = parseInt(coord['列']);
                const row = parseInt(coord['行']);
                if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                    placeImportedOp(boardEarly, 'guard', col, row, i);
                }
            }
        }
    }

    // 铲子前5个（前期）
    if (currentValues['frame_wj_custom_是否使用铲子1']?.index === 1) {
        for (let i = 1; i <= 5; i++) {
            const coord = currentValues[`frame_wj_custom_使用铲子${i}坐标`]?.data;
            if (coord && coord['列'] && coord['行']) {
                const col = parseInt(coord['列']);
                const row = parseInt(coord['行']);
                if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                    placeImportedOp(boardEarly, 'shovel_before', col, row, i);
                }
            }
        }
    }

    // 铲子后5个（前期）
    if (currentValues['frame_wj_custom_是否使用铲子2']?.index === 1) {
        for (let i = 6; i <= 10; i++) {
            const coord = currentValues[`frame_wj_custom_使用铲子${i}坐标`]?.data;
            if (coord && coord['列'] && coord['行']) {
                const col = parseInt(coord['列']);
                const row = parseInt(coord['行']);
                if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                    const slotPos = i - 5; // 转换为 1~5
                    placeImportedOp(boardEarly, 'shovel_after', col, row, slotPos);
                }
            }
        }
    }

    // 补植物（后期）
    if (currentValues['是否需要补植物']?.index === 1) {
        for (let slot = 2; slot <= 8; slot++) {
            const switchName = `frame_卡槽${slot}_补植物`;
            if (currentValues[switchName]?.index === 1) {
                const childPrefix = (slot >= 7) ? `frame_卡槽${slot}_` : `卡槽${slot}_`;
                const maxPos = (slot === 2 || slot === 3) ? 15 : 5;
                for (let pos = 1; pos <= maxPos; pos++) {
                    const name = `${childPrefix}${pos}`;
                    // 只导入真正开启的补植物位置
                    if (currentValues[name]?.index !== 1) continue;
                    const coord = currentValues[`${name}坐标`]?.data;
                    if (coord && coord['列'] && coord['行']) {
                        const col = parseInt(coord['列']);
                        const row = parseInt(coord['行']);
                        if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                            placeImportedOp(boardLate, `patch_slot${slot}`, col, row, pos);
                        }
                    }
                }
            }
        }
    }

    // 铲除植物（后期）
    if (currentValues['铲除植物']?.index === 1) {
        for (let i = 1; i <= 5; i++) {
            const coord = currentValues[`铲除植物${i}坐标`]?.data;
            if (coord && coord['列'] && coord['行']) {
                const col = parseInt(coord['列']);
                const row = parseInt(coord['行']);
                if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                    placeImportedOp(boardLate, 'shovel_late', col, row, i);
                }
            }
        }
    }

    // 后期小关喂豆
    if (currentValues['小关是否喂豆']?.index === 1) {
        const coord = currentValues['小关喂豆位置']?.data;
        if (coord && coord['列'] && coord['行']) {
            const col = parseInt(coord['列']);
            const row = parseInt(coord['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardLate, 'feed_late', col, row, null);
            }
        }
    }

    // 后期 Boss 喂豆
    if (currentValues['fw_boss关是否需要喂豆']?.index === 1) {
        const coord = currentValues['fw_boss关喂豆位置']?.data;
        if (coord && coord['列'] && coord['行']) {
            const col = parseInt(coord['列']);
            const row = parseInt(coord['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardLate, 'bossfeed_late', col, row, null);
            }
        }
    }

    // 后期 Boss 喂豆2
    if (currentValues['fw_boss关额外喂豆位置']?.index === 1) {
        const coord = currentValues['fw_boss关喂豆2位置']?.data;
        if (coord && coord['列'] && coord['行']) {
            const col = parseInt(coord['列']);
            const row = parseInt(coord['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardLate, 'bossfeed2_late', col, row, null);
            }
        }
    }

    // 前期小关喂豆（自定义布阵）
    if (currentValues['frame_wj_custom_布完阵是否喂豆']?.index === 1) {
        const coord = currentValues['frame_wj_custom_喂豆位置坐标']?.data;
        if (coord && coord['列'] && coord['行']) {
            const col = parseInt(coord['列']);
            const row = parseInt(coord['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardEarly, 'feed', col, row, null);
            }
        }
    }

    // 前期 Boss 喂豆
    if (currentValues['frame_wj_custom_boss关是否喂豆']?.index === 1) {
        const coord = currentValues['frame_wj_boss_custom_喂豆位置坐标']?.data;
        if (coord && coord['列'] && coord['行']) {
            const col = parseInt(coord['列']);
            const row = parseInt(coord['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardEarly, 'bossfeed', col, row, null);
            }
        }
    }

    // 喂豆球果
    if (currentValues['是否开局喂豆球果']?.index === 1) {
        const coord = currentValues['喂豆球果']?.data;
        if (coord && coord['列'] && coord['行']) {
            const col = parseInt(coord['列']);
            const row = parseInt(coord['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardLate, 'feed_ball_late', col, row, null);
            }
        }
    }

    // 小关抛花
    if (currentValues['小关是否抛花']?.index === 1) {
        const coord1 = currentValues['1花位置']?.data;
        if (coord1 && coord1['列'] && coord1['行']) {
            const col = parseInt(coord1['列']);
            const row = parseInt(coord1['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardLate, 'flower', col, row, 1);
            }
        }
        const coord2 = currentValues['2花位置']?.data;
        if (coord2 && coord2['列'] && coord2['行']) {
            const col = parseInt(coord2['列']);
            const row = parseInt(coord2['行']);
            if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                placeImportedOp(boardLate, 'flower', col, row, 2);
            }
        }
    }

    // Boss 抛花
    if (currentValues['boss关是否抛花']?.index === 1) {
        for (let i = 1; i <= 4; i++) {
            const coord = currentValues[`boss关_${i}花位置`]?.data;
            if (coord && coord['列'] && coord['行']) {
                const col = parseInt(coord['列']);
                const row = parseInt(coord['行']);
                if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                    placeImportedOp(boardLate, 'bossflower', col, row, i);
                }
            }
        }
    }

    // 魔甘
    if (currentValues['是否魔甘收尾(牢玩家专属)']?.index === 1) {
        const mappings = [
            { opId: 'sweet1', optName: '甜薯1种植位置' },
            { opId: 'sweet2', optName: '甜薯2种植位置' },
            { opId: 'ganlan1', optName: '飓风甘蓝1种植位置' },
            { opId: 'ganlan2', optName: '飓风甘蓝2种植位置' },
            { opId: 'magicfeed', optName: '魔甘前喂豆位置' }
        ];
        mappings.forEach(map => {
            const coord = currentValues[map.optName]?.data;
            if (coord && coord['列'] && coord['行']) {
                const col = parseInt(coord['列']);
                const row = parseInt(coord['行']);
                if (col >= 1 && col <= cols && row >= 1 && row <= rows) {
                    placeImportedOp(boardLate, map.opId, col, row, null);
                }
            }
        });
    }
}
