// 网页引擎回归测试：web/bazi-engine.web.js 必须与 engine.mjs 输出完全一致
// 方法：vm 沙箱加载 lunar UMD + web 引擎，跑全部 fixtures，逐柱比对
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as engineMod from './engine.mjs';   // Node 引擎：用于十神推导双引擎对账

const __dirname = dirname(fileURLToPath(import.meta.url));

// lunar UMD 来源：标准 node_modules（克隆即可跑）→ site vendor 兜底
// 返回源码字符串；两处沙箱加载共用同一份，避免版本/来源不一致造成的假绿。
function loadLunarSrc() {
  const candidates = [
    join(__dirname, 'node_modules/lunar-javascript/lunar.js'),
    join(__dirname, 'web/vendor/lunar.min.js'),
  ];
  for (const c of candidates) {
    try { return readFileSync(c, 'utf8'); } catch { /* next */ }
  }
  throw new Error('lunar-javascript not found — run `npm install` first.');
}
const lunarSrc = loadLunarSrc();
const engineSrc = readFileSync(join(__dirname, 'web/bazi-engine.web.js'), 'utf8');

const sandbox = { module: { exports: {} }, console };
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(lunarSrc, sandbox);     // UMD 在沙箱中走 CommonJS 分支 → module.exports
const Solar = sandbox.module.exports.Solar;
if (!Solar) { console.error('FATAL: Solar 未暴露'); process.exit(1); }

// 把 Solar 注入 web 引擎的全局（web 引擎依赖全局 Solar）
const sandbox2 = { Solar, module: { exports: {} }, console };
sandbox2.self = sandbox2;
vm.createContext(sandbox2);
vm.runInContext(engineSrc, sandbox2, { filename: 'bazi-engine.web.js' });
const BaziEngine = sandbox2.module.exports;
if (!BaziEngine) { console.error('FATAL: BaziEngine 未暴露'); process.exit(1); }

const fixtures = JSON.parse(readFileSync(join(__dirname, 'test-fixtures.json'), 'utf8'));

let pass = 0, fail = 0;
const failures = [];
for (const c of fixtures.cases) {
  const inp = { year: c.result.input.year, month: c.result.input.month, day: c.result.input.day,
    hour: c.result.input.hour, minute: c.result.input.minute, longitude: c.result.input.longitude,
    tzOffsetHours: c.result.input.tzOffsetHours, unknownTime: c.result.input.unknownTime, sect: c.result.input.sect };
  // fixtures 里 input.hour 可能为 null；engine.mjs 语义一致
  const got = BaziEngine.computeBazi(inp);
  const exp = c.result.pillars;
  const names = ['year', 'month', 'day', 'time'];
  let ok = true;
  for (const n of names) {
    const e = exp[n] ? exp[n].ganzhi : null;
    const g = got.pillars[n] ? got.pillars[n].ganzhi : null;
    if (e !== g) { ok = false; failures.push(`${c.name} [${n}]: expect ${e}, got ${g}`); }
    // 藏干、十神、纳音全比对
    if (exp[n] && got.pillars[n]) {
      if (JSON.stringify(exp[n].hideGan) !== JSON.stringify(got.pillars[n].hideGan)) { ok = false; failures.push(`${c.name} [${n}.hideGan]`); }
      if (exp[n].shiShenGan !== got.pillars[n].shiShenGan) { ok = false; failures.push(`${c.name} [${n}.shiShenGan]: expect ${exp[n].shiShenGan}, got ${got.pillars[n].shiShenGan}`); }
      if (exp[n].naYin !== got.pillars[n].naYin) { ok = false; failures.push(`${c.name} [${n}.naYin]`); }
    }
  }
  if (JSON.stringify(c.result.fiveElements) !== JSON.stringify(got.fiveElements)) { ok = false; failures.push(`${c.name} [fiveElements]`); }
  if (ok) pass++; else fail++;
}
console.log(`web引擎回归: ${pass} pass / ${fail} fail (共 ${fixtures.cases.length} 例)`);
if (failures.length) { console.log('--- 失败明细 ---'); for (const f of failures.slice(0, 20)) console.log(' ', f); process.exit(1); }
console.log('ALL GREEN ✓ 网页引擎与 Node 引擎完全一致');

// ---------- 十神推导一致性（v0.3.3 新增对外暴露的函数）----------
// 两层保护：① 两引擎 100 组合逐字段一致 ② 人工核过的已知真值（防止两引擎以同样方式同错）
const STEMS10 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const KNOWN = [
  ['丙','丙','比肩'],['丙','丁','劫财'],   // 同五行：阳阳比肩 / 阳阴劫财
  ['丙','戊','食神'],['丙','己','伤官'],   // 我生
  ['丙','庚','偏财'],['丙','辛','正财'],   // 我克
  ['丙','壬','七杀'],['丙','癸','正官'],   // 克我
  ['丙','甲','偏印'],['丙','乙','正印'],   // 生我
  ['壬','丙','偏财'],['壬','辛','正印'],['壬','戊','七杀'],['壬','乙','伤官'],
];
let tpass = 0, tbad = [];
for (const d of STEMS10) for (const g of STEMS10) {
  const a = engineMod.deriveTenGod(d, g), b = BaziEngine.deriveTenGod(d, g);
  if (JSON.stringify(a) !== JSON.stringify(b)) tbad.push(`推导不一致 ${d}日主 + ${g}: node=${JSON.stringify(a)} web=${JSON.stringify(b)}`);
  else tpass++;
}
if (tpass !== 100) { console.log(`十神推导双引擎一致性: ${tpass}/100`); for (const f of tbad.slice(0, 5)) console.log(' ', f); process.exit(1); }
if (!engineMod.deriveTenGod('丙','丙') || engineMod.deriveTenGod('X','丙') !== null) { console.log('deriveTenGod 入参守卫异常'); process.exit(1); }
let kbad = 0;
for (const [d, g, want] of KNOWN) {
  const got = engineMod.deriveTenGod(d, g);
  if (!got || got.god !== want) { kbad++; console.log(`  已知真值错: ${d}日主 + ${g} 期望 ${want} 实得 ${got && got.god}`); }
}
if (kbad) process.exit(1);
console.log(`十神推导: 双引擎 ${tpass}/100 组合一致 ✓ ｜ 已知真值 ${KNOWN.length}/${KNOWN.length} 通过 ✓`);

// ---------- 大运双引擎一致性（v0.4.0 新增）----------
// 排盘已锁在 fixtures 上；这里把新的大运层也钉住：同一组输入下
// engine.mjs 与 web 引擎必须产出逐字段相同的整棵结果树。
const stable = v => JSON.stringify(v, (k, val) =>
  (val && typeof val === 'object' && !Array.isArray(val))
    ? Object.keys(val).sort().reduce((o, key) => (o[key] = val[key], o), {})
    : val);

const LUCK_INPUTS = [
  { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1 },
  { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8, gender: 0 },
  { year: 1988, month: 6, day: 1, hour: 10, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1 },
  { year: 2000, month: 1, day: 1, hour: 0, minute: 30, longitude: null, tzOffsetHours: 8, gender: 0 },
  { year: 1993, month: 7, day: 7, hour: 15, minute: 30, longitude: 0.13, tzOffsetHours: 1, gender: 1 },
  { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: -74.01, tzOffsetHours: -5, gender: 1 },
  { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: -74.01, tzOffsetHours: -5, gender: 1, frame: 'true-solar' },
  { year: 1975, month: 12, day: 31, hour: 23, minute: 45, longitude: 87.62, tzOffsetHours: 8, gender: 0 },
  { year: 2016, month: 2, day: 4, hour: 17, minute: 46, longitude: null, tzOffsetHours: 8, gender: 1 },
  { year: 1991, month: 3, day: 23, hour: null, minute: 0, longitude: null, tzOffsetHours: 8, gender: 1, unknownTime: true },
  { year: 1997, month: 7, day: 1, hour: 9, minute: 45, longitude: null, tzOffsetHours: 8, gender: 1, method: 'precise' },
];
let lpass = 0; const lbad = [];
for (const inp of LUCK_INPUTS) {
  const n = engineMod.computeLuckPillars(Object.assign({}, inp, { today: '2026-09-17' }));
  const w = BaziEngine.computeLuckPillars(Object.assign({}, inp, { today: '2026-09-17' }));
  const ns = stable(n), ws = stable(w);
  if (ns === ws) { lpass++; continue; }
  let at = 0; while (at < ns.length && ns[at] === ws[at]) at++;
  lbad.push(inp.year + '-' + inp.month + '-' + inp.day + ' g=' + inp.gender + ' @' + at +
    ' node=' + ns.slice(Math.max(0, at - 70), at + 70) + ' | web=' + ws.slice(Math.max(0, at - 70), at + 70));
}
if (lbad.length) { console.log('大运双引擎一致性失败 ' + lbad.length + '/' + LUCK_INPUTS.length); for (const f of lbad.slice(0, 3)) console.log('  ✗ ' + f); process.exit(1); }
console.log('大运层: 双引擎 ' + lpass + '/' + LUCK_INPUTS.length + ' 组输入产出逐字段相同的结果树 ✓');

// 大运层的常量与原子函数也必须两边一致，防止只改了单侧的表
for (const k of ['JIAZI', 'JIE_EN', 'BRANCH_HIDE_GAN', 'STAGE_NAMES', 'STAGE_EN', 'STAGE_START_BRANCH']) {
  if (stable(engineMod[k]) !== stable(BaziEngine[k])) { console.log('常量不一致: ' + k); process.exit(1); }
}
if (engineMod.JIAZI.length !== 60 || engineMod.JIAZI[0] !== '甲子' || engineMod.JIAZI[59] !== '癸亥') { console.log('六十甲子表异常'); process.exit(1); }
for (let h = 0; h < 24; h++) {
  if (stable(engineMod.zhiBlockOf(h)) !== stable(BaziEngine.zhiBlockOf(h))) { console.log('zhiBlockOf(' + h + ') 不一致'); process.exit(1); }
}
for (const d of STEMS10) for (const b of ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']) {
  if (stable(engineMod.twelveStage(d, b)) !== stable(BaziEngine.twelveStage(d, b))) { console.log('twelveStage(' + d + ',' + b + ') 不一致'); process.exit(1); }
}
for (const stem of STEMS10) for (const g of [1, 0]) {
  if (stable(engineMod.luckDirection(stem, g)) !== stable(BaziEngine.luckDirection(stem, g))) { console.log('luckDirection(' + stem + ',' + g + ') 不一致'); process.exit(1); }
}
console.log('大运层常量与原子函数: 双引擎逐项一致 ✓（六十甲子 / 藏干 / 十二长生 / 顺逆 / 时辰块）');

// 版本号单一来源：两引擎各自的 ENGINE_VERSION 必须一致，页面上的静态标记
// 由 test-site-consistency.mjs 另行对账（那条闸门管 HTML，这条闸门管引擎）
if (engineMod.ENGINE_VERSION !== BaziEngine.ENGINE_VERSION) {
  console.log('版本号不一致: node=' + engineMod.ENGINE_VERSION + ' web=' + BaziEngine.ENGINE_VERSION);
  process.exit(1);
}
if (!/^v\d+\.\d+\.\d+$/.test(BaziEngine.ENGINE_VERSION)) {
  console.log('版本号格式异常: ' + BaziEngine.ENGINE_VERSION + '（应为 vX.Y.Z）');
  process.exit(1);
}
console.log('版本号单一来源: 双引擎一致 = ' + BaziEngine.ENGINE_VERSION + ' ✓');

// ---------- 合盘双引擎一致性（v0.5.0 新增）----------
// 8 组两盘组合（含未知时辰 / 海外时区 / 同盘自合），整棵结果树逐字段比对。
const CP_PAIRS = [
  [{ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8 },
   { year: 1990, month: 1, day: 15, hour: 8, minute: 0, longitude: null, tzOffsetHours: 8 }],
  [{ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8 },
   { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8 }],   // 同盘自合（辰辰自刑等）
  [{ year: 1988, month: 6, day: 1, hour: 4, minute: 0, longitude: null, tzOffsetHours: 8 },
   { year: 1993, month: 7, day: 7, hour: 15, minute: 30, longitude: 0.13, tzOffsetHours: 1 }],   // 伦敦出生
  [{ year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: -74.01, tzOffsetHours: -5 },
   { year: 2000, month: 1, day: 1, hour: 0, minute: 30, longitude: null, tzOffsetHours: 8 }],
  [{ year: 1975, month: 12, day: 31, hour: 23, minute: 45, longitude: 87.62, tzOffsetHours: 8 },
   { year: 2016, month: 2, day: 4, hour: 17, minute: 46, longitude: null, tzOffsetHours: 8 }],
  [{ year: 1991, month: 3, day: 23, hour: null, minute: 0, longitude: null, tzOffsetHours: 8, unknownTime: true },
   { year: 1994, month: 9, day: 9, hour: 12, minute: 0, longitude: null, tzOffsetHours: 8 }],
  [{ year: 1984, month: 2, day: 2, hour: 7, minute: 0, longitude: null, tzOffsetHours: 8, sect: 2 },
   { year: 1985, month: 2, day: 5, hour: 23, minute: 10, longitude: null, tzOffsetHours: 8 }],
  [{ year: 1996, month: 6, day: 6, hour: 6, minute: 6, longitude: null, tzOffsetHours: 8 },
   { year: 1997, month: 7, day: 7, hour: 19, minute: 0, longitude: null, tzOffsetHours: 8 }]
];
let cpass = 0; const cbad = [];
for (let i = 0; i < CP_PAIRS.length; i++) {
  const n = engineMod.computeCompatibility(CP_PAIRS[i][0], CP_PAIRS[i][1]);
  const w = BaziEngine.computeCompatibility(CP_PAIRS[i][0], CP_PAIRS[i][1]);
  const ns = stable(n), ws = stable(w);
  if (ns === ws) { cpass++; continue; }
  let at = 0; while (at < ns.length && ns[at] === ws[at]) at++;
  cbad.push('pair#' + i + ' @' + at + ' node=' + ns.slice(Math.max(0, at - 70), at + 70) + ' | web=' + ws.slice(Math.max(0, at - 70), at + 70));
}
if (cbad.length) { console.log('合盘双引擎一致性失败 ' + cbad.length + '/' + CP_PAIRS.length); for (const f of cbad.slice(0, 3)) console.log('  ✗ ' + f); process.exit(1); }
console.log('合盘层: 双引擎 ' + cpass + '/' + CP_PAIRS.length + ' 组两盘组合产出逐字段相同的结果树 ✓');

// 合盘常量与原子函数：全部关系表 + 干支全组合的原子关系比对
for (const k of ['STEM_COMBINE', 'STEM_COMBINE_ELEMENT', 'STEM_CLASH', 'BRANCH_SIX_HE', 'SIX_HE_ELEMENT',
                 'BRANCH_CLASH', 'BRANCH_HARM', 'BRANCH_TRINE', 'PUNISH_GROUPS', 'SELF_PUNISH',
                 'BRANCH_ANIMAL', 'BRANCH_ANIMAL_EN']) {
  if (stable(engineMod[k]) !== stable(BaziEngine[k])) { console.log('合盘常量不一致: ' + k); process.exit(1); }
}
const BRANCHES12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
let arel = 0;
for (const s1 of STEMS10) for (const s2 of STEMS10) {
  if (stable(engineMod.stemRelation(s1, s2)) !== stable(BaziEngine.stemRelation(s1, s2))) { console.log('stemRelation(' + s1 + ',' + s2 + ') 不一致'); process.exit(1); }
  arel++;
}
for (const b1 of BRANCHES12) for (const b2 of BRANCHES12) {
  if (stable(engineMod.branchRelations(b1, b2)) !== stable(BaziEngine.branchRelations(b1, b2))) { console.log('branchRelations(' + b1 + ',' + b2 + ') 不一致'); process.exit(1); }
  arel++;
}
console.log('合盘层常量与原子函数: 双引擎逐项一致 ✓（五合/四冲/六合/六冲/六害/三合/相刑/生肖，干 ' + (arel / 2) + ' + 支 ' + (arel / 2) + ' 全组合）');

