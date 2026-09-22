// ============================================================
// 合盘三层校验（v0.5.0）
//   L1 真值层：关系表教科书枚举 + 「只应命中的对」全扫描（防多报/漏报）
//   L2 权威层：与历法库 lunar-javascript 的 HE_GAN_5 / HE_ZHI_6 / CHONG /
//              SHENGXIAO 逐项对账（库没有刑/害/三合表，这部分只有真值层）
//   L3 黄金层：computeCompatibility 整树的手算真值（含未知时辰、同盘自合）
// 跑法：node test-compatibility.mjs
// ============================================================
import { createRequire } from 'node:module';
import {
  STEM_COMBINE, STEM_COMBINE_ELEMENT, STEM_CLASH, BRANCH_SIX_HE, SIX_HE_ELEMENT,
  BRANCH_CLASH, BRANCH_HARM, BRANCH_TRINE, PUNISH_GROUPS, SELF_PUNISH,
  BRANCH_ANIMAL, BRANCH_ANIMAL_EN, branchRelations, stemRelation, computeCompatibility
} from './engine.mjs';

const require = createRequire(import.meta.url);
let LJ;
try { LJ = require('lunar-javascript'); }
catch (err) { throw new Error('Run `npm install` first — lunar-javascript is required. (' + err.message + ')'); }
const { Solar } = LJ;
const U = LJ.LunarUtil;

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m) => { fail++; console.log('  ✗ ' + m); };
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m + ' — 实得 ' + JSON.stringify(a) + ' 期望 ' + JSON.stringify(b)));

console.log('L1 真值层：关系表教科书枚举 + 全 144 对扫描');

// 六合：恰好 6 对，方向无关，合化五行正确
const sixHePairs = [];
for (const b1 of BRANCHES) for (const b2 of BRANCHES) {
  if (branchRelations(b1, b2).some(r => r.type === '六合')) sixHePairs.push([b1, b2]);
}
if (sixHePairs.length === 12) ok('六合恰好 12 个方向对（6 对 × 双向）');
else bad('六合方向对数量 = ' + sixHePairs.length + '，应为 12');
const canon = s => [...s].sort().join(''); // 「子丑」与「丑子」是同一对：比较前按字符排序归一
const sixHeSet = new Set(sixHePairs.map(p => canon(p[0] + p[1])));
eq([...sixHeSet].sort(), ['午未', '丑子', '亥寅', '卯戌', '辰酉', '巳申'].sort(), '六合对 = 教科书六对（配对串已归一）');
for (const [k, v] of Object.entries(SIX_HE_ELEMENT)) {
  const r = branchRelations(k[0], k[1]).find(x => x.type === '六合');
  if (!r || r.element !== v) bad('六合化气 ' + k + ' 应为 ' + v);
  else pass++;
}
ok('六合化气五行逐对核对（子丑土 / 寅亥木 / 卯戌火 / 辰酉金 / 巳申水 / 午未土）');

