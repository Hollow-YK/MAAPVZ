// ============================================================
// 1. OPTION_DEFS（完整定义）
// ============================================================
if (typeof OPTION_DEFS === 'undefined') {
    window.OPTION_DEFS = {
        "无尽模式": {
            type: "select",
            cases: [
                { name: "预设模式", option: ["当期无尽模式"] },
                { name: "无尽通用框架", option: [
                    "当期无尽模式", "无尽全自动循环", "小关是否喂豆", "是否抛花",
                    "fw_boss关是否需要喂豆", "是否需要补植物",
                    "小关是否加速", "fw_boss关是否加速", "fw_boss_补给智能选取",
                    "fw_boss_是否开相机神器", "刷掉僵尸", "是否魔甘收尾(牢玩家专属)",
                    "自定义布阵"
                ] }
            ]
        },
        "自定义布阵": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "frame_wj_custom_回到后期",
                    "frame_wj_custom_是否种守卫菇",
                    "frame_wj_custom_布完阵是否喂豆",
                    "frame_wj_custom_boss关是否喂豆",
                    "frame_wj_custom_是否使用铲子1",
                    "frame_wj_custom_是否使用铲子2",
                    "卡1种植", "卡2种植", "卡3种植", "卡4种植", "卡5种植",
                    "卡6种植", "卡7种植", "卡8种植",
                    "frame_wj_custom_球果切换形态"
                ] }
            ]
        },
        "是否需要补植物": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "frame_卡槽2_补植物", "frame_卡槽3_补植物", "frame_卡槽4_补植物",
                    "frame_卡槽5_补植物", "frame_卡槽6_补植物", "frame_卡槽7_补植物",
                    "frame_卡槽8_补植物",
                    "铲除植物",
                    "frame_球果切换形态"
                ] }
            ]
        },
        "铲除植物": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "铲除植物1", "铲除植物2", "铲除植物3", "铲除植物4", "铲除植物5"
                ] }
            ]
        },
        "是否抛花": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "小关是否抛花", "boss关是否抛花", "识别能量花卡槽位置"
                ] }
            ]
        },
        "小关是否抛花": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: ["1花位置", "2花位置"] }
            ]
        },
        "boss关是否抛花": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "boss关_1花位置", "boss关_2花位置", "boss关_3花位置", "boss关_4花位置"
                ] }
            ]
        },
        "1花位置": { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"1"}] },
        "2花位置": { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"2"}] },
        "boss关_1花位置": { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"2"}] },
        "boss关_2花位置": { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"3"}] },
        "boss关_3花位置": { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"4"}] },
        "boss关_4花位置": { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"5"}] },
        "识别能量花卡槽位置": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "识别魔甘卡槽位置": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "识别三叶草卡槽位置": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },

        "小关是否喂豆": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "是否开局喂豆球果", "小关喂豆位置", "小关喂豆间隔"
                ] }
            ]
        },
        "fw_boss关是否需要喂豆": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "fw_boss关喂豆位置", "fw_boss关喂豆间隔",
                    "fw_boss关额外喂豆位置"
                ] }
            ]
        },
        "frame_wj_custom_是否种守卫菇": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "frame_wj_custom_种守卫菇位置1", "frame_wj_custom_种守卫菇位置2",
                    "frame_wj_custom_种守卫菇位置3", "frame_wj_custom_种守卫菇位置4",
                    "frame_wj_custom_种守卫菇位置5"
                ] }
            ]
        },
        "frame_wj_custom_是否使用铲子1": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "frame_wj_custom_使用铲子1", "frame_wj_custom_使用铲子2",
                    "frame_wj_custom_使用铲子3", "frame_wj_custom_使用铲子4",
                    "frame_wj_custom_使用铲子5"
                ] }
            ]
        },
        "frame_wj_custom_是否使用铲子2": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "frame_wj_custom_使用铲子6", "frame_wj_custom_使用铲子7",
                    "frame_wj_custom_使用铲子8", "frame_wj_custom_使用铲子9",
                    "frame_wj_custom_使用铲子10"
                ] }
            ]
        },
        "是否魔甘收尾(牢玩家专属)": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "多少秒后种魔甘", "使用三叶草", "魔甘高级选项"
                ] }
            ]
        },
        "魔甘高级选项": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [
                    "识别魔甘卡槽位置", "魔甘前使用能量豆",
                    "甜薯1种植位置", "甜薯2种植位置",
                    "飓风甘蓝1种植位置", "飓风甘蓝2种植位置",
                    "魔甘失败后是否重开"
                ] }
            ]
        },
        "魔甘前使用能量豆": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: ["魔甘前喂豆位置"] }
            ]
        },
        "使用三叶草": {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: ["识别三叶草卡槽位置"] }
            ]
        },
        "小关是否加速": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "fw_boss关是否加速": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "fw_boss_补给智能选取": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "fw_boss_是否开相机神器": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "刷掉僵尸": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "无尽全自动循环": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "frame_wj_custom_回到后期": { type: "input", inputs: [{name:"关卡",default:""}] },
        "frame_wj_custom_布完阵是否喂豆": { type: "switch", cases: [{name:"No"},{name:"Yes"}] },
        "frame_wj_custom_boss关是否喂豆": { type: "switch", cases: [{name:"No"},{name:"Yes"}] }
    };

    // 动态生成卡槽种植子选项
    for (let s=1; s<=8; s++) {
        const prefix = `卡${s}`;
        const maxTimes = (s === 1 || s === 2) ? 25 : 10; // 卡1、卡2支持25次
        OPTION_DEFS[`${prefix}种植`] = {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: Array.from({length:maxTimes}, (_,i) => `${prefix}种第${i+1}次`) }
            ]
        };
        for (let i=1; i<=maxTimes; i++) {
            const name = `${prefix}种第${i}次`;
            OPTION_DEFS[name] = {
                type: "switch",
                cases: [
                    { name: "No" },
                    { name: "Yes", option: [`${name}坐标`] }
                ]
            };
            OPTION_DEFS[`${name}坐标`] = {
                type: "input",
                inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
            };
        }
    }

    // 补植物：父节点带 frame_ 前缀，子节点 2~6 无前缀，7~8 带 frame_ 前缀
    for (let slot=2; slot<=8; slot++) {
        const switchName = `frame_卡槽${slot}_补植物`;
        const childPrefix = (slot >= 7) ? `frame_卡槽${slot}_` : `卡槽${slot}_`;
        const maxPos = (slot === 2 || slot === 3) ? 15 : 5; // 卡槽2、3支持15次
        const optionArray = [];
        for (let pos=1; pos<=maxPos; pos++) {
            optionArray.push(`${childPrefix}${pos}`);
        }
        OPTION_DEFS[switchName] = {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: optionArray }
            ]
        };
        for (let pos=1; pos<=maxPos; pos++) {
            const name = `${childPrefix}${pos}`;
            OPTION_DEFS[name] = {
                type: "switch",
                cases: [
                    { name: "No" },
                    { name: "Yes", option: [`${name}坐标`] }
                ]
            };
            OPTION_DEFS[`${name}坐标`] = {
                type: "input",
                inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
            };
        }
    }

    // 铲除植物子选项
    for (let i=1; i<=5; i++) {
        const name = `铲除植物${i}`;
        OPTION_DEFS[name] = {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [`${name}坐标`] }
            ]
        };
        OPTION_DEFS[`${name}坐标`] = {
            type: "input",
            inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
        };
    }

    // 守卫菇位置子选项
    for (let i=1; i<=5; i++) {
        const name = `frame_wj_custom_种守卫菇位置${i}`;
        OPTION_DEFS[name] = {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [`${name}坐标`] }
            ]
        };
        OPTION_DEFS[`${name}坐标`] = {
            type: "input",
            inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
        };
    }

    // 铲子子选项
    for (let i=1; i<=10; i++) {
        const name = `frame_wj_custom_使用铲子${i}`;
        OPTION_DEFS[name] = {
            type: "switch",
            cases: [
                { name: "No" },
                { name: "Yes", option: [`${name}坐标`] }
            ]
        };
        OPTION_DEFS[`${name}坐标`] = {
            type: "input",
            inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
        };
    }

    OPTION_DEFS['frame_wj_custom_喂豆位置'] = {
        type: "switch",
        cases: [
            { name: "No" },
            { name: "Yes", option: ['frame_wj_custom_喂豆位置坐标'] }
        ]
    };
    OPTION_DEFS['frame_wj_custom_喂豆位置坐标'] = {
        type: "input",
        inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
    };
    OPTION_DEFS['frame_wj_boss_custom_喂豆位置'] = {
        type: "switch",
        cases: [
            { name: "No" },
            { name: "Yes", option: ['frame_wj_boss_custom_喂豆位置坐标'] }
        ]
    };
    OPTION_DEFS['frame_wj_boss_custom_喂豆位置坐标'] = {
        type: "input",
        inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
    };

    // 魔甘相关
    OPTION_DEFS['甜薯1种植位置'] = { type: "input", inputs: [{name:"列",default:"8"},{name:"行",default:"2"}] };
    OPTION_DEFS['甜薯2种植位置'] = { type: "input", inputs: [{name:"列",default:"8"},{name:"行",default:"4"}] };
    OPTION_DEFS['飓风甘蓝1种植位置'] = { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"2"}] };
    OPTION_DEFS['飓风甘蓝2种植位置'] = { type: "input", inputs: [{name:"列",default:"7"},{name:"行",default:"4"}] };
    OPTION_DEFS['魔甘前喂豆位置'] = { type: "input", inputs: [{name:"列",default:"3"},{name:"行",default:"3"}] };
    OPTION_DEFS['多少秒后种魔甘'] = { type: "input", inputs: [{name:"秒",default:"15"}] };
    OPTION_DEFS['魔甘失败后是否重开'] = { type: "switch", cases: [{name:"Yes"},{name:"No"}] };

    // 喂豆相关
    OPTION_DEFS['小关喂豆位置'] = { type: "input", inputs: [{name:"列",default:"5"},{name:"行",default:"3"}] };
    OPTION_DEFS['fw_boss关喂豆位置'] = { type: "input", inputs: [{name:"列",default:"5"},{name:"行",default:"3"}] };
    OPTION_DEFS['fw_boss关喂豆间隔'] = { type: "input", inputs: [{ name: "秒", default: "4" }] };
        OPTION_DEFS['fw_boss关额外喂豆位置'] = {
        type: 'switch',
        cases: [
            { name: 'No' },
            { name: 'Yes', option: ['fw_boss关喂豆2间隔', 'fw_boss关喂豆2位置'] }
        ]
    };
    OPTION_DEFS['fw_boss关喂豆2间隔'] = {
        type: 'input',
        inputs: [{ name: '毫秒', default: '4000' }]
    };
    OPTION_DEFS['fw_boss关喂豆2位置'] = {
        type: 'input',
        inputs: [{ name: '列', default: '5' }, { name: '行', default: '3' }]
    };
    OPTION_DEFS['是否开局喂豆球果'] = {
        type: "switch",
        cases: [
            { name: "No" },
            { name: "Yes", option: ["喂豆球果"] }
        ]
    };
    OPTION_DEFS['小关喂豆间隔'] = {
    type: 'input',
    inputs: [{ name: 'seconds', default: '4' }]
};
    OPTION_DEFS['喂豆球果'] = {
        type: "input",
        inputs: [{ name: "列", default: "1" }, { name: "行", default: "1" }]
    };

    // 其他
    OPTION_DEFS['当期无尽模式'] = {
        type: "select",
        cases: [{ name: "神秘埃及", option: ["植物配置"] }]
    };
    OPTION_DEFS['植物配置'] = {
        type: "select",
        cases: [{ name: "原大桑葚", option: [
            "原大_小关是否抛花", "原大_boss关是否需要喂豆", "原大_是否需要补植物"
        ] }]
    };
    OPTION_DEFS['原大_小关是否抛花'] = { type: "switch", cases: [{name:"No"},{name:"Yes"}] };
    OPTION_DEFS['原大_boss关是否需要喂豆'] = { type: "switch", cases: [{name:"No"},{name:"Yes"}] };
    OPTION_DEFS['原大_是否需要补植物'] = { type: "switch", cases: [{name:"No"},{name:"Yes"}] };
    OPTION_DEFS['刷新僵尸的类别'] = { type: "checkbox", cases: [{name:"霹雳舞僵尸"}] };

        // ===== 球果相关定义 =====
    OPTION_DEFS['frame_wj_custom_球果切换形态'] = {
        type: 'switch',
        cases: [
            { name: 'No' },
            { name: 'Yes', option: ['frame_wj_custom_球果位置'] }
        ]
    };
    OPTION_DEFS['frame_wj_custom_球果位置'] = {
        type: 'select',
        cases: [
            { name: '恐龙形态' },
            { name: '幽灵马形态' },
            { name: '水母形态' }
        ]
    };
    OPTION_DEFS['frame_球果切换形态'] = {
        type: 'switch',
        cases: [
            { name: 'No' },
            { name: 'Yes', option: ['frame_球果位置'] }
        ]
    };
    OPTION_DEFS['frame_球果位置'] = {
        type: 'select',
        cases: [
            { name: '恐龙形态' },
            { name: '幽灵马形态' },
            { name: '水母形态' }
        ]
    };

    // ===== 补充缺失的自定义布阵相关定义 =====