// ---------- 喜用神双引擎一致性（v0.6.0 新增）----------
const FE_INPUTS = [
  { year: 1983, month: 11, day: 30, hour: 10, longitude: 116.41, tzOffsetHours: 8 },
  { year: 1988, month: 7, day: 8, hour: 8, longitude: 116.41, tzOffsetHours: 8 },
  { year: 1980, month: 5, day: 15, hour: 4, longitude: 116.41, tzOffsetHours: 8 },
  { year: 1986, month: 12, day: 20, hour: 14, longitude: 116.41, tzOffsetHours: 8 },
  { year: 1996, month: 5, day: 21, hour: 6, longitude: 116.41, tzOffsetHours: 8 },
  { year: 1991, month: 3, day: 23, unknownTime: true, longitude: 116.41, tzOffsetHours: 8 },
  { year: 1990, month: 1, day: 15, hour: 8, longitude: -74.01, tzOffsetHours: -5 },
  { year: 2000, month: 2, day: 29, hour: 23, longitude: 121.47, tzOffsetHours: 8 }
];
let fepass = 0; const febad = [];
for (let i = 0; i < FE_INPUTS.length; i++) {
  const n = engineMod.computeFavorableElement(FE_INPUTS[i]);
  const w = BaziEngine.computeFavorableElement(FE_INPUTS[i]);
  const ns = stable(n), ws = stable(w);
  if (ns === ws) { fepass++; continue; }
  let at = 0; while (at < ns.length && ns[at] === ws[at]) at++;
  febad.push('fe#' + i + ' @' + at + ' node=' + ns.slice(Math.max(0, at - 70), at + 70) + ' | web=' + ws.slice(Math.max(0, at - 70), at + 70));
}
if (febad.length) { console.log('喜用神双引擎一致性失败 ' + febad.length + '/' + FE_INPUTS.length); for (const f of febad.slice(0, 3)) console.log('  ✗ ' + f); process.exit(1); }
console.log('喜用神层: 双引擎 ' + fepass + '/' + FE_INPUTS.length + ' 组输入产出逐字段相同的结果树 ✓');

// 喜用神常量：季节表 / 季节英文名 / 阈值
for (const k of ['BRANCH_SEASON', 'SEASON_EN', 'STRENGTH_THRESHOLDS']) {
  if (stable(engineMod[k]) !== stable(BaziEngine[k])) { console.log('喜用神常量不一致: ' + k); process.exit(1); }
}
console.log('喜用神层常量: 双引擎逐项一致 ✓（季节表 / 阈值 0.55/0.45）');

// ---------- 纳音 / 日柱剖面双引擎一致性（v0.7.0 新增）----------
// 纳音真值表（30 对中文定值，硬编码——不是从引擎抄的，防两头一起错）
const NAYIN_TRUTH = [
  ['甲子', '海中金'], ['丙寅', '炉中火'], ['戊辰', '大林木'], ['庚午', '路旁土'], ['壬申', '剑锋金'],
  ['甲戌', '山头火'], ['丙子', '涧下水'], ['戊寅', '城头土'], ['庚辰', '白蜡金'], ['壬午', '杨柳木'],
  ['甲申', '泉中水'], ['丙戌', '屋上土'], ['戊子', '霹雳火'], ['庚寅', '松柏木'], ['壬辰', '长流水'],
  ['甲午', '沙中金'], ['丙申', '山下火'], ['戊戌', '平地木'], ['庚子', '壁上土'], ['壬寅', '金箔金'],
  ['甲辰', '覆灯火'], ['丙午', '天河水'], ['戊申', '大驿土'], ['庚戌', '钗钏金'], ['壬子', '桑柘木'],
  ['甲寅', '大溪水'], ['丙辰', '沙中土'], ['戊午', '天上火'], ['庚申', '石榴木'], ['壬戌', '大海水'],
];
for (const [gz, expect] of NAYIN_TRUTH) {
  const n = engineMod.nayinOf(gz), w = BaziEngine.nayinOf(gz);
  if (!n || !w || n.cn !== expect || w.cn !== expect) { console.log('纳音真值失败: ' + gz + ' 应为 ' + expect); process.exit(1); }
  if (stable(n) !== stable(w)) { console.log('纳音双引擎不一致: ' + gz); process.exit(1); }
}
// 同纳音配对真值：甲子↔乙丑 / 壬戌↔癸亥
if (engineMod.nayinOf('甲子').partner !== '乙丑' || engineMod.nayinOf('壬戌').partner !== '癸亥') { console.log('纳音配对失败'); process.exit(1); }
// 60 柱纳音表逐项相等
for (let i = 0; i < 60; i++) {
  if (engineMod.NAYIN[i] !== BaziEngine.NAYIN[i] || engineMod.NAYIN_EN[i] !== BaziEngine.NAYIN_EN[i]) { console.log('NAYIN 表 #' + i + ' 不一致'); process.exit(1); }
}
// ---------- 天干阴阳交叉断言（v0.7.1）----------
// 这条来自一个真实事故：STEM_POLARITY 曾写成两两成组的 ['阳','阳','阴','阴',…]，
// 与同段的 STEMS_EN（'Yi Yin Wood'）自相矛盾，并让 60 个日柱页的标题/描述整批把乙丙、己庚 的阴阳写反。
// 断言不硬编码数组，而是要求阴阳表与英文全名表互相印证——两张表不能各说各话。
{
  const EN = engineMod.STEMS_EN;
  const POL = engineMod.STEM_POLARITY;
  const WEN = BaziEngine.STEMS_EN;
  const WPOL = BaziEngine.STEM_POLARITY;
  for (let i = 0; i < 10; i++) {
    const fromEn = /\bYang\b/.test(EN[i]) ? '阳' : '阴';
    if (POL[i] !== fromEn) { console.log('天干阴阳与英文名矛盾: ' + engineMod.STEMS[i] + ' 阴阳表=' + POL[i] + ' 英文名=' + EN[i]); process.exit(1); }
    if (POL[i] !== (i % 2 === 0 ? '阳' : '阴')) { console.log('天干阴阳不符合索引奇偶: ' + engineMod.STEMS[i] + ' = ' + POL[i]); process.exit(1); }
    if (WPOL[i] !== POL[i]) { console.log('双引擎阴阳表不一致: ' + engineMod.STEMS[i]); process.exit(1); }
    if (WEN[i] !== EN[i]) { console.log('双引擎英文全名不一致: ' + engineMod.STEMS[i]); process.exit(1); }
  }
  console.log('天干阴阳: 10/10 与英文全名表互证 + 双引擎一致 ✓（甲丙戊庚壬阳 / 乙丁己辛癸阴）');
}

console.log('纳音层: 双引擎 30/30 真值 + 60 柱表逐项一致 ✓');

// 库对账：遍历连续 120 个阳历日（覆盖 60 柱 ×2 轮），lunar-javascript 的
// getDayNaYin() 必须与引擎 NAYIN 表逐日一致
{
  const lsandbox = { console, module: { exports: {} } };
  vm.runInContext(lunarSrc, vm.createContext(lsandbox), { filename: 'lunar.min.js' });
  const Lunar = lsandbox.module.exports;
  let ny = 0;
  for (let d = 0; d < 120; d++) {
    const dt = new Date(Date.UTC(1984, 1, 2 + d, 12));   // 1984-02-02 = 丙寅起
    const lu = Lunar.Solar.fromYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()).getLunar();
    const gz = lu.getDayInGanZhi();
    const libNy = lu.getDayNaYin();
    const engNy = engineMod.nayinOf(gz);
    if (!engNy || engNy.cn !== libNy) { console.log('纳音库对账失败 ' + gz + ': 引擎=' + (engNy && engNy.cn) + ' 库=' + libNy); process.exit(1); }
    ny++;
  }
  console.log('纳音库对账: ' + ny + ' 日逐日与 lunar-javascript 一致 ✓');
}

// 日柱剖面：黄金柱真值（seat / 长生 / 藏干十神）+ 60 柱双引擎逐字段一致
const PILLAR_TRUTH = [
  { gz: '甲子', seat: 'support', stage: '沐浴', hiddenGods: ['正印'] },
  { gz: '甲戌', seat: 'control', stage: '养', hiddenGods: ['偏财', '正官', '伤官'] },
  { gz: '壬申', seat: 'support', stage: '长生', hiddenGods: ['偏印', '比肩', '七杀'] },
  { gz: '丙午', seat: 'same', stage: '帝旺', hiddenGods: ['劫财', '伤官'] },
  { gz: '戊寅', seat: 'undercut', stage: '长生', hiddenGods: ['七杀', '偏印', '比肩'] },
  { gz: '辛巳', seat: 'undercut', stage: '死', hiddenGods: ['正官', '劫财', '正印'] },
];
for (const t of PILLAR_TRUTH) {
  const p = engineMod.dayPillarProfile(t.gz);
  if (p.seat !== t.seat || p.stage !== t.stage) { console.log('日柱剖面真值失败: ' + t.gz + ' seat=' + p.seat + ' stage=' + p.stage); process.exit(1); }
  if (JSON.stringify(p.hidden.map(h => h.god)) !== JSON.stringify(t.hiddenGods)) { console.log('藏干十神失败: ' + t.gz); process.exit(1); }
  const w = BaziEngine.dayPillarProfile(t.gz);
  if (stable(p) !== stable(w)) { console.log('日柱剖面双引擎不一致: ' + t.gz); process.exit(1); }
}
for (const gz of engineMod.JIAZI) {
  if (stable(engineMod.dayPillarProfile(gz)) !== stable(BaziEngine.dayPillarProfile(gz))) { console.log('剖面 60 柱不一致: ' + gz); process.exit(1); }
}
console.log('日柱剖面: 6 黄金柱真值 + 60 柱双引擎逐字段一致 ✓');


// ============================================================
// v0.8.0 R27/R28/R29：十二地支属性 / 十二长生 / 十神×柱位
// ------------------------------------------------------------
// 这一段的重点是「让两张表互相印证」，而不是把真值抄第二遍。
// 教训来源：v0.7.1 的 STEM_POLARITY 手写成两两成组，把乙/丙、己/庚、癸/甲
// 的阴阳全部标反，而同段的 STEMS_EN 是对的——引擎自相矛盾、测试却全绿。
// 所以下面所有展示用表都必须能被另一张表反推出来。
// ============================================================

// ① 地支阴阳必须能从 60 甲子反推：每个地支出现的 5 个柱干，阴阳必须统一
{
  for (let i = 0; i < engineMod.BRANCHES.length; i++) {
    const b = engineMod.BRANCHES[i];
    const gans = engineMod.JIAZI.filter(gz => gz[1] === b).map(gz => gz[0]);
    if (gans.length !== 5) { console.log('甲子反推失败: ' + b + ' 应出现在 5 柱，实为 ' + gans.length); process.exit(1); }
    const pols = [...new Set(gans.map(g => engineMod.STEMS.indexOf(g) % 2))];
    if (pols.length !== 1) { console.log('甲子反推失败: ' + b + ' 的柱干阴阳不统一 → ' + gans.join('')); process.exit(1); }
    const derived = pols[0] === 0 ? '阳' : '阴';
    if (engineMod.BRANCH_POLARITY[i] !== derived) {
      console.log('地支阴阳与甲子反推不符: ' + b + ' 表内=' + engineMod.BRANCH_POLARITY[i] + ' 反推=' + derived); process.exit(1);
    }
    if (engineMod.BRANCH_POLARITY[i] !== (i % 2 === 0 ? '阳' : '阴')) {
      console.log('地支阴阳与索引不符: ' + b); process.exit(1);
    }
    if (BaziEngine.BRANCH_POLARITY[i] !== engineMod.BRANCH_POLARITY[i]) { console.log('BRANCH_POLARITY 双引擎不一致'); process.exit(1); }
  }
  console.log('地支阴阳: 12 支均可从 60 甲子反推（阳支只配阳干）✓');
}

// ② 三会方：成员季节必须统一，且局五行必须等于该季节五行（春木夏火秋金冬水）
{
  const seasonEl = { spring: '木', summer: '火', autumn: '金', winter: '水' };
  const expect = ['木', '火', '金', '水'];
  const seen = [];
  for (const m of engineMod.BRANCH_MEETING) {
    const ss = [...new Set(m.branches.map(b => engineMod.BRANCH_SEASON[b]))];
    if (ss.length !== 1) { console.log('三会方季节不统一: ' + m.branches.join('')); process.exit(1); }
    if (m.element !== seasonEl[ss[0]]) { console.log('三会方五行与季节不符: ' + m.branches.join('') + ' ' + m.element + ' vs ' + ss[0]); process.exit(1); }
    seen.push(m.element);
    if (m.branches.length !== 3) { console.log('三会方成员数≠3'); process.exit(1); }
  }
  if (JSON.stringify(seen) !== JSON.stringify(expect)) { console.log('三会方缺局: ' + seen.join('')); process.exit(1); }
  if (JSON.stringify(BaziEngine.BRANCH_MEETING) !== JSON.stringify(engineMod.BRANCH_MEETING)) { console.log('BRANCH_MEETING 双引擎不一致'); process.exit(1); }
  console.log('三会方: 4 局季节/五行/成员数与引擎表一致 ✓');
}

// ③ 三合局 = 该局阳干的长生 / 帝旺 / 墓三支（跨表互证，不另抄真值）
{
  for (const t of engineMod.BRANCH_TRINE) {
    const yangGan = engineMod.STEMS.find(g => engineMod.STEMS.indexOf(g) % 2 === 0 && engineMod.STEM_ELEMENT[engineMod.STEMS.indexOf(g)] === t.element);
    const sbi = engineMod.BRANCHES.indexOf(engineMod.STAGE_START_BRANCH[yangGan]);
    const expect = [0, 4, 8].map(k => engineMod.BRANCHES[(sbi + k) % 12]).sort().join('');
    if (t.branches.slice().sort().join('') !== expect) {
      console.log('三合局与长生/帝旺/墓不符: ' + t.element + '局 ' + t.branches.join('') + ' ≠ ' + expect + '（' + yangGan + '）'); process.exit(1);
    }
  }
  console.log('三合局: 4 局均可由「阳干长生/帝旺/墓」互证 ✓');
}

// ④ 十二长生剖面：10 干各行正反算必须自洽（用 twelveStage 反验 stageProfile 的正算）
{
  const pillarCounts = [];
  for (let i = 0; i < 12; i++) {
    const sp = engineMod.stageProfile(i);
    if (!sp || sp.rows.length !== 10) { console.log('stageProfile ' + i + ' 行数≠10'); process.exit(1); }
    if (new Set(sp.rows.map(r => r.gan + r.branch)).size !== 10) { console.log('stageProfile ' + i + ' 有重复干支'); process.exit(1); }
    for (const r of sp.rows) {
      if (!r.verified) { console.log('stageProfile 自洽失败: ' + r.gan + ' 在 ' + r.branch + ' 不是 ' + sp.stageCn); process.exit(1); }
      if (r.verified !== (engineMod.twelveStage(r.gan, r.branch).stage === sp.stageCn)) { console.log('stageProfile verified 标记错'); process.exit(1); }
      // 阳干顺行 / 阴干逆行 必须与索引奇偶一致
      if (r.yangDirection !== (engineMod.STEMS.indexOf(r.gan) % 2 === 0)) { console.log('阳顺阴逆标记错: ' + r.gan); process.exit(1); }
    }
    // 柱数分布：长生/冠带/帝旺/病/墓/胎 各 6，其余各 4 —— 与日柱 hub 的实算分布互为印证
    if (sp.pillars.length !== (i % 2 === 0 ? 6 : 4)) { console.log('stageProfile ' + i + ' 柱数 ' + sp.pillars.length + ' 应为 ' + (i % 2 === 0 ? 6 : 4)); process.exit(1); }
    for (const pl of sp.pillars) {
      if (engineMod.twelveStage(pl.gz[0], pl.gz[1]).stage !== sp.stageCn) { console.log('柱归属错: ' + pl.gz); process.exit(1); }
    }
    pillarCounts.push(sp.pillars.length);
    if (stable(engineMod.stageProfile(i)) !== stable(BaziEngine.stageProfile(i))) { console.log('stageProfile 双引擎不一致 ' + i); process.exit(1); }
  }
  if (pillarCounts.reduce((a, b) => a + b, 0) !== 60) { console.log('十二阶段柱数之和≠60'); process.exit(1); }
  console.log('十二长生: 12 阶段 × 10 干正反自洽，柱数 ' + pillarCounts.join('/') + '（和=60）双引擎一致 ✓');
}