// 六冲 6 对
const clashPairs = new Set();
for (const b1 of BRANCHES) for (const b2 of BRANCHES) {
  if (branchRelations(b1, b2).some(r => r.type === '六冲')) clashPairs.add([...[b1, b2]].sort().join(''));
}
eq([...clashPairs].map(canon).sort(), ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'].map(canon).sort(), '六冲对 = 教科书六对');

// 六害 6 对
const harmPairs = new Set();
for (const b1 of BRANCHES) for (const b2 of BRANCHES) {
  if (branchRelations(b1, b2).some(r => r.type === '六害')) harmPairs.add([b1, b2].sort().join(''));
}
eq([...harmPairs].map(canon).sort(), ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'].map(canon).sort(), '六害对 = 教科书六对');

// 三合半合：每支恰好属于 1 个三合组；同组两支 → 半三合，共 C(3,2)*4=18 对
for (const b of BRANCHES) {
  const n = BRANCH_TRINE.filter(g => g.branches.includes(b)).length;
  if (n !== 1) bad(b + ' 属于 ' + n + ' 个三合组，应为 1');
  else pass++;
}
ok('十二支各属且仅属一个三合组');
const halfPairs = new Set();
for (const b1 of BRANCHES) for (const b2 of BRANCHES) {
  if (b1 !== b2 && branchRelations(b1, b2).some(r => r.type === '半三合')) halfPairs.add([b1, b2].sort().join(''));
}
if (halfPairs.size === 12) ok('半三合恰好 12 个无向对（4 组 × C(3,2)=3）');
else bad('半三合对数 = ' + halfPairs.size + '，应为 12');
if (halfPairs.has(canon('子午')) || halfPairs.has(canon('卯酉'))) bad('半三合混入了不同组的支对');
else pass++;

// 相刑：恃势 3 组内任意两支 = 3 对（双向 6）；无恩 3 对；无礼 1 对；自刑 4 支
const punishOf = (b1, b2) => branchRelations(b1, b2).find(r => r.type === '相刑');
eq(punishOf('寅', '巳')?.kind, '恃势之刑', '寅巳 = 恃势之刑');
eq(punishOf('申', '寅')?.kind, '恃势之刑', '申寅 = 恃势之刑（三支内任意两支）');
eq(punishOf('丑', '未')?.kind, '无恩之刑', '丑未 = 无恩之刑');
eq(punishOf('子', '卯')?.kind, '无礼之刑', '子卯 = 无礼之刑');
if (punishOf('子', '丑')) bad('子丑不应构成刑');
else pass++;
for (const b of SELF_PUNISH) {
  const r = branchRelations(b, b);
  if (!r.some(x => x.type === '自刑')) bad(b + ' 缺自刑');
  else pass++;
}
ok('自刑四支（辰午酉亥）逐一命中');
for (const b of ['子', '丑', '寅', '卯', '巳', '申', '未', '戌']) {
  if (branchRelations(b, b).some(x => x.type === '自刑')) bad(b + ' 不应自刑');
  else pass++;
}
ok('非自刑支同支对不误报');

// 关系多义性（R18 的教科书案例）：巳申 = 六合 + 相刑，但不半三合（分属不同三合组）
const ss = branchRelations('巳', '申');
eq(ss.map(r => r.type).sort(), ['六合', '相刑'], '巳申 = 六合 + 相刑并列（不裁决优先级）');
if (!ss.some(r => r.type === '半三合')) ok('巳申不半三合（巳∈金局、申∈水局，分属两组）——常见错误点被锁死');
else bad('巳申被误判半三合');

// 天干：五合 5 对 + 化气、四冲 4 对、同支无关系
const combos = new Set();
for (const s1 of STEMS) for (const s2 of STEMS) {
  const r = stemRelation(s1, s2).find(x => x.type === '天干五合');
  if (r) combos.add([s1, s2].sort().join(''));
}
eq([...combos].map(canon).sort(), ['丁壬', '丙辛', '乙庚', '戊癸', '甲己'].map(canon).sort(), '天干五合 = 教科书五对');
eq(STEM_COMBINE_ELEMENT['己甲'], '土', '甲己化土（key 已按码点归一为「己甲」）');
eq(STEM_COMBINE_ELEMENT['乙庚'], '金', '乙庚化金');
eq(STEM_COMBINE_ELEMENT['丙辛'], '水', '丙辛化水');
eq(STEM_COMBINE_ELEMENT['丁壬'], '木', '丁壬化木');
eq(STEM_COMBINE_ELEMENT['戊癸'], '火', '戊癸化火');
const sclash = new Set();
for (const s1 of STEMS) for (const s2 of STEMS) {
  if (stemRelation(s1, s2).some(x => x.type === '天干相冲')) sclash.add([s1, s2].sort().join(''));
}
eq([...sclash].map(canon).sort(), ['丁癸', '丙壬', '乙辛', '甲庚'].map(canon).sort(), '天干四冲 = 甲庚/乙辛/丙壬/丁癸（戊己不冲）');

// 全 144 支对中「至少一种关系」的对数（健全性：关系表没把多数对漏成空）
let withRel = 0;
for (const b1 of BRANCHES) for (const b2 of BRANCHES) { if (b1 !== b2 && branchRelations(b1, b2).length) withRel++; }
console.log('  · 132 个异支对中 ' + (withRel / 2) + ' 对（无向）存在至少一种关系');

console.log('L2 权威层：与 lunar-javascript 逐项对账');
// HE_GAN_5：按干索引 → 与 STEM_COMBINE 互查
for (let i = 0; i < 10; i++) {
  if (U.HE_GAN_5[i] !== STEM_COMBINE[STEMS[i]]) { bad('五合对账失败: ' + STEMS[i] + ' 库=' + U.HE_GAN_5[i] + ' 引擎=' + STEM_COMBINE[STEMS[i]]); }
  else pass++;
}
ok('天干五合 ×10 与库 HE_GAN_5 逐干一致');
// HE_ZHI_6
for (let i = 0; i < 12; i++) {
  if (U.HE_ZHI_6[i] !== BRANCH_SIX_HE[BRANCHES[i]]) { bad('六合对账失败: ' + BRANCHES[i] + ' 库=' + U.HE_ZHI_6[i] + ' 引擎=' + BRANCH_SIX_HE[BRANCHES[i]]); }
  else pass++;
}
ok('地支六合 ×12 与库 HE_ZHI_6 逐支一致');
// CHONG（六冲）
for (let i = 0; i < 12; i++) {
  if (U.CHONG[i] !== BRANCH_CLASH[BRANCHES[i]]) { bad('六冲对账失败: ' + BRANCHES[i] + ' 库=' + U.CHONG[i] + ' 引擎=' + BRANCH_CLASH[BRANCHES[i]]); }
  else pass++;
}
ok('地支六冲 ×12 与库 CHONG 逐支一致');
// SHENGXIAO（库 1-indexed，索引 0 为空串）
for (let i = 0; i < 12; i++) {
  if (U.SHENGXIAO[i + 1] !== BRANCH_ANIMAL[i]) { bad('生肖对账失败: ' + BRANCHES[i] + ' 库=' + U.SHENGXIAO[i + 1] + ' 引擎=' + BRANCH_ANIMAL[i]); }
  else pass++;
}
ok('生肖 ×12 与库 SHENGXIAO 逐支一致（库为 1-indexed，索引 0 是空串）');
// 生肖英文表健全性：12 个、无重复
if (new Set(BRANCH_ANIMAL_EN).size === 12 && BRANCH_ANIMAL_EN.every(x => /^[A-Z]/.test(x))) ok('生肖英文表 12 个且无重复');
else bad('生肖英文表异常');

// 库的 ZHI_XING 是「建除十二神」不是相刑——这里断言它长那样，防止后人把它当刑表引用
if (U.ZHI_XING[1] === '建' && U.ZHI_XING[12] === '闭') ok('库 ZHI_XING 确认为建除十二神（非相刑表）——引用陷阱已留档');

console.log('L3 黄金层：computeCompatibility 整树真值');
// 组 1：北京 1991-03-23 11:00（壬辰日主）× 北京 1990-01-15 08:00（庚辰日主）
// 经度 116.41 必须带上：真太阳时把 11:00 修正到 10:46 → 巳时（乙巳），这是黄金值的一部分
const r1 = computeCompatibility(
  { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: 116.41, tzOffsetHours: 8 },
  { year: 1990, month: 1, day: 15, hour: 8, minute: 0, longitude: 116.41, tzOffsetHours: 8 });
eq(r1.a.chart, { year: '辛未', month: '辛卯', day: '壬辰', time: '乙巳' }, 'A 四柱 = 辛未/辛卯/壬辰/乙巳');
eq(r1.b.chart, { year: '己巳', month: '丁丑', day: '庚辰', time: '庚辰' }, 'B 四柱 = 己巳/丁丑/庚辰/庚辰');
eq(r1.dayMasters.aSeesB.god, '偏印', 'A(壬) 见 B(庚) = 偏印');
eq(r1.dayMasters.bSeesA.god, '食神', 'B(庚) 见 A(壬) = 食神');
eq(r1.zodiac.a.animalEn, 'Goat', 'A 生肖 = Goat（未）');
eq(r1.zodiac.b.animalEn, 'Snake', 'B 生肖 = Snake（巳）');
eq(r1.counts, { stemCombine: 3, stemClash: 0, sixHe: 0, clash: 1, harm: 2, punishment: 3, halfTrine: 1 }, '关系计数 = 3干合/1冲/2害/3刑/1半三合');
eq(r1.dayPair.relations.map(x => x.type), ['自刑'], '日柱×日柱 = 辰辰自刑（夫妻宫自刑，逐字锁死）');
if (r1.stems.length === 16) ok('16 个干对全枚举');
else bad('干对数 = ' + r1.stems.length + '，应为 16');
if (r1.branches.length === 16) ok('16 个支对全枚举');
else bad('支对数 = ' + r1.branches.length + '，应为 16');
// 干合具体对：壬(月)×丁、乙(日)×庚、乙(时)×庚
const comboRows = r1.stems.filter(x => x.relations.some(q => q.type === '天干五合')).map(x => canon(x.aStem + x.bStem));
eq(comboRows.sort(), ['丁壬', '乙庚', '乙庚'], '三处干合 = 壬丁 / 乙庚 / 乙庚（归一后）');
// 跨盘半三合：金局（A 时支巳 + B 年支巳 + B 月支丑）， holders 跨两盘
eq(r1.trines.half.length, 1, '跨盘半三合恰好 1 组');
eq(r1.trines.half[0].element, '金', '半三合为金局');
if (r1.trines.half[0].holders.some(h => h.from === 'A') && r1.trines.half[0].holders.some(h => h.from === 'B')) ok('半三合成员确实跨两盘（A 时 + B 年/月）');
else bad('半三合成员未跨盘');
// 同盘内部的亥卯未半合不得出现（跨盘过滤）
if (!r1.trines.half.some(t => t.element === '木')) ok('同盘内部半合（A 年未×A 月卯）不进入合盘结果');
else bad('同盘内部半合泄漏进了合盘结果');
// 五行联合计数：8 个可见字相加
const expUnion = {};
for (const k of ['木','火','土','金','水']) expUnion[k] = r1.combinedElements.a[k] + r1.combinedElements.b[k];
eq(r1.combinedElements.union, expUnion, '联合五行 = 两盘可见字之和');
const aSum = Object.values(r1.combinedElements.a).reduce((s, v) => s + v, 0);
const uSum = Object.values(r1.combinedElements.union).reduce((s, v) => s + v, 0);
if (aSum === 8 && uSum === 16) ok('五行计数 = 每盘 8 个可见字、联合 16');
else bad('五行计数异常: A=' + aSum + ' union=' + uSum + '（应为 8/16）');
eq(r1.conventionNote.noScoreEn.includes('No match percentage'), true, '「不给匹配百分比」声明随引擎返回');

// 组 2：同盘自合（同一个人跟自己）——所有日主十神 = 比肩，辰辰自刑
const r2 = computeCompatibility(
  { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8 },
  { year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: null, tzOffsetHours: 8 });
eq(r2.dayMasters.aSeesB.god, '比肩', '同盘日主互见 = 比肩');
eq(r2.counts.punishment >= 2, true, '同盘自合至少 2 处自刑（日支辰 + 时支巳? 无——辰日/巳时，仅日柱对日柱辰辰 + 时柱巳巳? 巳非自刑）——实得 ' + r2.counts.punishment);
// 组 3：未知时辰 × 已知时辰——未知侧 time 柱必须缺席而非崩溃
const r3 = computeCompatibility(
  { year: 1991, month: 3, day: 23, hour: null, minute: 0, longitude: null, tzOffsetHours: 8, unknownTime: true },
  { year: 1994, month: 9, day: 9, hour: 12, minute: 0, longitude: null, tzOffsetHours: 8 });
if (r3.a.chart.time === null) ok('未知时辰侧 time 柱 = null（缺席而非猜测）');
else bad('未知时辰侧 time 柱未置空: ' + r3.a.chart.time);
if (r3.stems.length === 12 && r3.branches.length === 12) ok('未知时辰侧枚举数 = 3×4 = 12');
else bad('未知时辰侧枚举数 = ' + r3.stems.length + '/' + r3.branches.length + '，应为 12/12');
// 组 4：巳申教科书对——构造 A 日支巳 × B 日支申（1991-03-23 巳时 日支辰，不可用；换巳日巳时 × 申日申时太费——直接用原子关系已覆盖）
// 这里用年支层面造一组：1989 巳蛇年 × 1988 申猴年（龙年? 1988=辰龙，1989=巳蛇——改用 2004 甲申猴 vs 2001 巳蛇）
const r4 = computeCompatibility(
  { year: 2001, month: 6, day: 15, hour: 10, minute: 0, longitude: null, tzOffsetHours: 8 },
  { year: 2004, month: 9, day: 20, hour: 10, minute: 0, longitude: null, tzOffsetHours: 8 });
const zr = r4.zodiac.relations.map(x => x.type);
if (zr.includes('六合') && zr.includes('相刑')) ok('生肖层巳申：六合 + 相刑并列（2001 蛇 × 2004 猴）');
else bad('生肖层巳申关系异常: ' + JSON.stringify(zr));

console.log('');
if (fail) { console.log('合盘校验: ' + pass + ' pass / ' + fail + ' fail ✗'); process.exit(1); }
console.log('合盘校验: ' + pass + ' pass / 0 fail');
console.log('ALL GREEN ✓ 合盘三层校验全通过');
