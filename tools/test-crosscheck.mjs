#!/usr/bin/env node
// test-crosscheck.mjs — 差分对拍：独立算法路径复推四柱，与 engine.mjs 输出对照。
//
// 与引擎的算法差异（独立性的来源）：
//   日柱  引擎=lunar-javascript EightChar；本脚本=儒略日整数公式 (JDN+49)%60，
//         锚点 2000-01-01=戊午日（公开天文事实），与历法库完全无关。
//   时柱  引擎=EightChar；本脚本=五时遁公式（子时起干 = (日干序%5)*2）。
//   月柱  引擎=EightChar；本脚本=十二节时刻表判月支 + 五虎遁推月干。
//   年柱  引擎=EightChar；本脚本=立春时刻判年 + (年-4)%60 干支序公式。
// 复用 lunar-javascript 的部分：仅取节气/立春的天文时刻表（历法层，可信基座）。
//
// 用法：
//   node tools/test-crosscheck.mjs            # fixtures 33 例 + 随机 50 例差分
//   node tools/test-crosscheck.mjs --random   # 只跑随机差分
// 退出码：0=全绿，1=存在不一致。

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(import.meta.url);
let LJ;
try { LJ = require2('lunar-javascript'); }
catch (err) {
  throw new Error('Run `npm install` first — lunar-javascript is required. (' + err.message + ')');
}
const { Solar } = LJ;

const { computeBazi } = await import(path.join(ROOT, 'engine.mjs'));
const fixtures = (await import(path.join(ROOT, 'test-fixtures.json'), { with: { type: 'json' } })).default;

// ---------- 独立推导层 ----------
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const GANZHI60 = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);

// 儒略日数（格里历，正午起算的 JDN）
function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
// 锚点：2000-01-01 = 戊午（序 54）→ offset = 49
function dayGanzhi(y, m, d) { return GANZHI60[(jdn(y, m, d) + 49) % 60]; }
const ganzhiIndex = (gz) => GANZHI60.indexOf(gz);

// 时辰支：23:00–00:59 子、01–03 丑 …（含 23 点归子）
function branchIndexFromHour(h) { return Math.floor((h + 1) / 2) % 12; }
// 五时遁：时干 = ((日干序 % 5) * 2 + 时支序) % 10
function hourGan(dayGanIdx, branchIdx) { return STEMS[((dayGanIdx % 5) * 2 + branchIdx) % 10]; }
// 五虎遁：寅月干 = ((年干序 % 5) * 2 + 2) % 10；月干 = 寅月干 + (月支序 - 2 + 12) % 12
function monthGan(yearGanIdx, monthBranchIdx) {
  const yinGan = ((yearGanIdx % 5) * 2 + 2) % 10;
  return STEMS[(yinGan + ((monthBranchIdx - 2 + 12) % 12)) % 10];
}
// 年干支序：(立春后年份 - 4) % 60（1984=甲子）
function yearGanzhi(y) { return GANZHI60[(((y - 4) % 60) + 60) % 60]; }

// 中国夏令时官方逐年日期表（1986–1991，与引擎 v0.15.1 同源：国务院夏时制通告）
const CN_DST_RANGES = [
  [1986, 504, 914], [1987, 412, 913], [1988, 410, 911],
  [1989, 416, 917], [1990, 415, 916], [1991, 414, 915],
];

// 中国夏令时窗口（与引擎同一官方日期表口径）
function inCnDst(y, m, d) {
  const md = m * 100 + d;
  return CN_DST_RANGES.some(([yy, s, e]) => y === yy && md >= s && md <= e);
}

// 十二「节」→ 月支序（立春=寅=2 … 小寒=丑=1）
const JIE_TO_BRANCH = { '立春': 2, '惊蛰': 3, '清明': 4, '立夏': 5, '芒种': 6, '小暑': 7, '立秋': 8, '白露': 9, '寒露': 10, '立冬': 11, '大雪': 0, '小寒': 1 };