// ⑤ 十二地支剖面：关系对称（冲/害/六合互指）+ 每支 5 柱 + 10 干阶段表 + 藏干
{
  for (let i = 0; i < 12; i++) {
    const b = engineMod.BRANCHES[i];
    const p = engineMod.branchProfile(b);
    if (!p || p.index !== i) { console.log('branchProfile 索引错: ' + b); process.exit(1); }
    if (engineMod.BRANCH_CLASH[p.clash.branch] !== b) { console.log('六冲不对称: ' + b); process.exit(1); }
    if (engineMod.BRANCH_HARM[p.harm.branch] !== b) { console.log('六害不对称: ' + b); process.exit(1); }
    if (engineMod.BRANCH_SIX_HE[p.sixHe.branch] !== b) { console.log('六合不对称: ' + b); process.exit(1); }
    if (p.stageOf.length !== 10 || p.pillars.length !== 5) { console.log('branchProfile 字段数错: ' + b); process.exit(1); }
    // 本支的五行必须等于 BRANCH_ELEMENT（表内一致）
    if (p.element !== engineMod.BRANCH_ELEMENT[i]) { console.log('地支五行不符: ' + b); process.exit(1); }
    // 元月建：寅为正月 → 月建序必须由索引推出
    if (p.month !== ((i + 10) % 12) + 1) { console.log('月建错: ' + b); process.exit(1); }
    // 时辰区间：子 23–01 起，每支 +2 小时
    if (p.hour.start !== (23 + 2 * i) % 24 || p.hour.end !== (p.hour.start + 2) % 24) { console.log('时辰区间错: ' + b); process.exit(1); }
    if (stable(engineMod.branchProfile(b)) !== stable(BaziEngine.branchProfile(b))) { console.log('branchProfile 双引擎不一致: ' + b); process.exit(1); }
  }
  // 黄金值：子支
  const zi = engineMod.branchProfile('子');
  if (zi.polarity !== '阳' || zi.element !== '水' || zi.hour.text !== '23:00–01:00' || zi.month !== 11 || zi.jie !== '大雪') {
    console.log('子支黄金值失败: ' + JSON.stringify({ p: zi.polarity, e: zi.element, h: zi.hour.text, m: zi.month, j: zi.jie })); process.exit(1);
  }
  if (zi.sixHe.branch !== '丑' || zi.clash.branch !== '午' || zi.harm.branch !== '未' || zi.trine.peers.join('') !== '申辰' || zi.meeting.peers.join('') !== '亥丑') {
    console.log('子支关系黄金值失败'); process.exit(1);
  }
  // 甲在子必为沐浴（甲长生亥 → 沐浴子）
  const jiaZi = zi.stageOf.filter(r => r.gan === '甲')[0];
  if (jiaZi.stage !== '沐浴') { console.log('子支 甲 阶段应为沐浴，实为 ' + jiaZi.stage); process.exit(1); }
  console.log('十二地支: 12 支关系对称 + 5 柱/10 干阶段表 + 子支黄金值，双引擎一致 ✓');
}

// ⑥ 十神×柱位：10 日主 → 柱位天干必须是双射，且每行推导回代必须等于目标十神
{
  const posIds = engineMod.PILLAR_POS.map(p => p.id);
  if (posIds.join(',') !== 'year,month,hour') { console.log('PILLAR_POS 应为 年/月/时（日柱不列）'); process.exit(1); }
  for (const god of engineMod.TEN_GOD_ORDER) {
    for (const pos of posIds) {
      const tp = engineMod.tenGodPillarProfile(god, pos);
      if (!tp || tp.rows.length !== 10) { console.log('tenGodPillarProfile ' + god + '/' + pos + ' 行数≠10'); process.exit(1); }
      if (new Set(tp.rows.map(r => r.gan)).size !== 10) { console.log('柱干非双射: ' + god + '/' + pos); process.exit(1); }
      for (const r of tp.rows) {
        if (engineMod.tenGodOf(r.dayGan, r.gan) !== god) { console.log('十神回代失败: ' + r.dayGan + r.gan + ' ≠ ' + god); process.exit(1); }
        if (r.samePolarity !== (engineMod.STEMS.indexOf(r.dayGan) % 2 === engineMod.STEMS.indexOf(r.gan) % 2)) {
          console.log('同阴阳标记错: ' + r.dayGan + r.gan); process.exit(1);
        }
      }
      if (stable(engineMod.tenGodPillarProfile(god, pos)) !== stable(BaziEngine.tenGodPillarProfile(god, pos))) {
        console.log('tenGodPillarProfile 双引擎不一致 ' + god + '/' + pos); process.exit(1);
      }
    }
  }
  if (engineMod.tenGodPillarProfile('不存在', 'year') !== null) { console.log('非法十神未返回 null'); process.exit(1); }
  if (engineMod.tenGodPillarProfile('正财', 'day') !== null) { console.log('日柱位不应受理'); process.exit(1); }
  // 黄金值：正财在月柱 —— 日主甲（阳木）配月干己（阴土），异性故为正财
  const zc = engineMod.tenGodPillarProfile('正财', 'month');
  const jiaRow = zc.rows.filter(r => r.dayGan === '甲')[0];
  if (jiaRow.gan !== '己' || jiaRow.samePolarity !== false || jiaRow.relation !== 'wealth') {
    console.log('正财/月柱 日主甲 黄金值失败: ' + JSON.stringify(jiaRow)); process.exit(1);
  }
  console.log('十神×柱位: 30 组合 × 10 日主双射回代 + 黄金值，双引擎一致 ✓');
}


// ---------- ⑧ R30 流年 / 生肖层（v0.9.0） ----------
{
  // 8.1 立春表：双引擎字节相等。这是全站唯一一张「天文时刻」表，也是最不能漂的表——
  // 它错了不会报错，只会让所有生肖与年柱整体偏移一天。
  if (stable(engineMod.LICHUN) !== stable(BaziEngine.LICHUN)) { console.log('LICHUN 双引擎不一致'); process.exit(1); }
  if (engineMod.LICHUN_FROM !== BaziEngine.LICHUN_FROM) { console.log('LICHUN_FROM 不一致'); process.exit(1); }
  // 8.2 表自身的可证伪性质：立春永远落在 2 月 3–5 日（不可能是别的时候）。
  const badDay = [];
  for (let i = 0; i < engineMod.LICHUN.length; i++) {
    const s = engineMod.LICHUN[i], y = engineMod.LICHUN_FROM + i;
    const m = +s.slice(0, 2), d = +s.slice(2, 4);
    if (m !== 2 || d < 3 || d > 5) badDay.push(y);
  }
  if (badDay.length) { console.log('立春不在 2 月 3–5 日: ' + badDay.slice(0, 5).join(',')); process.exit(1); }
  // 8.3 黄金值：与公开发布的历书时刻一致（精确到分钟）
  const LICHUN_GOLD = { 2024: '2024-02-04 16:27', 2025: '2025-02-03 22:10', 2026: '2026-02-04 04:02', 2027: '2027-02-04 09:46' };
  for (const y of Object.keys(LICHUN_GOLD)) {
    const got = engineMod.lichunOf(+y).text.slice(0, 16);
    if (got !== LICHUN_GOLD[y]) { console.log('立春黄金值不符 ' + y + ': ' + got + ' ≠ ' + LICHUN_GOLD[y]); process.exit(1); }
  }
  if (engineMod.lichunOf(1899) !== null || engineMod.lichunOf(2101) !== null) { console.log('越界年份未返回 null'); process.exit(1); }

  // 8.4 跨表互证：生肖索引必须等于年柱的地支。年柱与生肖是两张表，若一张写错则分叉。
  for (let y = 1900; y <= 2100; y++) {
    const gz = engineMod.yearGanzhi(y);
    if (engineMod.BRANCHES[engineMod.zodiacIndexForYear(y)] !== gz[1]) {
      console.log('生肖与年柱地支分叉 ' + y + ': ' + gz + ' / ' + engineMod.zodiacIndexForYear(y)); process.exit(1);
    }
  }
  // 8.5 六十甲子闭环：1984 是甲子，60 年后回到甲子，且年柱全部落在六十甲子内。
  if (engineMod.yearGanzhi(1984) !== '甲子') { console.log('1984 应为甲子'); process.exit(1); }
  if (engineMod.yearGanzhi(2044) !== '甲子') { console.log('2044 应为甲子（六十年一循环）'); process.exit(1); }
  for (let y = 1900; y <= 2100; y++) {
    if (engineMod.JIAZI.indexOf(engineMod.yearGanzhi(y)) < 0) { console.log('年柱不在六十甲子内: ' + y); process.exit(1); }
  }
  // 8.6 生肖换柱的边界黄金值 —— 本站与多数生肖站的分歧点就在这里：
  //     1990-01-15 是蛇（立春 1990-02-04 10:14 未到），不是马；
  //     2024-02-04 16:00 是兔、17:00 是龙（立春 16:27 前后一分钟之差）。
  const Z = (y, m, d, h, mi) => engineMod.BRANCH_ANIMAL_EN[engineMod.zodiacIndexFromDateTime(y, m, d, h, mi)];
  const BOUND_GOLD = [
    [1990, 1, 15, 12, 0, 'Snake', '立春前约三周'],
    [1990, 2, 4, 10, 13, 'Snake', '立春前一分钟'],
    [1990, 2, 4, 10, 15, 'Horse', '立春后一分钟'],
    [2024, 2, 4, 16, 0, 'Rabbit', '立春前一小时'],
    [2024, 2, 4, 17, 0, 'Dragon', '立春后一小时'],
    [1900, 2, 4, 13, 50, 'Pig', '表首年立春前（属 1899 己亥）'],
    [1900, 2, 4, 13, 52, 'Rat', '表首年立春后（属 1900 庚子）'],
  ];
  for (const [y, m, d, h, mi, want, note] of BOUND_GOLD) {
    const got = Z(y, m, d, h, mi);
    if (got !== want) { console.log('生肖边界失败 ' + y + '-' + m + '-' + d + ' ' + h + ':' + mi + ' (' + note + '): ' + got + ' ≠ ' + want); process.exit(1); }
  }
  // 边界两侧必须互为前后一年（不是跳年），且必须逐分钟严丝合缝。
  // 注意：立春可能落在整分（如 1923-02-05 04:00），所以「前一分钟」要真借位——
  // 早先写成 Math.max(0, minute - 1)，整分时探针落在边界线上本身，被算作「后」。
  const shift = (d, h, mi, delta) => {
    let t = h * 60 + mi + delta;
    let day = d;
    while (t < 0) { t += 1440; day -= 1; }
    while (t >= 1440) { t -= 1440; day += 1; }
    return [day, Math.floor(t / 60), t % 60];
  };
  for (let y = 1900; y <= 2100; y++) {
    const lc = engineMod.lichunOf(y);
    const [bd, bh, bm] = shift(lc.day, lc.hour, lc.minute, -1);
    const [ad, ah, am] = shift(lc.day, lc.hour, lc.minute, +1);
    const before = engineMod.zodiacIndexFromDateTime(y, lc.month, bd, bh, bm);
    const after = engineMod.zodiacIndexFromDateTime(y, lc.month, ad, ah, am);
    if ((before + 1) % 12 !== after) {
      console.log('立春边界两侧非相邻生肖 ' + y + ': 立春 ' + lc.text + ' 前后 ' + before + ' → ' + after); process.exit(1);
    }
    // 边界线本身属于「新年」（≥ 立春即新岁）
    const on = engineMod.zodiacIndexFromDateTime(y, lc.month, lc.day, lc.hour, lc.minute);
    if (on !== after) { console.log('立春当刻未判入新年 ' + y); process.exit(1); }
  }
  // 8.7 年份表：144 年恰为 12 轮，每生肖 12 个年份；年份必须与索引一致。
  for (let bi = 0; bi < 12; bi++) {
    const ys = engineMod.zodiacYears(bi, 1900, 2043);
    if (ys.length !== 12) { console.log('生肖 ' + bi + ' 年份数应为 12，实为 ' + ys.length); process.exit(1); }
    for (const y of ys) if (engineMod.zodiacIndexForYear(y) !== bi) { console.log('年份表含错年 ' + y); process.exit(1); }
    if (ys[1] - ys[0] !== 12) { console.log('年份表间隔应为 12 年'); process.exit(1); }
  }

  // 8.8 太岁关系：五种关系各自的数量守恒 + 与地支关系表互证 + 互反性。
  //     守恒律：每一年「值、冲、害、破」各恰好 1 个生肖（因为这三张配对表都是一对一置换），
  //     「刑」则视相刑组而定（可为 0–2）。任何一条不守恒即说明配对表被改坏了。
  for (let yb = 0; yb < 12; yb++) {
    const rel = engineMod.taiSuiRelations(yb);
    if (rel.length !== 12) { console.log('太岁关系应覆盖 12 支'); process.exit(1); }
    const count = (k) => rel.filter((r) => r.kinds.indexOf(k) >= 0).length;
    if (count('zhi') !== 1 || count('chong') !== 1 || count('hai') !== 1 || count('po') !== 1) {
      console.log('太岁关系守恒律失败，年支 ' + engineMod.BRANCHES[yb] + ': ' + JSON.stringify({ zhi: count('zhi'), chong: count('chong'), hai: count('hai'), po: count('po') })); process.exit(1);
    }
    // 互证：太岁关系与 branchProfile 的冲/害判定必须一致（不允许两套判定）
    for (const r of rel) {
      const p = engineMod.branchProfile(r.branch);
      const want = [];
      if (p.clash.branch === engineMod.BRANCHES[yb]) want.push('chong');
      if (p.harm.branch === engineMod.BRANCHES[yb]) want.push('hai');
      if (engineMod.BRANCH_BREAK[r.branch] === engineMod.BRANCHES[yb]) want.push('po');
      for (const k of want) if (r.kinds.indexOf(k) < 0) { console.log('太岁关系漏项 ' + engineMod.BRANCHES[yb] + '→' + r.branch + ' 缺 ' + k); process.exit(1); }
    }
    // 互反性：b 冲 y ⇒ y 冲 b（冲/害/破都是对合，不是单向）
    for (const r of rel) {
      const back = engineMod.taiSuiRelations(r.bi).filter((x) => x.bi === yb)[0];
      if (r.kinds.indexOf('chong') >= 0 && back.kinds.indexOf('chong') < 0) { console.log('冲不互反 ' + yb + '/' + r.bi); process.exit(1); }
      if (r.kinds.indexOf('po') >= 0 && back.kinds.indexOf('po') < 0) { console.log('破不互反 ' + yb + '/' + r.bi); process.exit(1); }
    }
  }
  // 六破表：12 支两两互破、无自破
  for (const b of engineMod.BRANCHES) {
    const t = engineMod.BRANCH_BREAK[b];
    if (!t || t === b) { console.log('六破表含自破或缺失: ' + b); process.exit(1); }
    if (engineMod.BRANCH_BREAK[t] !== b) { console.log('六破表不对称: ' + b + '→' + t); process.exit(1); }
  }
  // 显式锁住「破与合重合」这处约定分歧：寅亥、巳申 既在六合表又在六破表。
  // 页面必须把这处分歧写出来（本站不偷偷选一种），这里防止有人「顺手」把重合项删掉。
  // 比较用集合，不用拼接字符串——拼接会把断言绑到 BRANCHES 的顺序上（第一次就栽在这里）。
  const overlap = engineMod.BRANCHES.filter((b) => engineMod.BRANCH_SIX_HE[b] === engineMod.BRANCH_BREAK[b]);
  const overlapSet = overlap.slice().sort().join('');
  const wantSet = ['寅', '亥', '巳', '申'].sort().join('');
  if (overlap.length !== 4 || overlapSet !== wantSet) {
    console.log('六破与六合的重合项应为 寅亥巳申 四支，实为 ' + overlap.join('')); process.exit(1);
  }
  // 自刑之支在「值太岁」时必须同时是「刑太岁」（辰午酉亥）——2026 丙午年属马者即值+刑
  for (const b of engineMod.SELF_PUNISH) {
    const bi = engineMod.BRANCHES.indexOf(b);
    const self = engineMod.taiSuiRelations(bi).filter((r) => r.bi === bi)[0];
    if (self.kinds.indexOf('zhi') < 0 || self.kinds.indexOf('xing') < 0) { console.log('自刑之支值年未同时论刑: ' + b); process.exit(1); }
  }
  // 黄金值：2027 丁未年犯太岁的四个生肖（页面要打印这几个字）
  const y27 = engineMod.yearProfile(2027);
  if (y27.ganzhi !== '丁未' || y27.zodiacEn !== 'Goat') { console.log('2027 应为丁未羊'); process.exit(1); }
  const off27 = y27.offenders.map((o) => o.animalEn + '[' + o.kinds.slice().sort().join('+') + ']').sort().join(' ');
  if (off27 !== 'Dog[po+xing] Goat[zhi] Ox[chong+xing] Rat[hai]') { console.log('2027 犯太岁黄金值失败: ' + off27); process.exit(1); }
  const y26 = engineMod.yearProfile(2026);
  if (y26.ganzhi !== '丙午' || y26.zodiacEn !== 'Horse') { console.log('2026 应为丙午马'); process.exit(1); }
  const off26 = y26.offenders.map((o) => o.animalEn + '[' + o.kinds.slice().sort().join('+') + ']').sort().join(' ');
  if (off26 !== 'Horse[xing+zhi] Ox[hai] Rabbit[po] Rat[chong]') { console.log('2026 犯太岁黄金值失败: ' + off26); process.exit(1); }

  // 8.9 五虎遁 × 六十甲子互证：年上起月的 12 个月柱必须全部落回六十甲子
  //     （干支同奇偶），且正月天干符合「甲己丙作首 / 乙庚戊为头 / 丙辛庚起 / 丁壬壬 / 戊癸甲」。
  const FIRST_MONTH_STEM = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' };
  for (let y = 1900; y <= 2100; y++) {
    const months = engineMod.yearMonthPillars(y);
    if (months.length !== 12) { console.log('月柱数应为 12'); process.exit(1); }
    if (months[0].branch !== '寅') { console.log('正月应为寅月'); process.exit(1); }
    if (months[0].stem !== FIRST_MONTH_STEM[engineMod.yearGanzhi(y)[0]]) {
      console.log('五虎遁正月天干错 ' + y + ': ' + months[0].stem); process.exit(1);
    }
    for (const m of months) {
      if (engineMod.JIAZI.indexOf(m.ganzhi) < 0) { console.log('月柱不在六十甲子内 ' + y + ' ' + m.ganzhi); process.exit(1); }
      if (engineMod.STEMS.indexOf(m.ganzhi[0]) % 2 !== engineMod.BRANCHES.indexOf(m.ganzhi[1]) % 2) {
        console.log('月柱干支不同奇偶 ' + y + ' ' + m.ganzhi); process.exit(1);
      }
    }
    // 月序与月建必须同步：第 k 月的支是 (k+1) 的月建
    for (let k = 0; k < 12; k++) {
      const bi = (k + 2) % 12;
      if (((bi + 10) % 12) + 1 !== months[k].month) { console.log('月建与月序不同步 ' + y); process.exit(1); }
    }
  }

  // 8.10 双引擎逐项一致（1900–2100 全扫 + 12 生肖剖面）
  for (let y = 1900; y <= 2100; y++) {
    if (stable(engineMod.lichunOf(y)) !== stable(BaziEngine.lichunOf(y))) { console.log('lichunOf 不一致 ' + y); process.exit(1); }
    if (engineMod.yearGanzhi(y) !== BaziEngine.yearGanzhi(y)) { console.log('yearGanzhi 不一致 ' + y); process.exit(1); }
    if (engineMod.zodiacIndexForYear(y) !== BaziEngine.zodiacIndexForYear(y)) { console.log('zodiacIndexForYear 不一致 ' + y); process.exit(1); }
    if (stable(engineMod.yearProfile(y)) !== stable(BaziEngine.yearProfile(y))) { console.log('yearProfile 不一致 ' + y); process.exit(1); }
    if (stable(engineMod.yearMonthPillars(y)) !== stable(BaziEngine.yearMonthPillars(y))) { console.log('yearMonthPillars 不一致 ' + y); process.exit(1); }
  }
  for (let bi = 0; bi < 12; bi++) {
    if (stable(engineMod.taiSuiRelations(bi)) !== stable(BaziEngine.taiSuiRelations(bi))) { console.log('taiSuiRelations 不一致 ' + bi); process.exit(1); }
    if (stable(engineMod.zodiacProfile(bi)) !== stable(BaziEngine.zodiacProfile(bi))) { console.log('zodiacProfile 不一致 ' + bi); process.exit(1); }
  }
  for (const [y, m, d, h, mi] of [[1990, 1, 15, 12, 0], [2024, 2, 4, 16, 0], [2027, 6, 1, 9, 30], [1900, 2, 4, 13, 51]]) {
    if (engineMod.zodiacIndexFromDateTime(y, m, d, h, mi) !== BaziEngine.zodiacIndexFromDateTime(y, m, d, h, mi)) {
      console.log('zodiacIndexFromDateTime 不一致 ' + y + '-' + m + '-' + d); process.exit(1);
    }
  }
  if (stable(engineMod.zodiacTaiSuiYears(4, 1984, 2040)) !== stable(BaziEngine.zodiacTaiSuiYears(4, 1984, 2040))) {
    console.log('zodiacTaiSuiYears 不一致'); process.exit(1);
  }
  // 非法入参
  if (engineMod.zodiacProfile(-1) !== null || engineMod.zodiacProfile(12) !== null) { console.log('zodiacProfile 非法索引未返回 null'); process.exit(1); }
  if (engineMod.zodiacIndexFromDateTime(2200, 1, 1) !== null) { console.log('越界年份未返回 null'); process.exit(1); }
  console.log('流年/生肖层 R30: 立春表 201 条字节相等 + 生肖可由六十甲子反推 + 换柱边界±1分钟 + 太岁守恒/互反/与地支表互证 + 五虎遁落回六十甲子 + 12 生肖剖面双引擎一致 ✓');
}


