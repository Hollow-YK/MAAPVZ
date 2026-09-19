"""
returnOCR —— 截图识别 + 条件判断（让流程根据屏幕内容走分支）
================================================================

一、这个功能是干什么的？
    对屏幕指定区域做 OCR（或复用某个节点的识别逻辑），把结果与条件比较：
      · 条件成立   → 动作成功(success)，流程继续往下走
      · 条件不成立 → 动作失败，进入该节点的 on_error 分支
    典型场景：判断金币/体力数量、判断按钮是否存在、根据数值分流等。

二、最简用法（推荐）：一行字符串
    在 pipeline JSON 里这样写：

      "custom_action_param": "<=900 @ 100,50,200,40 # 金币不足: "

    格式：  条件或节点名  [@ 识别区域]  [# 提示文字]

      · 条件   ：<=900  >=100  ==50  !=30  >10  <200
      · @ 区域 ：x,y,w,h（省略则全屏识别）
      · # 提示 ：成功时输出到日志的文字，会自动拼接识别到的内容
      · 节点名 ：不写条件、直接写某个节点名，表示"复用该节点的识别，
                 命中即成功"（可配合 @ 覆盖它的 roi）

    示例：
      "<=900"                             全屏 OCR，数字 <=900 则成功
      "<=900 @ 100,50,200,40"             指定区域识别并比较
      ">=100 @ 200,100,150,30 # 体力: "   带日志提示
      "CheckButton"                       复用 CheckButton 节点的识别
      "CheckButton # 找到按钮"

三、完整用法：JSON 对象
    需要前置点击/按住、成功后点击等高级功能时，用 JSON 对象：

      "custom_action_param": {
        "compare": "<=900",            // 比较条件（与 recognition_name 二选一）
        "roi": [100, 50, 200, 40],     // 识别区域，也可写 "100,50,200,40"
        "recognition_name": "节点名",  // 引用节点模式（别名 node）
        "return_text": "金币: ",       // 日志前缀（别名 text）

        "click_before": [x,y,w,h],     // 识别前先点一下
        "hold_position": [x,y,w,h],    // 识别前按住该位置
        "hold_before": 1.5,            // 按住时长（秒），也可写 "1.5s"
        "wait_before": 800,            // 点击/按住后等待（毫秒），也可写 "0.8s"

        "click_target": [x,y,w,h],     // 成功后点击（别名 click）
        "hold_after": 0                // 成功后点击的按住时长（秒）
      }

四、参数别名（写哪个都行）
    text  → return_text
    node  → recognition_name
    click → click_target

五、时长单位
    wait_before 默认毫秒，hold_before / hold_after 默认秒；
    都支持字符串带单位："800ms"、"0.8s"。

六、缓存说明
    相同 roi + recognition_name 的调用在 1.5 秒内复用同一次识别结果
    （compare 不影响缓存，各节点套用自己的条件），避免重复截图读到不同帧。

七、完整示例
    {
      "CheckGold": {
        "action": "Custom",
        "custom_action": "returnOCR",
        "custom_action_param": "<=900 @ 100,50,200,40 # 金币: ",
        "on_error": ["GoFarm"]
      },

      "OpenPanelAndCheck": {
        "action": "Custom",
        "custom_action": "returnOCR",
        "custom_action_param": {
          "click_before": [500, 300, 100, 50],
          "wait_before": "0.8s",
          "compare": ">=100",
          "roi": "200,100,150,30",
          "text": "体力: "
        }
      },

      "FindAndClick": {
        "action": "Custom",
        "custom_action": "returnOCR",
        "custom_action_param": {
          "node": "CheckButton",
          "click": [600, 400, 80, 40]
        },
        "on_error": ["NotFound"]
      }
    }
"""

import json
import re
import sys
import time
from maa.agent.agent_server import AgentServer
from maa.custom_action import CustomAction
from maa.context import Context

# 直接 OCR 能力（用于“识别数字并比较”）。老版本不支持时降级为仅引用节点模式。
try:
    from maa.pipeline import JRecognitionType, JOCR
    _DIRECT_RECO = True
except Exception:
    _DIRECT_RECO = False

# 短期识别缓存：同一 ROI 在 _OCR_CACHE_TTL 秒内复用上一次 OCR 结果。
# 用途：让同一轮里多个“判断”节点共用同一次识别结果（只读一次 + 复用），
# 避免第二个节点再次截图/OCR 读到不同帧而判断错误。
# 注意：只按 ROI + recognition_name 缓存，compare 不参与 key（compare 是每节点各自套用的门槛）。
_OCR_CACHE = {}
_OCR_CACHE_TTL = 1.5
_OCR_CACHE_MAX = 256

