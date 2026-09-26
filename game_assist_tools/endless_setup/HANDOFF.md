# MAAPVZ 作业集 / 无尽挑战重构 —— 交接文档

> 更新：2026-09-27
> 工作区：`D:\maapvz\MAAPVZ`（分支 `ref_Endless`）
> 编辑器：`game_assist_tools\endless_setup\static\index.html`（单文件 HTML+CSS+JS）
> 运行时：`agent\jobset\*`（Python，CustomAction）

---

## 0. 一句话现状

**网页端（作业集编辑器）已可用；运行时已能跑通「选卡 + 种植 + 换阵容 + 补给」。**

**⚠️ 唯一的缺口：收尾链只在网页端做好了，运行时完全没接。** 详见第 3 节。

---

## 1. 三层架构

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 编辑层 | `static/index.html` | 作者配槽位/棋盘/三条链/补给 → 存 JSON |
| 数据层 | `assets/resource/jobs/<code>.json` + `current.json` | 每个阵容一张表 |
| 执行层 | `agent/jobset/*` | 读作业集 → 注入 pipeline → 驱动 BatchSwipe |

执行层复用两个成熟动作，**不重写**：

- `agent/actions/batch_swipe.py` → `BatchSwipe`（组合动作 DSL）
- `agent/select_plant/custom_select_plant.py` → `SelectPlants`（选卡）

---

## 2. 已完成

### 2.1 网页端

- **三条链**：单次链 `slotOrder` / 循环链 `loopOrder` / **收尾链 `endOrder`**
  - 顶部有「显示：☑单次 ☑循环 ☑收尾」过滤下拉，默认全勾
  - 收尾链配色绿色，序号红色，图标 🚩
- **槽位形态三态**：右键切 `once → loop → end`（`slotModes`）
- **块内 chip 拖拽重排**：段内 `order` 数组记录自定义先后
- **右键取消格内项目**：1 项直接清；多项弹窗**多选**确认
- **补给选取弹窗**：堆叠卡片（悬停抽牌）+ 图库；「查看」固定在右侧独立区，**不参与排序**
- **boss / 普通关配置完全分离**：普通关用 `slotOrder/loopOrder/endOrder/waitAfter/slotModes`，
  boss 关用 `boss*` 前缀的同名四件套（+`bossEndOrder`）。**除槽位植物外全部独立**。
- **导出**：`once_chain` / `loop_chain` / `end_chain`（boss 段同名字段），
  以及 `waitAfter` / `bossWaitAfter` / `supplyPicks`

### 2.2 运行时（`agent/jobset/`）

| 文件 | 作用 |
| --- | --- |
| `engine.py` | 载入作业集、`pick_table(level)` 选表 |
| `level_tracker.py` | 关卡计数器 + 得分期望 |
| `dsl.py` | 格子名 → BatchSwipe DSL |
| `runtime.py` | 9 个 CustomAction + 1 识别 |
| `report.py` | 打印作业集解析结果（核对用） |
| `selfcheck.py` | 离线自测（无设备） |
| `check_graph.py` | 检查管道断路/悬挂引用 |

**CustomAction 清单**：`JobSetLoad` `JobSetFight` `JobSetLevel` `JobSetSlot`
`JobSetInfo` `JobSetReset` `JobSetRollback` `JobSetStage` `JobSetFightPlan`
`JobSetStageChanged`(识别)

**关键机制**：

- **每段一个节点**：链里第 i 段 → 独立节点（名字带段号），顺序严格跟链走
- **关卡融合**：首帧采信 OCR；后续与「上次识别值+1」比对；连续自洽则重同步；分数满 100 转纯计数
- **换阵容**：`JobSetStage` 锁表 → `JobSetRollback`(count-1，分数不变) → `通用_重开_暂停` → 跳回 `无尽挑战_识别开始战斗_清空卡牌`
- **补给**：`JobSetFight._apply_supply()` 覆盖「无尽局内_补给」的 next
  （`查看`固定首位 + 中间按 `supplyPicks` 顺序 + `兜底`固定末位）
  **⚠️ 不碰该节点的 `enabled`**（用户明确要求）
- **滑动时长**：pipe 里传 `"滑动时长": 100`（80ms 时连续滑动会「第二个滑不出来」）

---

## 3. ⚠️ 收尾链：网页端有，运行时【未集成】

### 现状

- 网页端**能配、能显示、能导出** `end_chain` / `bossEndOrder`
- 运行时 `runtime.py` **完全没有消费 `endOrder` / `end_chain`** —— 它是空的
- 也就是说：**用户在网页配了收尾链，跑起来不会有任何效果**

### 目标节点

```
assets\resource\pipeline\Endless_ref.json\03_Endless_fight\03-1Endless_fight_end\03-1-01Endless_fight.json
```

当前内容（空壳识别节点）：

```jsonc
{
    "无尽挑战_收尾": {
        "recognition": "TemplateMatch",
        "template": ["Endless/frame/僵尸头像.png"],
        "green_mask": true,
        "roi": [586, 15, 54, 57],
        "action": "DoNothing",
        "pre_delay": 0,
        "post_delay": 15000,
        "next": []
    }
}
```

### 语义

**检测到最后一波 → 执行一次收尾链 → 等待结算**（不再回到循环链）。

### 需要做的

1. `JobSetFight`（或新动作）增加 `收尾` 形态的注入：
   - 把 `end_chain` 按「每段一个节点」的方式生成节点（同现有 `_build_seg_nodes`）
   - 注入到 `无尽挑战_最后一波` 的 `next`（作为覆盖）
   - 与 `once`/`loop` 一样：`next` 第一项放 `无尽局内_继续挑战`，链尾指向「等结算」而非循环