// ---------- ⑨ R31 六十四卦层（v0.10.0） ----------
// 与 R30 同一套纪律：不把真值抄第二遍，而是让数据自己互相印证。
// 本段包含四类断言：
//   ① 两引擎逐字段一致（64 卦剖面 + 全部派生函数 + 常量表字节相等）
//   ② 外部锚点：Unicode 两个区块的码点（U+2630 八卦符 / U+4DC0 六十四卦符）
//   ③ 结构交叉断言：文王配对规则、八宫双射、纳甲守恒、六亲回代、上下卦分布
//   ④ 传统黄金值：八纯卦纳甲口诀、乾坤六亲（人工核过，不是从引擎抄的）
{
  const H = engineMod, W = BaziEngine;

  // ---- 表长与常量字节相等 ----
  const tables = ['TRI', 'TRI_PY', 'TRI_IMG', 'TRI_IMG_EN', 'TRI_GLYPH', 'TRI_ELEMENT', 'TRI_VALUE',
    'TRI_FAMILY', 'TRI_FAMILY_EN', 'TRI_DIR', 'TRI_DIR_EN', 'TRI_YANG',
    'HEX_CN', 'HEX_PY', 'HEX_EN', 'HEX_UNI', 'HEX_UPPER', 'HEX_LOWER',
    'GONG_OF', 'GONG_STAGE', 'GONG_LABEL', 'GONG_LABEL_EN', 'SHI_POS', 'YING_POS',
    'NAJIA_STEM_IN', 'NAJIA_STEM_OUT', 'NAJIA_IN_START', 'NAJIA_OUT_START',
    'SIX_SPIRITS', 'SIX_SPIRITS_EN', 'SPIRIT_START_BY_STEM'];
  for (const k of tables) {
    if (stable(H[k]) !== stable(W[k])) { console.log('R31 常量不一致: ' + k); process.exit(1); }
  }
  for (const k of ['TRI', 'TRI_VALUE', 'TRI_GLYPH']) {
    if (H[k].length !== H.TRIGRAM_COUNT) { console.log('R31 ' + k + ' 长度≠8'); process.exit(1); }
  }
  for (const k of ['HEX_CN', 'HEX_PY', 'HEX_EN', 'HEX_UNI', 'HEX_UPPER', 'HEX_LOWER', 'GONG_OF', 'GONG_STAGE']) {
    if (H[k].length !== H.HEXAGRAM_COUNT) { console.log('R31 ' + k + ' 长度≠64（实为 ' + H[k].length + '）'); process.exit(1); }
  }
  // 卦名 / 英文名 / Unicode 名各自唯一——64 条不能有重复项掩盖缺项。
  // 拼音**故意不查唯一性**：卦名有大量同音字（乾/谦 都是 Qian、颐/益 都是 Yi、
  // 坤/困 都是 Kun、蹇/渐 都是 Jian、履/旅 都是 Lv、比/贲 都是 Bi），
  // 这正是页面 slug 必须带卦序号（hexagram-15-qian vs hexagram-1-qian）的原因。
  for (const k of ['HEX_CN', 'HEX_EN', 'HEX_UNI']) {
    if (new Set(H[k]).size !== 64) { console.log('R31 ' + k + ' 有重复项'); process.exit(1); }
  }
  // 拼音只查格式：非空、纯 ASCII 字母与空格（拼错的拼音会带声调符号或汉字）
  for (let n = 0; n < 64; n++) {
    if (!/^[A-Za-z]+( [A-Za-z]+)*$/.test(H.HEX_PY[n])) { console.log('R31 HEX_PY 格式异常: 第' + (n + 1) + '卦 ' + H.HEX_PY[n]); process.exit(1); }
  }
  if (new Set(H.HEX_CN.map((c, i) => c + '|' + H.HEX_UPPER[i] + H.HEX_LOWER[i])).size !== 64) {
    console.log('R31 卦名与上下卦的组合有重复——矩阵可能被抄错'); process.exit(1);
  }

  // ---- ② 外部锚点：Unicode 码点 ----
  for (let t = 0; t < 8; t++) {
    if (H.triGlyph(t) !== String.fromCharCode(0x2630 + t)) { console.log('R31 八卦符码点错: ' + t); process.exit(1); }
  }
  for (let n = 1; n <= 64; n++) {
    const g = H.hexGlyph(n);
    if (g !== String.fromCharCode(0x4DC0 + n - 1)) { console.log('R31 卦符码点错: ' + n); process.exit(1); }
  }
  if (new Set(Array.from({ length: 64 }, (_, i) => H.hexGlyph(i + 1))).size !== 64) { console.log('R31 卦符不唯一'); process.exit(1); }
  // 显示用的卦符必须与「上卦符 + 下卦符」同族（同属易符号区块，不能混进别的字符）
  if (H.hexGlyph(1).codePointAt(0) !== 0x4dc0 || H.hexGlyph(64).codePointAt(0) !== 0x4dff) { console.log('R31 卦符区间错'); process.exit(1); }

  // ---- ④ 传统黄金值：八纯卦纳甲（京房口诀，人工录入） ----
  // 口诀：乾金甲子外壬午，坎水戊寅外戊申，艮土丙辰外丙戌，震木庚子外庚午，
  //       巽木辛丑外辛未，离火己卯外己酉，坤土乙未外癸丑，兑金丁巳外丁亥。
  const NAJIA_GOLDEN = {
    1: '甲子甲寅甲辰壬午壬申壬戌', 2: '乙未乙巳乙卯癸丑癸亥癸酉',
    29: '戊寅戊辰戊午戊申戊戌戊子', 30: '己卯己丑己亥己酉己未己巳',
    51: '庚子庚寅庚辰庚午庚申庚戌', 52: '丙辰丙午丙申丙戌丙子丙寅',
    57: '辛丑辛亥辛酉辛未辛巳辛卯', 58: '丁巳丁卯丁丑丁亥丁酉丁未',
  };
  for (const k of Object.keys(NAJIA_GOLDEN)) {
    const n = Number(k);
    const got = H.najiaOf(n).map((x) => x.ganzhi).join('');
    if (got !== NAJIA_GOLDEN[k]) { console.log('R31 纳甲黄金值失败 第' + n + '卦：' + got + ' ≠ ' + NAJIA_GOLDEN[k]); process.exit(1); }
  }
  // 六亲黄金值：乾为天（乾宫金）与坤为地（坤宫土），也是传世固定值
  const LQ1 = H.hexagramProfile(1).najia.map((x) => x.liuqin).join(',');
  if (LQ1 !== '子孙,妻财,父母,官鬼,兄弟,父母') { console.log('R31 乾为天六亲错：' + LQ1); process.exit(1); }
  const LQ2 = H.hexagramProfile(2).najia.map((x) => x.liuqin).join(',');
  if (LQ2 !== '兄弟,父母,官鬼,兄弟,妻财,子孙') { console.log('R31 坤为地六亲错：' + LQ2); process.exit(1); }
  // 六神起例：甲日起青龙、庚日起白虎（自初爻向上顺排）
  if (H.sixSpiritsOfDayStem(0).map((x) => x.cn).join('') !== '青龙朱雀勾陈螣蛇白虎玄武') { console.log('R31 甲日六神错'); process.exit(1); }
  if (H.sixSpiritsOfDayStem(6).map((x) => x.cn).join('') !== '白虎玄武青龙朱雀勾陈螣蛇') { console.log('R31 庚日六神错'); process.exit(1); }

  // ---- ③ 结构交叉断言 ----
  // (a) 阳卦判据 = 阳爻数为奇数（《易传》「阳卦多阴」），并与 TRI_VALUE 的 popcount 互证
  for (let t = 0; t < 8; t++) {
    let pc = 0, v = H.TRI_VALUE[t];
    for (let i = 0; i < 3; i++) if ((v >> i) & 1) pc++;
    if (H.TRI_YANG[t] !== (pc % 2)) { console.log('R31 阳卦标记与数值 popcount 不符: ' + t); process.exit(1); }
    if (H.triYangCount(t) !== pc) { console.log('R31 triYangCount 错: ' + t); process.exit(1); }
  }
  // (b) 卦符阴阳字形与 TRI_VALUE 的对应：三爻自下而上 = 低到高位
  for (let n = 1; n <= 64; n++) {
    const L = H.hexLines(n);
    if (L.length !== 6 || L.some((x) => x !== 0 && x !== 1)) { console.log('R31 hexLines 越界: ' + n); process.exit(1); }
    const v = L.reduce((a, b, i) => a + (b << i), 0);
    if (H.hexFromBinaryIndex(v + 1) !== n) { console.log('R31 二进制序双射失败: ' + n); process.exit(1); }
    if (H.hexBinaryIndex(n) !== v + 1) { console.log('R31 hexBinaryIndex 错: ' + n); process.exit(1); }
    // 下卦三爻必须等于 HEX_LOWER 的数值，上卦三爻等于 HEX_UPPER —— 两条独立路径必须一致
    if ((L[0] | (L[1] << 1) | (L[2] << 2)) !== H.TRI_VALUE[H.HEX_LOWER[n - 1]]) { console.log('R31 下卦爻值不符: ' + n); process.exit(1); }
    if ((L[3] | (L[4] << 1) | (L[5] << 2)) !== H.TRI_VALUE[H.HEX_UPPER[n - 1]]) { console.log('R31 上卦爻值不符: ' + n); process.exit(1); }
  }
  // (c) 传统全名必须能由上卦象 + 下卦象 + 卦名反推（八纯卦用「卦名为象」）
  for (let n = 1; n <= 64; n++) {
    const p = H.hexagramProfile(n);
    const want = p.upper.index === p.lower.index
      ? p.cn + '为' + H.TRI_IMG[p.upper.index]
      : H.TRI_IMG[p.upper.index] + H.TRI_IMG[p.lower.index] + p.cn;
    if (p.fullCn !== want) { console.log('R31 传统全名反推失败 第' + n + '卦：' + p.fullCn + ' ≠ ' + want); process.exit(1); }
  }
  // (d) 文王卦序 32 对配对规则：奇数卦的配对卦 = 其综卦；若自综则取其错卦
  const SELF_REV = [];
  for (let n = 1; n <= 63; n += 2) {
    const z = H.zongHex(n);
    let partner;
    if (z === n) { SELF_REV.push(n); partner = H.cuoHex(n); } else { partner = z; }
    if (partner !== n + 1) { console.log('R31 文王配对规则失败: ' + n + ' → ' + partner); process.exit(1); }
  }
  if (SELF_REV.join(',') !== '1,27,29,61') { console.log('R31 自综卦集合异常：' + SELF_REV); process.exit(1); }
  // 错/综对合（自己作用两次回到自身），互卦必须落在 1..64
  for (let n = 1; n <= 64; n++) {
    if (H.cuoHex(H.cuoHex(n)) !== n) { console.log('R31 错卦非对合: ' + n); process.exit(1); }
    if (H.zongHex(H.zongHex(n)) !== n) { console.log('R31 综卦非对合: ' + n); process.exit(1); }
    if (!(H.huHex(n) >= 1 && H.huHex(n) <= 64)) { console.log('R31 互卦越界: ' + n); process.exit(1); }
  }
  // (e) 八宫：8 宫 × 8 卦 = 64，双射无重叠；世应位与宫内阶段一一对应
  const seen = new Set();
  for (let g = 0; g < 8; g++) {
    const mem = H.hexagonsInGong(g);
    if (mem.length !== 8) { console.log('R31 宫 ' + g + ' 卦数 ' + mem.length + '≠8'); process.exit(1); }
    for (const n of mem) {
      if (seen.has(n)) { console.log('R31 第' + n + '卦被两宫占用'); process.exit(1); }
      seen.add(n);
      if (H.GONG_OF[n - 1] !== g) { console.log('R31 GONG_OF 与成员表不一致: ' + n); process.exit(1); }
      // 本宫卦必须是该宫的八纯卦（上卦=下卦=宫卦）
      const p = H.hexagramProfile(n);
      if (p.palace.stage === 0 && (p.upper.index !== H.GONG_ORDER[g] || p.lower.index !== H.GONG_ORDER[g])) {
        console.log('R31 本宫卦不是纯卦: ' + n); process.exit(1);
      }
      // 世应不得同位
      if (p.palace.shi === p.palace.ying) { console.log('R31 世应同位: ' + n); process.exit(1); }
    }
  }
  if (seen.size !== 64) { console.log('R31 八宫未覆盖 64 卦'); process.exit(1); }
  // 八宫阶段分布：每宫必然恰好一个六世（本宫）/一世/…/归魂
  for (let g = 0; g < 8; g++) {
    const stages = H.hexagonsInGong(g).map((n) => H.GONG_STAGE[n - 1]).sort((a, b) => a - b);
    if (stages.join(',') !== '0,1,2,3,4,5,6,7') { console.log('R31 宫 ' + g + ' 阶段分布异常：' + stages); process.exit(1); }
  }
  // (f) 上下卦分布：每个卦作为上卦出现 8 次、作为下卦出现 8 次（等价于「1..64 各出现一次」）
  for (let t = 0; t < 8; t++) {
    if (H.hexagonsWithTrigram(t, 'upper').length !== 8) { console.log('R31 上卦分布错: ' + t); process.exit(1); }
    if (H.hexagonsWithTrigram(t, 'lower').length !== 8) { console.log('R31 下卦分布错: ' + t); process.exit(1); }
  }
  // (g) 纯卦 = 上卦与下卦相同，必须恰好 8 个且与 HEX_PURE 一致
  const pure = [];
  for (let n = 1; n <= 64; n++) if (H.HEX_UPPER[n - 1] === H.HEX_LOWER[n - 1]) pure.push(n);
  if (pure.join(',') !== H.HEX_PURE.join(',')) { console.log('R31 纯卦集合不一致'); process.exit(1); }
  // (h) 纳甲守恒：384 爻，12 地支每个恰好 32 次；且每一爻的干支必须落在六十甲子里
  const bc = {};
  for (let n = 1; n <= 64; n++) {
    for (const x of H.najiaOf(n)) {
      bc[x.branch] = (bc[x.branch] || 0) + 1;
      if (H.JIAZI.indexOf(x.ganzhi) < 0) { console.log('R31 纳甲不在六十甲子内: 第' + n + '卦 ' + x.ganzhi); process.exit(1); }
      // 干支阴阳必须一致（阳干只能配阳支）——与 R27 的地支阴阳表互证，不另抄真值
      if ((H.STEMS.indexOf(x.stem) % 2) !== (x.branchIndex % 2)) {
        console.log('R31 纳甲干支阴阳不一致: 第' + n + '卦 ' + x.ganzhi); process.exit(1);
      }
    }
  }
  const bvals = Object.values(bc);
  if (Object.keys(bc).length !== 12 || bvals.some((v) => v !== 32)) { console.log('R31 纳甲地支分布异常：' + JSON.stringify(bc)); process.exit(1); }
  // 六亲回代：以本宫五行为「我」，六亲由五行关系唯一确定
  for (let n = 1; n <= 64; n++) {
    const p = H.hexagramProfile(n);
    for (const x of p.najia) {
      if (x.liuqin !== H.liuQinOf(p.palace.element, x.branchIndex)) { console.log('R31 六亲未由宫五行唯一确定: 第' + n + '卦'); process.exit(1); }
    }
  }

  // ---- ① 两引擎逐字段一致 ----
  for (let n = 1; n <= 64; n++) {
    if (stable(H.hexagramProfile(n)) !== stable(W.hexagramProfile(n))) { console.log('R31 hexagramProfile 不一致: ' + n); process.exit(1); }
    if (stable(H.najiaOf(n)) !== stable(W.najiaOf(n))) { console.log('R31 najiaOf 不一致: ' + n); process.exit(1); }
    if (H.cuoHex(n) !== W.cuoHex(n) || H.zongHex(n) !== W.zongHex(n) || H.huHex(n) !== W.huHex(n)) { console.log('R31 错综互不一致: ' + n); process.exit(1); }
    if (H.hexGlyph(n) !== W.hexGlyph(n) || H.hexFullCn(n) !== W.hexFullCn(n)) { console.log('R31 卦符/全名不一致: ' + n); process.exit(1); }
  }
  for (let t = 0; t < 8; t++) {
    if (H.triGlyph(t) !== W.triGlyph(t) || H.triYangCount(t) !== W.triYangCount(t)) { console.log('R31 八卦派生不一致: ' + t); process.exit(1); }
  }
  for (let gi = 0; gi < 8; gi++) {
    if (stable(H.hexagonsInGong(gi)) !== stable(W.hexagonsInGong(gi))) { console.log('R31 八宫成员不一致: ' + gi); process.exit(1); }
  }
  for (let si = 0; si < 10; si++) {
    if (stable(H.sixSpiritsOfDayStem(si)) !== stable(W.sixSpiritsOfDayStem(si))) { console.log('R31 六神不一致: 天干 ' + si); process.exit(1); }
  }
  for (let k = 0; k <= 65; k++) {
    if (H.hexFromBinaryIndex(k) !== W.hexFromBinaryIndex(k)) { console.log('R31 二进制序反查不一致: ' + k); process.exit(1); }
  }
  // 非法入参一律返回 null（页面据此隐藏整块，不能渲染出半个卦）
  if (H.hexagramProfile(0) !== null || H.hexagramProfile(65) !== null) { console.log('R31 hexagramProfile 非法入参未返回 null'); process.exit(1); }
  if (H.hexLines(0) !== null || H.najiaOf(65) !== null) { console.log('R31 hexLines/najiaOf 非法入参未返回 null'); process.exit(1); }

  console.log('六十四卦层 R31: Unicode 两区块码点锚定 + 文王配对规则 32 对 + 八宫双射 8×8 + 纳甲 8 纯卦黄金值/12 支各 32 次/干支阴阳一致 + 传统全名可由上下卦反推 + 64 卦剖面双引擎逐字段一致 ✓');
}


