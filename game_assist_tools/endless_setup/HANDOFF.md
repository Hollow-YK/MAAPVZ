# MAAPVZ 作业集 / 无尽挑战 —— 交接文档

> 工作区：`D:\maapvz\MAAPVZ`
> 网页端（作业集编辑器）：`game_assist_tools\endless_setup\static\`
> 运行时：`agent\jobset\*`（Python，CustomAction）

---

## 0. 一句话现状

**网页端（作业集编辑器）已可用；运行时已跑通「选卡 + 种植 + 换阵容 + 补给 + 收尾」。**

收尾链的运行时接线**已完成**（早期版本这里是缺口，现已补齐）：
收尾检测 → 收尾链 → 结算 → 收尾超时后动作。

---

## 1. 三层架构

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 网页（编辑器） | `game_assist_tools\endless_setup\static\` | 可视化配置，导出作业集 JSON |
| 数据（作业集） | `assets/resource/jobs/<code>.json` + `current.json` | 每个阵容一张表 |
| 运行时（执行） | `agent/jobset/*` + pipeline → 驱动 BatchSwipe | 解析作业集并注入管道 |

执行层**复用两个成熟动作，不重写**：

- `agent/actions/batch_swipe.py` → `BatchSwipe`（组合动作 DSL）
- `agent/select_plant/custom_select_plant.py` → `SelectPlants`（选卡）

### 网页端文件结构（已拆分）

`index.html` 原本是 7995 行的单文件，现已拆分为多文件：

```
static/
├── index.html          # 仅 head + 资源引用 + body 结构（约 289 行）
├── plants.json
├── css/
│   ├── base.css            # 手写主样式
│   └── vendor-fluent.css   # 第三方 Fluent UI 样式
└── js/
    ├── 01-options.js … 14-onload.js     # 选项树编辑器（section 1–14）
    └── 20-jobset-core.js … 29-jobset-init.js  # 作业集编辑器
```

> ⚠️ **关键**：Flask 的静态目录挂载在 **`/static/`**（`Flask(static_folder=STATIC_DIR)`），
> 不是根路径。所以 `index.html` 里的引用必须是 `/static/css/...`、`/static/js/...`；
> 写成相对路径 `css/...` 会 404。
>
> 数字前缀表示加载顺序，`<script>` 为非 module 模式，所有文件共享全局作用域。

---

## 2. 作业集运行时（`agent/jobset/`）

| 文件 | 职责 |
| --- | --- |
| `engine.py` | 载入作业集，`pick_table(level)` 选表 |
| `level_tracker.py` | 关卡计数器 + 得分期望 |
| `dsl.py` | 格子名 → BatchSwipe DSL |
| `runtime.py` | 全部 CustomAction / CustomRecognition |
| `report.py` | 打印作业集解析结果（调试） |
| `selfcheck.py` | 离线自测（无设备） |
| `check_graph.py` | 检查管道断路 / 悬挂引用 |

**CustomAction 清单（10 个）**：
`JobSetLoad` `JobSetFight` `JobSetLevel` `JobSetSlot` `JobSetInfo`
`JobSetReset` `JobSetRollback` `JobSetStage` `JobSetFightPlan` `JobSetEndRestart`

**CustomRecognition**：`JobSetStageChanged`

### 关键机制

- **每段一个节点**：链里第 i 段 → 独立节点（名字带段号），顺序严格跟链走。
- **关卡融合**：首帧采信 OCR；后续与「上次识别值 +1」比对；连续自洽则重同步；
  分数满 100 转纯计数。
- **换阵容**：`JobSetStage` 锁表 → `JobSetRollback`（count-1，分数不变）→
  调用 `通用_重开_暂停` → 跳回 `无尽挑战_识别开始战斗_清空卡牌` 重新走选卡流程。
- **三条链**：`once_chain` / `loop_chain` / `end_chain`。
  单次链为空时 fallback 到 `无尽局内_循环种植`。
- **节点覆盖**：`next` 覆盖成
  「`无尽局内_继续挑战`（固定首位）+ 中间按链顺序 + 链尾」。
- **滑动时长**：管道里连续滑动会「第二个滑不出来」，所以用 `"滑动时长": 100` 之类调参。

---

## 3. 收尾链（已接通）

### 目标 pipeline 节点

```
assets\resource\pipeline\Endless_ref.json\03_Endless_fight\03-1Endless_fight_end\03-1-01Endless_fight.json
```

包含两个**空壳节点**（`enabled: false`，由运行时按作业集注入）：

```jsonc
{
    // 收尾检测：僵尸头像出现在右上角 = 最后一波
    "无尽挑战_收尾": {
        "recognition": "TemplateMatch",
        "template": ["Endless/frame/僵尸头像.png"],
        "green_mask": true,
        "roi": [586, 15, 54, 57],
        "enabled": false,
        "action": "DoNothing",
        "pre_delay": 0,
        "post_delay": 15000,
        "next": []
    },
    // 收尾超时后动作 = 「重开」时的落点
    "无尽挑战_收尾重开": {
        "action": "Custom",
        "custom_action": "JobSetEndRestart",
        "enabled": false,
        "pre_delay": 0,
        "post_delay": 0,
        "next": []
    }
}
```

### 语义

**检测到最后一波 → 执行一次收尾链 → 等结算 → 若超时则按配置执行后续动作。**

### 运行时注入

`JobSetFight` 会把收尾链按「每段一个节点」生成（同 `_build_seg_nodes`），
链尾节点的 `next` 结构为：

```
["无尽局内_继续挑战", <收尾超时后动作>]
```

先识别「继续挑战」（结算画面）点它过关；识别不到（收尾超时）时，
落到「收尾超时后动作」：

| 配置 | 链尾 `next` 第二项 | 行为 |
| --- | --- | --- |
| `sub` + `once` | `无尽局内_单次种植` | 执行一轮单次动作 |
| `sub` + `loop` | `无尽局内_循环种植` | 继续循环种植（默认） |
| `sub` + `end` | `无尽挑战_收尾` | 重新执行收尾动作 |
| `restart` | `无尽挑战_收尾重开` | 重开当前关卡 |

> ⚠️ `无尽挑战_收尾重开` 的壳节点是 `enabled: false`，
> 运行时注入时**必须显式置 `enabled: True`**，否则节点不会执行。

### `JobSetEndRestart`（收尾超时 = 重开）

- **不增加计数器**：重开打的还是同一关，重开后重新识别天数会得到同一关 →
  计数器判「抖动」不推进，因此**不需要**显式 `rollback_one`。
- 调用 `通用_重开_暂停` 重开。
- 重开后跳回 **`无尽挑战_选取植物_开始战斗`**（直接开局，**不重新选卡**）。

---

## 4. 收尾参数（网页端「棋盘下侧」面板）

仅当**普通关棋盘上放了「收尾」形态的落子**时才显示。
**收尾仅对普通关生效 —— boss 关不能有收尾。**

| 字段 | 含义 | 默认 |
| --- | --- | --- |
| `endPostDelay` | 「收尾前等待」= `无尽挑战_收尾` 检测节点 `post_delay` | 15000 |
| `endLastPostDelay` | 「收尾超时时间」= 收尾链最后一个动作 `post_delay` | 6000 |
| `endAfterAction` | 「收尾超时后动作」= `sub` / `restart` | `sub` |
| `endSubAction` | 「子动作」= `once` / `loop` / `end` | `loop` |

### boss 关禁掉收尾（三重防护）

1. `jobSlotMode()`：boss 棋盘下 `end` 读取时归一化为 `loop`。
2. `jobToggleSlotMode()`：boss 棋盘下只在 `单次 ↔ 循环` 之间切换。
3. `jobNormalizeBossEndModes()`：**切到 boss 关 tab 时立即把残留的 `end` 改回 `loop`** 并保存。

---

## 5. 作业集 JSON 结构（当前网页导出）

```jsonc
{
  "code": "...", "name": "...", "worlds": [], "max_level": 149,
  "tables": [{
    "from_level": 1, "to_level": ...,
    "lineup": { "plants": [...], "mode": ..., "deck_no": ... },
    "slots": { "1": "粉丝心...", ... },
    // 三条链的顺序（拖动 chip 调整）
    "slotOrder": [{key, from, to, picked?, order?}],
    "loopOrder": [...], "endOrder": [...],
    "waitAfter": { "once|card2|2,1|2": 3 },
    "slotModes": { "card1": "once|loop|end", ... },
    // 收尾参数（仅普通关）
    "endPostDelay": 15000, "endLastPostDelay": 6000,
    "endAfterAction": "sub", "endSubAction": "loop",
    // boss 关同构（前缀 boss）
    "bossSlotOrder": [...], "bossLoopOrder": [...], "bossEndOrder": [...],
    "bossWaitAfter": {}, "bossSlotModes": {},
    // 补给（每个阵容独立）
    "supplyPicks": [{"id": "all", "name": "全...", "img": "..."}],
    "non_boss": {
       "once_chain": [{"key","slot","type","label",...}],
       "loop_chain": [...], "end_chain": [...],
       "sequence": [...]        // 兼容旧字段
    },
    "boss": { "once_chain": [...], "loop_chain": [...], "end_chain": [...] }
  }]
}
```

**`waitAfter` 键格式**：`{模式}|{槽位key}|{r},{c}|{seq}`
——注意是 **(r, c) 行在前列在后**（网页端 `jobPlacementKey(mode,scopeId,r,c,seq)`）。
例：`once|card2|2,1|2` = 单次链 / 槽2 / 行2列1 = **格子2_3**。

**`slotOrder` 段格式**：`{key, from, to, picked?, order?}`

- `from:0, to:null` = 该槽全部落点（按 seq）
- `picked:[0,2]` = 指定下标（不连续时用）
- `order:[2,0,1]` = **块内自定义顺序**（拖动 chip 后写入）

---

## 6. 验证方法

```powershell
cd D:\maapvz\MAAPVZ
.venv\Scripts\python.exe check_resource.py assets/resource     # pipeline 校验
.venv\Scripts\python.exe agent\jobset\selfcheck.py             # 引擎离线自测
.venv\Scripts\python.exe agent\jobset\check_graph.py           # 断路检查
.venv\Scripts\python.exe agent\jobset\report.py                # 打印作业集解析
```

**网页端验证**：改完 JS 后对每个文件跑 `node --check`；
启动服务后确认所有 `/static/...` 资源返回 200。

---

## 7. 环境

- Python：`.venv`（3.12，**无 flask**）；Flask 工具用 `D:\ana\python.exe`（flask 1.1.1）
- 启动网页：双击 `pvz.bat`（会自动挑带 flask 的解释器），端口 **5000**
- 无头浏览器：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- 补给图片素材：`game_assist_tools\endless_setup\static\supply\`

---

## 8. 🚨 交接给下一个 AI 的硬性要求

1. **写完后必须删除所有测试脚本。**
   本项目约定：临时脚本用 `_` 或 `zz` 前缀，用完立刻删。
   收工前跑一次：

   ```powershell
   Get-ChildItem -File | Where-Object { $_.Name -like "zz*" -or $_.Name -like "_*" }
   Get-ChildItem game_assist_tools\endless_setup\static -File |
       Where-Object { $_.Name -like "zz*" -or $_.Name -like "_*" }
   ```

   两个都应为空。

2. **不要动 `tools\` 目录**（`tools\AGENTS.md` 明令禁止，那是构建产物）。

3. 改 pipeline 后跑 `check_resource.py`；改 Python 后跑 `selfcheck.py`。

---

## 9. 已知问题 / 注意

- **浏览器缓存**：改完网页端必须 `Ctrl+F5` 强刷（不用重启 Flask）。
- **Python 改动**：需**完全重启 MAA/Agent 进程**（模块只在启动时 import 一次）。
- **Pipeline JSON 改动**：重启 MAA 或重载资源。
- **`_apply_supply` 不覆盖 `无尽局内_补给` 的 `enabled`** —— 用户明确要求 custom 不抢这个字段。
- `check_graph.py` 会报 **3 个「空 next」**，均为**有意保留的空壳节点**，
  且都是 `enabled: false`，属正常：
  - `01_Endless_plant_ref.json 无尽挑战_检查是否需要选植物`
  - `01_Endless_plant_ref.json 无尽挑战_选植物`
  - `Endless_html_ref.json 无尽挑战_编辑作业集`
- `selfcheck.py` 有 1 个**预存在**的 FAIL（`载入成功`，断言里硬编码了旧作业集 code），
  与代码改动无关。

---

## 10. 最近验证结果（全绿基线）

```
check_resource.py assets/resource  →  All directories checked
check_graph.py                     →  仅 3 个预存在空壳告警，无悬挂引用
网页端资源                          →  26 个 /static/ 资源全部 200
JS 语法                            →  24 个拆分文件 node --check 全通过
HTML 拆分完整性                     →  body / css / js 与原单文件逐字符一致
```
