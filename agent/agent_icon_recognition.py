# -*- coding: utf-8 -*-
"""
透明底PNG图标识别 —— MAA Agent 集成
=====================================
图库: assets/icon_lib/小图标_HeadshotPlant (327 个 RGBA PNG)

注册内容:
  自定义识别 IconMatch  —— 在截图中找指定图标, 返回命中框
      param: {"name": "whitemelon",            // 图标名(不含.png), 或名字数组
              "threshold": 0.9,                // 接受阈值, 默认0.9 (>=0.9 基本必对)
              "scale_range": [0.7, 2.5],       // 相对图库的尺度搜索范围
              "trim": 0.2,                     // 抗遮挡裁剪比例
              "roi": [x, y, w, h]}             // 可选, 限定搜索区域
  自定义动作 IconClick  —— 找到指定图标并点击
      param: 同 IconMatch, 另加:
              "dx": 0, "dy": 0,                // 点击点相对图标中心的偏移
              "delay": 0}                      // 点击后等待毫秒
  自定义动作 IconScan   —— 全图库扫描 (慢, 约3~6分钟), 结果写文件
      param: {"threshold": 0.55, "trim": 0.2, "min_support": 0.5,
              "out": "icon_scan"}              // 输出名, 写到 debug/ 下
  自定义动作 IconList   —— 打印图库全部图标名

鲁棒性: alpha掩膜NCC(背景无关) + 灰度NCC(抗变灰) + 裁剪NCC(抗小物件遮挡)
        + 轮廓支撑度(抗平滑区域假匹配)。>=0.9 分人工验证基本全对。
"""
import os
import sys
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import cv2

from maa.agent.agent_server import AgentServer
from maa.custom_action import CustomAction
from maa.custom_recognition import CustomRecognition
from maa.context import Context

if getattr(sys, 'frozen', False):
    ROOT_DIR = Path(sys.executable).parent
else:
    ROOT_DIR = Path(__file__).parent.parent

ICON_DIR = ROOT_DIR / "assets" / "icon_lib" / "小图标_HeadshotPlant"
DEBUG_DIR = ROOT_DIR / "debug"


# ==================== 基础工具 ====================

def imread_any(path, flags=cv2.IMREAD_COLOR):
    """读取含中文/非ASCII路径的图片"""
    return cv2.imdecode(np.fromfile(str(path), dtype=np.uint8), flags)


def imwrite_any(path, img):
    ext = os.path.splitext(str(path))[1] or '.png'
    ok, buf = cv2.imencode(ext, img)
    if ok:
        buf.tofile(str(path))
    return ok


_ICONS_CACHE = {}


def load_icons(icon_dir=None):
    """加载图库 (带缓存): 返回 [(name, rgba_img), ...]"""
    icon_dir = Path(icon_dir) if icon_dir else ICON_DIR
    key = str(icon_dir)
    if key in _ICONS_CACHE:
        return _ICONS_CACHE[key]
    icons = []
    for f in sorted(os.listdir(icon_dir)):
        if not f.lower().endswith('.png'):
            continue
        img = imread_any(icon_dir / f, cv2.IMREAD_UNCHANGED)
        if img is None or img.ndim != 3 or img.shape[2] != 4:
            continue
        icons.append((os.path.splitext(f)[0], img))
    _ICONS_CACHE[key] = icons
    return icons


def get_icon(name, icon_dir=None):
    for n, img in load_icons(icon_dir):
        if n == name:
            return img
    return None


# ==================== 匹配核心 ====================

def masked_ncc_multi(scene_chs, templ_chs, mask):
    """多通道 masked NCC (均值在蒙版内计算). 返回相关图, 值域[-1,1]."""
    m = mask.astype(np.float32)
    mass = float(m.sum())
    if mass < 4:
        return None
    num = None
    var_i = None
    var_t = 0.0
    for s_c, t_c in zip(scene_chs, templ_chs):
        tbar = float((m * t_c).sum()) / mass
        tmc = (m * (t_c - tbar)).astype(np.float32)
        var_t += float((tmc * t_c).sum())
        n = cv2.matchTemplate(s_c, tmc, cv2.TM_CCORR)
        num = n if num is None else num + n
        isum = cv2.matchTemplate(s_c, m, cv2.TM_CCORR)
        i2sum = cv2.matchTemplate(s_c * s_c, m, cv2.TM_CCORR)
        v = i2sum - isum * isum / mass
        var_i = v if var_i is None else var_i + v
    if var_t < 1.0:
        return None
    denom = np.sqrt(np.maximum(var_i, 0.0) * var_t)
    ncc = np.zeros_like(num, dtype=np.float32)
    valid = denom > 1.0
    ncc[valid] = num[valid] / denom[valid]
    return np.clip(ncc, -1.0, 1.0)