// ---------- ⑩ R32 神煞层（v0.11.0） ----------
// 同一套纪律：定表不抄第二遍——禄神/羊刃与十二长生互证、空亡与旬首推导互证、
// 十恶大败与「禄入空亡」推导互证、红鸾天喜对冲恒等、孤辰寡宿与季组推导互证。
// 黄金值（甲子旬空戌亥、天乙甲→丑未/辛→午寅、红鸾子→卯等）人工核对过，不是从引擎抄的。
{
  const H = engineMod, W = BaziEngine;

  // ---- 常量表字节相等 + 长度 ----
  const tables = ['SS_LU', 'SS_YANG_REN', 'SS_YIN_REN', 'SS_NOBLEMAN', 'SS_NOBLEMAN_ALT',
    'SS_WENCHANG', 'SS_TAIJI', 'SS_GUOYIN', 'SS_FUXING', 'SS_JINYU',
    'SS_KONGWANG', 'SS_SHI_E', 'SS_KUIGANG', 'SS_CHACUO', 'SS_TIANSH',
    'SS_HONGLUAN', 'SS_TIANDOCTOR', 'SS_XUEREN', 'SS_TIANDI', 'SS_GUCHEN', 'SS_GUASU'];
  for (const k of tables) {
    if (stable(H[k]) !== stable(W[k])) { console.log('R32 常量不一致: ' + k); process.exit(1); }
  }
  for (const k of tables) {
    if (H[k].length !== (k === 'SS_KONGWANG' || k === 'SS_TIANSH' ? 4 : 0) && H[k].length !== 10 && H[k].length !== 12) {
      if (['SS_KUIGANG', 'SS_TIANSH'].indexOf(k) < 0 || H[k].length !== (k === 'SS_KUIGANG' ? 4 : 4)) {
        if (['SS_KONGWANG'].indexOf(k) < 0 || H[k].length !== 6) { console.log('R32 ' + k + ' 长度异常: ' + H[k].length); process.exit(1); }
      }
    }
  }
  if (H.SS_KUIGANG.length !== 4 || H.SS_TIANSH.length !== 4 || H.SS_KONGWANG.length !== 6) { console.log('R32 定表长度异常'); process.exit(1); }
  for (const k of ['SS_TRINE_STAR', 'SS_YUEDE', 'SS_TONGZI', 'SS_LUOWANG']) {
    if (stable(H[k]) !== stable(W[k])) { console.log('R32 常量不一致: ' + k); process.exit(1); }
  }

  // ---- ① 禄神 = 十二长生临官；阳刃/阴刃 = 帝旺（与既有表交叉印证） ----
  for (let i = 0; i < 10; i++) {
    const gan = H.STEMS[i];
    const luB = H.BRANCHES.find((b) => H.twelveStage(gan, b).stage === '临官');
    if (luB !== H.SS_LU[i]) { console.log('R32 禄神[' + i + '] 与长生临官不符: 表 ' + H.SS_LU[i] + ' 推导 ' + luB); process.exit(1); }
    const wangB = H.BRANCHES.find((b) => H.twelveStage(gan, b).stage === '帝旺');
    if (H.SS_YANG_REN[i] && H.SS_YANG_REN[i] !== wangB) { console.log('R32 阳刃[' + i + '] 与帝旺不符'); process.exit(1); }
    if (H.SS_YIN_REN[i] && H.SS_YIN_REN[i] !== wangB) { console.log('R32 阴刃[' + i + '] 与帝旺不符'); process.exit(1); }
    if (!!H.SS_YANG_REN[i] === !!H.SS_YIN_REN[i]) { console.log('R32 阳刃/阴刃应恰有一派取值: ' + gan); process.exit(1); }
  }

  // ---- ② 空亡：旬首推导 + 12 支守恒 + 黄金值 ----
  for (let x = 0; x < 6; x++) {
    const d1 = H.BRANCHES[(x * 10 + 10) % 12], d2 = H.BRANCHES[(x * 10 + 11) % 12];
    if (H.SS_KONGWANG[x] !== d1 + d2) { console.log('R32 空亡旬 ' + x + ' 与推导不符'); process.exit(1); }
    if (H.kongWangOf(x * 10)[0] !== (x * 10 + 10) % 12) { console.log('R32 kongWangOf 旬首错'); process.exit(1); }
  }
  if (new Set(H.SS_KONGWANG.join('').split('')).size !== 12) { console.log('R32 空亡 12 支不守恒'); process.exit(1); }
  if (H.kongWangOfDayGz('甲子').voids.join('') !== '戌亥' || H.kongWangOfDayGz('癸亥').voids.join('') !== '子丑') { console.log('R32 空亡黄金值'); process.exit(1); }
  if (H.kongWangOfDayGz('戊辰').xunStart !== '甲子') { console.log('R32 戊辰应在甲子旬'); process.exit(1); }

  // ---- ③ 十恶大败 = 禄入空亡推导；乙丑异文不成立 ----
  const derived = H.shiEDerived();
  if (derived.length !== 10) { console.log('R32 十恶大败推导数≠10'); process.exit(1); }
  if (stable([...derived].sort()) !== stable([...H.SS_SHI_E].sort())) { console.log('R32 十恶大败推导与定表不符'); process.exit(1); }
  if (H.SS_SHI_E.indexOf('乙丑') >= 0) { console.log('R32 渊海子平乙丑异文混入'); process.exit(1); }

  // ---- ④ 红鸾卯起逆行 / 天喜对冲 / 病符岁后一辰 ----
  for (let b = 0; b < 12; b++) {
    if (H.shenshaHongLuan(b) !== (3 - b + 24) % 12) { console.log('R32 红鸾逆行错: ' + b); process.exit(1); }
    if (H.shenshaTianXi(b) !== (H.shenshaHongLuan(b) + 6) % 12) { console.log('R32 天喜非红鸾对冲: ' + b); process.exit(1); }
    if (H.shenshaBingFu(b) !== (b + 11) % 12) { console.log('R32 病符错: ' + b); process.exit(1); }
  }
  if (H.SS_HONGLUAN[0] !== '卯' || H.BRANCHES[H.shenshaTianXi(0)] !== '酉') { console.log('R32 红鸾天喜黄金值（子→卯/酉）'); process.exit(1); }

  // ---- ⑤ 三合组星结构：四正/四生/四墓 + 组归属 ----
  const SET4 = { taohua: '子午卯酉', jiangxing: '子午卯酉', zaisha: '子午卯酉',
    yima: '寅申巳亥', wangshen: '寅申巳亥', jiesha: '寅申巳亥', huagai: '辰戌丑未' };
  for (const key in H.SS_TRINE_STAR) {
    const tbl = H.SS_TRINE_STAR[key];
    const keys = Object.keys(tbl);
    if (keys.length !== 4) { console.log('R32 三合星 ' + key + ' 组数≠4'); process.exit(1); }
    const vals = new Set(keys.map((g) => tbl[g]));
    if (vals.size !== 4) { console.log('R32 三合星 ' + key + ' 四组结果重复'); process.exit(1); }
    for (const v of vals) if (SET4[key].indexOf(v) < 0) { console.log('R32 三合星 ' + key + ' 结果 ' + v + ' 越界'); process.exit(1); }
    for (const g of keys) for (const ch of g) {
      if (H.shenshaTrineBranch(key, H.BRANCHES.indexOf(ch)) !== H.BRANCHES.indexOf(tbl[g])) { console.log('R32 shenshaTrineBranch 组归属错: ' + key + ' ' + ch); process.exit(1); }
    }
  }
  if (H.SS_TRINE_STAR.yima['寅午戌'] !== '申' || H.SS_TRINE_STAR.yima['申子辰'] !== '寅') { console.log('R32 驿马口诀黄金值'); process.exit(1); }

  // ---- ⑥ 孤辰 = 组首+3、寡宿 = 组首-1 ----
  const BACK = [1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0];
  for (let i = 0; i < 12; i++) {
    const start = (i - BACK[i] + 12) % 12;
    if (H.SS_GUCHEN[i] !== H.BRANCHES[(start + 3) % 12]) { console.log('R32 孤辰[' + i + '] 与推导不符'); process.exit(1); }
    if (H.SS_GUASU[i] !== H.BRANCHES[(start + 11) % 12]) { console.log('R32 寡宿[' + i + '] 与推导不符'); process.exit(1); }
  }

  // ---- ⑦ 天医 = 月支-1；天德 = 8 干 + 4 四生支；月德/月德合 ----
  for (let m = 0; m < 12; m++) {
    if (H.shenshaMonthBranch('tiandoctor', m) !== (m + 1) % 12) { console.log('R32 天医月序 ' + m + ' 错'); process.exit(1); }
  }
  {
    const stems = [], brs = [];
    for (const v of H.SS_TIANDI) (H.STEMS.indexOf(v) >= 0 ? stems : brs).push(v);
    if (stems.length !== 8 || new Set(stems).size !== 8) { console.log('R32 天德干项异常'); process.exit(1); }
    if (stable(brs.slice().sort()) !== stable(['亥', '寅', '巳', '申'].sort())) { console.log('R32 天德支项应为四生支'); process.exit(1); }
    if (H.shenshaTianDeTarget(0).cn !== '丁' || H.shenshaTianDeTarget(1).cn !== '申') { console.log('R32 天德黄金值（寅月丁/卯月申）'); process.exit(1); }
  }
  if (H.shenshaYueDeStem(H.BRANCHES.indexOf('寅')) !== '丙' || H.shenshaYueDeHeStem(H.BRANCHES.indexOf('寅')) !== '辛') { console.log('R32 月德黄金值（寅月丙/合辛）'); process.exit(1); }
  for (const g in H.SS_YUEDE) {
    if (H.SS_YUEDE[g] !== '丙' && H.SS_YUEDE[g] !== '壬' && H.SS_YUEDE[g] !== '甲' && H.SS_YUEDE[g] !== '庚') { console.log('R32 月德干越界'); process.exit(1); }
  }

  // ---- ⑧ 官/财/印/食四星：日干甲黄金值（主气口径） ----
  {
    const officer = H.shenshaTenGodBranches(0, 'officer');
    if (stable(officer.map((r) => r.branchIdx)) !== stable([H.BRANCHES.indexOf('申'), H.BRANCHES.indexOf('酉')])) { console.log('R32 甲官星应为申酉'); process.exit(1); }
    const wealth = H.shenshaTenGodBranches(0, 'wealth');
    if (wealth.length !== 4) { console.log('R32 甲财星应含辰戌丑未四支，实得 ' + wealth.length); process.exit(1); }
    const seal = H.shenshaTenGodBranches(0, 'seal');
    if (stable(seal.map((r) => H.BRANCHES[r.branchIdx]).sort()) !== stable(['亥', '子'].sort())) { console.log('R32 甲印星应为亥子（水主气生甲；丑辰主气土为财）'); process.exit(1); }
    const output = H.shenshaTenGodBranches(0, 'output');
    if (stable(output.map((r) => H.BRANCHES[r.branchIdx]).sort()) !== stable(['巳', '午'].sort())) { console.log('R32 甲食伤应为巳午（火主气）'); process.exit(1); }
    if (H.shenshaTenGodBranches(0, 'nope').length !== 0) { console.log('R32 非法 family 应返回空'); process.exit(1); }
  }

  // ---- ⑨ 天赦 / 魁罡 / 阴阳差错结构 ----
  if (H.shenshaTianShOfDayBranch(H.BRANCHES.indexOf('申')) !== '戊申') { console.log('R32 天赦秋=戊申'); process.exit(1); }
  if (H.shenshaTianShOfDayBranch(H.BRANCHES.indexOf('寅')) !== '戊寅') { console.log('R32 天赦春=戊寅'); process.exit(1); }
  for (let i = 0; i < 12; i++) {
    if (H.SS_CHACUO[i][0] !== '丙丁戊辛壬癸'[i % 6] || H.SS_CHACUO[i][1] !== H.BRANCHES[i]) { console.log('R32 阴阳差错结构错: ' + i); process.exit(1); }
  }

  // ---- ⑩ shenshaScan 双引擎逐字段一致 + 双黄金案例（人工逐条核对过） ----
  const scanCases = [
    [['甲子', '丙寅', '戊辰', '庚申'],
     ['文昌@时支', '太极贵人@日支', '福星贵人@时支', '驿马@月支（年日双起）', '华盖@日支（年日双起）', '将星@年支（年日双起）', '月德贵人@月支干', '孤辰@月支', '官星@月支', '财星@年支', '食伤星@时支']],
    [['甲申', '壬申', '戊申', '丁巳'],
     ['文昌@年支、月支、日支', '禄神@时支', '福星贵人@年支、月支、日支', '劫煞@时支（年日双起）', '月德贵人@月支干', '月德合@时支干', '阴阳差错@日支柱', '十恶大败@月支柱（传统以日柱为主）', '天赦@日柱', '地网@时支', '印星@时支', '食伤星@年支', '食伤星@月支', '食伤星@日支']],
  ];
  for (const [pillars, want] of scanCases) {
    const gh = H.shenshaScan(pillars).map((h) => h.cn + '@' + h.where);
    const gw = W.shenshaScan(pillars).map((h) => h.cn + '@' + h.where);
    if (stable(gh) !== stable(gw)) { console.log('R32 shenshaScan 双引擎不一致: ' + pillars.join('')); process.exit(1); }
    if (stable(gh) !== stable(want)) { console.log('R32 shenshaScan 黄金值不符: ' + pillars.join('') + '\n  got:  ' + gh.join(' | ') + '\n  want: ' + want.join(' | ')); process.exit(1); }
  }

  console.log('神煞层 R32: 定表与推导互证（禄=临官/刃=帝旺/空亡=旬首/十恶大败=禄入空亡/红鸾逆行/孤寡季组）+ 三合星四正四生四墓 + 天德 8干4支 + 甲四星黄金值 + scan 双黄金案例双引擎一致 ✓');
}

