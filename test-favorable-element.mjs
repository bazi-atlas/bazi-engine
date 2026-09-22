// ============================================================
// 喜用神数学界 test-favorable-element.mjs（v0.6.0）
// 三层：
//   ① 常量真值（季节表、阈值）
//   ② 不变量全扫描（计分自洽：和式、阈值、用忌互斥、月令加倍、日主排除）
//   ③ 黄金盘六例锁值（强+同判 / 弱+同判 / 弱+分歧 / 中和+调候 / 中和恰0.5 / 未知时辰）
// 手工核对说明见各黄金盘注释。
// ============================================================
import { computeFavorableElement, BRANCH_SEASON, SEASON_EN, STRENGTH_THRESHOLDS, BRANCHES } from './engine.mjs';

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ ' + msg); }
}

// ---------- ① 常量真值 ----------
console.log('[1] 常量真值');
ok(BRANCH_SEASON['寅'] === 'spring' && BRANCH_SEASON['卯'] === 'spring' && BRANCH_SEASON['辰'] === 'spring', '春 = 寅卯辰');
ok(BRANCH_SEASON['巳'] === 'summer' && BRANCH_SEASON['午'] === 'summer' && BRANCH_SEASON['未'] === 'summer', '夏 = 巳午未');
ok(BRANCH_SEASON['申'] === 'autumn' && BRANCH_SEASON['酉'] === 'autumn' && BRANCH_SEASON['戌'] === 'autumn', '秋 = 申酉戌');
ok(BRANCH_SEASON['亥'] === 'winter' && BRANCH_SEASON['子'] === 'winter' && BRANCH_SEASON['丑'] === 'winter', '冬 = 亥子丑');
ok(Object.keys(BRANCH_SEASON).length === 12, '季节表覆盖 12 支');
for (const b of BRANCHES) ok(typeof SEASON_EN[BRANCH_SEASON[b]] === 'string', 'SEASON_EN 覆盖 ' + b);
ok(STRENGTH_THRESHOLDS.strong === 0.55 && STRENGTH_THRESHOLDS.weak === 0.45, '阈值 = 0.55 / 0.45（声明值）');

