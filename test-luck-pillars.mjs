// ============================================================
// 大运引擎回归测试
//
// 三层独立校验：
//   L1 数学层：传统「时辰块法」与线性比例尺的误差必须 < 1 日 + 1 时辰块；
//              整倍数区间必须与线性比例尺精确相等；精确法必须恒等于 sec/720。
//   L2 权威层：与历法库 lunar-javascript 内置 getYun() 逐项对账（顺逆、起运
//              岁数、交运日、十步大运干支、虚岁、起始年、十二长生）。库把
//              23:00–23:59 归进亥时（其内部 timeZhiIndex 却写子），本引擎按
//              23:00 为子时边界计——凡端点落在 23 点档的用例单列为「已公开分歧」，
//              并要求差值恰好是一个时辰块（10 起运日），不许出现第三种偏差。
//   L3 真值层：顺逆真值表 20 组、时辰块编号 24 小时全覆盖、藏干表 12 支逐支核对。
// ============================================================
import { createRequire } from 'node:module';
import {
  computeLuckPillars, luckDirection, luckStartTraditional, luckStartPrecise,
  twelveStage, zhiBlockIndex, zhiBlockOf, JIAZI, BRANCH_HIDE_GAN, JIE_EN
} from './engine.mjs';

const require = createRequire(import.meta.url);
let Solar;
try {
  ({ Solar } = require('lunar-javascript'));
} catch (err) {
  throw new Error('Run `npm install` first — lunar-javascript is required. (' + err.message + ')');
}