// ⑦ 三个新函数的版本一致性

for (const k of ['kongWangOfDayGz', 'shiEDerived', 'shenshaScan', 'shenshaTenGodBranches',
  'shenshaTrineBranch', 'shenshaDayStemBranches', 'shenshaHongLuan', 'shenshaTianDeTarget']) {
  if (typeof BaziEngine[k] !== 'function') { console.log('R32 web 引擎缺导出: ' + k); process.exit(1); }
}
if (engineMod.ENGINE_VERSION !== BaziEngine.ENGINE_VERSION) { console.log('双引擎版本不一致'); process.exit(1); }

// ==================== R36 八宅命卦（v0.12.0） ====================
{
  const need = ['KUA_DIRS', 'KUA_DIR_META', 'KUA_GUA', 'KUA_STAR_META', 'KUA_MANSIONS',
    'kuaFengShuiYear', 'kuaNumberOf', 'kuaFiveHandled', 'kuaProfile'];
  for (const k of need) {
    if (BaziEngine[k] === undefined) { console.log('R36 web 引擎缺导出: ' + k); process.exit(1); }
  }
  if (engineMod.KUA_MANSIONS === undefined) { console.log('R36 Node 引擎缺导出'); process.exit(1); }

  // ---- ① 定表双引擎字节相等 ----
  for (const k of ['KUA_DIRS', 'KUA_DIR_META', 'KUA_GUA', 'KUA_STAR_META', 'KUA_MANSIONS']) {
    if (stable(engineMod[k]) !== stable(BaziEngine[k])) { console.log('R36 定表双引擎不一致: ' + k); process.exit(1); }
  }

  // ---- ② 大游年表结构：每行恰八星各一次 + 全表对称 ----
  const STARS8 = ['生气', '延年', '天医', '伏位', '祸害', '六煞', '五鬼', '绝命'];
  const G8 = engineMod.KUA_DIRS;
  for (const h of G8) {
    const row = G8.map((d) => engineMod.KUA_MANSIONS[h][d]);
    if (stable([...row].sort()) !== stable([...STARS8].sort())) {
      console.log('R36 大游年行不是八星各一次: ' + h + ' → ' + row.join(',')); process.exit(1);
    }
    for (const d of G8) {
      if (engineMod.KUA_MANSIONS[h][d] !== engineMod.KUA_MANSIONS[d][h]) {
        console.log('R36 大游年表不对称: ' + h + d); process.exit(1);
      }
    }
  }

  // ---- ③ 东西不相混：四吉星只落同组四宫、四凶星只落异组四宫 ----
  const GROUP_OF = { '坎': 'east', '震': 'east', '巽': 'east', '离': 'east', '坤': 'west', '乾': 'west', '艮': 'west', '兑': 'west' };
  for (const h of G8) {
    const hg = GROUP_OF[h];
    for (const d of G8) {
      const star = engineMod.KUA_MANSIONS[h][d];
      const luck = engineMod.KUA_STAR_META[star].luck;
      const same = GROUP_OF[d] === hg;
      if ((luck === 1) !== same) {
        console.log('R36 东西不相混被破坏: ' + h + '→' + d + ' 星=' + star); process.exit(1);
      }
    }
  }

  // ---- ④ 命卦数黄金值（外部速查表逐例：卜易居公式例 + 口诀法例） ----
  const golden = [
    [1985, 'male', 6], [1988, 'female', 3], [1990, 'male', 1], [1990, 'female', 8],
    [1979, 'male', 3], [1979, 'female', 3], [2005, 'male', 4], [2008, 'female', 8],
    [2000, 'male', 9], [2000, 'female', 6],
  ];
  for (const [y, g, exp] of golden) {
    if (engineMod.kuaNumberOf(y, g) !== exp) { console.log('R36 Node 黄金值: ' + y + g + ' 应 ' + exp); process.exit(1); }
    if (BaziEngine.kuaNumberOf(y, g) !== exp) { console.log('R36 web 黄金值: ' + y + g + ' 应 ' + exp); process.exit(1); }
  }

  // ---- ⑤ 世纪公式 ≡ 统一式（男 (2−Y)%9 / 女 (Y−5)%9），1900–2099 全年份双引擎 ----
  const unified = (y, g) => {
    let n = ((g === 'male' ? 2 - y : y - 5) % 9 + 9) % 9;
    if (n === 0) n = 9;
    if (n === 5) n = g === 'male' ? 2 : 8;
    return n;
  };
  for (const E of [engineMod, BaziEngine]) {
    for (let y = 1900; y <= 2099; y++) {
      for (const g of ['male', 'female']) {
        if (E.kuaNumberOf(y, g) !== unified(y, g)) {
          console.log('R36 世纪公式≠统一式: ' + y + ' ' + g + ' (engine=' + (E === engineMod ? 'node' : 'web') + ')'); process.exit(1);
        }
      }
    }
  }

  // ---- ⑥ 寄宫标志 ----
  if (!engineMod.kuaFiveHandled(1990, 'female') || !BaziEngine.kuaFiveHandled(1990, 'female')) { console.log('R36 1990 女应为寄卦(余5)'); process.exit(1); }
  if (!engineMod.kuaFiveHandled(2008, 'female')) { console.log('R36 2008 女应为寄卦'); process.exit(1); }
  if (engineMod.kuaFiveHandled(1985, 'male')) { console.log('R36 1985 男不应为寄卦'); process.exit(1); }
  if (engineMod.kuaFiveHandled(2000, 'male')) { console.log('R36 2000 男(余0→9)不应为寄卦'); process.exit(1); }

  // ---- ⑦ 立春边界：风水年切换（2026 立春 = 02-04 04:02） ----
  if (engineMod.kuaFengShuiYear(2026, 2, 3, 12, 0) !== 2025) { console.log('R36 立春前应属上一年'); process.exit(1); }
  if (engineMod.kuaFengShuiYear(2026, 2, 4, 4, 2) !== 2026) { console.log('R36 立春时刻当分钟起属当年'); process.exit(1); }
  if (engineMod.kuaFengShuiYear(2026, 2, 4, 4, 1) !== 2025) { console.log('R36 立春前 1 分钟仍属上一年'); process.exit(1); }
  const b3 = engineMod.kuaProfile(2026, 2, 3, 'male');
  const b5 = engineMod.kuaProfile(2026, 2, 5, 'male');
  if (b3.fsYear !== 2025 || b3.kua !== 2 || b3.gua !== '坤') { console.log('R36 2026-02-03 男应 = 乙巳年坤二'); process.exit(1); }
  if (b5.fsYear !== 2026 || b5.kua !== 1 || b5.gua !== '坎') { console.log('R36 2026-02-05 男应 = 丙午年坎一'); process.exit(1); }

  // ---- ⑧ kuaProfile 双引擎逐字段一致（跨年代×两性×寄卦×边界共 12 例） ----
  const cases = [
    [1990, 6, 15, 'female'], [1985, 3, 21, 'male'], [1988, 11, 2, 'female'],
    [2000, 1, 1, 'male'], [2000, 12, 31, 'female'], [2005, 8, 8, 'male'],
    [2008, 2, 5, 'female'], [1979, 7, 4, 'male'], [2026, 2, 3, 'male'],
    [2026, 2, 5, 'male'], [1995, 2, 4, 'female'], [1950, 1, 1, 'female'],
  ];
  for (const c of cases) {
    const a = engineMod.kuaProfile(c[0], c[1], c[2], c[3], 12, 0);
    const b = BaziEngine.kuaProfile(c[0], c[1], c[2], c[3], 12, 0);
    if (stable(a) !== stable(b)) { console.log('R36 kuaProfile 双引擎不一致: ' + c.join('-')); process.exit(1); }
    if (a.directions.length !== 8) { console.log('R36 方位数应为 8'); process.exit(1); }
    const fuwei = a.directions.find((d) => d.starCn === '伏位');
    if (!fuwei || fuwei.gua !== a.gua) { console.log('R36 伏位不在本命宫: ' + c.join('-')); process.exit(1); }
  }

  // ---- ⑨ kuaProfile 黄金档案（1990-06-15 女 = 寄艮八，逐方向核对衍象坊总表） ----
  const p90 = engineMod.kuaProfile(1990, 6, 15, 'female', 12, 0);
  if (p90.fsYear !== 1990 || p90.fsYearGanzhi !== '庚午' || p90.kua !== 8 || p90.gua !== '艮'
    || p90.group !== 'west' || p90.groupCn !== '西四命' || !p90.fiveHandled) {
    console.log('R36 1990 女档案不符'); process.exit(1);
  }
  const GEN_ROW = { '坎': '五鬼', '艮': '伏位', '震': '六煞', '巽': '绝命', '离': '祸害', '坤': '生气', '兑': '延年', '乾': '天医' };
  for (const d of p90.directions) {
    if (d.starCn !== GEN_ROW[d.gua]) { console.log('R36 艮命八星不符: ' + d.gua + ' 应 ' + GEN_ROW[d.gua] + ' 实 ' + d.starCn); process.exit(1); }
  }

  console.log('八宅命卦 R36: 大游年定表双引擎一致 + 全表对称/每行八星/东西不相混 + 命卦数 10 黄金值 + 世纪公式≡统一式(1900–2099×2性×2引擎) + 立春边界±1分钟 + 12 例档案双引擎一致 + 艮命逐星对账 ✓');
}