// 收集 [year-1, year+1] 范围内全部「节」事件（北京时刻）
const jieCache = new Map();
function jieEvents(bjYear) {
  if (jieCache.has(bjYear)) return jieCache.get(bjYear);
  const events = [];
  for (let y = bjYear - 1; y <= bjYear + 1; y++) {
    const lunar = Solar.fromYmd(y, 6, 1).getLunar();
    const table = lunar.getJieQiTable();
    for (const [name, solar] of Object.entries(table)) {
      if (!(name in JIE_TO_BRANCH)) continue;
      events.push({
        name,
        year: solar.getYear(),
        branch: JIE_TO_BRANCH[name],
        t: Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()),
      });
    }
  }
  events.sort((a, b) => a.t - b.t);
  jieCache.set(bjYear, events);
  return events;
}

// 独立复推四柱（与引擎同一套「已声明约定」，不同算法路径）
function independentBazi(input) {
  const { year, month, day, hour, minute = 0, longitude, tzOffsetHours, unknownTime = false, sect = 1 } = input;
  // 1) 钟表时间：夏令时还原为标准时（正确跨日回滚）
  let cy = year, cm = month, cd = day, ch = hour, cmin = minute, dstApplied = false;
  if (!unknownTime && ch != null && inCnDst(cy, cm, cd)) { ch -= 1; dstApplied = true; if (ch < 0) { ch += 24; cd -= 1; } }
  // 2) 绝对时刻 → 北京时间（年/月柱轨道：节气是天文事件）
  const tzOff = tzOffsetHours;
  const bjMs = Date.UTC(cy, cm - 1, cd, ch == null ? 12 : ch, cmin) - tzOff * 3600000 + 8 * 3600000;
  const bj = new Date(bjMs);
  // 3) 年柱：最近一个已过的立春所属公历年，即干支年
  const yBase = bj.getUTCFullYear();
  const events = jieEvents(yBase);
  let lichunYear = null;
  for (const e of events) { if (e.name === '立春' && e.t <= bjMs) lichunYear = e.year; }
  if (lichunYear == null) {
    for (const e of jieEvents(yBase - 1)) { if (e.name === '立春' && e.t <= bjMs) lichunYear = e.year; }
  }
  const yz = yearGanzhi(lichunYear);
  // 4) 月柱：最近一个已过的「节」定月支，五虎遁定月干
  let cur = null;
  for (const e of events) { if (e.t <= bjMs) cur = e; else break; }
  if (cur == null) {
    for (const e of jieEvents(yBase - 1)) { if (e.t <= bjMs) cur = e; else break; }
  }
  const yIdx = GANZHI60.indexOf(yz) % 10;
  const mBranch = cur.branch;
  const monthGz = monthGan(yIdx, mBranch) + BRANCHES[mBranch];
  // 5) 日柱轨道：出生地真太阳时
  let tY = cy, tM = cm, tD = cd, tH = ch, tMin = cmin;
  if (!unknownTime && ch != null && longitude != null) {
    const central = tzOff * 15;
    const shiftMin = (longitude - central) * 4; // 秒级精度，不做分钟取整（避免在时辰边界翻转）
    const t = new Date(Date.UTC(tY, tM - 1, tD, tH, tMin, 0) + shiftMin * 60000);
    tY = t.getUTCFullYear(); tM = t.getUTCMonth() + 1; tD = t.getUTCDate(); tH = t.getUTCHours(); tMin = t.getUTCMinutes();
  }
  let dayIdxBranchShift = 0;
  let hBranch = null, hGz = null;
  if (!unknownTime && ch != null) {
    if (tH >= 23) {
      // sect1 换日派：日柱进次日，时柱按次日日干起遁
      // sect2 夜子时派（lunar-javascript 流派2）：日柱归当天，时柱取次日日干起遁
      if (sect === 1) dayIdxBranchShift = 1;
      else dayIdxBranchShift = 1; // 时柱日干基准：两派都用次日，仅日柱不同
      hBranch = 0;
    } else hBranch = branchIndexFromHour(tH);
  }
  const dJdn = jdn(tY, tM, tD) + (sect === 1 ? dayIdxBranchShift : 0);
  const dz = dayGanzhiByJdn(dJdn);
  if (hBranch != null) {
    const hourBaseJdn = jdn(tY, tM, tD) + dayIdxBranchShift;
    const dGanIdx = GANZHI60.indexOf(dayGanzhiByJdn(hourBaseJdn)) % 10;
    hGz = hourGan(dGanIdx, hBranch) + BRANCHES[hBranch];
  }
  return {
    year: yz, month: monthGz,
    day: dz, time: unknownTime || ch == null ? null : hGz,
    meta: { dstApplied, bjIso: bj.toISOString(), tst: { y: tY, m: tM, d: tD, h: tH, min: tMin } },
  };
}
function ganzhiIndexByStemBranch(s, b) { return (STEMS.indexOf(s) % 5) * 0 + GANZHI60.findIndex(g => g[0] === s && g[1] === b); }
function dayGanzhiByJdn(j) { return GANZHI60[(((j + 49) % 60) + 60) % 60]; }

