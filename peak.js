/* dsh-perfect-ui — DeepSeek 峰谷时段计算（纯本地，无网络依赖）

   ---- 规则来源（官方文档确证，非猜测）----
   https://api-docs.deepseek.com/quick_start/pricing
   原文：Off-peak rates are half of the peak rates. Peak hours are
         01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday,
         excluding Chinese public holidays. All other hours are off-peak,
         including weekends and Chinese public holidays in full.

   换算成北京时间（UTC+8，全年无夏令时）：
     01:00-04:00 UTC -> 09:00-12:00 CST
     06:00-10:00 UTC -> 14:00-18:00 CST
   即峰时 = 工作日 09:00-12:00 与 14:00-18:00，其余全为闲时。

   ---- 为什么内置节假日表而不是联网取 ----
   官方规则明确「排除中国法定节假日」，若只按周末判断，在春节/国庆等
   长假期间会把整天算成峰时 —— 那是错的。但客户端插件不应在渲染路径里
   发起网络请求（拖慢、失败、隐私），所以把国家公布的放假安排内置成
   一张小表，每年更新一次即可。表覆盖 2025–2026（已公布），
   超出范围时按「仅周末+时段」降级，并在界面上注明依据。

   ---- 数据来源 ----
   国务院办公厅放假通知（gov.cn），经 china-holiday-calender 汇总核对。
   2025 与 2026 两张表由该 ICS 日历逐条比对生成。
*/