// ==================== R37 每日干支（v0.13.0） ====================
{
  const need = ['DAILY_OFFICERS', 'dailyOfficerIndex', 'dailyOfficer', 'dailyProfile'];
  for (const k of need) {
    if (BaziEngine[k] === undefined) { console.log('R37 web 引擎缺导出: ' + k); process.exit(1); }
    if (engineMod[k] === undefined) { console.log('R37 Node 引擎缺导出: ' + k); process.exit(1); }
  }

  // ---- ① 建除表：双引擎字节相等 + 12 项 + cn 唯一 + en 非空 ----
  if (stable(engineMod.DAILY_OFFICERS) !== stable(BaziEngine.DAILY_OFFICERS)) {
    console.log('R37 DAILY_OFFICERS 双引擎不一致'); process.exit(1);
  }
  if (engineMod.DAILY_OFFICERS.length !== 12) { console.log('R37 建除表应 12 项'); process.exit(1); }
  if (new Set(engineMod.DAILY_OFFICERS.map(o => o.cn)).size !== 12) { console.log('R37 建除 cn 有重复'); process.exit(1); }
  if (engineMod.DAILY_OFFICERS.some(o => !o.en || o.en.indexOf('—') < 0)) { console.log('R37 建除 en 缺失或格式错'); process.exit(1); }

  // ---- ② 结构断言（12×12 全组合×双引擎）：固定月支 12 官各一次 + 建⟺同支 + 破⟺冲月支 ----
  const BR = engineMod.BRANCHES, CLASH = engineMod.BRANCH_CLASH;
  for (const E of [engineMod, BaziEngine]) {
    for (const m of BR) {
      const seen = [];
      for (const d of BR) {
        const o = E.dailyOfficer(m, d);
        if (!o || o.index < 0) { console.log('R37 dailyOfficer 返回空: ' + m + d); process.exit(1); }
        seen.push(o.cn);
        if ((o.index === 0) !== (d === m)) { console.log('R37 建⟺同支被破坏: ' + m + d); process.exit(1); }
        if ((o.index === 6) !== (d === CLASH[m])) { console.log('R37 破⟺冲月支被破坏: ' + m + d); process.exit(1); }
      }
      if (new Set(seen).size !== 12) { console.log('R37 固定月支未用满 12 官: ' + m); process.exit(1); }
    }
  }

  // ---- ③ lunar 库逐日对账：公式 vs LunarUtil.ZHI_XING ----
  const Lunar = sandbox.module.exports.Lunar;
  if (!Lunar) { console.log('R37 sandbox Lunar 未暴露'); process.exit(1); }
  let checked = 0, mismatch = 0;
  for (let d = new Date(2025, 0, 1); d <= new Date(2026, 8, 20); d.setDate(d.getDate() + 1)) {
    const lu = Lunar.fromDate(new Date(d));
    const got = engineMod.dailyOfficer(lu.getMonthZhi(), lu.getDayZhi());
    checked++;
    if (got.cn !== lu.getZhiXing()) {
      mismatch++;
      if (mismatch <= 3) console.log('R37 lunar 对账失配: ' + d.toISOString().slice(0, 10) + ' lunar=' + lu.getZhiXing() + ' engine=' + got.cn);
    }
  }
  if (mismatch > 0) { console.log('R37 lunar 对账 ' + mismatch + '/' + checked + ' 失配'); process.exit(1); }

  // ---- ④ dailyProfile 双引擎逐字段一致（12 例跨月界/破日/晚子时/年初） ----
  const cases = [
    [2026, 9, 20, 12, 0], [2026, 9, 26, 12, 0], [2026, 9, 6, 12, 0],
    [2026, 9, 19, 23, 30], [2026, 1, 1, 0, 30], [2025, 6, 15, 8, 0],
    [2026, 2, 3, 23, 10], [2026, 2, 4, 5, 0], [2024, 2, 10, 12, 0],
    [2026, 12, 31, 21, 0], [2025, 11, 7, 6, 30], [2026, 5, 5, 14, 45],
  ];
  for (const c of cases) {
    const a = engineMod.dailyProfile(c[0], c[1], c[2], c[3], c[4]);
    const b = BaziEngine.dailyProfile(c[0], c[1], c[2], c[3], c[4]);
    if (stable(a) !== stable(b)) { console.log('R37 dailyProfile 双引擎不一致: ' + c.join('-')); process.exit(1); }
    if (!a || !a.officer || a.voids.length !== 2) { console.log('R37 dailyProfile 结构缺失: ' + c.join('-')); process.exit(1); }
  }

  // ---- ⑤ 黄金档案：2026-09-20 12:00（探针算定的真值，非手抄） ----
  const t = engineMod.dailyProfile(2026, 9, 20, 12, 0);
  const exp = {
    pillars: { year: '丙午', month: '丁酉', day: '丁酉', hour: '丙午' },
    officer: { index: 0, cn: '建' }, clashBranch: '卯', clashAnimalEn: 'Rabbit',
    voids: ['辰', '巳'], xunStart: '甲午', naYinCn: '山下火', naYinEn: 'Foothill Fire',
    hourZhi: '午', hourRange: '11:00–13:00',
  };
  const flat = JSON.stringify(t);
  for (const [k, v] of Object.entries(exp)) {
    if (flat.indexOf(JSON.stringify(v).slice(1, -1)) < 0 && k !== 'pillars' && k !== 'officer') {
      console.log('R37 黄金档案缺 ' + k + ' 期望 ' + JSON.stringify(v)); process.exit(1);
    }
  }
  if (stable(t.pillars) !== stable(exp.pillars)) { console.log('R37 今日四柱不符: ' + flat.slice(0, 200)); process.exit(1); }
  if (t.officer.index !== 0 || t.officer.cn !== '建') { console.log('R37 建日判定错'); process.exit(1); }
  const po = engineMod.dailyProfile(2026, 9, 26, 12, 0);
  if (po.dayGz !== '癸卯' || !po.isPoDay || !po.poIsMonthClash) { console.log('R37 2026-09-26 应为破日（癸卯 冲月支酉）'); process.exit(1); }

  // ---- ⑥ 晚子时换日：23:30 已算次日（R11 口径） ----
  const late = engineMod.dailyProfile(2026, 9, 19, 23, 30);
  if (late.dayGz !== '丁酉' || late.hourZhi !== '子') { console.log('R37 晚子时换日错: ' + late.dayGz + late.hourZhi); process.exit(1); }

  // ---- ⑦ 月柱节气边界：白露前属申月 ----
  const mb = engineMod.dailyProfile(2026, 9, 6, 12, 0);
  if (mb.pillars.month !== '丙申') { console.log('R37 白露前月柱应 丙申，实 ' + mb.pillars.month); process.exit(1); }

  console.log('每日干支 R37: 建除表双引擎一致 + 12×12 结构断言（建⟺同支/破⟺冲月支/12 官轮转） + lunar 库 ' + checked + ' 天零失配 + 12 例档案双引擎一致 + 今日/破日/晚子时/月界黄金值 ✓');
}