let pass = 0, fail = 0; const failures = [];
const ok = (cond, msg) => { if (cond) pass++; else { fail++; failures.push(msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg} — 期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}`);

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const p2 = n => String(n).padStart(2, '0');

// ---------- L3-1 顺逆真值表：10 天干 × 2 性别 = 20 ----------
console.log('L3-1 顺逆真值表');
for (let i = 0; i < 10; i++) {
  const yang = i % 2 === 0;
  for (const gender of [1, 0]) {
    const d = luckDirection(STEMS[i], gender);
    eq(d.forward, (yang && gender === 1) || (!yang && gender === 0), `年干 ${STEMS[i]}(${yang ? '阳' : '阴'}) ${gender === 1 ? '男' : '女'} 顺逆`);
  }
}

// ---------- L3-2 时辰块编号：24 小时全覆盖 ----------
console.log('L3-2 时辰块编号');
const EXPECT_BLOCK = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 0];
for (let h = 0; h < 24; h++) eq(zhiBlockIndex(h), EXPECT_BLOCK[h], `${p2(h)}:xx 的时辰块`);
eq(zhiBlockOf(23).zhi, '子', '23 点归子时（本引擎约定）');
eq(zhiBlockOf(0).zhi, '子', '0 点归子时');
eq(zhiBlockOf(11).zhi, '午', '11 点归午时');

// ---------- L3-3 藏干表：12 支逐支与历法库核对 ----------
// 年支随年号走：(Y−4) mod 12 = 目标支序号，直接问历法库的年柱藏干
console.log('L3-3 藏干表（12 支逐支）');
for (let bi = 0; bi < 12; bi++) {
  let Y = 1991;
  while (((Y - 4) % 12 + 12) % 12 !== bi) Y++;
  const ec = Solar.fromYmdHms(Y, 6, 15, 12, 0, 0).getLunar().getEightChar();
  eq(ec.getYear()[1], BRANCHES[bi], `年支取样应落在 ${BRANCHES[bi]}`);
  eq(BRANCH_HIDE_GAN[BRANCHES[bi]].join(''), ec.getYearHideGan().join(''), `${BRANCHES[bi]} 藏干顺序`);
}

// ---------- L1-1 传统时辰块法：与线性比例尺的误差上界 ----------
// 比例尺 = 3 日 = 1 岁，即 1 日 = 120 起运日、2 小时 = 10 起运日。传统法把时间
// 切成「整数日 + 时辰块」，最坏偏差 = 1 日(120) + 1 个时辰块(10) = 130 起运日。
console.log('L1-1 传统时辰块法 · 线性比例尺误差上界');
let maxErr = 0, worst = null;
for (let trial = 0; trial < 3000; trial++) {
  const a = { y: 1950 + (trial % 80), m: 1 + (trial % 12), d: 1 + (trial % 28), h: (trial * 7) % 24, mi: (trial * 13) % 60 };
  const gapMin = 60 + (trial * 977) % (20 * 1440);
  const endMs = Date.UTC(a.y, a.m - 1, a.d, a.h, a.mi) + gapMin * 60000;
  const bd = new Date(endMs);
  const b = { y: bd.getUTCFullYear(), m: bd.getUTCMonth() + 1, d: bd.getUTCDate(), h: bd.getUTCHours(), mi: bd.getUTCMinutes() };
  const mine = luckStartTraditional(a, b);
  const linear = (endMs - Date.UTC(a.y, a.m - 1, a.d, a.h, a.mi)) / 1000 / 720;   // 1 起运日 = 12 分钟
  const err = Math.abs(mine.offsetDays - linear);
  if (err > maxErr) { maxErr = err; worst = `${JSON.stringify(a)}→${JSON.stringify(b)} 传统 ${mine.offsetDays} / 线性 ${linear.toFixed(2)}`; }
  ok(err <= 130.0001, `误差上界 ${JSON.stringify(a)}→${JSON.stringify(b)}: ${err.toFixed(2)} 起运日`);
}
console.log(`  最大偏差 ${maxErr.toFixed(2)} 起运日（上界 130）；最差样例 ${worst}`);

// ---------- L1-2 整倍数区间必须精确等于线性比例尺 ----------
console.log('L1-2 整倍数区间精确性');
for (let n = 1; n <= 15; n++) {
  for (const extraH of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]) {
    const a = { y: 1990, m: 3, d: 5, h: 5, mi: 0 };            // 05:00 恰在时辰边界上
    const endMs = Date.UTC(a.y, a.m - 1, a.d, a.h, a.mi) + n * 1440 * 60000 + extraH * 3600000;
    const bd = new Date(endMs);
    const b = { y: bd.getUTCFullYear(), m: bd.getUTCMonth() + 1, d: bd.getUTCDate(), h: bd.getUTCHours(), mi: bd.getUTCMinutes() };
    const mine = luckStartTraditional(a, b);
    eq(mine.offsetDays, n * 120 + extraH * 5, `整倍数 ${n}日+${extraH}h`);   // 1 日=120 起运日，2 小时=10
  }
}

// ---------- L1-3 精确法 = 秒数 ÷ 720 ----------
console.log('L1-3 精确法解析式');
for (const sec of [0, 1, 29, 30, 719, 720, 721, 21600, 259200, 259201, 1000000, 1234567]) {
  const p = luckStartPrecise(sec);
  ok(Math.abs(p.offsetDays - sec / 720) < 1e-9, `精确法 ${sec}s: ${p.offsetDays} vs ${sec / 720}`);
}

// ---------- L2 与历法库 getYun 逐项对账 ----------
console.log('L2 与历法库 getYun 对账');
const CASES = [
  [1991, 3, 23, 11, 0], [1991, 3, 23, 17, 30], [1988, 6, 1, 10, 0], [2000, 1, 1, 0, 30],
  [2000, 2, 4, 20, 0], [1976, 9, 9, 12, 30], [1955, 3, 15, 8, 20], [2010, 12, 31, 22, 0],
  [1968, 6, 6, 6, 6], [1993, 7, 7, 15, 30], [2020, 5, 20, 5, 0], [1984, 2, 5, 1, 15],
  [1949, 10, 1, 15, 0], [2008, 8, 8, 20, 8], [2016, 2, 4, 17, 46], [1997, 7, 1, 9, 45],
  [1962, 12, 22, 23, 0], [2003, 3, 6, 13, 20], [1971, 11, 11, 11, 11], [2030, 6, 15, 4, 0],
  [1996, 4, 4, 23, 40], [2005, 8, 7, 19, 0], [2014, 9, 23, 3, 30], [1965, 5, 5, 23, 59]
];
let compared = 0; const diverged = [];
for (const [y, m, d, h, mi] of CASES) {
  for (const gender of [1, 0]) {
    const run = computeLuckPillars({ year: y, month: m, day: d, hour: h, minute: mi, longitude: null, tzOffsetHours: 8, gender });
    const bj = run.instant.birthBeijing;                       // 夏令时已还原的绝对时刻
    const lunar = Solar.fromYmdHms(+bj.slice(0, 4), +bj.slice(5, 7), +bj.slice(8, 10), +bj.slice(11, 13), +bj.slice(14, 16), 0).getLunar();
    const yun = lunar.getEightChar().getYun(gender);
    const tag = `${y}-${p2(m)}-${p2(d)} ${p2(h)}:${p2(mi)} ${gender === 1 ? 'M' : 'F'}`;

    eq(run.direction.forward, yun.isForward(), `${tag} 顺逆`);

    const libOffset = yun.getStartYear() * 360 + yun.getStartMonth() * 30 + yun.getStartDay();
    const diff = run.start.traditional.offsetDays - libOffset;
    // 端点落在 23:00–23:59 时，库少算一个时辰块
    const inZi = run.instant.birthLocal.includes(' 23:') || run.instant.jie.local.includes(' 23:');
    if (inZi) {
      ok(Math.abs(diff) === 10 || diff === 0, `${tag} 23 点档分歧应为 0 或 10 起运日，实得 ${diff}`);
      diverged.push(`${tag} 差 ${diff} 起运日`);
    } else {
      eq(diff, 0, `${tag} 起运岁数（本引擎 ${run.start.traditional.offsetDays} vs 库 ${libOffset} = ${yun.getStartYear()}y${yun.getStartMonth()}m${yun.getStartDay()}d）`);
      eq(`${run.start.traditional.years}y${run.start.traditional.months}m${run.start.traditional.days}d`,
        `${yun.getStartYear()}y${yun.getStartMonth()}m${yun.getStartDay()}d`, `${tag} y/m/d 分解`);
      eq(run.start.startDate, yun.getStartSolar().toYmd(), `${tag} 交运日期`);
    }

    const dy = yun.getDaYun(11);
    for (let i = 1; i <= 10; i++) {
      eq(run.pillars[i - 1].ganzhi, dy[i].getGanZhi(), `${tag} 第${i}步大运干支`);
      // 干支序列只由顺逆 + 月柱决定，任何时候都必须一致；
      // 年份/虚岁由起运日决定，23 点档用例的起运日相差 10 天，可能跨年，故不比对。
      if (!inZi) {
        eq(run.pillars[i - 1].startYear, dy[i].getStartYear(), `${tag} 第${i}步起始年`);
        eq(run.pillars[i - 1].startAgeSui, dy[i].getStartAge(), `${tag} 第${i}步起始虚岁`);
      }
    }
    const ec = lunar.getEightChar();
    for (const [key, libStage] of [['year', ec.getYearDiShi()], ['month', ec.getMonthDiShi()], ['day', ec.getDayDiShi()], ['time', ec.getTimeDiShi()]]) {
      const gz = { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() }[key];
      eq(twelveStage(ec.getDayGan(), gz[1]).stage, libStage, `${tag} ${key}柱十二长生`);
    }
    compared++;
  }
}
console.log(`  逐项对账 ${compared} 组；其中 ${diverged.length} 组落在 23 点档（已公开分歧）：${diverged.slice(0, 3).join(' / ')}${diverged.length > 3 ? ' …' : ''}`);

// ---------- L2b 大运柱内部自洽 ----------
console.log('L2b 大运柱内部自洽');
{
  const run = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1 });
  eq(run.pillars.length, 10, '默认产出 10 步大运');
  eq(run.pillars[0].ganzhi, '庚寅', '辛卯逆排第一步应为庚寅');
  eq(run.pillars[1].ganzhi, '己丑', '第二步己丑');
  eq(run.pillars[0].startDate, '1996-12-03', '第一步交运日');
  eq(run.start.startDate, '1996-12-03', '起运日与第一步交运日一致');
  eq(run.instant.jie.name, '惊蛰', '逆排量到上一个节（惊蛰）');
  eq(run.instant.jie.direction, 'previous', '节气取向前一档');
  for (let i = 1; i < run.pillars.length; i++) {
    const prev = run.pillars[i - 1], cur = run.pillars[i];
    eq(cur.startYear - prev.startYear, 10, `第${i + 1}步与上一步相隔 10 年`);
    eq(cur.startAgeSui - prev.startAgeSui, 10, `第${i + 1}步虚岁间隔`);
    eq(JIAZI.indexOf(cur.ganzhi), (JIAZI.indexOf(prev.ganzhi) + 59) % 60, `逆排干支回退一位`);
    eq(cur.startDate, prev.endDate, `第${i + 1}步交运日 = 上一步截止日`);
  }
  ok(run.pillars[0].stemTenGod && run.pillars[0].stemTenGod.god.length === 2, '大运天干带十神');
  ok(run.pillars[0].branchTenGod && run.pillars[0].branchTenGod.god.length === 2, '大运地支本气带十神');
  ok(run.pillars[0].hideGan.length >= 1, '大运地支带藏干');
  ok(run.pillars[0].stage && run.pillars[0].stage.length >= 1, '大运地支带十二长生');
}

// ---------- L2c 顺排 / 女命 / 当前柱 ----------
console.log('L2c 顺排 / 女命 / 当前柱');
{
  const f = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 0 });
  eq(f.direction.forward, true, '1991 辛未年（阴年）女命应顺排');
  eq(f.pillars[0].ganzhi, '壬辰', '顺排第一步应为月柱进一位壬辰');
  eq(f.instant.jie.name, '清明', '顺排量到下一个节（清明）');
  const d = Solar.fromYmdHms(1991, 3, 23, 11, 0, 0).getLunar().getEightChar().getYun(0);
  eq(f.start.traditional.offsetDays, d.getStartYear() * 360 + d.getStartMonth() * 30 + d.getStartDay(), '女命起运岁数与历法库一致');

  // 当前柱按精确交运日判定：第 3 步 2016-12-03 起、第 4 步 2026-12-03 交运，
  // 所以 2026-09-17 仍在第 3 步——而按「大运年份 2026–2035」的习惯标签会说是第 4 步。
  // 这与绝大多数 App 的日历口径不同，页面把两者都摆出来，这里锁死精确口径。
  const now = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1, today: '2026-09-17' });
  eq(now.current.index, 3, '2026-09-17（第 4 步 12-03 才交运）应仍处于第 3 步');
  eq(now.current.pill.ganzhi, '戊子', '2026-09-17 在戊子运');
  eq(now.pillars[3].startDate, '2026-12-03', '第 4 步精确交运日');
  const after = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1, today: '2027-01-01' });
  eq(after.current.index, 4, '跨过 2026-12-03 后进入第 4 步');
  eq(after.current.pill.ganzhi, '丁亥', '2027 年在丁亥运');
  eq(now.current.pill.isCurrent, true, '当前柱有标记');
  eq(now.pillars.filter(p => p.isCurrent).length, 1, '只有一个当前柱');
  const before = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1, today: '1993-01-01' });
  eq(before.current.index, 0, '未起运时 index 为 0');
  eq(before.current.pill, null, '未起运时当前柱为空');
}

// ---------- L2d 未知时辰：起运成区间，大运序列不变 ----------
console.log('L2d 未知时辰');
{
  const a = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: null, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1, unknownTime: true });
  const b = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 23, minute: 59, longitude: null, tzOffsetHours: 8, gender: 1 });
  ok(a.unknownTime !== null, '未知时辰应产出区间');
  ok(a.unknownTime.low.traditional.offsetDays <= a.unknownTime.high.traditional.offsetDays, '区间下界 ≤ 上界');
  eq(a.pillars[0].ganzhi, b.pillars[0].ganzhi, '起运区间不影响第一步大运干支');
  eq(a.unknownTime.high.traditional.offsetDays, b.start.traditional.offsetDays, '区间上界 = 当日 23:59 的结果');
  ok(a.unknownTime.windowStart.endsWith('00:00') && a.unknownTime.windowEnd.endsWith('23:59'), '区间覆盖整日');
  ok(a.unknownTime.high.traditional.offsetDays - a.unknownTime.low.traditional.offsetDays <= 120, '一日之内的起运跨度不超过 4 个月');
}

// ---------- L2e 出生地框架 ----------
console.log('L2e 出生地框架');
{
  const nyc = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: -74.01, tzOffsetHours: -5, gender: 1 });
  const bj = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1 });
  eq(nyc.instant.frameShiftMinutes, (-5 - 8) * 60, 'civil 框架位移 = (时区偏移−8)×60');
  eq(nyc.instant.birthLocal, '1991-03-23 11:00', 'civil 框架下出生地钟面 = 录入值');
  ok(nyc.start.traditional.offsetDays !== bj.start.traditional.offsetDays, '纽约与北京同日同时但绝对时刻不同，起运应不同');
  const ts = computeLuckPillars({ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: -74.01, tzOffsetHours: -5, gender: 1, frame: 'true-solar' });
  eq(ts.instant.frameShiftMinutes, (-5 - 8) * 60 + ts.instant.trueSolarOffsetMinutes, 'true-solar 框架位移含经度项');
  ok(ts.frameAlt && ts.frameAlt.frame === 'civil', '另一框架作为敏感性对照给出');
  ok(ts.sensitivity && ts.sensitivity.minus1 && ts.sensitivity.plus1, '±1 小时敏感性给出');
}

console.log('');
if (failures.length) {
  console.log(`--- 失败明细（前 25 条 / 共 ${failures.length}）---`);
  for (const f of failures.slice(0, 25)) console.log('  ✗ ' + f);
}
console.log(`大运引擎: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
console.log('ALL GREEN ✓ 大运引擎三层校验全通过');