function PU_peak(/* 无状态，纯函数集合 */) {
  'use strict';

  /* 法定节假日（放假当天，全天按闲时计）。
     只列「不工作的日子」；调休上班日另列 compensated。 */
  var HOLIDAYS = {
    /* 2025 */
    '2025-01-01': '元旦',
    '2025-01-28': '春节', '2025-01-29': '春节', '2025-01-30': '春节', '2025-01-31': '春节',
    '2025-02-01': '春节', '2025-02-02': '春节', '2025-02-03': '春节', '2025-02-04': '春节',
    '2025-04-04': '清明', '2025-04-05': '清明', '2025-04-06': '清明',
    '2025-05-01': '劳动节', '2025-05-02': '劳动节', '2025-05-03': '劳动节',
    '2025-05-04': '劳动节', '2025-05-05': '劳动节',
    '2025-06-02': '端午',
    '2025-10-01': '国庆', '2025-10-02': '国庆', '2025-10-03': '国庆', '2025-10-04': '国庆',
    '2025-10-05': '国庆', '2025-10-06': '国庆', '2025-10-07': '国庆', '2025-10-08': '国庆',
    /* 2026 */
    '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
    '2026-02-15': '春节', '2026-02-16': '春节', '2026-02-17': '春节', '2026-02-18': '春节',
    '2026-02-19': '春节', '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节',
    '2026-02-23': '春节',
    '2026-04-04': '清明', '2026-04-05': '清明', '2026-04-06': '清明',
    '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节',
    '2026-05-04': '劳动节', '2026-05-05': '劳动节',
    '2026-06-19': '端午', '2026-06-20': '端午', '2026-06-21': '端午',
    '2026-09-25': '中秋', '2026-09-26': '中秋', '2026-09-27': '中秋',
    '2026-10-01': '国庆', '2026-10-02': '国庆', '2026-10-03': '国庆', '2026-10-04': '国庆',
    '2026-10-05': '国庆', '2026-10-06': '国庆', '2026-10-07': '国庆',
  };

  /* 调休上班日（原本是周末但要点上班 → 峰时规则照常生效） */
  var COMPENSATED = {
    '2025-01-26': 1, '2025-02-08': 1, '2025-04-27': 1, '2025-05-11': 1, '2025-09-29': 1, '2025-10-12': 1,
    '2026-01-04': 1, '2026-02-14': 1, '2026-02-28': 1, '2026-05-09': 1, '2026-09-20': 1, '2026-10-10': 1,
  };

  /* 峰时段（北京时间，单位：分钟从 0 点起） */
  var PEAK_WINDOWS = [
    [9 * 60, 12 * 60],    /* 09:00-12:00 CST */
    [14 * 60, 18 * 60],   /* 14:00-18:00 CST */
  ];

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dateKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* 该日期是否属于「工作日」（峰时规则只在工作日生效） */
  function isWorkday(d) {
    var key = dateKey(d);
    if (COMPENSATED[key]) return true;
    if (HOLIDAYS[key]) return false;
    var wd = d.getDay();            /* 0=周日, 6=周六 */
    return wd >= 1 && wd <= 5;
  }

  /* 该时刻是否在峰时 */
  function isPeakAt(d) {
    if (!isWorkday(d)) return false;
    var mins = d.getHours() * 60 + d.getMinutes();
    for (var i = 0; i < PEAK_WINDOWS.length; i++) {
      if (mins >= PEAK_WINDOWS[i][0] && mins < PEAK_WINDOWS[i][1]) return true;
    }
    return false;
  }

  /* 从 from 起找下一个「状态翻转」的时刻（分钟精度）。
     返回 { at: Date, toPeak: bool }，找不到返回 null。

     两处关键点：
     ① 上限必须是「最长假期」而不是 8 天 —— 春节连续闲时可超过 8 天
        （如 2025-01-27 18:00 → 2025-02-05 09:00 间隔 12420 分钟 > 11520），
        原 8 天上限会让 nextAt 返回 null，界面上「剩余 x 时 x 分」和
        「xx 转峰时」整行信息消失。放宽到 20 天。
     ② 跳跃式扫描：峰时窗口固定在 [540,720] 和 [840,1080] 两个区间，
        所以翻转只可能发生在这些边界（540/720/840/1080）或跨日（00:00）。
        非工作日直接跳到次日 00:00；工作日内把当前分钟跳到「下一个候选边界」。
        这样无论多长的假期，循环次数都是个位数量级，不再逐分钟扫。 */
  var CANDIDATE_BOUNDARIES = [0, 540, 720, 840, 1080, 1440];  /* 分钟，1440 = 次日 00:00 */
  function nextBoundary(from) {
    var cur = new Date(from.getTime());
    var wasPeak = isPeakAt(from);
    var guard = 40;   /* 跳跃式扫描下 40 次足够跨越任何假期，纯粹防死循环 */

    while (guard-- > 0) {
      /* 统一按「当前日期 + 下一个候选边界」推进，天然跳过无关分钟。 */
      var mins = cur.getHours() * 60 + cur.getMinutes();
      var nextMin = 1440;
      for (var i = 0; i < CANDIDATE_BOUNDARIES.length; i++) {
        if (CANDIDATE_BOUNDARIES[i] > mins) { nextMin = CANDIDATE_BOUNDARIES[i]; break; }
      }
      var probe = new Date(cur.getTime());
      probe.setHours(0, nextMin, 0, 0);   /* nextMin=1440 会自动进位到次日 00:00 */
      /* 非工作日：峰时窗口不跨午夜，当天不可能翻转，直接跳到次日 00:00 之后。 */
      if (!isWorkday(probe) || nextMin === 1440) {
        var dayStart = new Date(cur.getTime());
        dayStart.setHours(24, 0, 0, 0);
        probe = dayStart;
        if (isPeakAt(probe) !== wasPeak) return { at: new Date(probe.getTime()), toPeak: isPeakAt(probe) };
        cur = new Date(probe.getTime());
        cur.setMinutes(cur.getMinutes() + 1);   /* 越过午夜整点，避免原地打转 */
        continue;
      }
      if (isPeakAt(probe) !== wasPeak) return { at: new Date(probe.getTime()), toPeak: isPeakAt(probe) };
      cur = new Date(probe.getTime());
    }
    return null;
  }

  /* 面向界面的摘要：
       { peak: bool, label: '闲时'|'峰时',
         nextAt: Date|null, nextToPeak: bool,
         remainMs: number, reason: string }
     reason 说明判定依据（节假日 / 周末 / 时段 / 超出表范围降级）。 */
  function status(now) {
    var d = now || new Date();
    var key = dateKey(d);
    var peak = isPeakAt(d);
    var nb = nextBoundary(d);
    var reason = '';
    if (HOLIDAYS[key]) reason = HOLIDAYS[key] + '假期';
    else if (COMPENSATED[key]) reason = '调休上班';
    else if (isWorkday(d)) reason = '工作日';
    else reason = d.getDay() === 0 ? '周日' : '周六';

    /* 表覆盖范围检查：超出则如实标注 */
    var y = d.getFullYear();
    if (y < 2025 || y > 2026) reason += '（节假日表未覆盖本年度，仅按周末判断）';

    return {
      peak: peak,
      label: peak ? '峰时' : '闲时',
      nextAt: nb ? nb.at : null,
      nextToPeak: nb ? nb.toPeak : false,
      reason: reason,
    };
  }

  /* 把毫秒差格式化成「x 小时 y 分」，不足 1 分钟显示「不足 1 分」 */
  function humanRemain(ms) {
    if (ms <= 0) return '不足 1 分';
    var totalMin = Math.floor(ms / 60000);
    if (totalMin < 1) return '不足 1 分';
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h <= 0) return m + ' 分';
    if (m === 0) return h + ' 小时';
    return h + ' 小时 ' + m + ' 分';
  }

  return {
    isWorkday: isWorkday,
    isPeakAt: isPeakAt,
    nextBoundary: nextBoundary,
    status: status,
    humanRemain: humanRemain,
    PEAK_WINDOWS: PEAK_WINDOWS,
  };
}