// ---------- ③ 黄金盘（先于扫描定义，扫描复用其输入）----------
// 全部北京（lon 116.41, tz 8）。
const GOLDEN = [
  {
    tag: 'A strong+agree', opts: { year: 1983, month: 11, day: 30, hour: 10 },
    chart: { year: '癸亥', month: '癸亥', day: '壬戌', time: '乙巳' }, dm: '壬', season: 'winter',
    verdict: 'strong', support: 8.5, drain: 6.5, total: 15, ratio: 0.5666666666666667,
    perElement: { '木': 2.5, '火': 2, '土': 2, '金': 1, '水': 7.5 },
    fav: ['木', '火', '土'], unfav: ['水', '金'], th: '火', agree: true
  }, // 手核：亥亥双月令水×2 + 戌藏辛金癸水，同类(水7.5+金1)=8.5/15
  {
    tag: 'B weak+agree', opts: { year: 1988, month: 7, day: 8, hour: 8 },
    chart: { year: '戊辰', month: '己未', day: '甲子', time: '丁卯' }, dm: '甲', season: 'summer',
    verdict: 'weak', support: 5, drain: 9.5, total: 14.5, ratio: 0.3448275862068966,
    perElement: { '木': 3, '火': 2, '土': 7.5, '金': 0, '水': 2 },
    fav: ['水', '木'], unfav: ['火', '土', '金'], th: '水', agree: true
  }, // 手核：未月土×2=7.5 当权，甲木无根于未，弱；夏月调候水=用方第一顺位 → 同判
  {
    tag: 'C weak+disagree', opts: { year: 1980, month: 5, day: 15, hour: 4 },
    chart: { year: '庚申', month: '辛巳', day: '戊子', time: '甲寅' }, dm: '戊', season: 'summer',
    verdict: 'weak', support: 5.5, drain: 10, total: 15.5, ratio: 0.3548387096774194,
    perElement: { '木': 2.5, '火': 3.5, '土': 2, '金': 5.5, '水': 2 },
    fav: ['火', '土'], unfav: ['金', '水', '木'], th: '水', agree: false
  }, // 手核：申巳金旺，戊土弱；扶抑取火土，夏月调候取水=忌方 → 两派分歧，不裁决
  {
    tag: 'D balanced+tiaohou', opts: { year: 1986, month: 12, day: 20, hour: 14 },
    chart: { year: '丙寅', month: '庚子', day: '戊戌', time: '己未' }, dm: '戊', season: 'winter',
    verdict: 'balanced', support: 7, drain: 7.5, total: 14.5, ratio: 0.4827586206896552,
    perElement: { '木': 2, '火': 2.5, '土': 4.5, '金': 2.5, '水': 3 },
    fav: [], unfav: [], th: '火', agree: null
  }, // 中和：扶抑不给方向；冬月调候火照常输出
  {
    tag: 'E balanced-exact-half', opts: { year: 1996, month: 5, day: 21, hour: 6 },
    chart: { year: '丙子', month: '癸巳', day: '戊午', time: '乙卯' }, dm: '戊', season: 'summer',
    verdict: 'balanced', support: 7, drain: 7, total: 14, ratio: 0.5,
    perElement: { '木': 2.5, '火': 5.5, '土': 1.5, '金': 1, '水': 3.5 },
    fav: [], unfav: [], th: '水', agree: null
  }, // ratio 恰 0.5：0.45 < 0.5 < 0.55 → 中和（阈值边界样本）
  {
    tag: 'F unknown-hour', opts: { year: 1991, month: 3, day: 23, unknownTime: true },
    chart: { year: '辛未', month: '辛卯', day: '壬辰', time: null }, dm: '壬', season: 'spring',
    verdict: 'weak', support: 3.5, drain: 7.5, total: 11, ratio: 0.3181818181818182,
    perElement: { '木': 4, '火': 0.5, '土': 3, '金': 3, '水': 0.5 },
    fav: ['金', '水'], unfav: ['木', '火', '土'], th: null, agree: null
  } // 三柱口径：无时柱计分；春月无调候简则
];

console.log('[2] 黄金盘锁值');
for (const g of GOLDEN) {
  const r = computeFavorableElement({ ...g.opts, longitude: 116.41, tzOffsetHours: 8 });
  const p = g.tag + ' ';
  ok(JSON.stringify(r.chart) === JSON.stringify(g.chart), p + '四柱 ' + JSON.stringify(r.chart));
  ok(r.dayMaster.stem === g.dm, p + '日主 ' + r.dayMaster.stem);
  ok(r.season === g.season, p + '季节 ' + r.season);
  ok(r.score.verdict === g.verdict, p + '判定 ' + r.score.verdict);
  ok(r.score.support === g.support && r.score.drain === g.drain && r.score.total === g.total, p + '分数 ' + r.score.support + '/' + r.score.drain + '/' + r.score.total);
  ok(Math.abs(r.score.ratio - g.ratio) < 1e-12, p + 'ratio ' + r.score.ratio);
  for (const el of ['木', '火', '土', '金', '水']) ok(r.score.perElement[el] === g.perElement[el], p + '五行分 ' + el + '=' + r.score.perElement[el]);
  ok(JSON.stringify(r.fuYang.favorable.map(f => f.element)) === JSON.stringify(g.fav), p + '用 ' + r.fuYang.favorable.map(f => f.element).join(''));
  ok(JSON.stringify(r.fuYang.unfavorable.map(f => f.element)) === JSON.stringify(g.unfav), p + '忌 ' + r.fuYang.unfavorable.map(f => f.element).join(''));
  ok((r.tiaoHou.applicable ? r.tiaoHou.element : null) === g.th, p + '调候 ' + (r.tiaoHou.element || '无'));
  ok(r.synthesis.agree === g.agree, p + '两派 ' + r.synthesis.agree);
}