// ---------- 对拍 ----------
function compare(input, label) {
  const eng = computeBazi(input);
  const ind = independentBazi(input);
  const e = [eng.pillars.year.ganzhi, eng.pillars.month.ganzhi, eng.pillars.day.ganzhi, eng.pillars.time ? eng.pillars.time.ganzhi : null];
  const i = [ind.year, ind.month, ind.day, ind.time];
  const diffs = [];
  ['年', '月', '日', '时'].forEach((p, k) => {
    if ((e[k] || null) !== (i[k] || null)) diffs.push(`${p}柱 引擎=${e[k]} 独立=${i[k]}`);
  });
  return { label, input, e, i, diffs, eng };
}

let pass = 0, fail = 0;
const failures = [];

function report(r) {
  if (r.diffs.length === 0) { pass++; return true; }
  fail++;
  failures.push(r);
  const inp = r.input;
  console.log(`✗ [${r.label}] ${inp.year}-${inp.month}-${inp.day} ${inp.hour == null ? '?' : String(inp.hour).padStart(2, '0') + ':' + String(inp.minute).padStart(2, '0')} lon=${inp.longitude} tz=${inp.tzOffsetHours} sect=${inp.sect}`);
  r.diffs.forEach(d => console.log('    ' + d));
  return false;
}

console.log('== 锚点自检 ==');
const anchor = dayGanzhi(2000, 1, 1);
console.log(`2000-01-01 → ${anchor}（应为 戊午）${anchor === '戊午' ? '✓' : '✗ 公式错误！'}`);
if (anchor !== '戊午') process.exit(1);
// 二次锚点：1986-04-21 应为乙未（与引擎一致，且与万年历公开数据一致）
const anchor2 = dayGanzhi(1986, 4, 21);
console.log(`1986-04-21 → ${anchor2}（应为 乙未）${anchor2 === '乙未' ? '✓' : '✗'}`);

if (!process.argv.includes('--random')) {
  console.log('\n== fixtures 33 例对拍 ==');
  for (const c of fixtures.cases) {
    report(compare(c.result.input, c.name));
  }
}

console.log('\n== 随机 50 例差分（确定性种子）==');
let seed = 20260921;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const TZS = [-8, -5, 0, 1, 5.5, 8, 9, 10];
for (let k = 0; k < 50; k++) {
  const y = 1950 + Math.floor(rnd() * 76);
  const m = 1 + Math.floor(rnd() * 12);
  const d = 1 + Math.floor(rnd() * 28);
  const h = Math.floor(rnd() * 24);
  const mi = Math.floor(rnd() * 60);
  let lon, tz;
  const pick = rnd();
  if (pick < 0.55) { tz = 8; lon = 80 + rnd() * 50; }             // 国内：新疆~黑龙江
  else if (pick < 0.7 && y >= 1986 && y <= 1991) { tz = 8; lon = 100 + rnd() * 26; } // DST 窗口加权
  else { tz = TZS[Math.floor(rnd() * TZS.length)]; lon = tz * 15 + (rnd() * 14 - 7); } // 海外
  const sect = rnd() < 0.5 ? 1 : 2;
  report(compare({ year: y, month: m, day: d, hour: h, minute: mi, longitude: +lon.toFixed(2), tzOffsetHours: tz, sect }, `rand-${k + 1}`));
}

console.log(`\n== 结果：一致 ${pass} / 不一致 ${fail} ==`);
if (fail > 0) {
  console.log('不一致用例需逐条归因：流派分歧 / 历法口径 / 真 bug');
  process.exit(1);
}
console.log('CROSSCHECK ALL GREEN ✓');