# 参数别名：人性化简写 -> 标准名
_PARAM_ALIASES = {
    "text": "return_text",
    "node": "recognition_name",
    "click": "click_target",
}

# 需要解析为 [x, y, w, h] 的区域类参数
_BOX_PARAMS = ("roi", "hold_position", "click_before", "click_target")

# 判断一个字符串是否以比较表达式开头（用于简写模式区分 compare / 节点名）
_COMPARE_RE = re.compile(r'^\s*(<=|>=|==|!=|<|>)\s*-?\d')


@AgentServer.custom_action("returnOCR")
class ReturnOCR(CustomAction):
    def run(self, context: Context, argv: CustomAction.RunArg) -> CustomAction.RunResult:
        """截图 -> 识别 -> 比较。动作 success = 是否命中/比较成立。

        参数支持三种写法（详见文件头文档）：
        - 一行简写："<=900 @ 100,50,200,40 # 提示文字"
        - JSON 对象：{"compare": "<=900", "roi": [...], ...}
        - JSON 字符串（含双编码兼容）

        success=False 时节点走 on_error；可用来做“条件判断/分流”。
        """
        if not argv.custom_action_param:
            return CustomAction.RunResult(success=True)

        param = self._parse_param(argv.custom_action_param)
        if param is None:
            return CustomAction.RunResult(success=False)

        return_text = param.get("return_text", "")
        roi = param.get("roi", [])
        hold_position = param.get("hold_position", [])
        hold_before = self._parse_duration(param.get("hold_before", 0.0), default_unit="s")
        click_before = param.get("click_before", [])
        wait_before = self._parse_duration(param.get("wait_before", 500), default_unit="ms")
        click_target = param.get("click_target", [])
        hold_after = self._parse_duration(param.get("hold_after", 0.0), default_unit="s")
        compare = param.get("compare", "")
        recognition_name = param.get("recognition_name", "")

        if not compare and not recognition_name:
            print("warn:returnOCR 缺少 compare 或 recognition_name，"
                  "正确格式如: \"<=900 @ 100,50,200,40 # 提示文字\"", file=sys.stderr, flush=True)
            return CustomAction.RunResult(success=False)

        # ---------- 辅助函数 ----------
        def do_tap(box, hold_seconds=0.0):
            if not box or len(box) != 4:
                return
            x = box[0] + box[2] // 2
            y = box[1] + box[3] // 2
            if hold_seconds > 0:
                context.tasker.controller.post_swipe(x, y, x, y, duration=int(hold_seconds * 1000)).wait()
            else:
                context.tasker.controller.post_click(x, y).wait()

        # ---------- 截图并识别（可带前置按住/点击）----------
        hit = False
        text = ""
        num = None
        cache_key = self._cache_key(param)
        cached = self._cache_get(cache_key)
        if cached is not None:
            # 命中缓存：直接复用上一次识别结果（只读一次 + 复用）
            hit, text, num = cached["hit"], cached["text"], cached["num"]
        elif hold_position and len(hold_position) == 4 and hold_before > 0:
            x = hold_position[0] + hold_position[2] // 2
            y = hold_position[1] + hold_position[3] // 2
            context.tasker.controller.post_touch_down(x, y).wait()
            time.sleep(hold_before)
            image = context.tasker.controller.post_screencap().wait().get()
            hit, text, num = self._recognize(context, image, param)
            context.tasker.controller.post_touch_up().wait()
            self._cache_put(cache_key, hit, text, num)
            if wait_before > 0:
                time.sleep(wait_before)
        elif click_before:
            do_tap(click_before, 0)
            if wait_before > 0:
                time.sleep(wait_before)
            image = context.tasker.controller.post_screencap().wait().get()
            hit, text, num = self._recognize(context, image, param)
            self._cache_put(cache_key, hit, text, num)
        else:
            image = context.tasker.controller.post_screencap().wait().get()
            hit, text, num = self._recognize(context, image, param)
            self._cache_put(cache_key, hit, text, num)

        if not hit:
            # 未命中 / 比较不成立：保持安静，动作失败（走 on_error）
            return CustomAction.RunResult(success=False)

        comp = str(num) if num is not None else text
        full_message = f"{return_text}{comp}"
        print(f"info:{full_message}", file=sys.stderr, flush=True)

        if click_target:
            do_tap(click_target, hold_after)

        return CustomAction.RunResult(success=True)

    # ---------- 参数解析（简写 / JSON / 别名 / 单位）----------
    @classmethod
    def _parse_param(cls, raw):
        """把 custom_action_param 统一解析成规范化的 dict；失败返回 None（并打印提示）。"""
        param = None
        if isinstance(raw, dict):
            # 有的版本直接传已解析对象
            param = dict(raw)
        elif isinstance(raw, str):
            param = cls._try_json(raw)
            if not isinstance(param, dict):
                # 不是 JSON 对象（可能是简写，也可能是纯数字等），按一行简写解析
                param = cls._parse_shorthand(raw)
        if not isinstance(param, dict):
            print(f"warn:returnOCR 无法解析参数: {raw!r}\n"
                  f"     正确格式如: \"<=900 @ 100,50,200,40 # 提示文字\"，或 JSON 对象",
                  file=sys.stderr, flush=True)
            return None
        return cls._normalize(param)

    @staticmethod
    def _try_json(s):
        """尝试按 JSON 解析（兼容“双编码”：解出来仍是字符串时再解一次）。"""
        try:
            param = json.loads(s)
        except json.JSONDecodeError:
            return None
        if isinstance(param, str):
            try:
                param = json.loads(param)
            except json.JSONDecodeError:
                return None
        return param

    @classmethod
    def _parse_shorthand(cls, s):
        """解析一行简写：  条件或节点名 [@ x,y,w,h] [# 提示文字]"""
        text = s.strip()
        if not text:
            return None
        param = {}
        if "#" in text:
            text, hint = text.split("#", 1)
            param["return_text"] = hint.strip()
            text = text.strip()
        if "@" in text:
            text, roi_s = text.split("@", 1)
            roi = cls._parse_box(roi_s)
            if roi is None:
                print(f"warn:returnOCR 简写中的区域格式错误: {roi_s!r}，应为 x,y,w,h",
                      file=sys.stderr, flush=True)
                return None
            param["roi"] = roi
            text = text.strip()
        if not text:
            return None
        if _COMPARE_RE.match(text):
            param["compare"] = text
        else:
            param["recognition_name"] = text
        return param

    @classmethod
    def _normalize(cls, param):
        """应用别名、把区域参数统一成 [x, y, w, h]。"""
        for alias, std in _PARAM_ALIASES.items():
            if alias in param and std not in param:
                param[std] = param.pop(alias)
        for key in _BOX_PARAMS:
            if key in param and param[key]:
                box = cls._parse_box(param[key])
                if box is None:
                    print(f"warn:returnOCR 参数 {key} 格式错误: {param[key]!r}，应为 [x,y,w,h]",
                          file=sys.stderr, flush=True)
                    param[key] = []
                else:
                    param[key] = box
        return param

    @staticmethod
    def _parse_box(v):
        """把 [x,y,w,h] 或 \"x,y,w,h\" 解析成 4 个 int 的列表；失败返回 None。"""
        if isinstance(v, (list, tuple)) and len(v) == 4:
            try:
                return [int(float(x)) for x in v]
            except (TypeError, ValueError):
                return None
        if isinstance(v, str):
            parts = re.split(r'[,，\s]+', v.strip())
            if len(parts) == 4:
                try:
                    return [int(float(p)) for p in parts]
                except ValueError:
                    return None
        return None

    @staticmethod
    def _parse_duration(v, default_unit="ms"):
        """解析时长，统一返回秒(float)。数字按默认单位；字符串可带单位 '0.8s' / '800ms'。"""
        if isinstance(v, bool):
            return 0.0
        if isinstance(v, (int, float)):
            return float(v) / 1000.0 if default_unit == "ms" else float(v)
        if isinstance(v, str):
            m = re.match(r'^\s*(-?\d+(?:\.\d+)?)\s*(ms|s|毫秒|秒)?\s*$', v)
            if m:
                val = float(m.group(1))
                unit = m.group(2) or default_unit
                return val / 1000.0 if unit in ("ms", "毫秒") else val
        print(f"warn:returnOCR 时长格式错误: {v!r}，已按 0 处理", file=sys.stderr, flush=True)
        return 0.0

    # ---------- 识别分发 ----------
    def _recognize(self, context, image, param):
        """返回 (hit, text, num)。hit=命中/比较成立；text=识别文字；num=提取到的数字(若为数字比较)。"""
        if param.get("compare"):
            return self._number_compare(context, image, param)
        return self._node_reference(context, image, param)

    def _number_compare(self, context, image, param):
        """识别 ROI 里的数字并比较。compare 形如 '<=900'、'>=100'、'==50'、'!=30'、'>10'、'<200'。"""
        if not _DIRECT_RECO:
            return (False, "", None)
        roi = param.get("roi")
        roi_t = tuple(int(v) for v in roi) if roi and len(roi) == 4 else (0, 0, 0, 0)
        try:
            ocr = JOCR(roi=roi_t)
            detail = context.run_recognition_direct(JRecognitionType.OCR, ocr, image)
        except Exception as e:
            print(f"warn:识别数字 OCR 失败 {e}", file=sys.stderr, flush=True)
            return (False, "", None)
        text = ""
        num = None
        if detail is not None and detail.hit and detail.best_result is not None:
            text = getattr(detail.best_result, "text", None) or ""
            num = self._extract_number(text)
        cmp_spec = self._parse_compare(param.get("compare"))
        return (self._do_compare(num, cmp_spec), text, num)

    def _node_reference(self, context, image, param):
        """引用别的节点识别：run_recognition(节点名)，hit 即命中。"""
        name = param.get("recognition_name")
        if not name:
            return (True, "", None)
        try:
            override = {}
            roi = param.get("roi")
            if roi and len(roi) == 4:
                override[name] = {"roi": tuple(int(v) for v in roi)}
            detail = context.run_recognition(name, image, pipeline_override=override)
        except Exception as e:
            print(f"warn:引用识别失败 {name}: {e}", file=sys.stderr, flush=True)
            return (False, "", None)
        hit = bool(detail is not None and detail.hit)
        text = ""
        num = None
        if hit:
            try:
                best = detail.best_result
                if best is not None:
                    text = getattr(best, "text", None) or ""
                    num = self._extract_number(text)
            except Exception:
                pass
        # 若同时给了 compare，则用识别出的数字做门槛比较，返回 hit=比较是否成立。
        # 这样能复用被引用节点（含 color_filter / replace），而不是裸 OCR。
        cmp_spec = self._parse_compare(param.get("compare")) if param.get("compare") else None
        if cmp_spec is not None:
            hit = self._do_compare(num, cmp_spec)
        return (hit, text, num)

    # ---------- 识别缓存（只读一次 + 复用）----------
    @staticmethod
    def _cache_key(param):
        """ROI + recognition_name 作为缓存键；compare 不参与（compare 是每节点各自套用的门槛）。"""
        roi = param.get("roi")
        roi_t = tuple(int(v) for v in roi) if roi and len(roi) == 4 else None
        name = param.get("recognition_name") or ""
        return (roi_t, name)

    @staticmethod
    def _cache_get(key):
        if key is None:
            return None
        item = _OCR_CACHE.get(key)
        if item and (time.monotonic() - item["ts"]) <= _OCR_CACHE_TTL:
            return item
        return None

    @staticmethod
    def _cache_put(key, hit, text, num):
        if key is None:
            return None
        if len(_OCR_CACHE) > _OCR_CACHE_MAX:
            _OCR_CACHE.clear()
        _OCR_CACHE[key] = {"ts": time.monotonic(), "hit": hit, "text": text, "num": num}

    # ---------- 数字解析/比较 ----------
    @staticmethod
    def _extract_number(text):
        m = re.search(r'-?\d+(?:\.\d+)?', text or "")
        if not m:
            return None
        s = m.group()
        return float(s) if "." in s else int(s)

    @staticmethod
    def _parse_compare(compare):
        m = re.match(r'^\s*(<=|>=|==|!=|<|>)\s*(-?\d+(?:\.\d+)?)\s*$', str(compare or "").strip())
        if not m:
            return None
        return m.group(1), float(m.group(2))

    @staticmethod
    def _do_compare(num, cmp_spec):
        if num is None or cmp_spec is None:
            return False
        op, bound = cmp_spec
        if op == "<":
            return num < bound
        if op == "<=":
            return num <= bound
        if op == ">":
            return num > bound
        if op == ">=":
            return num >= bound
        if op == "==":
            return num == bound
        if op == "!=":
            return num != bound
        return False