def color_ncc_map(scene_f3, templ_bgr, mask):
    return masked_ncc_multi(cv2.split(scene_f3), cv2.split(templ_bgr), mask)


def gray_ncc_map(scene_g1, templ_bgr, mask):
    tg = cv2.cvtColor(templ_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    return masked_ncc_multi([scene_g1], [tg], mask)


def trimmed_ncc(patch_chs, templ_chs, mask, trim=0.2):
    """裁剪NCC: 剔除蒙版内残差最大的 trim 比例像素再算相关 (抗遮挡)"""
    m = mask > 0
    if m.sum() < 16:
        return 0.0
    zps, zts = [], []
    for p_c, t_c in zip(patch_chs, templ_chs):
        pv = p_c[m].astype(np.float64)
        tv = t_c[m].astype(np.float64)
        ps, ts = pv.std(), tv.std()
        if ps < 1e-3 or ts < 1e-3:
            return 0.0
        zps.append((pv - pv.mean()) / ps)
        zts.append((tv - tv.mean()) / ts)
    zp = np.stack(zps, 1)
    zt = np.stack(zts, 1)
    resid = ((zp - zt) ** 2).sum(1)
    thr = np.quantile(resid, 1.0 - trim)
    keep = resid <= thr
    if keep.sum() < 16:
        return 0.0
    a = zp[keep].ravel()
    b = zt[keep].ravel()
    na, nb = np.sqrt((a * a).sum()), np.sqrt((b * b).sum())
    if na < 1e-6 or nb < 1e-6:
        return 0.0
    return float((a * b).sum() / (na * nb))


def edge_support(patch_gray, mask):
    """轮廓支撑度: 模板alpha轮廓处场景应有强边缘 (抗渐变假匹配)"""
    m = mask > 0
    if m.sum() < 16:
        return 0.0
    er = cv2.erode(mask, np.ones((3, 3), np.uint8))
    boundary = (m & (er == 0))
    if boundary.sum() < 8:
        return 0.0
    gx = cv2.Sobel(patch_gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(patch_gray, cv2.CV_32F, 0, 1, ksize=3)
    gm = np.sqrt(gx * gx + gy * gy)
    strong = (gm > 40).astype(np.uint8)
    strong = cv2.dilate(strong, np.ones((3, 3), np.uint8))
    return float(strong[boundary].mean())


def candidate_score(scene_f3, scene_g1, icon, x, y, scale, trim=0.2,
                    relocalize=True):
    """原图 (x,y) 处按 scale 核验: 返回 (score, (x,y,w,h), support)"""
    ih, iw = icon.shape[:2]
    w, h = int(round(iw * scale)), int(round(ih * scale))
    if w < 8 or h < 8:
        return 0.0, (x, y, w, h), 0.0
    H, W = scene_f3.shape[:2]
    t = cv2.resize(icon, (w, h))
    mask = (t[..., 3] > 128).astype(np.uint8)
    if int(mask.sum()) < w * h * 0.15:
        return 0.0, (x, y, w, h), 0.0
    t_bgr = t[..., :3].astype(np.float32)

    if relocalize:
        mgn = int(0.15 * max(w, h)) + 5
        rx0, ry0 = max(0, x - mgn), max(0, y - mgn)
        rx1, ry1 = min(W, x + w + mgn), min(H, y + h + mgn)
        if rx1 - rx0 < w or ry1 - ry0 < h:
            return 0.0, (x, y, w, h), 0.0
        res = gray_ncc_map(scene_g1[ry0:ry1, rx0:rx1], t_bgr, mask)
        if res is None:
            return 0.0, (x, y, w, h), 0.0
        _, mv, _, ml = cv2.minMaxLoc(res)
        x, y = rx0 + ml[0], ry0 + ml[1]

    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 - x0 < w * 0.7 or y1 - y0 < h * 0.7:
        return 0.0, (x, y, w, h), 0.0
    mx0, my0 = x0 - x, y0 - y
    mx1, my1 = mx0 + (x1 - x0), my0 + (y1 - y0)
    m_c = mask[my0:my1, mx0:mx1]
    t_c = t_bgr[my0:my1, mx0:mx1]
    patch3 = scene_f3[y0:y1, x0:x1]
    p_gray = scene_g1[y0:y1, x0:x1]
    p_chs = cv2.split(patch3)
    t_chs = cv2.split(t_c)
    t_gray = cv2.cvtColor(t_c, cv2.COLOR_BGR2GRAY).astype(np.float32)
    best = 0.0
    for tr in (0.0, trim):
        best = max(best, trimmed_ncc(p_chs, t_chs, m_c, tr),
                   trimmed_ncc([p_gray], [t_gray], m_c, tr))
    sup = edge_support(p_gray, m_c)
    return best, (x, y, w, h), sup


def iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix, iy = max(ax, bx), max(ay, by)
    iw = min(ax + aw, bx + bw) - ix
    ih = min(ay + ah, by + bh) - iy
    if iw <= 0 or ih <= 0:
        return 0.0
    inter = iw * ih
    return inter / float(aw * ah + bw * bh - inter)


def cluster_1d(values, gap):
    order = np.argsort(values)
    ids = np.zeros(len(values), int)
    cid = 0
    for i in range(1, len(order)):
        if values[order[i]] - values[order[i - 1]] > gap:
            cid += 1
        ids[order[i]] = cid
    return ids


def level_of(score):
    if score >= 0.75:
        return 'high'
    if score >= 0.60:
        return 'medium'
    return 'low'


# ==================== 快速单图标查找 ====================

def find_icon(img_bgr, name, threshold=0.9, trim=0.2, scale_range=(0.7, 2.5),
              roi=None, icon_dir=None):
    """在 BGR 图中查找指定图标, 返回 dict(name/score/support/x/y/w/h) 或 None。
    快路径: 半分辨率灰度NCC多尺度粗扫 -> 原图裁剪NCC精核。通常 <1秒。"""
    icon = get_icon(name, icon_dir)
    if icon is None:
        print(f"[IconMatch] 图库中不存在: {name}")
        return None
    ox, oy = 0, 0
    if roi is not None:
        rx, ry, rw, rh = [int(v) for v in roi]
        H0, W0 = img_bgr.shape[:2]
        rx, ry = max(0, rx), max(0, ry)
        rw, rh = min(rw, W0 - rx), min(rh, H0 - ry)
        if rw < 16 or rh < 16:
            return None
        img_bgr = img_bgr[ry:ry + rh, rx:rx + rw]
        ox, oy = rx, ry
    H, W = img_bgr.shape[:2]
    scene_f3 = img_bgr.astype(np.float32)
    scene_g1 = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    small = cv2.resize(img_bgr, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    small_g1 = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)

    ih, iw = icon.shape[:2]
    lo, hi = scale_range
    best = (0.0, None)  # (coarse_score, (x_small, y_small, scale_full))
    s = lo * 0.5
    while s <= hi * 0.5 + 1e-6:
        w = int(round(iw * s))
        h = int(round(ih * s))
        if 8 <= w <= W // 2 and 8 <= h <= H // 2:
            t = cv2.resize(icon, (w, h),
                           interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
            mask = (t[..., 3] > 128).astype(np.uint8)
            if int(mask.sum()) >= w * h * 0.15:
                res = gray_ncc_map(small_g1, t[..., :3].astype(np.float32), mask)
                if res is not None:
                    _, mv, _, ml = cv2.minMaxLoc(res)
                    if mv > best[0]:
                        best = (float(mv), (ml[0], ml[1], s * 2))
        s += 0.05
    if best[1] is None or best[0] < max(0.35, threshold - 0.35):
        return None
    xs, ys, scale_f = best[1]
    # 原图精核 (尺度 ±5%)
    out = None
    for ds in (0.95, 1.0, 1.05):
        sf = scale_f * ds
        w, h = int(round(iw * sf)), int(round(ih * sf))
        cx, cy = xs * 2 + int(round(iw * scale_f)), ys * 2 + int(round(ih * scale_f))
        nx, ny = int(cx - w / 2), int(cy - h / 2)
        sc1, box1, sup1 = candidate_score(scene_f3, scene_g1, icon, nx, ny, sf,
                                          trim, relocalize=True)
        sc2, box2, sup2 = candidate_score(scene_f3, scene_g1, icon, nx, ny, sf,
                                          trim, relocalize=False)
        sc, box, sup = (sc1, box1, sup1) if sc1 >= sc2 else (sc2, box2, sup2)
        if out is None or sc > out['score']:
            out = {'name': name, 'score': round(float(sc), 4),
                   'support': round(float(sup), 3),
                   'x': int(box[0]) + ox, 'y': int(box[1]) + oy,
                   'w': int(box[2]), 'h': int(box[3])}
    if out is None or out['score'] < threshold:
        return None
    out['level'] = level_of(out['score'])
    return out


# ==================== 全图库扫描 (慢) ====================

_SCAN_G = {}


def _coarse_one_icon(args):
    name, icon = args
    small_g1 = _SCAN_G['small_g1']
    sh, sw = small_g1.shape[:2]
    ih, iw = icon.shape[:2]
    cands = []
    for scale in _SCAN_G['scales']:
        w = int(round(iw * scale))
        h = int(round(ih * scale))
        if w < 8 or h < 8 or w > sw or h > sh:
            continue
        t = cv2.resize(icon, (w, h),
                       interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
        mask = (t[..., 3] > 128).astype(np.uint8)
        if int(mask.sum()) < w * h * 0.15:
            continue
        res = gray_ncc_map(small_g1, t[..., :3].astype(np.float32), mask)
        if res is None:
            continue
        ys, xs = np.nonzero(res >= _SCAN_G['threshold'])
        if len(ys) == 0:
            continue
        scores = res[ys, xs]
        order = np.argsort(-scores)[:12]
        for idx in order:
            cands.append((float(scores[idx]), name, int(xs[idx]), int(ys[idx]),
                          scale, w, h))
    cands.sort(key=lambda c: -c[0])
    kept = []
    for c in cands:
        s, _, x, y, _, w, h = c
        if all(abs(x - k[2]) >= min(w, k[5]) * 0.5 or abs(y - k[3]) >= min(h, k[6]) * 0.5
               for k in kept):
            kept.append(c)
            if len(kept) >= 60:
                break
    return kept


def scan_icons(img_bgr, threshold=0.55, trim=0.2, min_support=0.5,
               keep_all_sizes=False, icon_dir=None, workers=None, verbose=True):
    """全图库网格扫描。返回识别结果列表 (同 result.json 格式)。约3~6分钟。"""
    H, W = img_bgr.shape[:2]
    scene_f3 = img_bgr.astype(np.float32)
    scene_g1 = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    small = cv2.resize(img_bgr, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    small_g1 = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
    scales_small = [round(0.35 + 0.03 * i, 5) for i in range(29)]
    icons = load_icons(icon_dir)
    if verbose:
        print(f"[IconScan] 图库 {len(icons)} 个图标, 开始粗扫...", flush=True)

    _SCAN_G['small_g1'] = small_g1
    _SCAN_G['scales'] = scales_small
    _SCAN_G['threshold'] = max(0.38, threshold - 0.15)
    with ThreadPoolExecutor(max_workers=workers or min(8, os.cpu_count())) as ex:
        results = list(ex.map(_coarse_one_icon, icons))
    coarse = [c for sub in results for c in sub]
    if verbose:
        print(f"[IconScan] 粗扫候选: {len(coarse)}", flush=True)

    # 位置预聚类: 同位置只留 top8 图标
    coarse.sort(key=lambda c: -c[0])
    pos_clusters = []
    for c in coarse:
        s, name, x, y, sc, w, h = c
        cx, cy = x + w / 2, y + h / 2
        for cl in pos_clusters:
            if abs(cx - cl[0]) < 0.45 * max(w, cl[2]) and \
               abs(cy - cl[1]) < 0.45 * max(h, cl[2]):
                if len(cl[3]) < 8:
                    cl[3].append(c)
                break
        else:
            pos_clusters.append((cx, cy, w, [c]))
    slim = [c for cl in pos_clusters for c in cl[3]]
    if verbose:
        print(f"[IconScan] 位置聚类后进入精扫: {len(slim)}", flush=True)

    icon_map = dict(icons)
    final_cands = []
    for s0, name, x, y, scale_s, w_s, h_s in slim:
        icon = icon_map[name]
        fx, fy = x * 2, y * 2
        best_s, best_box, best_sup = 0.0, None, 0.0
        for ds in (0.95, 1.0, 1.05):
            scale_f = scale_s * 2 * ds
            ih, iw = icon.shape[:2]
            w, h = int(round(iw * scale_f)), int(round(ih * scale_f))
            cx, cy = fx + w_s, fy + h_s
            nx, ny = int(cx - w / 2), int(cy - h / 2)
            sc1, box1, sup1 = candidate_score(scene_f3, scene_g1, icon, nx, ny,
                                              scale_f, trim, relocalize=True)
            sc2, box2, sup2 = candidate_score(scene_f3, scene_g1, icon, nx, ny,
                                              scale_f, trim, relocalize=False)
            if sc1 >= sc2:
                sc, box, sup = sc1, box1, sup1
            else:
                sc, box, sup = sc2, box2, sup2
            if sc > best_s:
                best_s, best_box, best_sup = sc, box, sup
        if best_box is not None:
            final_cands.append({'name': name, 'score': best_s,
                                'support': best_sup,
                                'x': best_box[0], 'y': best_box[1],
                                'w': best_box[2], 'h': best_box[3]})
    if verbose:
        print(f"[IconScan] 精扫完成, 候选: {len(final_cands)}", flush=True)

    # ---- 网格判定 ----
    final_cands = [c for c in final_cands
                   if c['score'] >= max(0.40, threshold - 0.15)
                   and c['support'] >= min_support]
    if not final_cands:
        return []
    ref = [c for c in final_cands if c['score'] >= 0.80 and c['support'] >= 0.55]
    if len(ref) < 3:
        ref = sorted(final_cands, key=lambda c: -c['score'])[:15]
    bins = {}
    for c in ref:
        b = int(c['w'] // 25) * 25
        v = (c['score'] ** 4) * c['w']
        if b not in bins or v > bins[b]:
            bins[b] = v
    peak = max(bins, key=bins.get)
    near_peak = [c for c in ref if abs(c['w'] - peak) <= 37]
    med_w = float(np.median([c['w'] for c in near_peak]))
    med_h = float(np.median([c['h'] for c in near_peak]))
    if keep_all_sizes:
        pool = [c for c in final_cands if c['score'] >= 0.35]
    else:
        med_m = max(med_w, med_h)
        pool = [c for c in final_cands
                if med_m * 0.75 <= max(c['w'], c['h']) <= med_m * 1.5
                and c['score'] >= 0.35]
    if verbose:
        print(f"[IconScan] 主流尺寸 ≈ {int(med_w)}x{int(med_h)}, 候选池 {len(pool)}",
              flush=True)

    seeds = [c for c in pool if c['score'] >= 0.70]
    if len(seeds) < 3:
        seeds = sorted(pool, key=lambda c: -c['score'])[:15]
    scx = np.array([c['x'] + c['w'] / 2 for c in seeds])
    scy = np.array([c['y'] + c['h'] / 2 for c in seeds])
    gx = cluster_1d(scx, med_w * 0.5)
    gy = cluster_1d(scy, med_h * 0.5)
    col_vals = sorted(float(np.mean(scx[gx == i])) for i in range(gx.max() + 1))
    row_vals = sorted(float(np.mean(scy[gy == i])) for i in range(gy.max() + 1))

    def fill_gaps(lines):
        if len(lines) < 2:
            return lines, None
        diffs = np.diff(lines)
        pitch = float(np.median(diffs))
        out = [lines[0]]
        for d, nxt in zip(diffs, lines[1:]):
            n_missing = int(round(d / pitch)) - 1
            for k in range(1, n_missing + 1):
                out.append(out[-1] + d / (n_missing + 1))
            out.append(nxt)
        return out, pitch

    cols, pitch_x = fill_gaps(col_vals)
    rows, pitch_y = fill_gaps(row_vals)
    if pitch_x:
        v = cols[0] - pitch_x
        while v - med_w / 2 >= 0 and len(cols) < 20:
            cols.insert(0, v)
            v -= pitch_x
        v = cols[-1] + pitch_x
        while v + med_w / 2 <= W and len(cols) < 20:
            cols.append(v)
            v += pitch_x
    if pitch_y:
        v = rows[0] - pitch_y
        while v - med_h / 2 >= 0 and len(rows) < 20:
            rows.insert(0, v)
            v -= pitch_y
        v = rows[-1] + pitch_y
        while v + med_h / 2 <= H and len(rows) < 20:
            rows.append(v)
            v += pitch_y
    if verbose:
        print(f"[IconScan] 推断网格: {len(cols)}列 x {len(rows)}行", flush=True)

    dets = []
    for cxv in cols:
        for cyv in rows:
            near = [c for c in pool
                    if abs(c['x'] + c['w'] / 2 - cxv) < med_w * 0.5
                    and abs(c['y'] + c['h'] / 2 - cyv) < med_h * 0.5]
            if not near:
                continue
            near.sort(key=lambda c: -c['score'])
            best = near[0]
            second = next((g for g in near[1:] if g['name'] != best['name']), None)
            margin = best['score'] - (second['score'] if second else 0.0)
            if best['score'] < max(0.45, threshold - 0.10):
                continue
            d = dict(best)
            d['margin'] = round(margin, 3)
            d['level'] = level_of(best['score'])
            if best['support'] < min_support or best['score'] < threshold:
                d['level'] = 'low'
            dets.append(d)
    # 非网格散点补充
    pool_sorted = sorted(pool, key=lambda c: -c['score'])
    for c in pool_sorted:
        if c['score'] < 0.85 or c['support'] < min_support:
            continue
        cx, cy = c['x'] + c['w'] / 2, c['y'] + c['h'] / 2
        on_grid = any(abs(cx - cxv) < med_w * 0.5 and abs(cy - cyv) < med_h * 0.5
                      for cxv in cols for cyv in rows)
        dup = any(iou((c['x'], c['y'], c['w'], c['h']),
                      (k['x'], k['y'], k['w'], k['h'])) >= 0.2 for k in dets)
        if not on_grid and not dup:
            d = dict(c)
            d['margin'] = 0.0
            d['level'] = level_of(c['score'])
            d['off_grid'] = True
            dets.append(d)
    dets = sorted(dets, key=lambda d: (d['y'], d['x']))
    return dets


def annotate(img_bgr, dets, out_path):
    img = img_bgr.copy()
    color_map = {'high': (0, 220, 0), 'medium': (0, 220, 255), 'low': (0, 60, 255)}
    for d in dets:
        color = color_map.get(d['level'], (255, 255, 255))
        cv2.rectangle(img, (d['x'], d['y']), (d['x'] + d['w'], d['y'] + d['h']),
                      color, 2)
        label = '%s %.2f' % (d['name'], d['score'])
        cv2.putText(img, label, (d['x'], max(14, d['y'] - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 3)
        cv2.putText(img, label, (d['x'], max(14, d['y'] - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    imwrite_any(out_path, img)


# ==================== MAA 注册 ====================

def _parse_param(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            v = json.loads(raw)
            if isinstance(v, dict):
                return v
        except json.JSONDecodeError:
            pass
    return {}


def _find_best(img, names, param):
    threshold = float(param.get("threshold", 0.9))
    trim = float(param.get("trim", 0.2))
    scale_range = tuple(param.get("scale_range", (0.7, 2.5)))
    roi = param.get("roi")
    best = None
    for nm in names:
        hit = find_icon(img, nm, threshold=threshold, trim=trim,
                        scale_range=scale_range, roi=roi)
        if hit and (best is None or hit['score'] > best['score']):
            best = hit
    return best


@AgentServer.custom_recognition("IconMatch")
class IconMatch(CustomRecognition):
    """在截图中查找指定透明底图标。命中返回其包围框, 未命中返回 box=None。"""

    def analyze(self, context: Context, argv: CustomRecognition.AnalyzeArg):
        param = _parse_param(argv.custom_recognition_param)
        names = param.get("name") or param.get("names")
        if not names:
            return CustomRecognition.AnalyzeResult(
                box=None, detail='[IconMatch] 缺少参数 name')
        if isinstance(names, str):
            names = [names]
        if "roi" not in param and argv.roi is not None:
            r = argv.roi
            try:
                roi = [r.x, r.y, r.width, r.height]
            except (AttributeError, TypeError, IndexError):
                try:
                    roi = [r[0], r[1], r[2], r[3]]
                except (TypeError, IndexError):
                    roi = None
            if roi and roi[2] > 0 and roi[3] > 0:
                param = dict(param, roi=roi)
        best = _find_best(argv.image, names, param)
        if best is None:
            return CustomRecognition.AnalyzeResult(
                box=None,
                detail=f"[IconMatch] 未命中 {names} (阈值{param.get('threshold', 0.9)})")
        return CustomRecognition.AnalyzeResult(
            box=(best['x'], best['y'], best['w'], best['h']),
            detail=json.dumps(best, ensure_ascii=False))


@AgentServer.custom_action("IconClick")
class IconClick(CustomAction):
    """找到指定图标并点击其中心 (可加偏移)。"""

    def run(self, context: Context, argv: CustomAction.RunArg) -> CustomAction.RunResult:
        try:
            param = _parse_param(argv.custom_action_param)
            names = param.get("name") or param.get("names")
            if not names:
                print("[IconClick] 缺少参数 name")
                return CustomAction.RunResult(success=False)
            if isinstance(names, str):
                names = [names]
            img = context.tasker.controller.cached_image
            if img is None:
                print("[IconClick] cached_image 为空")
                return CustomAction.RunResult(success=False)
            best = _find_best(img, names, param)
            if best is None:
                print(f"[IconClick] 未命中 {names}")
                return CustomAction.RunResult(success=False)
            dx, dy = int(param.get("dx", 0)), int(param.get("dy", 0))
            delay = int(param.get("delay", 0))
            cx = best['x'] + best['w'] // 2 + dx
            cy = best['y'] + best['h'] // 2 + dy
            print(f"[IconClick] 命中 {best['name']} score={best['score']:.3f} "
                  f"sup={best['support']:.2f} 点击 ({cx},{cy})")
            context.tasker.controller.post_click(cx, cy, contact=0).wait()
            if delay > 0:
                time.sleep(delay / 1000.0)
            return CustomAction.RunResult(success=True)
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[IconClick] 异常: {e}")
            return CustomAction.RunResult(success=False)


@AgentServer.custom_action("IconScan")
class IconScan(CustomAction):
    """全图库扫描当前截图, 结果写入 debug/<out>.json 与 debug/<out>.png。耗时数分钟。"""

    def run(self, context: Context, argv: CustomAction.RunArg) -> CustomAction.RunResult:
        try:
            param = _parse_param(argv.custom_action_param)
            img = context.tasker.controller.cached_image
            if img is None:
                print("[IconScan] cached_image 为空")
                return CustomAction.RunResult(success=False)
            out_name = str(param.get("out", "icon_scan"))
            t0 = time.time()
            dets = scan_icons(img,
                              threshold=float(param.get("threshold", 0.55)),
                              trim=float(param.get("trim", 0.2)),
                              min_support=float(param.get("min_support", 0.5)),
                              keep_all_sizes=bool(param.get("keep_all_sizes", False)))
            DEBUG_DIR.mkdir(parents=True, exist_ok=True)
            jpath = DEBUG_DIR / f"{out_name}.json"
            ppath = DEBUG_DIR / f"{out_name}.png"
            with open(jpath, 'w', encoding='utf-8') as f:
                json.dump(dets, f, ensure_ascii=False, indent=2)
            annotate(img, dets, ppath)
            print(f"[IconScan] 识别 {len(dets)} 个目标, 耗时 {time.time() - t0:.0f}s")
            for d in dets:
                print("  %-28s score=%.3f sup=%.2f pos=(%4d,%4d) %dx%d [%s]"
                      % (d['name'], d['score'], d.get('support', 0),
                         d['x'], d['y'], d['w'], d['h'], d['level']))
            print(f"[IconScan] 结果: {jpath} / {ppath}")
            return CustomAction.RunResult(success=True)
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[IconScan] 异常: {e}")
            return CustomAction.RunResult(success=False)


@AgentServer.custom_action("IconList")
class IconList(CustomAction):
    """打印图库全部图标名。"""

    def run(self, context: Context, argv: CustomAction.RunArg) -> CustomAction.RunResult:
        icons = load_icons()
        print(f"[IconList] 共 {len(icons)} 个图标:")
        for n, img in icons:
            print(f"  {n} ({img.shape[1]}x{img.shape[0]})")
        return CustomAction.RunResult(success=True)