2. `_build_seg_nodes` 目前只处理 `once_chain` / `loop_chain`，需扩到 `end_chain`
3. 确认「等结算」的落点节点（`03-1-01` 里 `post_delay: 15000` 那个是过渡，需要明确后续）
4. 跑 `check_resource.py` + `check_graph.py` 验证

---

## 4. 已知问题 / 注意

- **浏览器缓存**：改完 HTML 必须让用户 `Ctrl+F5` 强刷（**不用重启 Flask**）
- **Python 改动**：需**完全重启 MAA/Agent 进程**（模块只在启动时 import 一次，重载资源不够）
- **Pipeline JSON 改动**：重启 MAA 或重载资源
- **`_apply_supply` 不覆盖 `无尽局内_补给` 的 `enabled`** —— 用户明确要求 custom 不抢这个开关
- **收尾链的注入顺序**：`无尽局内_继续挑战` 的 `next` 目前是
  `["无尽局内_补给", "无尽挑战_选取植物_开始战斗"]`，**补给必须在前**
  （曾经漏掉导致补给链永不执行）
- 作业集 JSON 结构（当前网页导出）：

```jsonc
{ "code","name","version","worlds":[],"max_level":149,
  "tables":[{
     "from_level","to_level",
     "lineup":{"plants":[],"deck":null},
     "slots":{"1":"粉丝心叶兰",...},
     // 普通关三链 + 等待 + 形态
     "slotOrder":[{key,from,to,picked?,order?}],
     "loopOrder":[...], "endOrder":[...],
     "waitAfter":{ "once|card2|2,1|2": 3 },
     "slotModes":{ "card1":"once|loop|end", ... },
     // boss 关同构（前缀 boss）
     "bossSlotOrder":[...], "bossLoopOrder":[...], "bossEndOrder":[...],
     "bossWaitAfter":{}, "bossSlotModes":{},
     // 补给（每个阵容独立）
     "supplyPicks":[{"id":"all","name":"全部植物","img":"全部植物.png"}],
     "non_boss":{
        "once_chain":[{"key","slot","type","label","mode","cells":[...]}],
        "loop_chain":[...], "end_chain":[...],
        "sequence":[...]        // 兼容旧字段
     },
     "boss":{ "once_chain":[...], "loop_chain":[...], "end_chain":[...] }
  }]}
```

**`waitAfter` 键格式**：`{模式}|{槽位key}|{r},{c}|{seq}`
——注意是 **(r, c) 行在前列在后**（网页端 `jobPlacementKey(mode,scopeId,r,c,seq)`）。
例：`once|card2|2,1|2` = 单次链/槽2/行2列1 = **格子2_3**。

**`slotOrder` 段格式**：`{key, from, to, picked?, order?}`

- `from:0, to:null` = 该槽全部落点（按 seq）
- `picked:[0,2]` = 指定下标（不连续时用）
- `order:[2,0,1]` = **块内自定义顺序**（拖动 chip 后写入）

---

## 5. 验证方法

```powershell
cd D:\maapvz\MAAPVZ
.venv\Scripts\python.exe check_resource.py assets/resource     # pipeline 校验
.venv\Scripts\python.exe agent\jobset\selfcheck.py             # 引擎离线自测
.venv\Scripts\python.exe agent\jobset\check_graph.py           # 断路检查
.venv\Scripts\python.exe agent\jobset\report.py                # 打印作业集解析
```

**无头浏览器验证 HTML**（很有用）：

- 复制 `index.html` → 在 `</body>` 前注入测试脚本 → `--dump-dom` 读 `document.title`
- 需要 `sandbox_permissions: danger-full-access`（Edge 要起子进程）
- 注意：**带 `transition` 的属性，`getComputedStyle` 会返回过渡起点值**，
  测量要用 `getBoundingClientRect()` 或读 inline style

---

## 6. 环境

- 沙箱：`workspace-write`；Edge 无头浏览器需 `danger-full-access`
- Python：`.venv`（3.12，**无 flask**）；Flask 工具用 `D:\ana\python.exe`
- 无头浏览器：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- **补给图片素材**：`game_assist_tools\endless_setup\static\supply\`（24 张，来自 `D:\qq文件\boost\boost`）

---

## 7. 🚨 交接给下一个 AI 的硬性要求

1. **写完后必须删除所有测试脚本**。
   本项目约定：临时脚本用 `_` 或 `zz` 前缀，用完立刻删。
   收工前跑一次：

   ```powershell
   Get-ChildItem -File | Where-Object { $_.Name -like "zz*" -or $_.Name -like "_*" }
   Get-ChildItem game_assist_tools\endless_setup\static -File |
       Where-Object { $_.Name -like "zz*" -or $_.Name -like "_*" }
   ```

   两个都应为空。

2. **不要动 `tools\` 目录**（`tools\AGENTS.md` 明令禁止，那是构建产物）。

3. **优先完成收尾链的运行时接线**（第 3 节）。

4. 改 pipeline 后跑 `check_resource.py`；改 Python 后跑 `selfcheck.py`。

---

## 8. 最近验证结果（全绿基线）

```
check_resource.py assets/resource  →  All directories checked
selfcheck.py                       →  全部通过
check_graph.py                     →  断路 0（3 个空壳节点为有意保留）
```

网页端实测（无头 Edge）：

```
三条链          = [单次链, 循环链, 收尾链]
链过滤          = 默认全勾，可单独取消
块内重排        = 拖动后 cells 顺序变化，导出跟随
收尾序号        = rgb(220,38,38) 红色
补给固定区      = 「查看」独立显示，不进堆叠区
右键取消        = 1 项直清 / 多项弹窗多选
div 标签平衡    = 250 / 250
node --check    = JS SYNTAX OK
JS 运行时错误    = []
```
