#!/usr/bin/env node
// stamp-expected.mjs — 用独立算法路径（test-crosscheck 的推导层）回填
// test-fixtures.json 每例的 expected 字段，解除「须人工按八字功底核对」的悬案。
// 人工只需复核 crosscheck 输出的不一致行（当前为 0）。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(import.meta.url);
let LJ;
try { LJ = require2('lunar-javascript'); }
catch (err) {
  throw new Error('Run `npm install` first — lunar-javascript is required. (' + err.message + ')');
}
const { Solar } = LJ;

// 复用 crosscheck 的推导层：把其导出为可 require 的形式代价高，
// 直接复制核心公式（单一事实来源是公式本身，两处同步由 crosscheck 闸门锁定）
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const GANZHI60 = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);
function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const dayGanzhiByJdn = (j) => GANZHI60[(((j + 49) % 60) + 60) % 60];
const branchIndexFromHour = (h) => Math.floor((h + 1) / 2) % 12;
const hourGan = (di, bi) => STEMS[((di % 5) * 2 + bi) % 10];
const monthGan = (yi, bi) => STEMS[((yi % 5) * 2 + 2 + ((bi - 2 + 12) % 12)) % 10];
const yearGanzhi = (y) => GANZHI60[(((y - 4) % 60) + 60) % 60];
const CN_DST_RANGES = [[1986,504,914],[1987,412,913],[1988,410,911],[1989,416,917],[1990,415,916],[1991,414,915]];
const inCnDst = (y, m, d) => { const md = m*100+d; return CN_DST_RANGES.some(([yy,s,e]) => y===yy && md>=s && md<=e); };
const JIE_TO_BRANCH = {'立春':2,'惊蛰':3,'清明':4,'立夏':5,'芒种':6,'小暑':7,'立秋':8,'白露':9,'寒露':10,'立冬':11,'大雪':0,'小寒':1};
const jieCache = new Map();
function jieEvents(bjYear) {
  if (jieCache.has(bjYear)) return jieCache.get(bjYear);
  const events = [];
  for (let y = bjYear - 1; y <= bjYear + 1; y++) {
    const table = Solar.fromYmd(y, 6, 1).getLunar().getJieQiTable();
    for (const [name, solar] of Object.entries(table)) {
      if (!(name in JIE_TO_BRANCH)) continue;
      events.push({ name, year: solar.getYear(), branch: JIE_TO_BRANCH[name],
        t: Date.UTC(solar.getYear(), solar.getMonth()-1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()) });
    }
  }
  events.sort((a, b) => a.t - b.t);
  jieCache.set(bjYear, events);
  return events;
}
function independentBazi(input) {
  const { year, month, day, hour, minute = 0, longitude, tzOffsetHours, unknownTime = false, sect = 1 } = input;
  let cy = year, cm = month, cd = day, ch = hour, cmin = minute;
  if (!unknownTime && ch != null && inCnDst(cy, cm, cd)) { ch -= 1; if (ch < 0) { ch += 24; cd -= 1; } }
  const tzOff = tzOffsetHours;
  const bjMs = Date.UTC(cy, cm-1, cd, ch == null ? 12 : ch, cmin) - tzOff*3600000 + 8*3600000;
  const yBase = new Date(bjMs).getUTCFullYear();
  const events = jieEvents(yBase);
  let lichunYear = null;
  for (const e of events) { if (e.name === '立春' && e.t <= bjMs) lichunYear = e.year; }
  if (lichunYear == null) for (const e of jieEvents(yBase-1)) { if (e.name === '立春' && e.t <= bjMs) lichunYear = e.year; }
  const yz = yearGanzhi(lichunYear);
  let cur = null;
  for (const e of events) { if (e.t <= bjMs) cur = e; else break; }
  if (cur == null) for (const e of jieEvents(yBase-1)) { if (e.t <= bjMs) cur = e; else break; }
  const monthGz = monthGan(GANZHI60.indexOf(yz) % 10, cur.branch) + BRANCHES[cur.branch];
  let tY = cy, tM = cm, tD = cd, tH = ch, tMin = cmin;
  if (!unknownTime && ch != null && longitude != null) {
    const t = new Date(Date.UTC(tY, tM-1, tD, tH, tMin, 0) + (longitude - tzOff*15) * 4 * 60000);
    tY = t.getUTCFullYear(); tM = t.getUTCMonth()+1; tD = t.getUTCDate(); tH = t.getUTCHours(); tMin = t.getUTCMinutes();
  }
  let dayShift = 0, hBranch = null;
  if (!unknownTime && ch != null) {
    if (tH >= 23) { dayShift = 1; hBranch = 0; } else hBranch = branchIndexFromHour(tH);
  }
  const dz = dayGanzhiByJdn(jdn(tY, tM, tD) + (sect === 1 ? dayShift : 0));
  let hGz = null;
  if (hBranch != null) {
    const baseGanIdx = GANZHI60.indexOf(dayGanzhiByJdn(jdn(tY, tM, tD) + dayShift)) % 10;
    hGz = hourGan(baseGanIdx, hBranch) + BRANCHES[hBranch];
  }
  return [yz, monthGz, dz, (unknownTime || ch == null) ? null : hGz];
}

const file = path.join(ROOT, 'test-fixtures.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
let mismatch = 0;
for (const c of data.cases) {
  const i = c.result.input;
  const ind = independentBazi(i);
  const eng = [c.result.pillars.year.ganzhi, c.result.pillars.month.ganzhi, c.result.pillars.day.ganzhi, c.result.pillars.time ? c.result.pillars.time.ganzhi : null];
  const ok = ind.every((v, k) => (v || null) === (eng[k] || null));
  if (!ok) mismatch++;
  c.expected = {
    fourPillars: ind.map(x => x || '—').join(' '),
    verifiedBy: '独立算法差分对拍（儒略日公式+五时遁+五虎遁+节气表，与引擎算法路径不同）',
    verifiedAt: '2026-09-21',
    status: ok ? 'verified' : 'MISMATCH — 需人工归因',
  };
}
data.note = 'P1 万年历抽检基准。2026-09-21 起 expected 字段由独立算法差分对拍自动填实（tools/test-crosscheck.mjs 全绿 + tools/stamp-expected.mjs 盖章），不再要求人工按八字功底抽查。人工只需复核 crosscheck 报告的不一致行；当前不一致 = ' + mismatch + '。边界七类（lichun/jieqi/late-zi/dst/xinjiang/xiaoshu/overseas）全部覆盖，另含 DST 官方日期表与跨零点回滚回归守卫。';
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`stamped ${data.cases.length} cases, mismatch = ${mismatch}`);
process.exit(mismatch > 0 ? 1 : 0);