// 1. 编队切换开关及输入
OPTION_DEFS['frame_wj_custom_前期使用编队'] = {
    type: 'switch',
    cases: [
        { name: 'No' },
        { name: 'Yes', option: ['frame_wj_custom_前期切换到第几编队'] }
    ]
};
OPTION_DEFS['frame_wj_custom_前期切换到第几编队'] = {
    type: 'input',
    inputs: [{ name: '编队', default: '' }]
};
OPTION_DEFS['frame_wj_custom_回到后期切换编队'] = {
    type: 'switch',
    cases: [
        { name: 'No' },
        { name: 'Yes', option: ['frame_wj_custom_切换到第几编队'] }
    ]
};
OPTION_DEFS['frame_wj_custom_切换到第几编队'] = {
    type: 'input',
    inputs: [{ name: '编队', default: '' }]
};

// 2. Boss 关喂豆间隔（自定义布阵下）
OPTION_DEFS['frame_wj_boss_custom_喂豆间隔'] = {
    type: 'input',
    inputs: [{ name: '秒数', default: '3' }]
};

// 3. 将上述子项添加到父级 Yes 分支的 option 数组中（确保层级正确）
// 修正 自定义布阵 的 Yes 分支
if (OPTION_DEFS['自定义布阵']) {
    const cases = OPTION_DEFS['自定义布阵'].cases;
    for (let c of cases) {
        if (c.name === 'Yes') {
            if (!c.option) c.option = [];
            // 添加缺失的编队开关（如果不存在）
            ['frame_wj_custom_前期使用编队', 'frame_wj_custom_回到后期切换编队'].forEach(item => {
                if (!c.option.includes(item)) c.option.push(item);
            });
            break;
        }
    }
}
// 修正 frame_wj_custom_boss关是否喂豆 的 Yes 分支
if (OPTION_DEFS['frame_wj_custom_boss关是否喂豆']) {
    const cases = OPTION_DEFS['frame_wj_custom_boss关是否喂豆'].cases;
    for (let c of cases) {
        if (c.name === 'Yes') {
            if (!c.option) c.option = [];
            if (!c.option.includes('frame_wj_boss_custom_喂豆间隔')) {
                c.option.push('frame_wj_boss_custom_喂豆间隔');
            }
            break;
        }
    }
}
}