// ---------- ③ 不变量全扫描 ----------
console.log('[3] 不变量全扫描');
const ELS = ['木', '火', '土', '金', '水'];
let swept = 0;
for (let y = 1981; y <= 2000; y += 3) {
  for (const md of [[1, 20], [3, 20], [5, 20], [7, 20], [9, 20], [11, 20]]) {
    for (const h of [3, 9, 15, 21]) {
      const opts = { year: y, month: md[0], day: md[1], hour: h, longitude: 116.41, tzOffsetHours: 8 };
      const r = computeFavorableElement(opts);
      const s = r.score;
      ok(Math.abs(s.support + s.drain - s.total) < 1e-9, '和式 support+drain=total @' + y + md);
      ok(s.ratio >= 0 && s.ratio <= 1, 'ratio ∈ [0,1] @' + y + md);
      ok(s.total > 0, '总分>0 @' + y + md);
      const want = s.ratio >= 0.55 ? 'strong' : s.ratio <= 0.45 ? 'weak' : 'balanced';
      ok(s.verdict === want, '判定与阈值一致 @' + y + md);
      const favE = r.fuYang.favorable.map(f => f.element), unfE = r.fuYang.unfavorable.map(f => f.element);
      ok(favE.every(e => ELS.includes(e)) && unfE.every(e => ELS.includes(e)), '用忌 ⊆ 五行 @' + y + md);
      ok(favE.every(e => !unE(e)), '用忌互斥 @' + y + md);
      function unE(e) { return unfE.includes(e); }
      if (s.verdict === 'balanced') { ok(favE.length === 0 && unfE.length === 0, '中和不给方向 @' + y + md); }
      if (s.verdict === 'weak') { ok(favE.length === 2 && favE[0] !== favE[1], '弱=印+比劫两位 @' + y + md); }
      if (s.verdict === 'strong') { ok(favE.length === 3 && new Set(favE).size === 3, '强=泄耗克三位 @' + y + md); }
      // 计分自洽：breakdown 求和 = perElement
      const sum = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
      for (const b of s.breakdown) sum[b.element] += b.weight;
      for (const el of ELS) ok(Math.abs(sum[el] - s.perElement[el]) < 1e-9, 'breakdown 求和=perElement ' + el + ' @' + y + md);
      // 月令加倍 + 日主排除
      for (const b of s.breakdown) {
        if (b.pos === 'month') ok(b.monthBoosted === true && b.weight === (b.kind === 'branch-hidden' ? 1 : 2), '月柱贡献 ×2 @' + y + md);
        else ok(b.monthBoosted === false, '非月柱不加倍 @' + y + md);
        ok(!(b.pos === 'day' && b.kind === 'stem'), '日主天干不计分 @' + y + md);
      }
      // 季节 → 调候
      if (r.season === 'summer') ok(r.tiaoHou.element === '水', '夏调候水 @' + y + md);
      if (r.season === 'winter') ok(r.tiaoHou.element === '火', '冬调候火 @' + y + md);
      if (r.season === 'spring' || r.season === 'autumn') ok(r.tiaoHou.applicable === false, '春秋无季节调候 @' + y + md);
      swept++;
    }
  }
}
console.log('  扫描 ' + swept + ' 盘 × 每盘十余项断言');

// 未知时辰：无 time 计分项
const u = computeFavorableElement({ year: 1991, month: 3, day: 23, unknownTime: true, longitude: 116.41, tzOffsetHours: 8 });
ok(u.score.breakdown.every(b => b.pos !== 'time'), '未知时辰：无时柱计分');
ok(u.unknownTime === true && u.chart.time === null, '未知时辰标记与三柱盘');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