// ==================== R38 嫁娶择日（v0.14.0） ====================
{
  const need = ['weddingScan', 'weddingDayProfile', 'weddingAnchors', 'xiuOfDate', 'dayTianShen',
    'dayTianShenIndex', 'jianChuHuangDao', 'OFFICER_MARRY', 'WEDDING_WEIGHTS', 'TIAN_SHEN_GOOD',
    'XIU_CN', 'XIU_EN', 'XIU_LUCK', 'XIU_MARRY', 'XIU_SEVEN_CN'];
  for (const k of need) {
    if (BaziEngine[k] === undefined) { console.log('R38 web 引擎缺导出: ' + k); process.exit(1); }
    if (engineMod[k] === undefined) { console.log('R38 Node 引擎缺导出: ' + k); process.exit(1); }
  }

  // ---- ① 二十八宿定表：28 项唯一 + 嫁娶 10/13/5 + 吉凶 11/7/10 ----
  if (engineMod.XIU_CN.length !== 28 || new Set(engineMod.XIU_CN).size !== 28) { console.log('R38 XIU_CN 非 28 项唯一'); process.exit(1); }
  if (engineMod.XIU_EN.length !== 28 || new Set(engineMod.XIU_EN).size !== 28) { console.log('R38 XIU_EN 非 28 项唯一'); process.exit(1); }
  const marryCnt = { yes: 0, no: 0, mixed: 0 }, luckCnt = { '吉': 0, '平': 0, '凶': 0 };
  engineMod.XIU_MARRY.forEach(v => { marryCnt[v] = (marryCnt[v] || 0) + 1; });
  engineMod.XIU_LUCK.forEach(v => { luckCnt[v] = (luckCnt[v] || 0) + 1; });
  if (marryCnt.yes !== 10 || marryCnt.no !== 13 || marryCnt.mixed !== 5) { console.log('R38 宿嫁娶定表计数不符: ' + JSON.stringify(marryCnt)); process.exit(1); }
  if (luckCnt['吉'] !== 11 || luckCnt['平'] !== 7 || luckCnt['凶'] !== 10) { console.log('R38 宿吉凶定表计数不符: ' + JSON.stringify(luckCnt)); process.exit(1); }
  // 七曜交叉断言：表里的七曜必须等于「外部源逐宿抄录串」——两张互不依赖的编码必须逐字相等
  const SEVEN_TRUTH = '木金土日月火水木金土日月火水木金土日月火水木金土日月火水';
  const derived = engineMod.XIU_CN.map((_, i) => engineMod.XIU_SEVEN_CN[i % 7]).join('');
  if (derived !== SEVEN_TRUTH) { console.log('R38 七曜推导与外部源不符: ' + derived); process.exit(1); }
  // 四兽：每 7 宿一组，四组名固定
  const MANSIONS = ['东方苍龙', '北方玄武', '西方白虎', '南方朱雀'];
  for (let g = 0; g < 4; g++) {
    if (engineMod.XIU_MANSION_CN[g] !== MANSIONS[g]) { console.log('R38 四兽名不符: ' + g); process.exit(1); }
  }
  // mixed 宿必须都有分歧说明（不能静默）
  engineMod.XIU_CN.forEach((cn, i) => {
    if (engineMod.XIU_MARRY[i] === 'mixed' && !engineMod.XIU_MARRY_DIVERGE_CN[cn]) { console.log('R38 mixed 宿缺分歧说明: ' + cn); process.exit(1); }
  });

  // ---- ② 十二天神：12 项唯一 + 6 黄 6 黑 + 起例口诀六对闭合 ----
  if (engineMod.TIAN_SHEN_CN.length !== 12 || new Set(engineMod.TIAN_SHEN_CN).size !== 12) { console.log('R38 天神表非 12 项唯一'); process.exit(1); }
  const tsGoodCnt = engineMod.TIAN_SHEN_GOOD.filter(Boolean).length;
  if (tsGoodCnt !== 6) { console.log('R38 天神黄道数应为 6，实 ' + tsGoodCnt); process.exit(1); }
  // 口诀「寅申起子、卯酉起寅、辰戌起辰、巳亥起午、子午起申、丑未起戌」：青龙（index 0）落支
  const START_PAIRS = [['寅', '申', '子'], ['卯', '酉', '寅'], ['辰', '戌', '辰'], ['巳', '亥', '午'], ['子', '午', '申'], ['丑', '未', '戌']];
  for (const [mA, mB, start] of START_PAIRS) {
    for (const mb of [mA, mB]) {
      const bi = engineMod.BRANCHES.indexOf(mb);
      const idx = engineMod.dayTianShenIndex(bi, engineMod.BRANCHES.indexOf(start));
      if (idx !== 0) { console.log('R38 青龙起例不符: ' + mb + '月 起 ' + start + ' 实天神 ' + engineMod.TIAN_SHEN_CN[idx]); process.exit(1); }
    }
  }
  // 每月支下 12 官用满（与 R37 建除同构）+ 双引擎一致
  for (let m = 0; m < 12; m++) {
    const seen = new Set();
    for (let d = 0; d < 12; d++) {
      const idx = engineMod.dayTianShenIndex(m, d);
      seen.add(idx);
      const w = BaziEngine.dayTianShenIndex(m, d);
      if (w !== idx) { console.log('R38 dayTianShenIndex 双引擎不一致'); process.exit(1); }
    }
    if (seen.size !== 12) { console.log('R38 月支 ' + engineMod.BRANCHES[m] + ' 下 12 天神未用满'); process.exit(1); }
  }

  // ---- ③ 两套黄黑道是两套系统：144 组合里恰好 72 个同结论（50.0%） ----
  let hdAgree = 0;
  for (let m = 0; m < 12; m++) for (let d = 0; d < 12; d++) {
    const jc = engineMod.jianChuHuangDao((d - m + 12) % 12);
    const ts = engineMod.TIAN_SHEN_GOOD[engineMod.dayTianShenIndex(m, d)];
    if (jc === ts) hdAgree++;
  }
  if (hdAgree !== 72) { console.log('R38 两法一致数应为 72/144，实 ' + hdAgree); process.exit(1); }

  // ---- ④ lunar 库逐日对账：宿（jdn+11)%28 + 天神口诀式，各 900 天零失配 ----
  const Lunar = sandbox.module.exports.Lunar;
  if (!Lunar) { console.log('R38 sandbox Lunar 未暴露'); process.exit(1); }
  let nX = 0, nT = 0, checkedD = 0;
  for (let i = 0; i < 900; i++) {
    const dt = new Date(Date.UTC(2024, 0, 1, 12) + i * 86400000);
    const lu = Lunar.fromDate(new Date(dt.getTime()));
    const x = engineMod.xiuOfDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    if (x.cn !== lu.getXiu()) { nX++; if (nX <= 3) console.log('R38 宿失配 ' + x.dateEn + ' ' + x.cn + ' vs ' + lu.getXiu()); }
    const t = engineMod.dayTianShen(lu.getMonthZhi(), lu.getDayZhi());
    if (t.cn !== lu.getDayTianShen()) { nT++; if (nT <= 3) console.log('R38 天神失配 ' + t.cn + ' vs ' + lu.getDayTianShen()); }
    checkedD++;
  }
  if (nX > 0 || nT > 0) { console.log('R38 lunar 对账失配 宿 ' + nX + ' 天神 ' + nT); process.exit(1); }
  // 反之：宿吉凶表与库的 getXiuLuck 只允许在「平」处分歧（21/28 一致，7 个分歧恰为平）
  const libLuck = {};
  for (let i = 0; i < 28 * 20; i++) {
    const dt = new Date(Date.UTC(2024, 0, 1, 12) + i * 86400000);
    const lu = Lunar.fromDate(new Date(dt.getTime()));
    const k = lu.getXiu();
    libLuck[k] = libLuck[k] || {};
    libLuck[k][lu.getXiuLuck()] = (libLuck[k][lu.getXiuLuck()] || 0) + 1;
  }
  let xAgree = 0, xDiverge = [];
  engineMod.XIU_CN.forEach((cn, i) => {
    const lib = Object.keys(libLuck[cn]).sort((a, b) => libLuck[cn][b] - libLuck[cn][a])[0];
    const mine = engineMod.XIU_LUCK[i];
    const ok = (lib === '吉' && mine === '吉') || (lib === '凶' && mine === '凶');
    if (ok) xAgree++; else xDiverge.push(cn);
  });
  if (xAgree !== 21) { console.log('R38 宿吉凶与库一致数应为 21/28，实 ' + xAgree); process.exit(1); }
  for (const cn of xDiverge) {
    if (engineMod.XIU_LUCK[engineMod.XIU_CN.indexOf(cn)] !== '平') { console.log('R38 与库分歧的宿应为「平」: ' + cn); process.exit(1); }
  }

  // ---- ⑤ 硬性排除：五类各取真值断言（黄金值先用探针算定） ----
  const groom = { year: 1992, month: 5, day: 20, hour: 12, minute: 0 };   // 壬申年 丙申日
  const bride = { year: 1994, month: 8, day: 3, hour: 12, minute: 0 };    // 甲戌年 辛酉日
  const an = engineMod.weddingAnchors(groom, 'M');
  const ab = engineMod.weddingAnchors(bride, 'F');
  if (an.yearPillar !== '壬申' || an.dayPillar !== '丙申' || an.animalEn !== 'Monkey') { console.log('R38 新郎锚点不符: ' + JSON.stringify(an)); process.exit(1); }
  if (ab.yearPillar !== '甲戌' || ab.dayPillar !== '辛酉' || ab.animalEn !== 'Dog') { console.log('R38 新娘锚点不符: ' + JSON.stringify(ab)); process.exit(1); }
  const couple = { groom: an, bride: ab };
  const po = engineMod.weddingDayProfile(2026, 9, 26, couple);   // 癸卯 破日
  if (po.passes || po.rejects.map(r => r.key).indexOf('month-po') < 0) { console.log('R38 2026-09-26 破日未排除: ' + JSON.stringify(po.rejects.map(r => r.key))); process.exit(1); }
  const closeDay = engineMod.weddingDayProfile(2026, 9, 22, couple);   // 需为闭日（下断言时先看 reject）
  if (closeDay.officer.cn === '闭' && closeDay.passes) { console.log('R38 闭日未排除'); process.exit(1); }
  // 冲新郎本命日支（申）→ 日支寅
  let found = null;
  for (let d = 1; d <= 31 && !found; d++) {
    const p = engineMod.weddingDayProfile(2026, 8, d, couple);
    if (p.dayBranch === '寅') found = p;
  }
  if (!found || found.rejects.map(r => r.key).indexOf('clash-groom-day') < 0) { console.log('R38 冲新郎本命日支未排除'); process.exit(1); }

  // ---- ⑥ 扫描统计 + 评分结构（黄金值锁定，权重一改就红） ----
  const r26 = engineMod.weddingScan({ groom, bride, from: { y: 2026, m: 1, d: 1 }, to: { y: 2026, m: 12, d: 31 } });
  if (r26.total !== 365 || r26.passed !== 199 || r26.excluded !== 166) {
    console.log('R38 2026 全年统计不符: ' + r26.total + '/' + r26.passed + '/' + r26.excluded); process.exit(1);
  }
  if (r26.byReason['month-po'] !== 31 || r26.byReason['year-po'] !== 31 || r26.byReason['close-day'] !== 33) {
    console.log('R38 2026 排除因由不符: ' + JSON.stringify(r26.byReason)); process.exit(1);
  }
  const hi = r26.days.filter(d => d.score >= 70).length, top = r26.days.filter(d => d.score >= 85).length;
  if (hi !== 69 || top !== 24) { console.log('R38 2026 高分日数不符: ≥70 ' + hi + ' ≥85 ' + top); process.exit(1); }
  if (r26.huangDaoAgree !== 184) { console.log('R38 2026 两法一致天数不符: ' + r26.huangDaoAgree); process.exit(1); }
  // 评分 = base + Σ信号权重（clamp 0..100）；等第映射
  for (const d of r26.days.slice(0, 40)) {
    let s = engineMod.WEDDING_WEIGHTS.base;
    for (const sg of d.signals) s += sg.weight;
    s = Math.max(0, Math.min(100, s));
    if (s !== d.score) { console.log('R38 评分与信号和不符: ' + d.dateEn + ' ' + s + ' vs ' + d.score); process.exit(1); }
    if (d.score < 0 || d.score > 100) { console.log('R38 评分越界'); process.exit(1); }
  }

  // ---- ⑦ 黄金档案：2027-05-02（辛巳 除日 明堂黄道 房宿宜嫁娶，满分） ----
  const w = engineMod.weddingScan({ groom, bride, from: { y: 2027, m: 5, d: 1 }, to: { y: 2027, m: 5, d: 31 } });
  if (w.total !== 31 || w.passed !== 20 || w.excluded !== 11) { console.log('R38 2027-05 统计不符: ' + w.total + '/' + w.passed + '/' + w.excluded); process.exit(1); }
  const best = w.best;
  if (best.dateEn !== '2027-05-02' || best.dayGz !== '辛巳' || best.officer.cn !== '除' || best.tianShen.cn !== '明堂'
    || best.xiu.cn !== '房' || best.xiu.marriage !== 'yes' || best.score !== 100 || best.tier !== 'top' || !best.huangDaoAgree) {
    console.log('R38 2027-05-02 黄金档案不符: ' + JSON.stringify({ d: best.dateEn, gz: best.dayGz, of: best.officer.cn, ts: best.tianShen.cn, x: best.xiu.cn, sc: best.score }));
    process.exit(1);
  }
  if (best.weekday.index !== 0 || best.weekday.en !== 'Sunday') { console.log('R38 星期计算错: ' + best.weekday.en); process.exit(1); }
  // 巳申既六合又相刑：两条信号必须同时出现（公开分歧的另一面）
  const keys = best.signals.map(s => s.key);
  if (keys.indexOf('he-groom-day') < 0 || keys.indexOf('punish-groom') < 0) { console.log('R38 巳申合刑应并存: ' + keys.join(',')); process.exit(1); }
  // 只看周末
  const wk = engineMod.weddingScan({ groom, bride, from: { y: 2027, m: 5, d: 1 }, to: { y: 2027, m: 5, d: 31 }, weekendOnly: true });
  if (wk.passed !== 6 || wk.weekendSkipped !== 21) { console.log('R38 周末筛选不符: ' + wk.passed + '/' + wk.weekendSkipped); process.exit(1); }
  for (const d of wk.days) { if (d.weekday.index !== 0 && d.weekday.index !== 6) { console.log('R38 周末筛选含工作日 ' + d.dateEn); process.exit(1); } }

  // ---- ⑧ weddingDayProfile 双引擎逐字段一致（12 例跨月界/破日/闭日/冲日/年初） ----
  const dayCases = [[2026, 9, 20], [2026, 9, 26], [2027, 5, 2], [2027, 5, 15], [2027, 1, 1],
    [2026, 12, 31], [2025, 2, 3], [2028, 2, 29], [2026, 6, 18], [2027, 8, 8], [2026, 3, 5], [2029, 11, 22]];
  for (const c of dayCases) {
    const a = engineMod.weddingDayProfile(c[0], c[1], c[2], couple);
    const b = BaziEngine.weddingDayProfile(c[0], c[1], c[2], couple);
    if (stable(a) !== stable(b)) { console.log('R38 weddingDayProfile 双引擎不一致: ' + c.join('-')); process.exit(1); }
    if (!a.xiu || !a.tianShen || !a.officer || !a.signals.length) { console.log('R38 档案结构缺失: ' + c.join('-')); process.exit(1); }
  }
  // 扫描也必须双引擎一致（取一个月）
  const sa = engineMod.weddingScan({ groom, bride, from: { y: 2027, m: 5, d: 1 }, to: { y: 2027, m: 5, d: 31 } });
  const sb2 = BaziEngine.weddingScan({ groom, bride, from: { y: 2027, m: 5, d: 1 }, to: { y: 2027, m: 5, d: 31 } });
  if (stable(sa.days) !== stable(sb2.days) || stable(sa.byReason) !== stable(sb2.byReason)) { console.log('R38 weddingScan 双引擎不一致'); process.exit(1); }

  console.log('嫁娶择日 R38: 宿/天神定表结构断言 + 七曜×外部源逐字一致 + 两法黄黑道 72/144(50.0%) + lunar 库 900 天零失配（宿与天神）+ 宿吉凶 21/28（分歧 7 个恰为「平」）+ 硬性排除真值 + 2026 全年 199 通过/69 高分 + 2027-05 黄金档案 + 12 例双引擎一致 ✓');
}


// ================= R39 姓名五行字表（v0.15.0） =================
{
  const FIVE = ['木', '火', '土', '金', '水'];

  // ---- ① 双引擎：表与常量字节相等 ----
  if (stable(engineMod.WUXING_CHAR_TABLE) !== stable(BaziEngine.WUXING_CHAR_TABLE)) { console.log('R39 字表双引擎不一致'); process.exit(1); }
  for (const k of ['WUXING_SHENG', 'WUXING_KE', 'WUXING_RADICAL_ELEMENT', 'WUXING_RADICAL_KANGXI']) {
    if (stable(engineMod[k]) !== stable(BaziEngine[k])) { console.log('R39 常量不一致: ' + k); process.exit(1); }
  }

  // ---- ② 表自洽：形派结论必须能从部首表推出、数派结论必须能从康熙笔画推出（防两真相源） ----
  if (engineMod.WUXING_CHAR_TABLE.length !== 72) { console.log('R39 字表应为 72 字，实 ' + engineMod.WUXING_CHAR_TABLE.length); process.exit(1); }
  const seen = new Set();
  for (const e of engineMod.WUXING_CHAR_TABLE) {
    if (engineMod.WUXING_RADICAL_ELEMENT[e.rad] !== e.formEl) { console.log('R39 字形五行与部首表矛盾: ' + e.c); process.exit(1); }
    if (engineMod.wuxingStrokeElement(e.kangxi) !== e.strokeEl) { console.log('R39 笔画五行与康熙笔画矛盾: ' + e.c); process.exit(1); }
    if (FIVE.indexOf(e.formEl) < 0 || FIVE.indexOf(e.strokeEl) < 0 || !e.py || e.kangxi < 2 || e.kangxi > 36) { console.log('R39 字段越界: ' + e.c); process.exit(1); }
    if (e.agree !== (e.formEl === e.strokeEl)) { console.log('R39 agree 位错: ' + e.c); process.exit(1); }
    if (seen.has(e.c)) { console.log('R39 字重复: ' + e.c); process.exit(1); }
    seen.add(e.c);
  }

  // ---- ③ 表级结构统计（黄金值锁定；改表必红） ----
  const st = engineMod.wuxingTableStats();
  if (st.total !== 72 || st.agree !== 15 || st.disagree !== 57) { console.log('R39 表级统计不符: ' + JSON.stringify(st)); process.exit(1); }
  const formExp = { 木: 18, 火: 9, 土: 12, 金: 6, 水: 27 };
  const strokeExp = { 木: 15, 火: 16, 土: 6, 金: 21, 水: 14 };
  for (const el of FIVE) {
    if (st.byForm[el] !== formExp[el]) { console.log('R39 形派分布不符: ' + el + ' ' + st.byForm[el]); process.exit(1); }
    if (st.byStroke[el] !== strokeExp[el]) { console.log('R39 数派分布不符: ' + el + ' ' + st.byStroke[el]); process.exit(1); }
  }
  // 笔画五行函数边界：1,2木 3,4火 5,6土 7,8金 9,0水
  const bandExp = [[1, '木'], [2, '木'], [3, '火'], [4, '火'], [5, '土'], [6, '土'], [7, '金'], [8, '金'], [9, '水'], [10, '水'], [11, '木'], [21, '木'], [24, '火'], [16, '土']];
  for (const [n, el] of bandExp) {
    if (engineMod.wuxingStrokeElement(n) !== el) { console.log('R39 笔画五行边界错: ' + n + '→' + engineMod.wuxingStrokeElement(n)); process.exit(1); }
  }

  // ---- ④ 黄金档案（探针算定） ----
  const p1 = engineMod.nameWuxingProfile('梓涵');
  if (p1.known !== 2 || p1.agreeCount !== 1 || p1.formCounts.木 !== 1 || p1.formCounts.水 !== 1 || p1.strokeCounts.木 !== 2) { console.log('R39 梓涵档案不符: ' + JSON.stringify(p1)); process.exit(1); }
  const p2 = engineMod.nameWuxingProfile('明鑫');
  if (p2.agreeCount !== 0 || p2.formCounts.火 !== 1 || p2.formCounts.金 !== 1 || p2.strokeCounts.金 !== 1 || p2.strokeCounts.火 !== 1) { console.log('R39 明鑫档案不符: ' + JSON.stringify(p2)); process.exit(1); }
  const p3 = engineMod.nameWuxingProfile('沐宸');
  if (p3.known !== 1 || p3.unknownChars.join('') !== '宸') { console.log('R39 未收字应回报 unknown: ' + JSON.stringify(p3)); process.exit(1); }
  const p4 = engineMod.nameWuxingProfile('钰银');
  if (p4.formCounts.金 !== 2 || p4.strokeCounts.火 !== 2 || p4.chars[0].trad !== '鈺') { console.log('R39 简体入表/繁体对应不符: ' + JSON.stringify(p4)); process.exit(1); }
  if (engineMod.charWuxingOf('鈺') !== engineMod.charWuxingOf('钰')) { console.log('R39 繁体键应命中同一字'); process.exit(1); }
  if (engineMod.nameWuxingProfile('').total !== 0 || engineMod.nameWuxingProfile('  ').total !== 0) { console.log('R39 空名应零字'); process.exit(1); }

  // ---- ⑤ elementRelation 全 25 格封闭 + 黄金方向（生克方向写反当初版探针抓过） ----
  for (const a of FIVE) for (const b of FIVE) {
    const r = engineMod.elementRelation(a, b);
    const expect = a === b ? 'same'
      : (engineMod.WUXING_SHENG[a] === b ? 'aShengB' : engineMod.WUXING_SHENG[b] === a ? 'bShengA'
        : engineMod.WUXING_KE[a] === b ? 'aKeB' : 'bKeA');
    if (r !== expect) { console.log('R39 elementRelation 封闭性破: ' + a + b + ' ' + r); process.exit(1); }
  }
  if (engineMod.elementRelation('木', '火') !== 'aShengB' || engineMod.elementRelation('木', '土') !== 'aKeB'
    || engineMod.elementRelation('土', '木') !== 'bKeA' || engineMod.elementRelation('金', '木') !== 'aKeB') { console.log('R39 生克方向错'); process.exit(1); }

  // ---- ⑥ 双引擎逐字段：8 个名字剖面 + 统计 + 25 格关系 ----
  const names = ['梓涵', '明鑫', '沐宸', '林森', '雨桐', '钰涵', '金鑫', '子涵'];
  for (const nm of names) {
    if (stable(engineMod.nameWuxingProfile(nm)) !== stable(BaziEngine.nameWuxingProfile(nm))) { console.log('R39 剖面双引擎不一致: ' + nm); process.exit(1); }
  }
  if (stable(engineMod.wuxingTableStats()) !== stable(BaziEngine.wuxingTableStats())) { console.log('R39 统计双引擎不一致'); process.exit(1); }
  for (const a of FIVE) for (const b of FIVE) {
    if (stable(engineMod.elementRelation(a, b)) !== stable(BaziEngine.elementRelation(a, b))) { console.log('R39 关系双引擎不一致: ' + a + b); process.exit(1); }
  }
  if (engineMod.ENGINE_VERSION !== BaziEngine.ENGINE_VERSION) { console.log('R39 版本不一致'); process.exit(1); }

  console.log('姓名五行 R39: 72 字表双引擎字节相等 + 表自洽（形派由部首推、数派由笔画推）+ 一致 15/72(20.8%) + 两派分布 + 笔画边界 14 例 + 梓涵/明鑫/沐宸/钰银黄金档案 + elementRelation 25 格封闭 + 8 名剖面双引擎一致 ✓');
}
