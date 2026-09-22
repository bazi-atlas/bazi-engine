// 八字排盘引擎（版本号唯一来源：下方 ENGINE_VERSION）
// 底层：lunar-javascript（6tail，长期维护，节气天文算法）
// v0.3 地基要点（保留原记录）：
// v0.3 要点：年/月柱按「绝对时刻」判定节气边界（v0.2 误用当地时间当北京时间，远经度出生在节气交界日会判错月柱）；
//           日/时柱按出生地真太阳时（子平主流：日柱在当地子时换日）。
// 本文件只做三件事：封装约定、真太阳时校正、输出结构化排盘结果。
// 所有「流派选择」都在 SPEC 里声明，不藏在代码里。
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// lunar-javascript：唯一外部依赖，从 node_modules 解析（npm install）
let Solar;
try {
  ({ Solar } = require('lunar-javascript'));
} catch (err) {
  throw new Error(
    'bazi-engine needs the "lunar-javascript" package.\n' +
    'Run `npm install` in the bazi-engine directory first.\n' +
    'Underlying error: ' + err.message
  );
}

// ---------- 版本 ----------
// 单一来源：网页、审计面板、methodology 页脚、测试全部引用这里，避免改版本时漏改。
// 发版流程：改这一处 → 跑 test-site-consistency.mjs（它会把所有页面里的版本串和这里对账）。
export const ENGINE_VERSION = 'v0.15.1';

// ---------- 常量表 ----------
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const STEMS_EN = ['Jia Yang Wood','Yi Yin Wood','Bing Yang Fire','Ding Yin Fire','Wu Yang Earth','Ji Yin Earth','Geng Yang Metal','Xin Yin Metal','Ren Yang Water','Gui Yin Water'];
const STEM_ELEMENT = ['木','木','火','火','土','土','金','金','水','水'];
// R26 天干阴阳（声明性约定）：甲丙戊庚壬（偶数索引）为阳，乙丁己辛癸（奇数索引）为阴——即由索引奇偶决定。
// 曾错写成两两成组的 ['阳','阳','阴','阴',…]，结果乙丙、己庚、癸甲的标签全部互换；
// 该错误与同段的 STEMS_EN（'Yi Yin Wood'）自相矛盾，测试里已加交叉断言锁死。
const STEM_POLARITY = STEMS.map((_, i) => (i % 2 === 0 ? '阳' : '阴'));
const BRANCH_MAIN_QI = ['水','土','木','木','土','火','火','土','金','金','土','水']; // 子丑寅卯辰巳午未申酉戌亥 主气
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const BRANCH_ELEMENT = ['水','土','木','木','土','火','火','土','金','金','土','水'];

// 十神英文名（站点用）
const TEN_GODS_EN = {
  '比肩':'Peer (BiJian)','劫财':'Rival (JieCai)','食神':'Eating God (ShiShen)','伤官':'Hurting Officer (ShangGuan)',
  '偏财':'Indirect Wealth (PianCai)','正财':'Direct Wealth (ZhengCai)','七杀':'Seven Killings (QiSha)',
  '正官':'Direct Officer (ZhengGuan)','偏印':'Indirect Resource (PianYin)','正印':'Direct Resource (ZhengYin)'
};

// ---------- 真太阳时 ----------
// v1：经度项 = (出生地经度 − 当地时区中央经线) × 4 分钟。
// 中央经线默认按时区推断：round(经度/15)×15（如纽约-74°→-75°，上海114°→120°）。
// 可用 tzCentralMeridian 显式覆盖。均时差（EoT，±16分钟）在 v2 接入。
export function tzCentralMeridianOf(longitude) {
  return Math.round(longitude / 15) * 15;
}
export function trueSolarOffsetMinutes(longitude, tzCentralMeridian = null) {
  if (longitude == null) return 0;
  const central = tzCentralMeridian ?? tzCentralMeridianOf(longitude);
  return (longitude - central) * 4;
}

// 中国夏令时官方日期表（1986–1991）。来源：国务院夏时制通告（1986 首年 5/4–9/14；
// 此后每年 4 月中旬第一个星期日 02:00 起、9 月中旬第一个星期日 02:00 止），
// 多源一致（百度百科「北京夏令时」等）。v0.15.1 修复：此前用统一 5/4–9/14 粗边界，
// 1987–1991 每年 4 月中旬至 5/3、部分年份 9 月中旬误差窗口约 3–4 周会漏算/多算 1 小时。
// 注：起止日当天 02:00 前后的换钟瞬间按日期粒度处理，属已声明近似。
const CN_DST_RANGES = [
  [1986, 504, 914], [1987, 412, 913], [1988, 410, 911],
  [1989, 416, 917], [1990, 415, 916], [1991, 414, 915],
];
function inCnDst(y, m, d) {
  const md = m * 100 + d;
  return CN_DST_RANGES.some(([yy, s, e]) => y === yy && md >= s && md <= e);
}

// 十神判定：相对真实日主（本地盘日柱天干）。v0.3.1 修复：年/月柱十神此前误用
// 绝对时刻盘（absEc）的日主——海外出生跨日时（如纽约=北京次日）日主会变，十神全错。
const SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };  // 我生
const KE   = { '木':'土','土':'水','水':'火','火':'金','金':'木' };  // 我克
export function tenGodOf(dayGan, gan) {
  const di = STEMS.indexOf(dayGan), gi = STEMS.indexOf(gan);
  const de = STEM_ELEMENT[di], ge = STEM_ELEMENT[gi];
  const samePolarity = (di % 2) === (gi % 2);
  if (de === ge) return samePolarity ? '比肩' : '劫财';
  if (SHENG[de] === ge) return samePolarity ? '食神' : '伤官';
  if (KE[de] === ge) return samePolarity ? '偏财' : '正财';
  if (SHENG[ge] === de) return samePolarity ? '偏印' : '正印';  // 生我
  return samePolarity ? '七杀' : '正官';                        // 克我
}

// ---------- 十神推导（v0.3.3 新增对外暴露）----------
// 排盘结果不变，只是把「这个神是怎么算出来的」变成可展示的数据结构，
// 供十神工具页逐干展示推导链——正确性可被用户逐条复核，这是本站的差异点。
// 判定只有四步：① 日主与目标天干的五行关系 → 组 ② 阴阳同异 → 正/偏（比劫组为比肩/劫财）
const TEN_GOD_GROUPS = {
  比肩:'peers', 劫财:'peers', 食神:'output', 伤官:'output', 偏财:'wealth', 正财:'wealth',
  七杀:'influence', 正官:'influence', 偏印:'resource', 正印:'resource'
};
const TEN_GOD_GROUP_LABEL = { peers:'Self & Peers', output:'Output', wealth:'Wealth', influence:'Influence', resource:'Resource' };
const TEN_GOD_GROUP_CN = { peers:'比劫', output:'食伤', wealth:'财星', influence:'官杀', resource:'印星' };

export function tenGodRelation(dayElement, ganElement) {
  if (dayElement === ganElement) return 'peers';            // 同类
  if (SHENG[dayElement] === ganElement) return 'output';    // 我生
  if (KE[dayElement] === ganElement) return 'wealth';       // 我克
  if (SHENG[ganElement] === dayElement) return 'resource';  // 生我
  return 'influence';                                       // 克我
}

export function deriveTenGod(dayGan, gan) {
  const di = STEMS.indexOf(dayGan), gi = STEMS.indexOf(gan);
  if (di < 0 || gi < 0) return null;
  const dayElement = STEM_ELEMENT[di], ganElement = STEM_ELEMENT[gi];
  const god = tenGodOf(dayGan, gan);
  const group = TEN_GOD_GROUPS[god];
  return {
    god, godEn: TEN_GODS_EN[god], group,
    groupLabel: TEN_GOD_GROUP_LABEL[group], groupCn: TEN_GOD_GROUP_CN[group],
    relation: tenGodRelation(dayElement, ganElement),
    dayElement, ganElement,
    samePolarity: (di % 2) === (gi % 2),
    dayPolarityYang: di % 2 === 0, ganPolarityYang: gi % 2 === 0
  };
}

// ---------- 主函数 ----------
export function computeBazi({ year, month, day, hour = null, minute = 0, longitude = null, tzCentralMeridian = null, tzOffsetHours = null, unknownTime = false, sect = 1 }) {
  // sect: 1 = 晚子时（23:00+）日柱归次日（子平主流）; 2 = 零点换日
  // tzOffsetHours: 出生时刻的 UTC 偏移（含夏令时，如伦敦7月=1、纽约3月=-5）。
  //   提供时中央经线 = tzOffsetHours×15，优先级最高——海外出生必须提供，否则经度推断在夏令时期间会差1小时。
  let h = hour, min = minute, dstApplied = false, tsOffset = 0, tsCorrected = null;
  // v0.3.2：真太阳时基准恒为时区中央经线 = UTC偏移×15（未提供时默认 UTC+8 → 东经120°）。
  // 定义即「标准时 + (经度 − 时区中央经线)×4 + EoT」——v0.2 的 round(经度/15) 推断在
  // 成都(104→105)、乌鲁木齐(87.6→90)等偏离中央经线大的地区会把基准算错 1 小时级。
  // 海外调用方必须显式传 tzOffsetHours（含夏令时）。
  const tzOff = tzOffsetHours != null ? tzOffsetHours : 8;
  const central = tzCentralMeridian != null ? tzCentralMeridian : tzOff * 15;

  // 夏令时：记录的钟表时间减回 1 小时。v0.15.1 修复：跨零点（夏令时期间 00:00–01:00
  // 出生）时日期须回滚到前一日——此前只把小时 +24 但日期不动，导致日柱错位一天，
  // 同一物理瞬间按钟表时间与按标准时录入会排出不同四柱（差分对拍 1988-07-11 00:30 探针实锤）。
  let ry = year, rm = month, rd = day;
  if (inCnDst(ry, rm, rd)) {
    h -= 1; dstApplied = true;
    if (h < 0) {
      h += 24;
      const prev = new Date(Date.UTC(ry, rm - 1, rd) - 86400000);
      ry = prev.getUTCFullYear(); rm = prev.getUTCMonth() + 1; rd = prev.getUTCDate();
    }
  }

  // v0.3 年/月柱按绝对时刻判定：节气切换是天文事件，全球同一瞬间，与出生地经度无关。
  // 钟表时间 − 时区偏移 = UTC，再 +8h 转成北京时间喂历法库（库的节气表以北京时间为口径）。
  // v0.2 直接把当地时间当北京时间，远经度出生（如美国西海岸）在节气交界日会判错月柱。
  const bj = new Date(Date.UTC(ry, rm - 1, rd, h == null ? 12 : h, min) - tzOff * 3600000 + 8 * 3600000);
  const by = bj.getUTCFullYear(), bm = bj.getUTCMonth() + 1, bd = bj.getUTCDate(), bh = bj.getUTCHours(), bmin = bj.getUTCMinutes();

  // 真太阳时（经度项，基准=当地时区中央经线）。用 Date.UTC 做加减，正确处理跨日/跨月/跨年滚动
  let cy = ry, cm = rm, cd = rd;
  if (longitude != null && central != null && !unknownTime) {
    tsOffset = trueSolarOffsetMinutes(longitude, central);
    const base = Date.UTC(ry, rm - 1, rd, h == null ? 12 : h, min);
    const shifted = new Date(base + tsOffset * 60000);
    cy = shifted.getUTCFullYear(); cm = shifted.getUTCMonth() + 1; cd = shifted.getUTCDate();
    h = shifted.getUTCHours(); min = shifted.getUTCMinutes();
    tsCorrected = { hour: h, minute: min, dateShifted: (cy !== ry || cm !== rm || cd !== rd) };
  }

  const solar = Solar.fromYmdHms(cy, cm, cd, h == null ? 12 : h, min, 0);
  const ec = solar.getLunar().getEightChar();
  ec.setSect(sect);
  // 年/月柱取自绝对时刻排盘（节气边界）；日/时柱取自出生地真太阳时排盘（日柱在当地子时换日，两轨可不同日）
  const absEc = Solar.fromYmdHms(by, bm, bd, bh, bmin, 0).getLunar().getEightChar();

  // 年/月柱：干支/藏干/纳音取自绝对时刻盘（节气边界）；十神相对真实日主重算（v0.3.1）
  const dayGan = ec.getDayGan();
  const pillars = {
    year:  { ganzhi: absEc.getYear(),  hideGan: absEc.getYearHideGan(),  shiShenGan: tenGodOf(dayGan, absEc.getYear()[0]),  naYin: absEc.getYearNaYin() },
    month: { ganzhi: absEc.getMonth(), hideGan: absEc.getMonthHideGan(), shiShenGan: tenGodOf(dayGan, absEc.getMonth()[0]), naYin: absEc.getMonthNaYin() },
    day:   { ganzhi: ec.getDay(),   hideGan: ec.getDayHideGan(),   shiShenGan: '日主',                  naYin: ec.getDayNaYin() },
    time:  { ganzhi: unknownTime ? null : ec.getTime(), hideGan: unknownTime ? null : ec.getTimeHideGan(), shiShenGan: unknownTime ? null : ec.getTimeShiShenGan(), naYin: unknownTime ? null : ec.getTimeNaYin() }
  };

  const dayIdx = STEMS.indexOf(dayGan);

  // 五行计数：三口径（规格书声明，默认「天干4+地支主气4」）
  const countAll = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  const countMain = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  const pillarsArr = [pillars.year, pillars.month, pillars.day, pillars.time];
  for (const p of pillarsArr) {
    if (!p.ganzhi) continue;
    countMain[STEM_ELEMENT[STEMS.indexOf(p.ganzhi[0])]]++;
    countMain[BRANCH_ELEMENT[BRANCHES.indexOf(p.ganzhi[1])]]++;
    for (const hg of p.hideGan) countAll[STEM_ELEMENT[STEMS.indexOf(hg)]]++;
    countAll[STEM_ELEMENT[STEMS.indexOf(p.ganzhi[0])]]++;
  }
  // 天干地支基础计数（不含藏干）与全量（含藏干）分开
  const countStemsBranches = JSON.parse(JSON.stringify(countMain));
  for (const p of pillarsArr) { if (!p.ganzhi) continue; for (const hg of p.hideGan) countMain[STEM_ELEMENT[STEMS.indexOf(hg)]] += 0.5; } // 藏干半权口径

  return {
    input: { year, month, day, hour, minute, longitude, tzOffsetHours: tzOff, unknownTime, sect },
    meta: {
      dayMaster: dayGan, dayMasterEn: STEMS_EN[dayIdx], dayElement: STEM_ELEMENT[dayIdx], dayPolarity: STEM_POLARITY[dayIdx],
      dstApplied, trueSolarOffsetMinutes: tsOffset, tzCentralMeridian: central, tzOffsetHours: tzOff,
      trueSolarTime: tsCorrected, absoluteInstantBeijing: `${by}-${String(bm).padStart(2,'0')}-${String(bd).padStart(2,'0')} ${String(bh).padStart(2,'0')}:${String(bmin).padStart(2,'0')}`, engine: 'lunar-javascript', engineVersion: 'lunar-javascript + 本引擎约定 ' + ENGINE_VERSION, sect,
      sectLabel: sect === 1 ? '晚子时日柱归次日（23:00 换日）' : '零点换日',
      sectLabelEn: sect === 1
        ? 'Late-Zi rule — the day pillar rolls over at 23:00 local true solar time (mainstream)'
        : 'Midnight rule — the day pillar changes at 00:00'
    },
    pillars,
    fiveElements: { stemsBranchesOnly: countStemsBranches, withHiddenHalfWeight: countMain, withHiddenFull: countAll },
    tenGodsEn: TEN_GODS_EN
  };
}

// ============================================================
// 大运（Luck Pillars）v0.4.0
//
// 本段只增加一个新能力，computeBazi 的输出一字未动——排盘的 33 例 fixtures
// 因此保持锁定，大运算错不会污染排盘回归。
//
// 约定（全部公开在 Methodology 页，编号 R8–R12）：
//  R8  顺逆：年干属阳的男命、年干属阴的女命顺排；年干属阴的男命、年干属阳的
//      女命逆排。判据用「本引擎公布的绝对时刻年柱」的年干，不用别的年柱。
//  R9  起运：量到「节」（立春/惊蛰/清明/立夏/芒种/小暑/立秋/白露/寒露/立冬/
//      大雪/小寒）的绝对时刻距离。顺排量到下一个节，逆排量到上一个节。
//      节气是天文事件，全球同一瞬间——与 R4b 同年月柱口径。
//  R10 换算：「3 日 = 1 岁、1 日 = 4 个月、1 时辰 = 10 日」。提供两种粒度：
//      traditional = 主流时辰块法（先把时刻落进 2 小时时辰块再计数，
//      这是绝大多数排盘 App 的口径）；precise = 精确到分钟的同一条比例尺。
//      两者会差几天到十几天，页面把差值公开，不藏。
//  R11 时辰块计数所用时钟框架：默认 birth-locality 标准民用时（= 用户录入的
//      钟表时间，夏令时先还原为标准时）。这是"拿本地黄历手算"的口径，
//      与主流 App 一致。true-solar 框架可切换，页面作为敏感性对照给出。
//  R12 交运日期：把起运岁数加在「录入的出生日期时间」上。起运的岁数不受
//      闰秒/均时差影响，但均时差（EoT ±16 分钟）本引擎 v1 未接入。
// ============================================================

const JIAZI = (function () {
  const a = [];
  for (let i = 0; i < 60; i++) a.push(STEMS[i % 10] + BRANCHES[i % 12]);
  return a;
})();

// 十二「节」（区别于十二「气」）：月柱换柱点，也是起运的丈量端点
const JIE_EN = {
  '立春': 'Start of Spring', '惊蛰': 'Awakening of Insects', '清明': 'Clear and Bright', '立夏': 'Start of Summer',
  '芒种': 'Grain in Ear', '小暑': 'Minor Heat', '立秋': 'Start of Autumn', '白露': 'White Dew',
  '寒露': 'Cold Dew', '立冬': 'Start of Winter', '大雪': 'Major Snow', '小寒': 'Minor Cold'
};

// 地支藏干（本气在前、中气居中、余气在末），顺序与历法库 lunar-javascript 的
// getXxxHideGan() 完全一致——否则本站「四柱藏干」与「大运藏干」会自相矛盾。
// 附带的好处是回归测试能逐支核对：巳 = 丙(本) 庚(中) 戊(余)，不是常见的丙戊庚写法。
const BRANCH_HIDE_GAN = {
  '子': ['癸'], '丑': ['己', '癸', '辛'], '寅': ['甲', '丙', '戊'], '卯': ['乙'],
  '辰': ['戊', '乙', '癸'], '巳': ['丙', '庚', '戊'], '午': ['丁', '己'], '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'], '酉': ['辛'], '戌': ['戊', '辛', '丁'], '亥': ['壬', '甲']
};

const BRANCH_EN_ENGINE = ['Zi (Rat)', 'Chou (Ox)', 'Yin (Tiger)', 'Mao (Rabbit)', 'Chen (Dragon)', 'Si (Snake)', 'Wu (Horse)', 'Wei (Goat)', 'Shen (Monkey)', 'You (Rooster)', 'Xu (Dog)', 'Hai (Pig)'];

// 十二长生：天干在某一地支上的旺衰阶段。阳干顺行、阴干逆行，起点为各干长生支。
const STAGE_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const STAGE_EN = ['Birth', 'Bathing', 'Attiring', 'Official Post', 'Prosperity', 'Decline', 'Illness', 'Death', 'Tomb', 'Extinction', 'Conception', 'Nourishment'];
const STAGE_START_BRANCH = { '甲': '亥', '乙': '午', '丙': '寅', '丁': '酉', '戊': '寅', '己': '酉', '庚': '巳', '辛': '子', '壬': '申', '癸': '卯' };

export function twelveStage(dayGan, branch) {
  const di = STEMS.indexOf(dayGan), bi = BRANCHES.indexOf(branch);
  if (di < 0 || bi < 0) return null;
  const start = STAGE_START_BRANCH[dayGan];
  const sbi = BRANCHES.indexOf(start);
  const yang = di % 2 === 0;                       // 阳干顺行
  const offset = yang ? ((bi - sbi) % 12 + 12) % 12 : ((sbi - bi) % 12 + 12) % 12;
  return {
    stage: STAGE_NAMES[offset], stageEn: STAGE_EN[offset], index: offset,
    yangDirection: yang, startBranch: start,
    startBranchEn: BRANCH_EN_ENGINE[sbi], dayGan
  };
}

// ---------- R8 顺逆 ----------
export function luckDirection(yearGan, gender) {
  const gi = STEMS.indexOf(yearGan);
  const yang = gi % 2 === 0;
  const male = gender === 1 || gender === 'male' || gender === 'M' || gender === true;
  const forward = (yang && male) || (!yang && !male);
  const polarityCn = yang ? '阳' : '阴';
  const polEn = yang ? 'yang' : 'yin';
  const genderCn = male ? '男' : '女';
  const genderEn = male ? 'Male' : 'Female';
  return {
    forward, male, yearGan, yearGanYang: yang, yearGanIndex: gi,
    rule: `${polarityCn}年干（${yearGan}）${genderCn}命 → ${forward ? '顺排' : '逆排'}`,
    ruleEn: `${polEn}-stem year (${yearGan}) + ${genderEn.toLowerCase()} → sequence runs ${forward ? 'forward' : 'backward'}`,
    ruleShortEn: yang
      ? (male ? 'Yang-year male → forward' : 'Yang-year female → backward')
      : (male ? 'Yin-year male → backward' : 'Yin-year female → forward'),
    directionEn: forward ? 'Forward (shun pai)' : 'Backward (ni pai)'
  };
}

// ---------- R11 时辰块 ----------
// 子 23:00–00:59、丑 01:00–02:59 …… 亥 21:00–22:59。注意 23 点归子（0 号块），
// 这是本节与历法库内置大运实现在 23 点出生时唯一的分歧点（见 methodology 勘误）。
export function zhiBlockIndex(hour) {
  return Math.floor((((hour % 24) + 25) % 24) / 2);
}
export function zhiBlockOf(hour) {
  const i = zhiBlockIndex(hour);
  return { index: i, zhi: BRANCHES[i], zhiEn: BRANCH_EN_ENGINE[i], label: `${BRANCHES[i]} (${String(i === 0 ? 23 : i * 2 - 1).padStart(2, '0')}:00–${String(i === 0 ? 0 : i * 2 - 1 + 1).padStart(2, '0')}:59)` };
}

function calendarDayDiff(a, b) {
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

// 数 (fromMin, toMin] 内落着的时辰边界（奇数整点 01:00、03:00 …… 23:00）。
// 子时自 23:00 起，所以 23:00 是一个真实边界——历法库的 getYun() 把 23 点整
// 归进亥时（其内部 timeZhiIndex 又写的是子），导致 23 点档少算一个时辰块；
// 本引擎按 23:00 为边界计，这是与库内建大运唯一的、已公开的分歧点。
function boundariesBetween(fromMin, toMin) {
  let n = 0;
  for (let m = (Math.floor(fromMin / 60) + 1) * 60; m <= toMin; m += 60) {
    if ((m / 60) % 2 === 1) n++;
  }
  return n;
}

// ---------- 起运换算：传统「时辰块」法（R10）----------
// a = 起算端（顺排=出生、逆排=节气），b = 落点端。两端必须已在同一时钟框架内。
// 口径 = 整数日 × 4 个月 + 跨过的时辰块 × 10 日；跨午夜时日历日差要多减一天。
export function luckStartTraditional(a, b) {
  let wholeDays = calendarDayDiff(a, b);
  const ta = a.h * 60 + a.mi, tb = b.h * 60 + b.mi;
  let blocks;
  if (tb >= ta) {
    blocks = boundariesBetween(ta, tb);
  } else {
    blocks = boundariesBetween(ta, 1440) + boundariesBetween(0, tb);
    wholeDays -= 1;                                  // 时辰跨了午夜，日历日差多算了一天
  }
  const monthCarry = Math.floor(blocks * 10 / 30);
  const monthTotal = wholeDays * 4 + monthCarry;
  const days = blocks * 10 - monthCarry * 30;
  const years = Math.floor(monthTotal / 12);
  const months = monthTotal - years * 12;
  return {
    method: 'traditional', years, months, days, hours: 0,
    offsetDays: years * 360 + months * 30 + days,
    wholeDays, blocks,
    blocksEn: `${blocks} two-hour block${blocks === 1 ? '' : 's'} crossed`
  };
}

// ---------- 起运换算：精确分钟法（R10）----------
// 同一条比例尺（3日=1岁、1日=4月、1时辰=10日），只是不再切成时辰块。纯整数运算：
// 1 岁 = 3 日 = 259200 秒；1 月 = 6 小时 = 21600 秒；1 日 = 12 分 = 720 秒；1 时 = 30 秒。
export function luckStartPrecise(totalSeconds) {
  let rem = Math.abs(Math.round(totalSeconds));
  const seconds = rem;
  const years = Math.floor(rem / 259200); rem -= years * 259200;
  const months = Math.floor(rem / 21600); rem -= months * 21600;
  const days = Math.floor(rem / 720); rem -= days * 720;
  const hours = rem / 30;
  return {
    method: 'precise', years, months, days, hours,
    offsetDays: years * 360 + months * 30 + days + hours / 24,
    realSeconds: seconds
  };
}

function parseInstant(s) {          // "YYYY-MM-DD HH:MM" / "YYYY-MM-DD HH:MM:SS"
  const [d, t] = String(s).split(' ');
  const [y, m, dd] = d.split('-').map(Number);
  const [h, mi, se] = t.split(':').map(Number);
  return { y, m, d: dd, h, mi, s: se || 0 };
}
function fmtInstant(o, withSeconds = false) {
  const p = n => String(n).padStart(2, '0');
  return `${o.y}-${p(o.m)}-${p(o.d)} ${p(o.h)}:${p(o.mi)}` + (withSeconds ? ':' + p(o.s || 0) : '');
}
function shiftInstant(o, minutes) {
  const t = Date.UTC(o.y, o.m - 1, o.d, o.h, o.mi, o.s || 0) + Math.round(minutes) * 60000;
  const dt = new Date(t);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds() };
}
function instantUTC(o) { return Date.UTC(o.y, o.m - 1, o.d, o.h, o.mi, o.s || 0); }
// 把 y 年 m 月 d 日加到某个日期上（月末夹取，与历法库 nextMonth 同口径），可带小时
function addCalendar(base, y, m, d, hours = 0) {
  const M = base.m - 1 + m;
  let Y = base.y + y + Math.floor(M / 12);
  const mNorm = ((M % 12) + 12) % 12;
  const dim = new Date(Date.UTC(Y, mNorm + 1, 0)).getUTCDate();
  const D = Math.min(base.d, dim);
  const dt = new Date(Date.UTC(Y, mNorm, D, base.h, base.mi) + d * 86400000 + Math.round(hours * 3600000));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: dt.getUTCHours(), mi: dt.getUTCMinutes() };
}
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

// ---------- 主入口 ----------
export function computeLuckPillars(opts) {
  const male = !(opts.gender === 0 || opts.gender === 'female' || opts.gender === 'F' || opts.gender === false);
  const gender = male ? 1 : 0;
  const count = opts.count || 10;
  const method = opts.method === 'precise' ? 'precise' : 'traditional';
  const frame = opts.frame === 'true-solar' ? 'true-solar' : 'civil';
  const todayISO = opts.today || new Date().toISOString().slice(0, 10);

  // 复用排盘：四柱与所有约定只实现一次
  const bazi = computeBazi(opts);
  const monthPillar = bazi.pillars.month.ganzhi;
  const yearPillar = bazi.pillars.year.ganzhi;
  const dir = luckDirection(yearPillar[0], gender);
  const tzOff = bazi.meta.tzOffsetHours;
  const tsOffset = bazi.meta.trueSolarOffsetMinutes;
  const dstApplied = bazi.meta.dstApplied;

  const birthBeijing = parseInstant(bazi.meta.absoluteInstantBeijing);
  // 时钟框架位移：绝对时刻（北京钟）→ 出生地钟面。civil = 标准民用时；true-solar 再加经度项。
  const frameShift = (tzOff - 8) * 60 + (frame === 'true-solar' ? tsOffset : 0);

  const lunarBirth = Solar.fromYmdHms(birthBeijing.y, birthBeijing.m, birthBeijing.d, birthBeijing.h, birthBeijing.mi, 0).getLunar();
  const prevJie = lunarBirth.getPrevJie(), nextJie = lunarBirth.getNextJie();
  const jieSrc = dir.forward ? nextJie : prevJie;
  const jieBeijing = parseInstant(jieSrc.getSolar().toYmdHms());
  const jieNameCn = jieSrc.getName();
  const jieNameEn = JIE_EN[jieNameCn] || jieNameCn;

  // 两端换到同一时钟框架，再量距离
  const birthLocal = shiftInstant(birthBeijing, frameShift);
  const jieLocal = shiftInstant(jieBeijing, frameShift);
  const a = dir.forward ? birthLocal : jieLocal;   // 起算端
  const b = dir.forward ? jieLocal : birthLocal;   // 落点端
  const elapsedSec = (instantUTC(b) - instantUTC(a)) / 1000;

  const trad = luckStartTraditional(a, b);
  const prec = luckStartPrecise(elapsedSec);
  const chosen = method === 'precise' ? prec : trad;
  const diffDays = +(prec.offsetDays - trad.offsetDays).toFixed(4);

  // 交运日期：加在录入的出生日期时间上（R12）。夏令时先还原为标准时，与框架口径一致。
  // v0.15.1：跨零点时日期同步回滚（与 computeBazi 的夏令时修复同口径）。
  const anchorHourRaw = (opts.hour == null ? 12 : opts.hour) - (dstApplied ? 1 : 0);
  const anchor = { y: opts.year, m: opts.month, d: opts.day, h: anchorHourRaw, mi: opts.minute || 0 };
  if (anchor.h < 0) {
    anchor.h += 24;
    const pd = new Date(Date.UTC(anchor.y, anchor.m - 1, anchor.d) - 86400000);
    anchor.y = pd.getUTCFullYear(); anchor.m = pd.getUTCMonth() + 1; anchor.d = pd.getUTCDate();
  }
  const anchorDate = { y: anchor.y, m: anchor.m, d: anchor.d, h: anchor.h, mi: anchor.mi };

  const D = JIAZI.indexOf(monthPillar);
  const startIndex = D < 0 ? 0 : D;
  const pillars = [];
  for (let i = 1; i <= count; i++) {
    const raw = startIndex + (dir.forward ? i : -i);
    const ganzhi = JIAZI[((raw % 60) + 60) % 60];
    const stem = ganzhi[0], branch = ganzhi[1];
    const stepY = chosen.years + (i - 1) * 10;
    const startAt = addCalendar(anchorDate, stepY, chosen.months, chosen.days, chosen.hours || 0);
    const endAt = addCalendar(anchorDate, stepY + 10, chosen.months, chosen.days, chosen.hours || 0);
    const hideGan = BRANCH_HIDE_GAN[branch];
    const sTG = deriveTenGod(bazi.meta.dayMaster, stem);
    const bTG = deriveTenGod(bazi.meta.dayMaster, hideGan[0]);
    const st = twelveStage(bazi.meta.dayMaster, branch);
    pillars.push({
      index: i, ganzhi, stem, branch,
      stemEn: STEMS_EN[STEMS.indexOf(stem)], branchEn: BRANCH_EN_ENGINE[BRANCHES.indexOf(branch)],
      element: STEM_ELEMENT[STEMS.indexOf(stem)], branchElement: BRANCH_ELEMENT[BRANCHES.indexOf(branch)],
      stemTenGod: sTG && { god: sTG.god, godEn: sTG.godEn, group: sTG.group, groupLabel: sTG.groupLabel, relation: sTG.relation },
      branchTenGod: bTG && { god: bTG.god, godEn: bTG.godEn, group: bTG.group, groupLabel: bTG.groupLabel, relation: bTG.relation },
      hideGan, hideGanTenGods: hideGan.map(hg => { const t = deriveTenGod(bazi.meta.dayMaster, hg); return { gan: hg, god: t.god, godEn: t.godEn, group: t.group }; }),
      stage: st && st.stage, stageEn: st && st.stageEn, stageIndex: st && st.index,
      startAgeSui: startAt.y - anchor.y + 1, endAgeSui: endAt.y - anchor.y,
      startYear: startAt.y, endYear: endAt.y - 1, yearLabel: `${startAt.y}–${endAt.y - 1}`,
      startDate: fmtInstant(startAt).slice(0, 10), endDate: fmtInstant(endAt).slice(0, 10),
      startDateTime: fmtInstant(startAt), endDateTime: fmtInstant(endAt),
      _startAt: startAt
    });
  }

  // 当前所处大运：交运时刻已过的最末一柱
  const nowT = Date.parse(todayISO + 'T00:00:00Z');
  let currentIndex = 0;
  for (const p of pillars) if (Date.UTC(p._startAt.y, p._startAt.m - 1, p._startAt.d) <= nowT) currentIndex = p.index;
  for (const p of pillars) { p.isCurrent = p.index === currentIndex; delete p._startAt; }

  const first = pillars[0];
  const run = {
    gender, genderLabel: male ? 'Male' : 'Female',
    direction: dir,
    dayMaster: bazi.meta.dayMaster, dayMasterEn: bazi.meta.dayMasterEn, dayElement: bazi.meta.dayElement,
    monthPillar, yearPillar,
    chart: { year: bazi.pillars.year.ganzhi, month: monthPillar, day: bazi.pillars.day.ganzhi, time: bazi.pillars.time && bazi.pillars.time.ganzhi },
    instant: {
      frame, frameShiftMinutes: frameShift, tzOffsetHours: tzOff, trueSolarOffsetMinutes: tsOffset, dstApplied,
      birthBeijing: fmtInstant(birthBeijing), birthLocal: fmtInstant(birthLocal),
      birthBlock: zhiBlockOf(birthLocal.h), jieBlock: zhiBlockOf(jieLocal.h),
      jie: { name: jieNameCn, nameEn: jieNameEn, beijing: fmtInstant(jieBeijing, true), local: fmtInstant(jieLocal, true), direction: dir.forward ? 'next' : 'previous' }
    },
    elapsed: {
      totalSeconds: elapsedSec, totalHours: elapsedSec / 3600, totalDays: elapsedSec / 86400,
      days: Math.floor(Math.abs(elapsedSec) / 86400),
      hours: Math.floor((Math.abs(elapsedSec) % 86400) / 3600),
      minutes: Math.floor((Math.abs(elapsedSec) % 3600) / 60)
    },
    start: {
      method, traditional: trad, precise: prec, chosen,
      differenceDays: diffDays,
      startDate: fmtInstant(addCalendar(anchorDate, chosen.years, chosen.months, chosen.days, chosen.hours || 0)).slice(0, 10),
      startDateTime: fmtInstant(addCalendar(anchorDate, chosen.years, chosen.months, chosen.days, chosen.hours || 0)),
      exactAgeAtStart: { years: chosen.years, months: chosen.months, days: chosen.days, hours: chosen.hours || 0 },
      startAgeSui: first.startAgeSui
    },
    preLuck: { startYear: anchor.y, endYear: first.startYear - 1, suiAgeFrom: 1, suiAgeTo: first.startAgeSui - 1 },
    pillars,
    current: { index: currentIndex, pill: currentIndex ? pillars[currentIndex - 1] : null, today: todayISO },
    // 另一框架下的同一计算，只作为敏感性对照（不参与上面任何数字）
    frameAlt: null,
    today: todayISO
  };

  // 敏感性：换时钟框架 + 换粒度，起运会怎么动
  const altFrame = frame === 'civil' ? 'true-solar' : 'civil';
  const altShift = (tzOff - 8) * 60 + (altFrame === 'true-solar' ? tsOffset : 0);
  const aAlt = shiftInstant(dir.forward ? birthBeijing : jieBeijing, altShift);
  const bAlt = shiftInstant(dir.forward ? jieBeijing : birthBeijing, altShift);
  const altSec = (instantUTC(bAlt) - instantUTC(aAlt)) / 1000;
  run.frameAlt = {
    frame: altFrame, shiftMinutes: altShift,
    traditional: luckStartTraditional(aAlt, bAlt),
    precise: luckStartPrecise(altSec)
  };

  // 敏感性：出生时刻 ±1 小时（跨时辰块边界会动 10 个起运日）
  const probe = h => {
    const bb = { y: birthBeijing.y, m: birthBeijing.m, d: birthBeijing.d, h: ((h % 24) + 24) % 24, mi: birthBeijing.mi };
    const bl = shiftInstant(bb, frameShift);
    const al = dir.forward ? bl : jieLocal, bl2 = dir.forward ? jieLocal : bl;
    return luckStartTraditional(al, bl2);
  };
  run.sensitivity = {
    minus2: probe(birthLocal.h - 2), minus1: probe(birthLocal.h - 1),
    base: trad,
    plus1: probe(birthLocal.h + 1), plus2: probe(birthLocal.h + 2)
  };

  // 出生时辰不可知：起运落在一个区间里，而整条大运序列不受影响
  if (bazi.input.unknownTime) {
    const dayStart = shiftInstant({ y: birthBeijing.y, m: birthBeijing.m, d: birthBeijing.d, h: 0, mi: 0 }, frameShift);
    const dayEnd = shiftInstant({ y: birthBeijing.y, m: birthBeijing.m, d: birthBeijing.d, h: 23, mi: 59 }, frameShift);
    const mk = bl => {
      const j = Solar.fromYmdHms(shiftInstant(bl, -frameShift).y, shiftInstant(bl, -frameShift).m, shiftInstant(bl, -frameShift).d, shiftInstant(bl, -frameShift).h, shiftInstant(bl, -frameShift).mi, 0).getLunar();
      const js = dir.forward ? j.getNextJie() : j.getPrevJie();
      const jl = shiftInstant(parseInstant(js.getSolar().toYmdHms()), frameShift);
      const aa = dir.forward ? bl : jl, bb2 = dir.forward ? jl : bl;
      const sec = (instantUTC(bb2) - instantUTC(aa)) / 1000;
      return { jie: js.getName(), jieEn: JIE_EN[js.getName()] || js.getName(), jieLocal: fmtInstant(jl, true), traditional: luckStartTraditional(aa, bb2), precise: luckStartPrecise(sec) };
    };
    const lo = mk(dayStart), hi = mk(dayEnd);
    run.unknownTime = {
      windowStart: fmtInstant(dayStart), windowEnd: fmtInstant(dayEnd),
      low: lo, high: hi,
      jieAmbiguous: lo.jie !== hi.jie,
      monthPillarAssumedNoon: monthPillar
    };
  } else {
    run.unknownTime = null;
  }

  return run;
}


// ============================================================
// 合盘（Compatibility / Two-Chart Synastry）v0.5.0
//
// 同大运段的原则：只新增能力，computeBazi 输出一字不动，排盘 fixtures 保持锁定。
//
// 约定（全部公开在 Methodology 页，编号 R13–R19）：
//  R13 天干五合：甲己合化土、乙庚金、丙辛水、丁壬木、戊癸火。
//  R14 天干四冲：甲庚、乙辛、丙壬、丁癸；戊己居中不冲。
//  R15 地支六合：子丑、寅亥、卯戌、辰酉、巳申、午未。合化五行取传统口径
//      （子丑土、寅亥木、卯戌火、辰酉金、巳申水、午未土）；「午未合化土还是
//      日月不合化」流派有分歧，页面公开标注。
//  R16 三合局：申子辰水、亥卯未木、寅午戌火、巳酉丑金。跨盘只出现两支时记
//      「半三合」并显式标注为有争议口径（三合须三支齐，两支是否成局各家不一）。
//  R17 六害：子未、丑午、寅巳、卯辰、申亥、酉戌。
//  R18 相刑：寅巳申（恃势，任意两支即构成）、丑戌未（无恩）、子卯（无礼）、
//      自刑（辰辰、午午、酉酉、亥亥）。关系全部并列，不设「合解冲」优先级——
//      巳申既六合又相刑又半三合，这是关系多义性的教科书案例，不裁决。
//  R19 跨盘作用：合盘为现代用法，古籍无「两盘干支互相作用」的原文。本引擎只
//      枚举关系、不给匹配百分比——任何权重都是发明，本站拒绝发明。
// ============================================================

export const STEM_COMBINE = { '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊' };
// 注意：SIX_HE_ELEMENT / STEM_COMBINE_ELEMENT 的 key 是「按 Unicode 码点排序后的两字串」，
// 因为 branchRelations/stemRelation 用 [b1,b2].sort().join('') 生成查找键——
// 子丑→丑子、寅亥→亥寅、甲己→己甲，不能按传统写法写 key，否则查表静默得 undefined。
export const STEM_COMBINE_ELEMENT = { '己甲':'土','乙庚':'金','丙辛':'水','丁壬':'木','戊癸':'火' };
export const STEM_CLASH = { '甲':'庚','庚':'甲','乙':'辛','辛':'乙','丙':'壬','壬':'丙','丁':'癸','癸':'丁' };
export const BRANCH_SIX_HE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };
export const SIX_HE_ELEMENT = { '丑子':'土','亥寅':'木','卯戌':'火','辰酉':'金','巳申':'水','午未':'土' };
export const BRANCH_CLASH = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
export const BRANCH_TRINE = [ { branches:['申','子','辰'], element:'水', elementEn:'Water' }, { branches:['亥','卯','未'], element:'木', elementEn:'Wood' }, { branches:['寅','午','戌'], element:'火', elementEn:'Fire' }, { branches:['巳','酉','丑'], element:'金', elementEn:'Metal' } ];
export const BRANCH_HARM = { '子':'未','未':'子','丑':'午','午':'丑','寅':'巳','巳':'寅','卯':'辰','辰':'卯','申':'亥','亥':'申','酉':'戌','戌':'酉' };
export const PUNISH_GROUPS = [
  { branches:['寅','巳','申'], kind:'恃势之刑', kindEn:'Punishment of Arrogance',
    note:'命名存在流派分歧：《阴符经》义理派以「木生火、火生土，生者还刑其生」论，作「无恩之刑」；本引擎从另一派作「恃势之刑」。两派对寅巳申/丑戌未的分组完全一致，仅名称互换，出处引文互见（渊海子平/三命通会传本即有异文）。',
    noteEn:'Naming diverges by school: the YinFuJing-reasoning school labels this "Punishment of Ingratitude" (the generated constrains its generator); this engine follows the school labeling it "Punishment of Arrogance". The grouping itself (Yin-Si-Shen / Chou-Xu-Wei) is unanimous across schools — only the labels swap.' },
  { branches:['丑','戌','未'], kind:'无恩之刑', kindEn:'Punishment of Ingratitude',
    note:'与寅巳申组互为镜像：义理派（土旺恃势相刑）称本组为「恃势之刑」，本引擎从另一派称「无恩之刑」。分组一致，名称互换。',
    noteEn:'Mirror of the Yin-Si-Shen group: the reasoning school calls this group "Punishment of Arrogance" (earth relying on strength); this engine follows the school calling it "Punishment of Ingratitude". Grouping unanimous, labels swapped.' },
  { branches:['子','卯'], kind:'无礼之刑', kindEn:'Punishment of Discourtesy' }
];
export const SELF_PUNISH = ['辰','午','酉','亥'];
export const BRANCH_ANIMAL = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
export const BRANCH_ANIMAL_EN = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];

// 天干跨盘关系：合、冲，都可能出现（互斥——不存在既合又冲的一对天干）
export function stemRelation(s1, s2) {
  const out = [];
  if (STEM_COMBINE[s1] === s2) out.push({ type: '天干五合', typeEn: 'stem combination', element: STEM_COMBINE_ELEMENT[[s1, s2].sort().join('')] });
  if (STEM_CLASH[s1] === s2) out.push({ type: '天干相冲', typeEn: 'stem clash' });
  return out;
}

// 地支跨盘关系：全部并列返回（R18：不设优先级，合冲刑害可并存）
export function branchRelations(b1, b2) {
  const out = [];
  if (BRANCH_SIX_HE[b1] === b2) out.push({ type: '六合', typeEn: 'six harmony', element: SIX_HE_ELEMENT[[b1, b2].sort().join('')] });
  if (BRANCH_CLASH[b1] === b2) out.push({ type: '六冲', typeEn: 'clash' });
  if (BRANCH_HARM[b1] === b2) out.push({ type: '六害', typeEn: 'harm' });
  for (const g of PUNISH_GROUPS) {
    if (g.branches.includes(b1) && g.branches.includes(b2) && b1 !== b2) {
      out.push({ type: '相刑', typeEn: 'punishment', kind: g.kind, kindEn: g.kindEn });
      break;
    }
  }
  if (b1 === b2 && SELF_PUNISH.includes(b1)) out.push({ type: '自刑', typeEn: 'self-punishment' });
  for (const g of BRANCH_TRINE) {
    if (b1 !== b2 && g.branches.includes(b1) && g.branches.includes(b2)) {
      out.push({ type: '半三合', typeEn: 'half trine (contested)', element: g.element, elementEn: g.elementEn });
      break;
    }
  }
  return out;
}

const POS_ORDER = ['year', 'month', 'day', 'time'];
const POS_CN = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' };
const POS_EN = { year: 'Year', month: 'Month', day: 'Day', time: 'Hour' };

function chartBrief(C) {
  const chart = {};
  for (const pos of POS_ORDER) { const p = C.pillars[pos]; chart[pos] = p ? p.ganzhi : null; } // web 引擎未知时辰时 pillars.time 为 null，此处同形防御
  const yb = C.pillars.year.ganzhi[1];
  const yi = BRANCHES.indexOf(yb);
  return {
    dayMaster: C.meta.dayMaster, dayMasterEn: C.meta.dayMasterEn, dayElement: C.meta.dayElement,
    dayBranch: C.pillars.day.ganzhi[1], yearBranch: yb,
    animal: BRANCH_ANIMAL[yi], animalEn: BRANCH_ANIMAL_EN[yi],
    chart, fiveElements: C.fiveElements
  };
}

export function computeCompatibility(aOpts, bOpts) {
  const A = computeBazi(aOpts), B = computeBazi(bOpts);
  const a = chartBrief(A), b = chartBrief(B);
  const dmA = a.dayMaster, dmB = b.dayMaster;

  // 日主互看：A 的日主如何「读」B 的日主（反向同理）
  const aSeesB = deriveTenGod(dmA, dmB), bSeesA = deriveTenGod(dmB, dmA);

  // 16 干对：B 的每一根干落在 A 日主上是什么十神 + 干合/干冲
  const stems = [];
  for (const pa of POS_ORDER) {
    const sa = a.chart[pa]; if (!sa) continue;
    for (const pb of POS_ORDER) {
      const sb = b.chart[pb]; if (!sb) continue;
      const tg = deriveTenGod(dmA, sb[0]);
      stems.push({ aPos: pa, aPosCn: POS_CN[pa], aPosEn: POS_EN[pa], aStem: sa[0], bPos: pb, bPosCn: POS_CN[pb], bPosEn: POS_EN[pb], bStem: sb[0], tenGod: tg.god, tenGodEn: tg.godEn, group: tg.group, groupEn: tg.groupLabel, relations: stemRelation(sa[0], sb[0]) });
    }
  }

  // 16 支对：全部并列关系（R18）
  const branches = [];
  for (const pa of POS_ORDER) {
    const ga = a.chart[pa]; if (!ga) continue;
    for (const pb of POS_ORDER) {
      const gb = b.chart[pb]; if (!gb) continue;
      branches.push({ aPos: pa, aPosCn: POS_CN[pa], aPosEn: POS_EN[pa], aBranch: ga[1], bPos: pb, bPosCn: POS_CN[pb], bPosEn: POS_EN[pb], bBranch: gb[1], relations: branchRelations(ga[1], gb[1]), involvesDayPalace: pa === 'day' || pb === 'day' });
    }
  }

  // 联合三合：八支并查，三支齐 = 成局；两支 = 半合（R16，标注争议）
  const union = [];
  for (const pa of POS_ORDER) { if (a.chart[pa]) union.push({ branch: a.chart[pa][1], from: 'A', pos: pa }); }
  for (const pb of POS_ORDER) { if (b.chart[pb]) union.push({ branch: b.chart[pb][1], from: 'B', pos: pb }); }
  const trinesFull = [], trinesHalf = [];
  for (const g of BRANCH_TRINE) {
    const present = union.filter(u => g.branches.includes(u.branch));
    const distinct = [...new Set(present.map(p => p.branch))];
    // 合盘语义：只列跨盘成局（两盘都有支参与）。同盘内部的半合属于本盘信息，
    // 排盘页已覆盖，这里出现只会制造噪音。
    const crossChart = present.some(p => p.from === 'A') && present.some(p => p.from === 'B');
    if (!crossChart) continue;
    if (distinct.length === 3) trinesFull.push({ element: g.element, elementEn: g.elementEn, members: present.map(p => ({ branch: p.branch, from: p.from, pos: p.pos })) });
    else if (distinct.length === 2) trinesHalf.push({ element: g.element, elementEn: g.elementEn, branches: distinct, holders: present.map(p => ({ branch: p.branch, from: p.from, pos: p.pos })) });
  }

  // 生肖（年支）关系
  const zodiac = { a: { branch: a.yearBranch, animal: a.animal, animalEn: a.animalEn }, b: { branch: b.yearBranch, animal: b.animal, animalEn: b.animalEn }, relations: branchRelations(a.yearBranch, b.yearBranch) };

  // 五行互补：两盘可见干支口径相加（8 个可见字），并给差
  const unionElements = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const k of Object.keys(unionElements)) unionElements[k] = (a.fiveElements.stemsBranchesOnly[k] || 0) + (b.fiveElements.stemsBranchesOnly[k] || 0);

  const counts = { stemCombine: 0, stemClash: 0, sixHe: 0, clash: 0, harm: 0, punishment: 0, halfTrine: 0 };
  for (const s of stems) { for (const r of s.relations) { if (r.type === '天干五合') counts.stemCombine++; if (r.type === '天干相冲') counts.stemClash++; } }
  for (const br of branches) { for (const r of br.relations) { if (r.type === '六合') counts.sixHe++; if (r.type === '六冲') counts.clash++; if (r.type === '六害') counts.harm++; if (r.type === '相刑' || r.type === '自刑') counts.punishment++; if (r.type === '半三合') counts.halfTrine++; } }

  const dayPair = branches.find(x => x.aPos === 'day' && x.bPos === 'day');

  return {
    engineVersion: ENGINE_VERSION,
    a, b,
    dayMasters: {
      a: dmA, b: dmB,
      aSeesB: { god: aSeesB.god, godEn: aSeesB.godEn, group: aSeesB.group, groupEn: aSeesB.groupLabel },
      bSeesA: { god: bSeesA.god, godEn: bSeesA.godEn, group: bSeesA.group, groupEn: bSeesA.groupLabel },
      sameElement: a.dayElement === b.dayElement, elements: [a.dayElement, b.dayElement]
    },
    stems, branches,
    zodiac, trines: { full: trinesFull, half: trinesHalf },
    combinedElements: { a: a.fiveElements.stemsBranchesOnly, b: b.fiveElements.stemsBranchesOnly, union: unionElements },
    counts, dayPair,
    conventionNote: {
      crossChartEn: 'Cross-chart interaction is a modern synastry convention; no classical text makes two charts interact. Every relation below is enumerated, none is weighted.',
      noScoreEn: 'No match percentage is given. Any weight or score would be invented, and this site does not invent.'
    }
  };
}

// ============================================================
// 喜用神（Favorable Element / Yong Shen）v0.6.0
//
// 同前两段的原则：只新增能力，computeBazi 输出一字不动。
//
// 约定（全部公开在 Methodology 页，编号 R20–R23）：
//  R20 强弱计分：每个可见天干（日主本身除外）为其五行记 1 分；每个地支按藏干
//      计分——主气 1 分、每个藏干 0.5 分（与 R7 的 withHiddenHalfWeight 完全
//      同一口径）。月柱（月令）全部贡献 ×2 —— 「月令当权」。日主的真太阳时
//      盘口径与排盘页一致。这是一套完全透明的加权计票法，不是唯一流派：
//      看根气、看合冲的师傅会在手工盘上得出不同强弱判断，页面明示这一点。
//  R21 强弱判据：同类分（比劫 + 印星）/ 总分 = ratio。ratio ≥ 0.55 → 身强
//      strong；≤ 0.45 → 身弱 weak；其间 → 中和 balanced。阈值是本引擎的
//      声明性选择，各派分界不一，页面公开写出 0.55/0.45。
//  R22 扶抑法取用：身强 → 取食伤（泄）、财星（耗）、官杀（克）为用，比劫、
//      印星为忌；身弱 → 取印星（生）、比劫（助）为用，其余为忌；中和 → 扶抑
//      法不给出方向，页面明示「两派以调候或格局定夺」。不发明任何百分比
//      幸运度——分数就是计票分数，用神就是规则输出。
//  R23 调候法简则：月支在巳午未（夏）→ 调候取水；亥子丑（冬）→ 调候取火。
//      其余月份不给出调候结论——经典调候按日主逐月查《穷通宝鉴》120 条表，
//      不能压缩成季节一句话，本引擎拒绝给一个假装完整的答案，页面指向
//      methodology 说明。两派同判/分歧在结果中显式标注。
// ============================================================

// 月支 → 季节（R23 调候判据用；判定用排盘月柱的地支，节气口径与 R4b 一致）
export const BRANCH_SEASON = {
  '寅': 'spring', '卯': 'spring', '辰': 'spring',
  '巳': 'summer', '午': 'summer', '未': 'summer',
  '申': 'autumn', '酉': 'autumn', '戌': 'autumn',
  '亥': 'winter', '子': 'winter', '丑': 'winter'
};
export const SEASON_EN = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
// R21 阈值（声明性选择，公开写出）
export const STRENGTH_THRESHOLDS = { strong: 0.55, weak: 0.45 };

// 生我者（印）与我生者（食伤）、我克者（财）与克我者（官杀）——从 SHENG/KE 表反查
function producerOf(el) { for (const k of Object.keys(SHENG)) if (SHENG[k] === el) return k; return null; }
function controllerOf(el) { for (const k of Object.keys(KE)) if (KE[k] === el) return k; return null; }

export function computeFavorableElement(opts) {
  const C = computeBazi(opts);
  const dm = C.meta.dayMaster;
  const de = C.meta.dayElement;
  const generated = SHENG[de];    // 我生 = 食伤
  const controlled = KE[de];      // 我克 = 财
  const produced = producerOf(de); // 生我 = 印
  const controls = controllerOf(de); // 克我 = 官杀

  // R20 计分：逐柱逐字，月柱 ×2，日主天干除外
  const perElement = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  const breakdown = [];
  for (const pos of POS_ORDER) {
    const p = C.pillars[pos];
    if (!p || !p.ganzhi) continue;
    const boost = pos === 'month' ? 2 : 1;
    if (pos !== 'day') {
      const stem = p.ganzhi[0];
      const el = STEM_ELEMENT[STEMS.indexOf(stem)];
      perElement[el] += 1 * boost;
      breakdown.push({ pos, kind: 'stem', char: stem, element: el, weight: 1 * boost, monthBoosted: boost === 2 });
    }
    const branch = p.ganzhi[1];
    const bEl = BRANCH_ELEMENT[BRANCHES.indexOf(branch)];
    perElement[bEl] += 1 * boost;
    breakdown.push({ pos, kind: 'branch-main-qi', char: branch, element: bEl, weight: 1 * boost, monthBoosted: boost === 2 });
    for (const hg of p.hideGan) {
      const hEl = STEM_ELEMENT[STEMS.indexOf(hg)];
      perElement[hEl] += 0.5 * boost;
      breakdown.push({ pos, kind: 'branch-hidden', char: hg, element: hEl, weight: 0.5 * boost, monthBoosted: boost === 2 });
    }
  }

  const support = perElement[de] + perElement[produced];
  const drain = perElement[generated] + perElement[controlled] + perElement[controls];
  const total = support + drain;
  const ratio = total > 0 ? support / total : 0;
  const verdict = ratio >= STRENGTH_THRESHOLDS.strong ? 'strong' : ratio <= STRENGTH_THRESHOLDS.weak ? 'weak' : 'balanced';

  // R22 扶抑取用（组顺序固定：身弱 印→比劫；身强 泄→耗→克）
  const GROUP_OF = { [produced]: { group: 'resource', cn: '印星', label: 'Resource' }, [de]: { group: 'peers', cn: '比劫', label: 'Self & Peers' }, [generated]: { group: 'output', cn: '食伤', label: 'Output' }, [controlled]: { group: 'wealth', cn: '财星', label: 'Wealth' }, [controls]: { group: 'influence', cn: '官杀', label: 'Influence' } };
  const EL_EN5 = { '木': 'Wood', '火': 'Fire', '土': 'Earth', '金': 'Metal', '水': 'Water' };
  const REASON = {
    weak: {
      [produced]: `${EL_EN5[produced]} produces ${EL_EN5[de]} — it feeds a weak day master`,
      [de]: `${EL_EN5[de]} is the day master's own phase — peers reinforce a weak day master`
    },
    strong: {
      [generated]: `${EL_EN5[de]} produces ${EL_EN5[generated]} — it drains a strong day master`,
      [controlled]: `${EL_EN5[de]} controls ${EL_EN5[controlled]} — a strong day master spends itself on wealth`,
      [controls]: `${EL_EN5[controls]} controls ${EL_EN5[de]} — it disciplines a strong day master`
    }
  };
  const favEls = verdict === 'strong' ? [generated, controlled, controls]
    : verdict === 'weak' ? [produced, de] : [];
  const unfavEls = verdict === 'strong' ? [de, produced]
    : verdict === 'weak' ? [generated, controlled, controls] : [];
  const mk = el => ({ element: el, elementEn: EL_EN5[el], group: GROUP_OF[el].group, groupCn: GROUP_OF[el].cn, groupLabel: GROUP_OF[el].label, reasonEn: (REASON[verdict] && REASON[verdict][el]) || null });
  const favorable = favEls.map(mk), unfavorable = unfavEls.map(mk);

  // R23 调候简则
  const monthBranch = C.pillars.month.ganzhi[1];
  const season = BRANCH_SEASON[monthBranch];
  let tiaoHou;
  if (season === 'summer') {
    tiaoHou = { applicable: true, element: '水', elementEn: 'Water', rule: 'summer months (Si/Wu/Wei) run hot — the climate school takes Water to moisten', ruleCn: '夏月炎燥，调候取水' };
  } else if (season === 'winter') {
    tiaoHou = { applicable: true, element: '火', elementEn: 'Fire', rule: 'winter months (Hai/Zi/Chou) run cold — the climate school takes Fire to warm', ruleCn: '冬月寒凝，调候取火' };
  } else {
    tiaoHou = { applicable: false, element: null, elementEn: null, rule: 'no season-level climate adjustment in the simplified rule; the classical school consults a per-day-stem, per-month table (Qiong Tong Bao Jian) that cannot be compressed into one line', ruleCn: '春秋月无季节级调候简则；经典调候按日主逐月查表' };
  }

  // 两派对照：调候元素落在用方 = 同判；落在忌方 = 分歧；无调候或不涉及 = 不适用
  let agree = null;
  if (tiaoHou.applicable && verdict !== 'balanced') {
    if (favorable.some(f => f.element === tiaoHou.element)) agree = true;
    else if (unfavorable.some(f => f.element === tiaoHou.element)) agree = false;
  }

  return {
    engineVersion: ENGINE_VERSION,
    dayMaster: { stem: dm, stemEn: C.meta.dayMasterEn, element: de, elementEn: EL_EN5[de], polarity: (STEMS.indexOf(dm) % 2 === 0 ? 'yang' : 'yin') },
    chart: { year: C.pillars.year.ganzhi, month: C.pillars.month.ganzhi, day: C.pillars.day.ganzhi, time: C.pillars.time ? C.pillars.time.ganzhi : null },
    monthBranch, monthBranchEn: BRANCH_EN_ENGINE[BRANCHES.indexOf(monthBranch)],
    season, seasonEn: SEASON_EN[season], unknownTime: !!C.input.unknownTime,
    score: { perElement, breakdown, support, drain, total, ratio, thresholds: STRENGTH_THRESHOLDS, verdict, verdictEn: verdict === 'strong' ? 'Strong day master' : verdict === 'weak' ? 'Weak day master' : 'Balanced day master', verdictCn: verdict === 'strong' ? '身强' : verdict === 'weak' ? '身弱' : '中和' },
    fuYang: { method: 'support & suppress (扶抑)', favorable, unfavorable },
    tiaoHou: Object.assign({ method: 'climate adjustment (调候)' }, tiaoHou),
    synthesis: { agree, noteEn: agree === true ? 'Both schools point the same way on ' + EL_EN5[tiaoHou.element] + '.' : agree === false ? 'The two schools disagree: the balance school wants ' + EL_EN5[favorable[0].element] + ', the climate school wants ' + EL_EN5[tiaoHou.element] + '. Both readings are shown; this site does not break the tie.' : agree === null && tiaoHou.applicable && verdict === 'balanced' ? 'The day master is balanced, so the balance school gives no direction; the climate school takes ' + EL_EN5[tiaoHou.element] + '.' : null },
    fiveElements: C.fiveElements,
    conventionNote: {
      scoringEn: 'Strength here is a weighted tally: every visible stem scores 1, every branch scores its main qi 1 plus 0.5 per hidden stem (the same half-weight convention as the five-element counts), and the month pillar counts double. Practitioners who also weigh roots, combinations and clashes by hand may reach a different verdict — the weights, not a black box, are published.',
      noLuckEn: 'No luck percentage, no gemstone, no colour prescription. The favorable element is the output of two published rules, shown with their disagreement.'
    }
  };
}

// ---------- 常量导出（供页面与回归测试共用，杜绝抄一份表）----------
// ============================================================
// v0.7.0 纳音与日柱剖面（day-pillar 页面的数据层）
// ============================================================
// R24 纳音：六十甲子纳音为定表——每对干支（甲子乙丑）共一纳音，两千年
//      通行本无流派分歧。中文为唯一真值，英文仅作展示用直译。
const NAYIN_PAIRS = [
  ['海中金', 'Gold in the Sea'], ['炉中火', 'Furnace Fire'], ['大林木', 'Forest Wood'],
  ['路旁土', 'Roadside Earth'], ['剑锋金', 'Sword-edge Metal'], ['山头火', 'Mountaintop Fire'],
  ['涧下水', 'Ravine Stream Water'], ['城头土', 'City Wall Earth'], ['白蜡金', 'White Wax Metal'],
  ['杨柳木', 'Willow Wood'], ['泉中水', 'Spring Water'], ['屋上土', 'Rooftop Earth'],
  ['霹雳火', 'Thunderbolt Fire'], ['松柏木', 'Pine and Cypress Wood'], ['长流水', 'Long Flowing Water'],
  ['沙中金', 'Gold in the Sand'], ['山下火', 'Foothill Fire'], ['平地木', 'Plain Wood'],
  ['壁上土', 'Wall Earth'], ['金箔金', 'Gold Foil'], ['覆灯火', 'Lamp Flame Fire'],
  ['天河水', 'Celestial River Water'], ['大驿土', 'Post Road Earth'], ['钗钏金', 'Hairpin Metal'],
  ['桑柘木', 'Mulberry Wood'], ['大溪水', 'Great Stream Water'], ['沙中土', 'Sand Earth'],
  ['天上火', 'Sky Fire'], ['石榴木', 'Pomegranate Wood'], ['大海水', 'Great Sea Water'],
];
const NAYIN = NAYIN_PAIRS.flatMap((p) => [p[0], p[0]]);
const NAYIN_EN = NAYIN_PAIRS.flatMap((p) => [p[1], p[1]]);

export function nayinOf(gz) {
  const i = JIAZI.indexOf(gz);
  if (i < 0) return null;
  return {
    cn: NAYIN[i], en: NAYIN_EN[i],
    pairIndex: i >> 1,
    partner: JIAZI[i % 2 === 0 ? i + 1 : i - 1],  // 共享同一纳音的另一柱
  };
}

// R25 日柱剖面：只输出结构事实（藏干十神 / 十二长生 / 纳音 / 干支主气生克），
//      **不输出人格结论**。「一柱一种人格」是网络流传的简化写法，本站明确
//      不做——同一日柱在不同月令与全局下的含义不同，判断需完整排盘。
//      干支主气生克的五种命名：比和 / 得地（支生干）/ 泄（干生支）/
//      盖头（干克支）/ 截脚（支克干），均为传统术语，本站沿用并声明。
export const SEAT_KIND = {
  same: { cn: '比和', en: 'Same element (bi he)' },
  support: { cn: '得地', en: 'Branch generates stem (de di)' },
  drain: { cn: '泄', en: 'Stem generates branch (xie)' },
  control: { cn: '盖头', en: 'Stem controls branch (gai tou)' },
  undercut: { cn: '截脚', en: 'Branch controls stem (jie jiao)' },
};

export function dayPillarProfile(gz) {
  if (typeof gz !== 'string' || gz.length !== 2) return null;
  const si = STEMS.indexOf(gz[0]), bi = BRANCHES.indexOf(gz[1]);
  if (si < 0 || bi < 0) return null;
  const stem = gz[0], branch = gz[1];
  const se = STEM_ELEMENT[si], be = BRANCH_ELEMENT[bi];
  let seat;
  if (se === be) seat = 'same';
  else if (SHENG[be] === se) seat = 'support';
  else if (SHENG[se] === be) seat = 'drain';
  else if (KE[se] === be) seat = 'control';
  else seat = 'undercut';
  const hidden = BRANCH_HIDE_GAN[branch].map((g, pos) => {
    const d = deriveTenGod(stem, g);
    return {
      gan: g, ganEn: STEMS_EN[STEMS.indexOf(g)],
      pos: pos === 0 ? 'main' : pos === 1 ? 'middle' : 'residual',
      posCn: pos === 0 ? '本气' : pos === 1 ? '中气' : '余气',
      element: STEM_ELEMENT[STEMS.indexOf(g)],
      god: d.god, godEn: d.godEn, group: d.group, groupCn: d.groupCn, groupLabel: d.groupLabel,
      relation: d.relation,
    };
  });
  const ny = nayinOf(gz);
  const st = twelveStage(stem, branch);
  return {
    gz,
    stem, branch, stemIdx: si, branchIdx: bi,
    stemEn: STEMS_EN[si], branchEn: BRANCH_EN_ENGINE[bi], animalEn: BRANCH_ANIMAL_EN[bi],
    stemElement: se, branchElement: be, stemPolarity: STEM_POLARITY[si],
    seat, seatCn: SEAT_KIND[seat].cn, seatEn: SEAT_KIND[seat].en,
    hidden,
    stage: st.stage, stageEn: st.stageEn, stageIndex: st.index,
    nayin: ny.cn, nayinEn: ny.en, nayinPartner: ny.partner, nayinPairIndex: ny.pairIndex,
  };
}

export { JIAZI, JIE_EN, BRANCH_HIDE_GAN, STAGE_NAMES, STAGE_EN, STAGE_START_BRANCH, BRANCHES, STEMS, STEM_ELEMENT, BRANCH_ELEMENT, NAYIN, NAYIN_EN, STEM_POLARITY, STEMS_EN };

export const BRANCH_EN = BRANCH_EN_ENGINE;

// ============================================================
// R27/R28/R29 十二地支属性 + 三个族剖面（v0.8.0）
// ------------------------------------------------------------
// 为什么加这一层：日柱页证明了「结构事实由引擎实算」这条路可行，
// 十二地支 / 十二长生 / 十神×柱位 三族同样只能靠实算——AI 摘要说不出
// 「子在十个天干上分别是哪一阶段」「未支的六合六冲六害各是谁」
// 「正财落在月柱时，十个日主各自对应哪个天干」。下面所有表都由索引
// 或已有表导出；交叉断言见 test-web-engine.mjs（含 60 甲子反推阴阳）。
// ============================================================

export const ELEMENT_EN = { 木: 'Wood', 火: 'Fire', 土: 'Earth', 金: 'Metal', 水: 'Water' };

// 地支阴阳：子寅辰午申戌为阳（偶数索引），丑卯巳未酉亥为阴。
// 必须由索引导出，不要手写数组——v0.7.1 的天干阴阳表正是手写成两两成组，
// 把乙/丙、己/庚、癸/甲 全部标反，且因计算只走索引奇偶而长期无人发现。
export const BRANCH_POLARITY = BRANCHES.map((_, i) => (i % 2 === 0 ? '阳' : '阴'));

// 方位：八方位制（丑寅同东北、辰巳同东南、未申同西南、戌亥同西北）
const BRANCH_DIR_CN = ['北', '东北', '东北', '东', '东南', '东南', '南', '西南', '西南', '西', '西北', '西北'];
const BRANCH_DIR_EN = ['North', 'Northeast', 'Northeast', 'East', 'Southeast', 'Southeast', 'South', 'Southwest', 'Southwest', 'West', 'Northwest', 'Northwest'];

// 月建与节令：寅为正月（立春起）。子 = 十一月大雪、丑 = 十二月小寒、寅 = 正月立春…
const BRANCH_JIE = ['大雪', '小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬'];

// 三会方（四季方位局）。成员季节必须与 BRANCH_SEASON 完全一致（测试断言）。
export const BRANCH_MEETING = [
  { branches: ['寅', '卯', '辰'], element: '木', elementEn: 'Wood', dirCn: '东方', dirEn: 'East' },
  { branches: ['巳', '午', '未'], element: '火', elementEn: 'Fire', dirCn: '南方', dirEn: 'South' },
  { branches: ['申', '酉', '戌'], element: '金', elementEn: 'Metal', dirCn: '西方', dirEn: 'West' },
  { branches: ['亥', '子', '丑'], element: '水', elementEn: 'Water', dirCn: '北方', dirEn: 'North' },
];

// 时辰区间：子时 23:00–01:00 起，每支 +2 小时（由索引导出，不手写）
export function branchHourRange(bi) {
  const two = (n) => (n < 10 ? '0' : '') + n;
  const start = (23 + 2 * bi) % 24, end = (start + 2) % 24;
  return { start, end, text: two(start) + ':00–' + two(end) + ':00' };
}

// ---------- R27 十二地支剖面：一个地支的全部结构事实 ----------
export function branchProfile(branch) {
  const bi = BRANCHES.indexOf(branch);
  if (bi < 0) return null;
  const element = BRANCH_ELEMENT[bi];
  const hidden = BRANCH_HIDE_GAN[branch].map((g, pos) => {
    const gi = STEMS.indexOf(g);
    return {
      gan: g, ganEn: STEMS_EN[gi], element: STEM_ELEMENT[gi], polarity: STEM_POLARITY[gi],
      pos: pos === 0 ? 'main' : pos === 1 ? 'middle' : 'residual',
      posCn: pos === 0 ? '本气' : pos === 1 ? '中气' : '余气',
    };
  });
  const trine = BRANCH_TRINE.find((t) => t.branches.indexOf(branch) >= 0);
  const meeting = BRANCH_MEETING.find((t) => t.branches.indexOf(branch) >= 0);
  const sixHe = BRANCH_SIX_HE[branch];
  const sixHeKey = [branch, sixHe].sort().join('');   // 配对表 key 按码点排序（v0.5.0 事故）
  const clashB = BRANCH_CLASH[branch], harmB = BRANCH_HARM[branch];
  const punishGroups = PUNISH_GROUPS.filter((g) => g.branches.indexOf(branch) >= 0).map((g) => ({
    kind: g.kind, kindEn: g.kindEn, members: g.branches.slice(), peers: g.branches.filter((b) => b !== branch),
  }));
  const stageOf = STEMS.map((s, si) => {
    const st = twelveStage(s, branch);
    return { gan: s, ganEn: STEMS_EN[si], polarity: STEM_POLARITY[si], element: STEM_ELEMENT[si],
             stage: st.stage, stageEn: st.stageEn, stageIndex: st.index };
  });
  const jie = BRANCH_JIE[bi];
  return {
    branch, index: bi, element, elementEn: ELEMENT_EN[element], polarity: BRANCH_POLARITY[bi],
    branchEn: BRANCH_EN_ENGINE[bi], animalCn: BRANCH_ANIMAL[bi], animalEn: BRANCH_ANIMAL_EN[bi],
    dirCn: BRANCH_DIR_CN[bi], dirEn: BRANCH_DIR_EN[bi],
    hour: branchHourRange(bi), month: ((bi + 10) % 12) + 1, jie, jieEn: JIE_EN[jie],
    season: BRANCH_SEASON[branch], seasonEn: SEASON_EN[BRANCH_SEASON[branch]],
    hidden,
    sixHe: { branch: sixHe, branchEn: BRANCH_EN_ENGINE[BRANCHES.indexOf(sixHe)],
             element: SIX_HE_ELEMENT[sixHeKey], elementEn: ELEMENT_EN[SIX_HE_ELEMENT[sixHeKey]] },
    clash: { branch: clashB, branchEn: BRANCH_EN_ENGINE[BRANCHES.indexOf(clashB)] },
    harm: { branch: harmB, branchEn: BRANCH_EN_ENGINE[BRANCHES.indexOf(harmB)] },
    trine: { element: trine.element, elementEn: trine.elementEn, members: trine.branches.slice(),
             peers: trine.branches.filter((b) => b !== branch) },
    meeting: { element: meeting.element, elementEn: meeting.elementEn, dirCn: meeting.dirCn, dirEn: meeting.dirEn,
               members: meeting.branches.slice(), peers: meeting.branches.filter((b) => b !== branch) },
    punishGroups, selfPunish: SELF_PUNISH.indexOf(branch) >= 0,
    stageOf, pillars: JIAZI.filter((gz) => gz[1] === branch),
  };
}

// ---------- R28 十二长生剖面：一个阶段的全部结构事实 ----------
// 注意：每个天干在十二支上各落一个阶段，所以「某阶段」对十个天干各对应唯一地支。
export function stageProfile(index) {
  if (!Number.isInteger(index) || index < 0 || index > 11) return null;
  const stageCn = STAGE_NAMES[index], stageEn = STAGE_EN[index];
  const rows = STEMS.map((s, si) => {
    const yang = si % 2 === 0;                       // 阳干顺行、阴干逆行
    const sbi = BRANCHES.indexOf(STAGE_START_BRANCH[s]);
    const bi = yang ? (sbi + index) % 12 : ((sbi - index) % 12 + 12) % 12;
    const b = BRANCHES[bi];
    const st = twelveStage(s, b);
    return {
      gan: s, ganEn: STEMS_EN[si], polarity: STEM_POLARITY[si], element: STEM_ELEMENT[si],
      branch: b, branchEn: BRANCH_EN_ENGINE[bi], animalCn: BRANCH_ANIMAL[bi], animalEn: BRANCH_ANIMAL_EN[bi],
      yangDirection: yang, startBranch: STAGE_START_BRANCH[s],
      startBranchEn: BRANCH_EN_ENGINE[BRANCHES.indexOf(STAGE_START_BRANCH[s])],
      stageIndex: st.index, verified: st.stage === stageCn,
    };
  });
  const pillars = [];
  for (let i = 0; i < 60; i++) {
    const gz = JIAZI[i];
    if (twelveStage(gz[0], gz[1]).stage === stageCn) {
      pillars.push({ gz, stemIdx: STEMS.indexOf(gz[0]), branchIdx: BRANCHES.indexOf(gz[1]) });
    }
  }
  return { index, stageCn, stageEn, rows, pillars,
           yangRows: rows.filter((r) => r.yangDirection), yinRows: rows.filter((r) => !r.yangDirection) };
}

// ---------- R29 十神 × 柱位剖面 ----------
// 柱位只取年/月/时：日柱是自身宫，与「十神是相对日主而言」自相缠绕，故不列。
export const PILLAR_POS = [
  { id: 'year', cn: '年柱', en: 'Year Pillar', palaceCn: '祖上与早年环境宫', palaceEn: 'ancestry & early environment' },
  { id: 'month', cn: '月柱', en: 'Month Pillar', palaceCn: '父母与事业环境宫', palaceEn: 'career environment & upbringing' },
  { id: 'hour', cn: '时柱', en: 'Hour Pillar', palaceCn: '子女与晚景宫', palaceEn: 'children & later life' },
];

export const TEN_GOD_ORDER = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];

export function tenGodPillarProfile(god, pos) {
  if (TEN_GOD_ORDER.indexOf(god) < 0) return null;
  const posDef = PILLAR_POS.find((p) => p.id === pos);
  if (!posDef) return null;
  // 对每个日主，找出唯一能构成该十神的柱位天干（十天干对固定日主是十神的双射）
  const rows = STEMS.map((dg, di) => {
    const gan = STEMS.find((g) => tenGodOf(dg, g) === god);
    const d = deriveTenGod(dg, gan);
    const gi = STEMS.indexOf(gan);
    return {
      dayGan: dg, dayGanEn: STEMS_EN[di], dayElement: STEM_ELEMENT[di], dayPolarity: STEM_POLARITY[di],
      gan, ganEn: STEMS_EN[gi], ganElement: STEM_ELEMENT[gi], ganPolarity: STEM_POLARITY[gi],
      god: d.god, godEn: d.godEn, group: d.group, groupLabel: d.groupLabel, groupCn: d.groupCn,
      relation: d.relation, samePolarity: d.samePolarity,
    };
  });
  return { god, godEn: rows[0].godEn, group: rows[0].group, groupLabel: rows[0].groupLabel,
           groupCn: rows[0].groupCn, relation: rows[0].relation, pos, posDef, rows };
}

// ============================================================
// R30 流年 / 生肖层（v0.9.0）
// ------------------------------------------------------------
// 生肖与年柱的换柱线是「立春」，不是元旦、也不是农历正月初一。
// 这是本站与多数生肖网站的主要分歧：1990-01-15 出生的人属蛇（己巳），
// 因为立春（1990-02-04 11:14）还没到——按农历新年切会算成属马。
// 立春是天文时刻（太阳黄经 315°），浏览器引擎不能带历法库，所以整张表
// 逐字复制（与 JIAZI / NAYIN / BRANCH_HIDE_GAN 同一套做法）。
// 表的生成与黄金值校验见 generate-lichun.mjs；双引擎一致性见 test-web-engine.mjs。
// ============================================================

export const LICHUN_FROM = 1900;   // 表首年份
export const LICHUN = [   // index = year - LICHUN_FROM；每项 'MMDDHHmm'（北京时间）
  '02041351', '02041939', '02050138', '02050731', '02051324', '02041915', '02050103', '02050658',
  '02051247', '02041832', '02050027', '02050610', '02051153', '02041742', '02042329', '02050525',
  '02051113', '02041657', '02042253', '02050439', '02051026', '02041620', '02042206', '02050400',
  '02050949', '02041536', '02042138', '02050330', '02050916', '02041508', '02042051', '02050240',
  '02050829', '02041409', '02042003', '02050148', '02050729', '02041325', '02041914', '02050110',
  '02050707', '02041249', '02041848', '02050040', '02050622', '02041219', '02041803', '02042350',
  '02050542', '02041122', '02041720', '02042313', '02050452', '02041045', '02041630', '02042217',
  '02050411', '02040954', '02041549', '02042142', '02050323', '02040922', '02041517', '02042107',
  '02050304', '02040846', '02041437', '02042030', '02050207', '02040758', '02041345', '02041925',
  '02050120', '02040704', '02041300', '02041859', '02050039', '02040633', '02041226', '02041812',
  '02050009', '02040555', '02041145', '02041739', '02042318', '02040511', '02041107', '02041651',
  '02042242', '02040427', '02041014', '02041608', '02042148', '02040337', '02040930', '02041512',
  '02042107', '02040301', '02040856', '02041457', '02042040', '02040228', '02040824', '02041405',
  '02041956', '02040143', '02040727', '02041318', '02041900', '02040049', '02040647', '02041232',
  '02041822', '02040013', '02040603', '02041158', '02041746', '02032334', '02040528', '02041114',
  '02041703', '02032258', '02040450', '02041042', '02041627', '02032210', '02040402', '02040946',
  '02041531', '02032120', '02040308', '02040858', '02041448', '02032041', '02040241', '02040831',
  '02041419', '02032011', '02040203', '02040752', '02041339', '02031925', '02040112', '02040658',
  '02041244', '02031836', '02040031', '02040618', '02041204', '02031753', '02032343', '02040536',
  '02041123', '02031713', '02032308', '02040455', '02041047', '02031642', '02032234', '02040424',
  '02041008', '02031553', '02032147', '02040331', '02040914', '02031503', '02032049', '02040237',
  '02040829', '02031420', '02032021', '02040210', '02040757', '02031352', '02031941', '02040130',
  '02040719', '02031303', '02031857', '02040043', '02040627', '02031225', '02031812', '02032358',
  '02040546', '02031129', '02031726', '02032315', '02040458', '02031054', '02031642', '02032230',
  '02040428', '02031018', '02031617', '02032207', '02040346', '02030941', '02031529', '02032109',
  '02040300',
];

export function lichunOf(year) {
  const i = year - LICHUN_FROM;
  if (i < 0 || i >= LICHUN.length) return null;
  const s = LICHUN[i];
  return {
    year,
    month: +s.slice(0, 2), day: +s.slice(2, 4), hour: +s.slice(4, 6), minute: +s.slice(6, 8),
    text: `${year}-${s.slice(0, 2)}-${s.slice(2, 4)} ${s.slice(4, 6)}:${s.slice(6, 8)}`,
    dateText: `${year}-${s.slice(0, 2)}-${s.slice(2, 4)}`,
  };
}

// 年柱：公历年 Y 的立春起，年柱为六十甲子第 (Y - 1984) 位。1984 = 甲子。
export function yearGanzhiIndex(year) {
  return (((year - 1984) % 60) + 60) % 60;
}
export function yearGanzhi(year) {
  const i = yearGanzhiIndex(year);
  return STEMS[i % 10] + BRANCHES[i % 12];
}
// 生肖 = 年支。索引与地支一致（0 = 子鼠 … 11 = 亥猪）。
export function zodiacIndexForYear(year) {
  return (((year - 1984) % 12) + 12) % 12;
}

// R30 生肖换柱：按立春的**时刻**比较，精确到分钟，不是按日比较。
// 立春当天出生的人因此能精确判定——多数生肖站做不到这一点。
export function zodiacIndexFromDateTime(year, month, day, hour = 12, minute = 0) {
  const lc = lichunOf(year);
  if (!lc) return null;
  const stamp = month * 1000000 + day * 10000 + hour * 100 + minute;
  const line = lc.month * 1000000 + lc.day * 10000 + lc.hour * 100 + lc.minute;
  return zodiacIndexForYear(stamp < line ? year - 1 : year);
}

// 某生肖对应的公历年（该年立春起即为此生肖）
export function zodiacYears(bi, from, to) {
  const out = [];
  for (let y = from; y <= to; y++) if (zodiacIndexForYear(y) === bi) out.push(y);
  return out;
}

// R30 六破表（传统定表）。三组与其它关系重合，各流派对「已合之支是否再论破」
// 有分歧：寅亥同时是六合，巳申同时是六合且各自的三合局互含。
// 本站照表全列，不偷偷选一种，并在页面上把这处分歧写出来。
export const BRANCH_BREAK = {
  '子': '酉', '酉': '子', '丑': '辰', '辰': '丑', '寅': '亥', '亥': '寅',
  '卯': '午', '午': '卯', '巳': '申', '申': '巳', '未': '戌', '戌': '未',
};

// R30 犯太岁的五种关系。传统把「生肖与流年地支」的关系归为这五类，
// 本站全部按表实算：值（同支）/ 冲（相隔六位）/ 刑（同一相刑组或自刑）/
// 害（六害）/ 破（六破）。这五类可以并存（例如本命年又是自刑之支时，值+刑）。
export const TAI_SUI_KINDS = [
  { key: 'zhi', cn: '值太岁', en: 'Own year', noteCn: '生肖与流年地支相同，即本命年', noteEn: 'your animal is the year branch — ben ming nian' },
  { key: 'chong', cn: '冲太岁', en: 'Clash', noteCn: '生肖与流年地支相隔六位', noteEn: 'your branch sits six positions from the year branch' },
  { key: 'xing', cn: '刑太岁', en: 'Punishment', noteCn: '生肖与流年地支同处一个相刑组，或同属自刑之支', noteEn: 'your branch shares a punishment group with the year branch, or both self-punish' },
  { key: 'hai', cn: '害太岁', en: 'Harm', noteCn: '生肖与流年地支构成六害', noteEn: 'your branch forms a six-harm pair with the year branch' },
  { key: 'po', cn: '破太岁', en: 'Break', noteCn: '生肖与流年地支构成六破', noteEn: 'your branch forms a six-break pair with the year branch' },
];

// 给定流年地支，返回十二支各自的太岁关系（kinds 为空 = 不犯太岁）。
// 复用 branchProfile 的冲/害/刑判定，避免把刑组表抄第二遍。
export function taiSuiRelations(yearBi) {
  const yb = BRANCHES[yearBi];
  if (!yb) return null;
  return BRANCHES.map((b, bi) => {
    const p = branchProfile(b);
    const kinds = [];
    if (bi === yearBi) kinds.push('zhi');
    if (p.clash.branch === yb) kinds.push('chong');
    if (p.harm.branch === yb) kinds.push('hai');
    if (BRANCH_BREAK[b] === yb) kinds.push('po');
    const inGroup = p.punishGroups.some((g) => g.peers.indexOf(yb) >= 0);
    if (inGroup || (p.selfPunish && b === yb)) kinds.push('xing');
    return { bi, branch: b, animalCn: BRANCH_ANIMAL[bi], animalEn: BRANCH_ANIMAL_EN[bi], kinds };
  });
}

// 某生肖在给定年份区间内「犯太岁」的年份清单（含当年干支与关系种类）。
export function zodiacTaiSuiYears(bi, from, to) {
  const out = [];
  for (let y = from; y <= to; y++) {
    const rel = taiSuiRelations(zodiacIndexForYear(y)).find((r) => r.bi === bi);
    if (rel && rel.kinds.length) out.push({ year: y, ganzhi: yearGanzhi(y), kinds: rel.kinds.slice() });
  }
  return out;
}

// R30 五虎遁：年上起月。寅月（正月）天干由年干决定——甲己之年丙作首、
// 乙庚之岁戊为头、丙辛必定寻庚起、丁壬壬位顺行流、戊癸之年甲寅求。
// 推导为 5 个起点后顺行，12 个月柱全部落回六十甲子（测试断言这一条）。
export function monthStemIndex(yearStemIndex, monthOrdinal) {
  const first = [2, 4, 6, 8, 0][yearStemIndex % 5];
  return (first + (monthOrdinal - 1)) % 10;
}

export function yearMonthPillars(year) {
  const ysi = yearGanzhiIndex(year) % 10;
  return Array.from({ length: 12 }, (_, k) => {
    const bi = (k + 2) % 12;                 // 寅 = 2 起，顺行
    const si = monthStemIndex(ysi, k + 1);
    return {
      ordinal: k + 1, month: ((bi + 10) % 12) + 1,
      ganzhi: STEMS[si] + BRANCHES[bi], stem: STEMS[si], branch: BRANCHES[bi],
      stemIndex: si, branchIndex: bi, jie: BRANCH_JIE[bi], jieEn: JIE_EN[BRANCH_JIE[bi]],
    };
  });
}

// ---------- R30 流年剖面 ----------
export function yearProfile(year) {
  const gi = yearGanzhiIndex(year);
  const si = gi % 10, bi = gi % 12;
  const gz = STEMS[si] + BRANCHES[bi];
  const ny = nayinOf(gz);
  const relations = taiSuiRelations(bi);
  return {
    year, ganzhi: gz, stem: STEMS[si], branch: BRANCHES[bi], stemIndex: si, branchIndex: bi,
    stemEn: STEMS_EN[si], branchEn: BRANCH_EN_ENGINE[bi],
    stemElement: STEM_ELEMENT[si], branchElement: BRANCH_ELEMENT[bi],
    stemPolarity: STEM_POLARITY[si], branchPolarity: BRANCH_POLARITY[bi],
    elementEn: ELEMENT_EN[STEM_ELEMENT[si]],
    nayin: ny.cn, nayinEn: ny.en, nayinPartner: ny.partner,
    zodiacCn: BRANCH_ANIMAL[bi], zodiacEn: BRANCH_ANIMAL_EN[bi],
    jie: BRANCH_JIE[bi], jieEn: JIE_EN[BRANCH_JIE[bi]],
    lichun: lichunOf(year), nextLichun: lichunOf(year + 1),
    relations,
    offenders: relations.filter((r) => r.kinds.length),
    months: yearMonthPillars(year),
  };
}

// ---------- R30 生肖剖面 ----------
// 生肖页与地支页的分工（刻意如此，避免两族内容重复）：
//   地支页 = 位置页：藏干、月建、时辰、方位、十干十二长生、含该支的五个甲子柱；
//   生肖页 = 日历页：公历年表、立春边界、犯太岁年份、与其它生肖的关系。
// 两页互相链接，各自声明对方负责什么。
export function zodiacProfile(bi) {
  if (!(bi >= 0 && bi <= 11)) return null;
  const branch = BRANCHES[bi];
  const p = branchProfile(branch);
  return {
    index: bi, branch, branchEn: p.branchEn,
    animalCn: p.animalCn, animalEn: p.animalEn,
    polarity: p.polarity, element: p.element, elementEn: p.elementEn,
    dirCn: p.dirCn, dirEn: p.dirEn, hour: p.hour, month: p.month, jie: p.jie, jieEn: p.jieEn,
    season: p.season, seasonEn: p.seasonEn, hidden: p.hidden,
    sixHe: p.sixHe, clash: p.clash, harm: p.harm, trine: p.trine, meeting: p.meeting,
    punishGroups: p.punishGroups, selfPunish: p.selfPunish,
    breakBranch: BRANCH_BREAK[branch],
    years: zodiacYears(bi, 1900, 2043),
    pillars: p.pillars,
  };
}

// ============================================================
// R31 六十四卦层（v0.10.0）
// ------------------------------------------------------------
// 为什么一个八字站要算卦：纳甲六爻是**以干支为骨**的体系——六十四卦的每一爻都
// 落在六十甲子里，六亲、五行、月建日辰全靠干支推。本站已有的干支/五行/藏干资产
// 在这里全部复用，而卦的部分（八宫、世应、纳甲、错综互）都可以由「上下卦」纯推导，
// 不靠背诵对照表——这正是本站的立身之本：给定任何一卦，页面上的每个字都能复算。
//
// 约定（公开分歧处都标注）：
//   R31.1 卦序用**文王卦序**（1..64，与 Unicode U+4DC0..U+4DFF 一致）作为主序；
//         先天/二进制序（伏羲序，乾=63）作为第二序号同时给出——两者不同不是错误。
//   R31.2 六爻一律**自下而上**为初、二、三、四、五、上；爻的阴阳用 1=阳 0=阴。
//   R31.3 内卦（下卦）三爻为初二三，外卦（上卦）三爻为四五六。
//   R31.4 纳甲用**京房纳甲**（通行口诀，见 NAJIA 常量）：乾坤内外异干，其余六卦内外同干；
//         阳卦（乾震坎艮）地支顺行隔位，阴卦（坤巽离兑）逆行隔位。
//         「阳卦」的判据 = 卦中阳爻数为奇数（乾三、震坎艮各一），与《易传》「阳卦多阴」一致。
//   R31.5 两套卦序、纳甲、八宫、世应、错综互全部由「上卦 + 下卦」推导，无第二处人工数据。
//
// 定表的生成与 8 组交叉校验见 generate-hexagrams.py（外部权威源：Unicode 两个区块
// U+2630..U+2637 八卦符 / U+4DC0..U+4DFF 六十四卦符；8×8 上下卦矩阵 + 逐卦显式清单
// 互证；文王卦序 32 对综/错配对规则；京房八宫双射；纳甲 8 纯卦黄金值 + 384 爻阴阳一致
// + 12 地支各出现 32 次）。双引擎一致性见 test-web-engine.mjs 的 R31 段。
// ============================================================

// 八卦：**先天卦序**索引 0..7 = 乾一 兑二 离三 震四 巽五 坎六 艮七 坤八。
// 该次序与 Unicode U+2630+i 的官方名称逐条一致（生成器断言）。
export const TRI = ['乾','兑','离','震','巽','坎','艮','坤'];
export const TRI_PY = ['Qian','Dui','Li','Zhen','Xun','Kan','Gen','Kun'];
export const TRI_IMG = ['天','泽','火','雷','风','水','山','地'];
export const TRI_IMG_EN = ['Heaven','Lake','Fire','Thunder','Wind','Water','Mountain','Earth'];
export const TRI_GLYPH = ['☰','☱','☲','☳','☴','☵','☶','☷'];
export const TRI_ELEMENT = ['金','金','火','木','木','水','土','土'];
// 三爻自下而上的阴阳（1=阳 0=阴）折算成的数值（初爻为最低位）：乾 111→7 … 坤 000→0。
// 这个数值就是「二进制序」的组成部分，也是错/综/互三卦运算的唯一依据。
export const TRI_VALUE = [7,3,5,1,6,2,4,0];
export const TRI_FAMILY = ['父','少女','中女','长男','长女','中男','少男','母'];
export const TRI_FAMILY_EN = ['Father','Youngest Daughter','Middle Daughter','Eldest Son','Eldest Daughter','Middle Son','Youngest Son','Mother'];
export const TRI_DIR = ['西北','西','南','东','东南','北','东北','西南'];
export const TRI_DIR_EN = ['Northwest','West','South','East','Southeast','North','Northeast','Southwest'];
// 「阳卦」= 阳爻数为奇数：乾(3) 震(1) 坎(1) 艮(1) 为阳；兑(2) 离(2) 巽(2) 坤(0) 为阴。
// 生成器里由 TRI_VALUE 的 popcount 逐条断言，不另存一份。
export const TRI_YANG = [1,0,0,1,0,1,1,0];

// 纳甲：索引 = 先天卦序。内卦天干 / 外卦天干 / 内卦初爻地支索引 / 外卦四爻地支索引。
// 口诀：乾金甲子外壬午，坎水戊寅外戊申，艮土丙辰外丙戌，震木庚子外庚午，
//       巽木辛丑外辛未，离火己卯外己酉，坤土乙未外癸丑，兑金丁巳外丁亥。
export const NAJIA_STEM_IN  = ['甲','丁','己','庚','辛','戊','丙','乙'];
export const NAJIA_STEM_OUT = ['壬','丁','己','庚','辛','戊','丙','癸'];
export const NAJIA_IN_START  = [0,5,3,0,1,2,4,7];
export const NAJIA_OUT_START = [6,11,9,6,7,8,10,1];

// 六十四卦（文王卦序）。四张表同长度，由 test-web-engine 的长度断言与黄金值锁死。
export const HEX_CN = ['乾','坤','屯','蒙','需','讼','师','比','小畜','履','泰','否','同人','大有','谦','豫','随','蛊','临','观','噬嗑','贲','剥','复','无妄','大畜','颐','大过','坎','离','咸','恒','遁','大壮','晋','明夷','家人','睽','蹇','解','损','益','夬','姤','萃','升','困','井','革','鼎','震','艮','渐','归妹','丰','旅','巽','兑','涣','节','中孚','小过','既济','未济'];
export const HEX_PY = ['Qian','Kun','Zhun','Meng','Xu','Song','Shi','Bi','Xiao Xu','Lv','Tai','Pi','Tong Ren','Da You','Qian','Yu','Sui','Gu','Lin','Guan','Shi He','Bi','Bo','Fu','Wu Wang','Da Xu','Yi','Da Guo','Kan','Li','Xian','Heng','Dun','Da Zhuang','Jin','Ming Yi','Jia Ren','Kui','Jian','Xie','Sun','Yi','Guai','Gou','Cui','Sheng','Kun','Jing','Ge','Ding','Zhen','Gen','Jian','Gui Mei','Feng','Lv','Xun','Dui','Huan','Jie','Zhong Fu','Xiao Guo','Ji Ji','Wei Ji'];
export const HEX_EN = ['The Creative','The Receptive','Difficulty at the Beginning','Youthful Folly','Waiting','Conflict','The Army','Holding Together','The Taming Power of the Small','Treading','Peace','Standstill','Fellowship with Others','Possession in Great Measure','Modesty','Enthusiasm','Following','Work on What Has Been Spoiled','Approach','Contemplation','Biting Through','Grace','Splitting Apart','Return','Innocence','The Taming Power of the Great','The Corners of the Mouth','Preponderance of the Great','The Abysmal Water','The Clinging Fire','Influence','Duration','Retreat','The Power of the Great','Progress','Darkening of the Light','The Family','Opposition','Obstruction','Deliverance','Decrease','Increase','Breakthrough','Coming to Meet','Gathering Together','Pushing Upward','Oppression','The Well','Revolution','The Cauldron','The Arousing Thunder','Keeping Still Mountain','Development','The Marrying Maiden','Abundance','The Wanderer','The Gentle Wind','The Joyous Lake','Dispersion','Limitation','Inner Truth','Small Preponderance','After Completion','Before Completion'];
// Unicode 官方卦名（去 'HEXAGRAM FOR ' 前缀）。用途是**外部锚点**：生成器用
// unicodedata 逐条断言「U+4DC0+n-1 的官方名 == 本表第 n 项」，所以文王卦序的位置
// 一旦被改动就会被抓出来（英文显示名有几种通行译法，这串不会随译法漂移）。
export const HEX_UNI = ['THE CREATIVE HEAVEN','THE RECEPTIVE EARTH','DIFFICULTY AT THE BEGINNING','YOUTHFUL FOLLY','WAITING','CONFLICT','THE ARMY','HOLDING TOGETHER','SMALL TAMING','TREADING','PEACE','STANDSTILL','FELLOWSHIP','GREAT POSSESSION','MODESTY','ENTHUSIASM','FOLLOWING','WORK ON THE DECAYED','APPROACH','CONTEMPLATION','BITING THROUGH','GRACE','SPLITTING APART','RETURN','INNOCENCE','GREAT TAMING','MOUTH CORNERS','GREAT PREPONDERANCE','THE ABYSMAL WATER','THE CLINGING FIRE','INFLUENCE','DURATION','RETREAT','GREAT POWER','PROGRESS','DARKENING OF THE LIGHT','THE FAMILY','OPPOSITION','OBSTRUCTION','DELIVERANCE','DECREASE','INCREASE','BREAKTHROUGH','COMING TO MEET','GATHERING TOGETHER','PUSHING UPWARD','OPPRESSION','THE WELL','REVOLUTION','THE CAULDRON','THE AROUSING THUNDER','THE KEEPING STILL MOUNTAIN','DEVELOPMENT','THE MARRYING MAIDEN','ABUNDANCE','THE WANDERER','THE GENTLE WIND','THE JOYOUS LAKE','DISPERSION','LIMITATION','INNER TRUTH','SMALL PREPONDERANCE','AFTER COMPLETION','BEFORE COMPLETION'];
// 每卦的上卦 / 下卦（先天卦序索引）。
export const HEX_UPPER = [0,7,5,6,5,0,7,5,4,0,7,0,0,2,7,3,1,6,7,4,2,6,6,7,0,6,6,1,5,2,1,3,0,3,2,7,4,2,5,3,6,4,1,0,1,7,1,5,1,2,3,6,4,3,3,2,4,1,4,5,4,3,5,2];
export const HEX_LOWER = [0,7,3,5,0,5,5,7,0,1,0,7,2,0,6,7,3,4,1,7,3,2,7,3,3,0,3,4,5,2,6,4,6,0,7,2,2,1,6,5,1,3,0,4,7,4,5,4,2,4,3,6,6,1,2,6,4,1,5,1,1,6,2,5];

// 京房八宫：次序 = 乾 坎 艮 震 巽 离 坤 兑；每宫 8 卦 = 本宫(六世)、一世…五世、游魂、归魂。
export const GONG_ORDER = [0,5,6,3,4,2,7,1];
export const GONG_OF = [0,6,1,5,6,5,1,6,4,2,6,0,5,0,7,3,3,4,6,0,4,2,0,6,4,2,4,3,1,5,7,3,0,6,0,1,4,2,7,3,2,4,6,0,7,3,7,3,1,5,3,2,2,7,1,5,4,7,5,1,2,7,1,5];
export const GONG_STAGE = [0,0,2,4,6,6,7,7,1,5,3,3,7,7,5,1,7,7,2,4,5,1,5,1,4,2,6,6,0,0,3,3,2,4,6,6,2,4,4,2,3,3,5,1,2,4,1,5,4,2,0,0,7,7,5,1,0,0,5,1,6,6,3,3];
export const GONG_LABEL = ['六世','一世','二世','三世','四世','五世','游魂','归魂'];
export const GONG_LABEL_EN = ['Pure','First','Second','Third','Fourth','Fifth','Wandering','Returning'];
// 世爻 / 应爻位置（1..6 自下而上）。游魂世在四爻、归魂世在三爻——与四世/三世同世位但应位不同。
export const SHI_POS = [6,1,2,3,4,5,4,3];
export const YING_POS = [3,4,5,6,1,2,1,6];
// 自综卦（奇位）：乾/坤、颐/大过、坎/离、中孚/小过 四对。它们与配对卦的关系是「错」而非「综」。
export const HEX_SELF_REVERSING = [1,27,29,61];
export const HEX_PURE = [1,2,29,30,51,52,57,58];
// 六神（六兽）起法：按**日干**起，甲乙起青龙、丙丁起朱雀、戊起勾陈、己起螣蛇、庚辛起白虎、壬癸起玄武，
// 自初爻向上依次配。这是卜卦当日的变量，不是卦的固有属性——页面必须说明这一点。
export const SIX_SPIRITS = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
export const SIX_SPIRITS_EN = ['Azure Dragon','Vermilion Bird','Gouchen','Flying Serpent','White Tiger','Black Tortoise'];
export const SPIRIT_START_BY_STEM = [0,0,1,1,2,3,4,4,5,5];   // 索引 = 天干索引

// 3 位阴阳值 → 卦序（0..63 的二进制序，+1 即「先天/二进制序编号」）
const HEX_BY_VALUE = (function () {
  const a = [];
  for (let n = 1; n <= 64; n++) a[TRI_VALUE[HEX_LOWER[n - 1]] | (TRI_VALUE[HEX_UPPER[n - 1]] << 3)] = n;
  return a;
})();

export const HEXAGRAM_COUNT = 64;
export const TRIGRAM_COUNT = 8;

// ---------- 基本派生 ----------
export function hexGlyph(n) { return String.fromCharCode(0x4DC0 + n - 1); }
export function triGlyph(ti) { return TRI_GLYPH[ti]; }
export function hexLines(n) {   // 六爻自下而上，1=阳 0=阴
  if (!(n >= 1 && n <= 64)) return null;
  const v = TRI_VALUE[HEX_LOWER[n - 1]] | (TRI_VALUE[HEX_UPPER[n - 1]] << 3);
  const out = [];
  for (let i = 0; i < 6; i++) out.push((v >> i) & 1);
  return out;
}
function hexValueOf(n) { return TRI_VALUE[HEX_LOWER[n - 1]] | (TRI_VALUE[HEX_UPPER[n - 1]] << 3); }
export function hexBinaryIndex(n) { return hexValueOf(n) + 1; }   // 伏羲/二进制序 1..64（坤为地=1，乾为天=64）
export function hexFromBinaryIndex(k) { return HEX_BY_VALUE[k - 1] || 0; }
export function hexFullCn(n) {  // 传统全名：水雷屯 / 乾为天（八纯卦用「X为Y」）
  const i = n - 1, u = HEX_UPPER[i], l = HEX_LOWER[i];
  return u === l ? HEX_CN[i] + '为' + TRI_IMG[u] : TRI_IMG[u] + TRI_IMG[l] + HEX_CN[i];
}
export function triYangCount(ti) { let c = 0, v = TRI_VALUE[ti]; for (let i = 0; i < 3; i++) if ((v >> i) & 1) c++; return c; }

// ---------- 错 / 综 / 互（三个纯推导的卦关系） ----------
export function cuoHex(n) {   // 错卦（旁通）：六爻全变
  return hexFromBinaryIndex((hexValueOf(n) ^ 63) + 1);
}
export function zongHex(n) {  // 综卦（反卦）：六爻上下颠倒
  const v = hexValueOf(n);
  let r = 0;
  for (let i = 0; i < 6; i++) if ((v >> i) & 1) r |= 1 << (5 - i);
  return hexFromBinaryIndex(r + 1);
}
export function huHex(n) {    // 互卦（互体）：2·3·4 爻为下卦，3·4·5 爻为上卦
  const L = hexLines(n);
  const lo = L[1] | (L[2] << 1) | (L[3] << 2);
  const up = L[2] | (L[3] << 1) | (L[4] << 2);
  return hexFromBinaryIndex(((up << 3) | lo) + 1);
}

// ---------- 纳甲 ----------
export function najiaOf(n) {
  if (!(n >= 1 && n <= 64)) return null;
  const u = HEX_UPPER[n - 1], l = HEX_LOWER[n - 1];
  const out = [];
  for (let k = 0; k < 3; k++) {
    const t = l;
    const bi = (((NAJIA_IN_START[t] + (TRI_YANG[t] ? 2 * k : -2 * k)) % 12) + 12) % 12;
    out.push({ pos: k + 1, inner: true, stem: NAJIA_STEM_IN[t], stemIndex: STEMS.indexOf(NAJIA_STEM_IN[t]), branch: BRANCHES[bi], branchIndex: bi, ganzhi: NAJIA_STEM_IN[t] + BRANCHES[bi] });
  }
  for (let k = 0; k < 3; k++) {
    const t = u;
    const bi = (((NAJIA_OUT_START[t] + (TRI_YANG[t] ? 2 * k : -2 * k)) % 12) + 12) % 12;
    out.push({ pos: k + 4, inner: false, stem: NAJIA_STEM_OUT[t], stemIndex: STEMS.indexOf(NAJIA_STEM_OUT[t]), branch: BRANCHES[bi], branchIndex: bi, ganzhi: NAJIA_STEM_OUT[t] + BRANCHES[bi] });
  }
  return out;
}

// ---------- 六亲（相对本宫五行的称谓） ----------
export function liuQinOf(gongElement, branchIndex) {
  const e = BRANCH_ELEMENT[branchIndex];
  if (e === gongElement) return '兄弟';
  if (SHENG[gongElement] === e) return '子孙';
  if (SHENG[e] === gongElement) return '父母';
  if (KE[e] === gongElement) return '官鬼';
  return '妻财';
}
// 六神：按日干起的，逐爻自初向上配（页面要说明这是「当日」变量）
export function sixSpiritsOfDayStem(stemIndex) {
  const s = SPIRIT_START_BY_STEM[stemIndex];
  const out = [];
  for (let k = 0; k < 6; k++) { const i = (s + k) % 6; out.push({ pos: k + 1, cn: SIX_SPIRITS[i], en: SIX_SPIRITS_EN[i] }); }
  return out;
}

// ---------- 八宫 ----------
export function hexagonsInGong(gi) {
  const out = [];
  for (let n = 1; n <= 64; n++) if (GONG_OF[n - 1] === gi) out.push(n);
  return out;
}
export function hexagonsWithTrigram(ti, where) {   // where: 'upper' | 'lower'
  const arr = where === 'lower' ? HEX_LOWER : HEX_UPPER;
  const out = [];
  for (let n = 1; n <= 64; n++) if (arr[n - 1] === ti) out.push(n);
  return out;
}

// ---------- 卦剖面（页面的唯一数据来源） ----------
export function hexagramProfile(n) {
  if (!(n >= 1 && n <= 64)) return null;
  const i = n - 1;
  const u = HEX_UPPER[i], l = HEX_LOWER[i];
  const gi = GONG_OF[i], st = GONG_STAGE[i];
  const gongTri = GONG_ORDER[gi];
  const gongElement = TRI_ELEMENT[gongTri];
  const tri = (t) => ({
    index: t, cn: TRI[t], py: TRI_PY[t], img: TRI_IMG[t], imgEn: TRI_IMG_EN[t], glyph: TRI_GLYPH[t],
    element: TRI_ELEMENT[t], elementEn: ELEMENT_EN[TRI_ELEMENT[t]], value: TRI_VALUE[t],
    yang: !!TRI_YANG[t], yangCount: triYangCount(t), family: TRI_FAMILY[t], familyEn: TRI_FAMILY_EN[t],
    dir: TRI_DIR[t], dirEn: TRI_DIR_EN[t],
  });
  const najia = najiaOf(n).map((x) => ({
    ...x,
    branchElement: BRANCH_ELEMENT[x.branchIndex],
    branchElementEn: ELEMENT_EN[BRANCH_ELEMENT[x.branchIndex]],
    liuqin: liuQinOf(gongElement, x.branchIndex),
  }));
  return {
    n,
    cn: HEX_CN[i], py: HEX_PY[i], en: HEX_EN[i], unicodeName: HEX_UNI[i],
    glyph: hexGlyph(n), fullCn: hexFullCn(n),
    upper: tri(u), lower: tri(l),
    lines: hexLines(n), lineStr: hexLines(n).join(''),
    binaryIndex: hexBinaryIndex(n),
    pure: HEX_PURE.indexOf(n) >= 0,
    selfReversing: HEX_SELF_REVERSING.indexOf(n) >= 0,
    palace: {
      index: gi, trigram: TRI[gongTri], trigramPy: TRI_PY[gongTri], glyph: TRI_GLYPH[gongTri],
      element: gongElement, elementEn: ELEMENT_EN[gongElement],
      stage: st, stageCn: GONG_LABEL[st], stageEn: GONG_LABEL_EN[st],
      shi: SHI_POS[st], ying: YING_POS[st], members: hexagonsInGong(gi),
    },
    najia,
    najiaBranches: najia.map((x) => x.branch),
    distinctBranches: najia.map((x) => x.branch).filter((b, k, a) => a.indexOf(b) === k),
    cuo: cuoHex(n), zong: zongHex(n), hu: huHex(n),
    upperSiblings: hexagonsWithTrigram(u, 'upper'),
    lowerSiblings: hexagonsWithTrigram(l, 'lower'),
    // 该卦在六十甲子里出现几次：六爻干支与六十甲子的交集（每爻必落在六十甲子内）
    jiaziHits: najia.map((x) => x.ganzhi).filter((gz) => JIAZI.indexOf(gz) >= 0),
  };
}

// ============ R32 神煞层（v0.11.0）============
// 定表来源：generate-shensha.py（2026-09-20 外部源核对，每表 >=2 源）+ 结构推导互证：
//   禄神=十二长生临官、羊刃(阳/阴)=帝旺、空亡=旬首推导、十恶大败=禄入空亡推导、
//   红鸾=卯起逆行、天喜=红鸾对冲、病符=岁后一辰、孤辰=季组末支+1、寡宿=季组首支-1、天医=月支-1。
// 公开流派分歧（不偷偷选一种）：
//   ① 天乙贵人 庚辛 两干：主流「甲戊庚牛羊…六辛逢马虎」vs 别派「甲戊并牛羊…庚辛逢虎马」
//   ② 羊刃：主流仅阳干有刃；别派阴干取帝旺（阴刃）
//   ③ 十恶大败：《渊海子平》异文作「乙丑」，但乙禄卯不入甲子旬空亡，推导不成立 → 取三命通会「己丑」
//   ④ 天罗地网：火命戌亥为天罗、水土命辰巳为地网为常见口径，四维卦位写法各派不一
// R32.1 起例锚点七类：day-stem（日干查四支）/ trine（三合组）/ month-branch（月支查）/
//   month-trine（月支三合组查干）/ year-branch（年支查）/ pillar-list（固定柱表）/ derived（复用十神、纳音）
// R32.2 神煞是经验标签层：只输出「规则 + 查表 + 推导链」，不输出吉凶断言、不输出人格结论。

export const SS_LU = ['寅','卯','巳','午','巳','午','申','酉','亥','子'];
export const SS_YANG_REN = ['卯','','午','','午','','酉','','子',''];
export const SS_YIN_REN = ['','寅','','巳','','巳','','申','','亥'];
export const SS_NOBLEMAN = ['丑未','子申','亥酉','亥酉','丑未','子申','丑未','午寅','卯巳','卯巳'];
export const SS_NOBLEMAN_ALT = ['丑未','子申','亥酉','亥酉','丑未','子申','寅午','寅午','卯巳','卯巳'];
export const SS_WENCHANG = ['巳','午','申','酉','申','酉','亥','子','寅','卯'];
export const SS_TAIJI = ['子午','子午','卯酉','卯酉','辰戌丑未','辰戌丑未','寅亥','寅亥','巳申','巳申'];
export const SS_GUOYIN = ['戌','亥','丑','寅','丑','寅','辰','巳','未','申'];
export const SS_FUXING = ['寅子','丑卯','寅子','亥','申','未','午','巳','辰','丑卯'];
export const SS_JINYU = ['辰','巳','未','申','未','申','戌','亥','丑','寅'];
export const SS_KONGWANG = ['戌亥','申酉','午未','辰巳','寅卯','子丑'];
export const SS_SHI_E = ['甲辰','乙巳','壬申','丙申','丁亥','庚辰','戊戌','癸亥','辛巳','己丑'];
export const SS_KUIGANG = ['壬辰','庚戌','庚辰','戊戌'];
export const SS_CHACUO = ['丙子','丁丑','戊寅','辛卯','壬辰','癸巳','丙午','丁未','戊申','辛酉','壬戌','癸亥'];
export const SS_TIANSH = ['戊寅','甲午','戊申','甲子'];
export const SS_HONGLUAN = ['卯','寅','丑','子','亥','戌','酉','申','未','午','巳','辰'];
export const SS_TIANDOCTOR = ['丑','寅','卯','辰','巳','午','未','申','酉','戌','亥','子'];
export const SS_XUEREN = ['丑','未','寅','申','卯','酉','辰','戌','巳','亥','午','子'];
export const SS_TIANDI = ['丁','申','壬','辛','亥','甲','癸','寅','丙','乙','巳','庚'];
export const SS_TRINE_STAR = {
  taohua:    { '寅午戌':'卯','申子辰':'酉','巳酉丑':'午','亥卯未':'子' },
  yima:      { '寅午戌':'申','申子辰':'寅','巳酉丑':'亥','亥卯未':'巳' },
  huagai:    { '寅午戌':'戌','申子辰':'辰','巳酉丑':'丑','亥卯未':'未' },
  jiangxing: { '寅午戌':'午','申子辰':'子','巳酉丑':'酉','亥卯未':'卯' },
  wangshen:  { '寅午戌':'巳','申子辰':'亥','巳酉丑':'申','亥卯未':'寅' },
  jiesha:    { '寅午戌':'亥','申子辰':'巳','巳酉丑':'寅','亥卯未':'申' },
  zaisha:    { '寅午戌':'子','申子辰':'午','巳酉丑':'卯','亥卯未':'酉' }
};
export const SS_YUEDE = { '寅':'丙','午':'丙','戌':'丙','申':'壬','子':'壬','辰':'壬','巳':'庚','酉':'庚','丑':'庚','亥':'甲','卯':'甲','未':'甲' };
export const SS_GUCHEN = ['寅','寅','巳','巳','巳','申','申','申','亥','亥','亥','寅'];
export const SS_GUASU  = ['戌','戌','丑','丑','丑','辰','辰','辰','未','未','未','戌'];
export const SS_TONGZI = {
  springAutumn: ['寅','子'],      // 春秋月（寅卯辰/申酉戌）日支或时支见
  winterSummer: ['卯','未','辰'], // 冬夏月（亥子丑/巳午未）日支或时支见
  nayin: { '金': ['午','卯'], '木': ['午','卯'], '水': ['酉','戌'], '火': ['酉','戌'], '土': ['辰','巳'] }
};
export const SS_LUOWANG = {
  tianLuo: { elements: ['火'], branches: ['戌','亥'] },
  diWang:  { elements: ['水','土'], branches: ['辰','巳'] }
};

export function kongWangOf(jiaziIdx) {
  const xun = Math.floor(jiaziIdx / 10);
  return [(xun * 10 + 10) % 12, (xun * 10 + 11) % 12];
}
export function kongWangOfDayGz(gz) {
  const i = JIAZI.indexOf(gz);
  if (i < 0) return null;
  const voids = kongWangOf(i);
  return { xunStart: JIAZI[Math.floor(i / 10) * 10], voids: [BRANCHES[voids[0]], BRANCHES[voids[1]]] };
}
export function shiEDerived() {   // 十恶大败 = 日干禄落本旬空亡（与 SS_SHI_E 互证）
  const out = [];
  for (let k = 0; k < 60; k++) {
    const stem = STEMS[k % 10], branch = BRANCHES[k % 12];
    const voids = SS_KONGWANG[Math.floor(k / 10)];
    if (voids.indexOf(SS_LU[k % 10]) >= 0) out.push(stem + branch);
  }
  return out;
}

const SS_DAY_TABLES = {
  nobleman: SS_NOBLEMAN, noblemanAlt: SS_NOBLEMAN_ALT, wenchang: SS_WENCHANG,
  taiji: SS_TAIJI, guoyin: SS_GUOYIN, fuxing: SS_FUXING, jinyu: SS_JINYU,
  lu: null, yangren: null, yinren: null
};
export function shenshaDayStemBranches(starKey, stemIdx) {
  if (stemIdx < 0 || stemIdx > 9) return [];
  if (starKey === 'lu') return [BRANCHES.indexOf(SS_LU[stemIdx])];
  if (starKey === 'yangren') { const b = SS_YANG_REN[stemIdx]; return b ? [BRANCHES.indexOf(b)] : []; }
  if (starKey === 'yinren')  { const b = SS_YIN_REN[stemIdx];  return b ? [BRANCHES.indexOf(b)] : []; }
  const tbl = SS_DAY_TABLES[starKey];
  if (!tbl) return [];
  return tbl[stemIdx].split('').map(function (b) { return BRANCHES.indexOf(b); });
}
export function shenshaTrineBranch(starKey, branchIdx) {
  const tbl = SS_TRINE_STAR[starKey];
  if (!tbl || branchIdx < 0 || branchIdx > 11) return -1;
  for (const g in tbl) if (g.indexOf(BRANCHES[branchIdx]) >= 0) return BRANCHES.indexOf(tbl[g]);
  return -1;
}
export function shenshaMonthBranch(starKey, monthOrdinal) {  // monthOrdinal 0=寅月
  if (monthOrdinal < 0 || monthOrdinal > 11) return -1;
  if (starKey === 'tiandoctor') return (monthOrdinal + 1) % 12;  // 天医=月支-1
  if (starKey === 'xueren') return BRANCHES.indexOf(SS_XUEREN[monthOrdinal]);
  return -1;
}
export function shenshaYueDeStem(monthBi) {
  for (const g in SS_YUEDE) if (g.indexOf(BRANCHES[monthBi]) >= 0) return SS_YUEDE[g];
  return '';
}
export function shenshaYueDeHeStem(monthBi) {
  const s = shenshaYueDeStem(monthBi);
  return s ? STEM_COMBINE[s] : '';
}
export function shenshaTianDeTarget(monthOrdinal) {  // 0=寅月；四维以同支寄宫（申亥寅巳）
  if (monthOrdinal < 0 || monthOrdinal > 11) return null;
  const v = SS_TIANDI[monthOrdinal];
  const si = STEMS.indexOf(v);
  return si >= 0 ? { type: 'stem', idx: si, cn: v } : { type: 'branch', idx: BRANCHES.indexOf(v), cn: v };
}
export function shenshaHongLuan(yearBi) { return (3 - yearBi + 24) % 12; }
export function shenshaTianXi(yearBi) { return (shenshaHongLuan(yearBi) + 6) % 12; }
export function shenshaBingFu(yearBi) { return (yearBi + 11) % 12; }
export function shenshaGuChen(yearBi) { return BRANCHES.indexOf(SS_GUCHEN[yearBi]); }
export function shenshaGuaSu(yearBi)  { return BRANCHES.indexOf(SS_GUASU[yearBi]); }

// 官/财/印/食四星：各日干 × 12 支主气（BRANCH_MAIN_QI 藏干首位）的十神归属
export function shenshaTenGodBranches(dayStemIdx, family) {
  // family: 'officer'(官杀) | 'wealth'(财星) | 'seal'(印星) | 'output'(食伤)
  const dayGan = STEMS[dayStemIdx];
  const famMap = {
    officer: ['七杀', '正官'], wealth: ['偏财', '正财'],
    seal: ['偏印', '正印'], output: ['食神', '伤官']
  };
  const target = famMap[family];
  if (!target) return [];
  const rows = [];
  for (let bi = 0; bi < 12; bi++) {
    const mainQi = BRANCH_HIDE_GAN[BRANCHES[bi]][0];
    const god = tenGodOf(dayGan, mainQi);
    if (target.indexOf(god) >= 0) rows.push({ branchIdx: bi, hidden: mainQi, god: god });
  }
  return rows;
}

const SS_TIANSH_SEASON = [   // 季（月支组）→ 天赦柱：春寅卯辰/夏巳午未/秋申酉戌/冬亥子丑
  ['寅','卯','辰'], ['巳','午','未'], ['申','酉','戌'], ['亥','子','丑']
];
export function shenshaTianShOfDayBranch(monthBi) {
  for (let s = 0; s < 4; s++) if (SS_TIANSH_SEASON[s].indexOf(BRANCHES[monthBi]) >= 0) return SS_TIANSH[s];
  return '';
}

// 八字神煞扫描：输入 4 柱干支（年/月/日/时，无时传空串），返回命中清单。
// 锚点流派：三合组星按 年支、日支 双锚分别标注（起年/起日两派都算，不偷偷选）。
export function shenshaScan(pillars) {
  const gz = pillars || [];
  const branches = gz.map(function (p) { return p ? BRANCHES.indexOf(p.charAt(1)) : -1; });
  const stems = gz.map(function (p) { return p ? STEMS.indexOf(p.charAt(0)) : -1; });
  const di = stems[2], yBi = branches[0], mBi = branches[1], dBi = branches[2];
  const hits = [];
  const whereCn = ['年支', '月支', '日支', '时支'];
  function scanBranches(anchorLabel, biList) {
    return function (key, cn, check) {
      const found = [];
      for (let i = 0; i < 4; i++) {
        if (branches[i] >= 0 && check(i, branches[i])) found.push(i);
      }
      if (found.length) hits.push({ key: key, cn: cn, where: found.map(function (i) { return whereCn[i]; }).join('、'), anchor: anchorLabel });
    };
  }
  // ① 日干起：贵人/文昌/禄/刃/金舆/太极/国印/福星
  if (di >= 0) {
    const dayScan = scanBranches('日干' + STEMS[di], null);
    dayScan('nobleman', '天乙贵人', function (i, b) { return shenshaDayStemBranches('nobleman', di).indexOf(b) >= 0; });
    dayScan('wenchang', '文昌', function (i, b) { return shenshaDayStemBranches('wenchang', di).indexOf(b) >= 0; });
    dayScan('lu', '禄神', function (i, b) { return shenshaDayStemBranches('lu', di).indexOf(b) >= 0; });
    dayScan('yangren', '羊刃', function (i, b) { return shenshaDayStemBranches('yangren', di).indexOf(b) >= 0 || shenshaDayStemBranches('yinren', di).indexOf(b) >= 0; });
    dayScan('jinyu', '金舆', function (i, b) { return shenshaDayStemBranches('jinyu', di).indexOf(b) >= 0; });
    dayScan('taiji', '太极贵人', function (i, b) { return shenshaDayStemBranches('taiji', di).indexOf(b) >= 0; });
    dayScan('guoyin', '国印贵人', function (i, b) { return shenshaDayStemBranches('guoyin', di).indexOf(b) >= 0; });
    dayScan('fuxing', '福星贵人', function (i, b) { return shenshaDayStemBranches('fuxing', di).indexOf(b) >= 0; });
  }
  // ② 三合组星：年支、日支双锚
  const trineStars = [['taohua','咸池桃花'],['yima','驿马'],['huagai','华盖'],['jiangxing','将星'],['wangshen','亡神'],['jiesha','劫煞'],['zaisha','灾煞']];
  for (let t = 0; t < trineStars.length; t++) {
    const key = trineStars[t][0], cn = trineStars[t][1];
    const anchors = [];
    if (yBi >= 0 && shenshaTrineBranch(key, yBi) >= 0) anchors.push('起年支');
    if (dBi >= 0 && shenshaTrineBranch(key, dBi) >= 0) anchors.push('起日支');
    const found = [];
    for (let i = 0; i < 4; i++) {
      if (branches[i] < 0) continue;
      const byYear = yBi >= 0 && shenshaTrineBranch(key, yBi) === branches[i];
      const byDay = dBi >= 0 && shenshaTrineBranch(key, dBi) === branches[i];
      if (byYear || byDay) found.push(whereCn[i] + (byYear && byDay ? '（年日双起）' : byYear ? '（起年支）' : '（起日支）'));
    }
    if (found.length) hits.push({ key: key, cn: cn, where: found.join('、'), anchor: anchors.join(' / ') || '' });
  }
  // ③ 月支起：天医、血刃、天德、月德
  if (mBi >= 0) {
    const mo = (mBi + 10) % 12;  // 月支索引 → 月序（0=寅月）
    const doc = shenshaMonthBranch('tiandoctor', mo);
    const xue = shenshaMonthBranch('xueren', mo);
    for (let i = 0; i < 4; i++) {
      if (branches[i] === doc) hits.push({ key: 'tiandoctor', cn: '天医', where: whereCn[i], anchor: '月支' + BRANCHES[mBi] });
      if (branches[i] === xue) hits.push({ key: 'xueren', cn: '血刃', where: whereCn[i], anchor: '月支' + BRANCHES[mBi] });
    }
    const td = shenshaTianDeTarget(mo);
    for (let i = 0; i < 4; i++) {
      if (td && td.type === 'stem' && stems[i] === td.idx) hits.push({ key: 'tiande', cn: '天德贵人', where: whereCn[i] + '干', anchor: '月支' + BRANCHES[mBi] });
      if (td && td.type === 'branch' && branches[i] === td.idx) hits.push({ key: 'tiande', cn: '天德贵人', where: whereCn[i], anchor: '月支' + BRANCHES[mBi] });
    }
    const yd = shenshaYueDeStem(mBi), ydh = shenshaYueDeHeStem(mBi);
    for (let i = 0; i < 4; i++) {
      if (stems[i] >= 0 && STEMS[stems[i]] === yd) hits.push({ key: 'yuede', cn: '月德贵人', where: whereCn[i] + '干', anchor: '月支' + BRANCHES[mBi] });
      if (stems[i] >= 0 && STEMS[stems[i]] === ydh) hits.push({ key: 'yuedehe', cn: '月德合', where: whereCn[i] + '干', anchor: '月支' + BRANCHES[mBi] });
    }
  }
  // ④ 年支起：红鸾、天喜、病符、孤辰、寡宿
  if (yBi >= 0) {
    const hl = shenshaHongLuan(yBi), tx = shenshaTianXi(yBi), bf = shenshaBingFu(yBi);
    const gc = shenshaGuChen(yBi), gs = shenshaGuaSu(yBi);
    for (let i = 0; i < 4; i++) {
      if (branches[i] === hl) hits.push({ key: 'hongluan', cn: '红鸾', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
      if (branches[i] === tx) hits.push({ key: 'tianxi', cn: '天喜', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
      if (branches[i] === bf) hits.push({ key: 'bingfu', cn: '病符', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
      if (branches[i] === gc) hits.push({ key: 'guchen', cn: '孤辰', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
      if (branches[i] === gs) hits.push({ key: 'guasu', cn: '寡宿', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
    }
  }
  // ⑤ 固定柱表：魁罡 / 阴阳差错 / 十恶大败（以日柱为主，其余柱标注）
  const listStars = [['kuigang','魁罡',SS_KUIGANG],['chacuo','阴阳差错',SS_CHACUO],['shie','十恶大败',SS_SHI_E]];
  for (let L = 0; L < listStars.length; L++) {
    const key = listStars[L][0], cn = listStars[L][1], tbl = listStars[L][2];
    for (let i = 0; i < 4; i++) {
      if (gz[i] && tbl.indexOf(gz[i]) >= 0) {
        hits.push({ key: key, cn: cn, where: whereCn[i] + '柱' + (i === 2 ? '' : '（传统以日柱为主）'), anchor: '' });
      }
    }
  }
  // ⑥ 天赦：月支季组 + 日柱
  if (mBi >= 0 && gz[2]) {
    const ts = shenshaTianShOfDayBranch(mBi);
    if (ts && ts === gz[2]) hits.push({ key: 'tianshe', cn: '天赦', where: '日柱', anchor: '月支' + BRANCHES[mBi] });
  }
  // ⑦ 空亡：日柱所在旬，四支逢之为空
  if (gz[2]) {
    const kw = kongWangOfDayGz(gz[2]);
    if (kw) {
      for (let i = 0; i < 4; i++) {
        if (branches[i] >= 0 && kw.voids.indexOf(BRANCHES[branches[i]]) >= 0) {
          hits.push({ key: 'kongwang', cn: '空亡', where: whereCn[i], anchor: '日柱' + gz[2] + '旬空' + kw.voids.join('') });
        }
      }
    }
  }
  // ⑧ 童子煞：月令季节 + 年柱纳音五行 + 日/时支
  if (mBi >= 0 && gz[0]) {
    const mo = (mBi + 10) % 12;
    const season = (mo <= 2 || (mo >= 6 && mo <= 8)) ? 'springAutumn' : 'winterSummer';
    const ny = nayinOf(gz[0]);
    const el = ny ? ny.cn.charAt(ny.cn.length - 1) : '';
    for (let i = 0; i < 4; i++) {
      if (i !== 2 && i !== 3) continue;  // 只看日支、时支
      if (branches[i] >= 0) {
        const b = BRANCHES[branches[i]];
        const hitSeason = SS_TONGZI[season].indexOf(b) >= 0;
        const hitNayin = el && SS_TONGZI.nayin[el] && SS_TONGZI.nayin[el].indexOf(b) >= 0;
        if (hitSeason || hitNayin) {
          hits.push({ key: 'tongzi', cn: '童子煞', where: whereCn[i], anchor: (hitSeason ? season === 'springAutumn' ? '春秋月' : '冬夏月' : '') + (hitSeason && hitNayin ? '+' : '') + (hitNayin ? '年纳音属' + el : '') });
        }
      }
    }
  }
  // ⑨ 天罗地网：日柱纳音五行条件
  if (gz[2]) {
    const ny = nayinOf(gz[2]);
    const el = ny ? ny.cn.charAt(ny.cn.length - 1) : '';
    for (let i = 0; i < 4; i++) {
      if (branches[i] < 0) continue;
      const b = BRANCHES[branches[i]];
      if (SS_LUOWANG.tianLuo.elements.indexOf(el) >= 0 && SS_LUOWANG.tianLuo.branches.indexOf(b) >= 0) {
        hits.push({ key: 'luowang', cn: '天罗', where: whereCn[i], anchor: '日柱纳音属' + el });
      }
      if (SS_LUOWANG.diWang.elements.indexOf(el) >= 0 && SS_LUOWANG.diWang.branches.indexOf(b) >= 0) {
        hits.push({ key: 'luowang', cn: '地网', where: whereCn[i], anchor: '日柱纳音属' + el });
      }
    }
  }
  // ⑩ 官/财/印/食四星（主气口径）
  if (di >= 0) {
    const godStars = [['guanxing','官星','officer'],['caixing','财星','wealth'],['yinxing','印星','seal'],['shishenxing','食伤星','output']];
    for (let g = 0; g < godStars.length; g++) {
      const rows = shenshaTenGodBranches(di, godStars[g][2]);
      for (let i = 0; i < 4; i++) {
        for (let r = 0; r < rows.length; r++) {
          if (branches[i] === rows[r].branchIdx) {
            hits.push({ key: godStars[g][0], cn: godStars[g][1], where: whereCn[i], anchor: rows[r].hidden + '（' + rows[r].god + '）' });
          }
        }
      }
    }
  }
  return hits;
}
// ============ R32 结束 ============

// ============ R33 场景层组合约定（v0.11.1，页工厂层，无新引擎代码） ============
// 场景页（gen/scenarios.mjs）的信号全部取自本文件既有导出，组合规则在此声明：
// R33.1 官杀/财星/印星/食伤支 = shenshaTenGodBranches（支主气藏干 × 日主十神判定）；
//       比劫支 = BRANCH_HIDE_GAN 主气 tenGodOf(dayGan, 主气)。
// R33.2 禄/阳刃/阴刃/天乙贵人（两派）/国印/金舆/福星 = shenshaDayStemBranches（R32 表）。
// R33.3 天干五合与化气 = STEM_COMBINE/STEM_COMBINE_ELEMENT（码点排序对）；天干相冲 =
//       STEM_CLASH（戊己无冲，这是可展示的结构事实，不是缺数据）。
// R33.4 配偶星性别口径两派并列：男命以财星为妻、女命以官星为夫（传统口径）与
//       「两组都看」（现代口径）同时标注，不偷偷选一个。
// R33.5 场景页只输出落支与个数，不输出吉凶结论；整盘强弱归喜用神计算器（R19–R23）。
// ============ R33 结束 ============

// ============ R34 日主剖面组合约定（v0.11.2，页工厂层，无新引擎代码） ============
// 日主十型页（gen/dayMaster.mjs）的信号全部取自本文件既有导出，组合规则在此声明：
// R34.1 十二长生逐支 = twelveStage(dayGan, branch)（R5 起点表 + 阳顺阴逆）；
// R34.2 禄/阳刃/阴刃/天乙贵人（两派）/文昌 = shenshaDayStemBranches（R32 表），
//       build 期互证：禄=临官、刃=帝旺对十干全部成立才渲染；
// R34.3 本气十神 = BRANCH_HIDE_GAN 主气 tenGodOf(dayGan, 主气)；
// R34.4 五合化气/相冲 = STEM_COMBINE/STEM_COMBINE_ELEMENT/STEM_CLASH；
// R34.5 本干日柱 = JIAZI 中天干匹配的恰 6 柱（奇偶配对的结构结果）；
//       帝旺可达性（甲乙庚辛不可达）由 twelveStage 对本干 6 柱当场算出，不写死。
// ============ R34 结束 ============

// ============ R35 干支关系字表组合约定（v0.11.3，页工厂层，无新引擎代码） ============
// 关系 8 页（gen/relations.mjs）的表值全部取自本文件既有导出，组合与互证规则在此声明：
// R35.1 天干五合/相冲 = STEM_COMBINE/STEM_COMBINE_ELEMENT/STEM_CLASH（戊己无冲）；
// R35.2 地支六合/六冲/六害 = BRANCH_SIX_HE/BRANCH_CLASH/BRANCH_HARM，页面 build 期
//       断言：害 = 冲∘合（12/12）、冲 = +6（12/12）、六合化气土恰 2；
// R35.3 三合 = BRANCH_TRINE，build 断言：等距 {0,4,8} 且中神 ∈ 四正；半合/拱合由
//       三合组两两组合当场推导（12 = 4×C(3,2)，8 含中神 + 4 拱合）；
// R35.4 相刑 = PUNISH_GROUPS + SELF_PUNISH 手写真值表（历法库不携带刑表，
//       LunarUtil.ZHI_XING 是建除十二神）；
// R35.5 页面只列真值表与推导，不输出吉凶结论；取用轻重属完整排盘。
// ============ R35 结束 ============

export const KUA_DIRS = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];   // 北→东北→…→西北（顺时针）
export const KUA_DIR_META = {
  '坎': { dirCn: '正北', dirEn: 'North' },
  '艮': { dirCn: '东北', dirEn: 'Northeast' },
  '震': { dirCn: '正东', dirEn: 'East' },
  '巽': { dirCn: '东南', dirEn: 'Southeast' },
  '离': { dirCn: '正南', dirEn: 'South' },
  '坤': { dirCn: '西南', dirEn: 'Southwest' },
  '兑': { dirCn: '正西', dirEn: 'West' },
  '乾': { dirCn: '西北', dirEn: 'Northwest' },
};

export const KUA_GUA = {
  1: { gua: '坎', py: 'Kan',  elCn: '水', elEn: 'Water',  houseCn: '中男', houseEn: 'Middle Son', group: 'east' },
  2: { gua: '坤', py: 'Kun',  elCn: '土', elEn: 'Earth',  houseCn: '母亲', houseEn: 'Mother',     group: 'west' },
  3: { gua: '震', py: 'Zhen', elCn: '木', elEn: 'Wood',   houseCn: '长男', houseEn: 'Eldest Son', group: 'east' },
  4: { gua: '巽', py: 'Xun',  elCn: '木', elEn: 'Wood',   houseCn: '长女', houseEn: 'Eldest Daughter', group: 'east' },
  6: { gua: '乾', py: 'Qian', elCn: '金', elEn: 'Metal',  houseCn: '父亲', houseEn: 'Father',     group: 'west' },
  7: { gua: '兑', py: 'Dui',  elCn: '金', elEn: 'Metal',  houseCn: '少女', houseEn: 'Youngest Daughter', group: 'west' },
  8: { gua: '艮', py: 'Gen',  elCn: '土', elEn: 'Earth',  houseCn: '少男', houseEn: 'Youngest Son', group: 'west' },
  9: { gua: '离', py: 'Li',   elCn: '火', elEn: 'Fire',   houseCn: '中女', houseEn: 'Middle Daughter', group: 'east' },
};

export const KUA_STAR_META = {
  '生气': { en: 'Sheng Qi — Growing Qi',     starCn: '贪狼', starEn: 'Tan Lang',  elCn: '木', elEn: 'Wood',   luck: 1 },
  '延年': { en: 'Yan Nian — Longevity',      starCn: '武曲', starEn: 'Wu Qu',     elCn: '金', elEn: 'Metal',  luck: 1 },
  '天医': { en: 'Tian Yi — Heavenly Doctor', starCn: '巨门', starEn: 'Ju Men',    elCn: '土', elEn: 'Earth',  luck: 1 },
  '伏位': { en: 'Fu Wei — Self Seat',        starCn: '辅弼', starEn: 'Fu Bi',     elCn: '木', elEn: 'Wood',   luck: 1 },
  '祸害': { en: 'Huo Hai — Mishap',          starCn: '禄存', starEn: 'Lu Cun',    elCn: '土', elEn: 'Earth',  luck: -1 },
  '六煞': { en: 'Liu Sha — Six Killings',    starCn: '文曲', starEn: 'Wen Qu',    elCn: '水', elEn: 'Water',  luck: -1 },
  '五鬼': { en: 'Wu Gui — Five Ghosts',      starCn: '廉贞', starEn: 'Lian Zhen', elCn: '火', elEn: 'Fire',   luck: -1 },
  '绝命': { en: 'Jue Ming — Life Severed',   starCn: '破军', starEn: 'Po Jun',    elCn: '金', elEn: 'Metal',  luck: -1 },
};

// 大游年歌：每句 = [伏位宫, 顺时针七宫, 七星单字]。单字 → 全名（六=六煞、天=天医、
// 五=五鬼、祸=祸害、绝=绝命、延=延年、生=生气）。逐宫展开成 8×8 定表（含伏位自身）。
const KUA_STAR_OF_CHAR = {
  '生': '生气', '延': '延年', '天': '天医', '伏': '伏位',
  '祸': '祸害', '六': '六煞', '五': '五鬼', '绝': '绝命',
};
const KUA_SONG = [
  ['乾', '坎艮震巽离坤兑', '六天五祸绝延生'],
  ['坎', '艮震巽离坤兑乾', '五天生延绝祸六'],
  ['艮', '震巽离坤兑乾坎', '六绝祸生延天五'],
  ['震', '巽离坤兑乾坎艮', '延生祸绝五天六'],
  ['巽', '离坤兑乾坎艮震', '天五六祸生绝延'],
  ['离', '坤兑乾坎艮震巽', '六五绝延祸生天'],
  ['坤', '兑乾坎艮震巽离', '天延绝生祸五六'],
  ['兑', '乾坎艮震巽离坤', '生祸延绝六五天'],
];
export const KUA_MANSIONS = {};
for (const [house, dirs, stars] of KUA_SONG) {
  const row = { [house]: '伏位' };
  for (let i = 0; i < 7; i++) row[dirs[i]] = KUA_STAR_OF_CHAR[stars[i]];
  KUA_MANSIONS[house] = row;
}

// R36.1 风水年：立春前出生按上一年。与 zodiacIndexFromDateTime 同一时刻比较口径。
export function kuaFengShuiYear(year, month, day, hour = 12, minute = 0) {
  const lc = lichunOf(year);
  if (!lc) return null;
  const stamp = month * 1000000 + day * 10000 + hour * 100 + minute;
  const line = lc.month * 1000000 + lc.day * 10000 + lc.hour * 100 + lc.minute;
  return stamp < line ? year - 1 : year;
}

// R36.2 原始余数（0 已作 9，5 尚未寄宫）。内部函数；对外用 kuaNumberOf。
function kuaRaw(fsYear, gender) {
  const yy = fsYear % 100;
  const n = gender === 'male'
    ? (fsYear < 2000 ? 100 - yy : 99 - yy) % 9
    : (((yy - (fsYear < 2000 ? 4 : -6)) % 9) + 9) % 9;
  return n === 0 ? 9 : n;
}

// R36.2+R36.3 命卦数：余 0 作 9、余 5 男寄坤 2 / 女寄艮 8。
export function kuaNumberOf(fsYear, gender) {
  const n = kuaRaw(fsYear, gender);
  return n === 5 ? (gender === 'male' ? 2 : 8) : n;
}

// 该命卦数是否为「中宫寄卦」（原余 5）：页面据此标注「五寄坤/艮」的推导步骤。
export function kuaFiveHandled(fsYear, gender) {
  return kuaRaw(fsYear, gender) === 5;
}

// 命卦全档案：风水年 + 命卦数 + 卦 + 东西四命 + 八方位游年星（伏位在自身宫）。
export function kuaProfile(year, month, day, gender, hour = 12, minute = 0) {
  const fsYear = kuaFengShuiYear(year, month, day, hour, minute);
  if (!fsYear) return null;
  const kua = kuaNumberOf(fsYear, gender);
  const g = KUA_GUA[kua];
  const row = KUA_MANSIONS[g.gua];
  const guaPy = {};
  for (const k of Object.keys(KUA_GUA)) guaPy[KUA_GUA[k].gua] = KUA_GUA[k].py;
  const directions = KUA_DIRS.map((dg) => {
    const starCn = row[dg];
    const m = KUA_STAR_META[starCn];
    return {
      gua: dg, guaPy: guaPy[dg],
      dirCn: KUA_DIR_META[dg].dirCn, dirEn: KUA_DIR_META[dg].dirEn,
      starCn, starEn: m.en, starXingCn: m.starCn, starXingEn: m.starEn,
      elCn: m.elCn, elEn: m.elEn, luck: m.luck,
    };
  });
  return {
    fsYear, fsYearGanzhi: yearGanzhi(fsYear), kua,
    fiveHandled: kuaFiveHandled(fsYear, gender),
    gua: g.gua, guaPy: g.py, elCn: g.elCn, elEn: g.elEn,
    houseCn: g.houseCn, houseEn: g.houseEn,
    group: g.group, groupCn: g.group === 'east' ? '东四命' : '西四命',
    groupEn: g.group === 'east' ? 'East group' : 'West group',
    directions,
  };
}
// ============ R36 结束 ============

// ============ R37 每日干支（v0.13.0） ============
// 「今天是什么干支日」层：任意日期时刻 → 四柱 + 日柱档案 + 建除十二神 + 冲 + 空亡 + 时辰块。
// R37.1 建除十二神（十二值日）：表 DAILY_OFFICERS = 建除满平定执破危成收开闭。
//       规则：月建（月支）起「建」，顺数至日支 —— officerIndex = (日支−月支+12)%12。
//       与历法库 LunarUtil.ZHI_XING 逐日对账（2025-01-01..2026-09-20 共 628 天零失配，
//       test-web-engine 落实）。结构断言：①固定月支下 12 个日支恰好用满 12 官各一次
//       ②「建」⟺ 日支=月支 ③「破」⟺ 日支冲月支（index 6 ⟺ +6）——破日就是月支的冲日。
// R37.2 日界：本引擎日柱在真太阳时子时（23:00）切换（R11 同口径），23:30 已算次日；
//       「子夜换日」是另一派，页面并列展示。月界：月柱按节气（绝对时刻，R4b/R9），
//       不按农历初一、不按元旦——与年柱同一条公开分歧线。
// R37.3 dailyProfile 只组装既有层（computeBazi/dayPillarProfile 的表源/nayinOf/
//       kongWangOfDayGz/BRANCH_CLASH/zhiBlockOf），零新真相源；页面据此给推导链。
// R37.4 查询口径：无地点输入时按北京时间 civil time 处理（与排盘页缺省一致），
//       页面声明；给地点后日柱应用真太阳时——那是排盘页的职责，本页不复制。

export const DAILY_OFFICERS = [
  { cn: '建', en: 'Jian — Establish' },
  { cn: '除', en: 'Chu — Remove' },
  { cn: '满', en: 'Man — Full' },
  { cn: '平', en: 'Ping — Level' },
  { cn: '定', en: 'Ding — Stable' },
  { cn: '执', en: 'Zhi — Hold' },
  { cn: '破', en: 'Po — Break' },
  { cn: '危', en: 'Wei — Peril' },
  { cn: '成', en: 'Cheng — Complete' },
  { cn: '收', en: 'Shou — Receive' },
  { cn: '开', en: 'Kai — Open' },
  { cn: '闭', en: 'Bi — Close' },
];

export function dailyOfficerIndex(monthBranch, dayBranch) {
  const m = BRANCHES.indexOf(monthBranch);
  const d = BRANCHES.indexOf(dayBranch);
  if (m < 0 || d < 0) return -1;
  return (d - m + 12) % 12;
}

export function dailyOfficer(monthBranch, dayBranch) {
  const i = dailyOfficerIndex(monthBranch, dayBranch);
  if (i < 0) return null;
  return { index: i, cn: DAILY_OFFICERS[i].cn, en: DAILY_OFFICERS[i].en };
}

export function dailyProfile(year, month, day, hour = 12, minute = 0) {
  const r = computeBazi({ year, month, day, hour, minute });
  if (!r || !r.pillars) return null;
  const p = r.pillars;
  const dayGz = p.day.ganzhi;
  const monthGz = p.month.ganzhi;
  const monthBranch = monthGz.charAt(1);
  const dayBranch = dayGz.charAt(1);
  const officer = dailyOfficer(monthBranch, dayBranch);
  const dbi = BRANCHES.indexOf(dayBranch);
  const mbi = BRANCHES.indexOf(monthBranch);
  const clashBranch = BRANCH_CLASH[dayBranch];
  const cbi = BRANCHES.indexOf(clashBranch);
  const kw = kongWangOfDayGz(dayGz);
  const ny = nayinOf(dayGz);
  const blk = zhiBlockOf(hour);
  return {
    pillars: { year: p.year.ganzhi, month: monthGz, day: dayGz, hour: p.time.ganzhi },
    dayGz, monthGz, monthBranch, dayBranch,
    officer,
    isPoDay: officer.index === 6,
    poIsMonthClash: officer.index === 6 && dbi === (mbi + 6) % 12,
    clashBranch, clashAnimalCn: BRANCH_ANIMAL[cbi], clashAnimalEn: BRANCH_ANIMAL_EN[cbi],
    voids: kw.voids, xunStart: kw.xunStart,
    naYinCn: ny.cn, naYinEn: ny.en,
    hourZhi: blk.zhi, hourZhiEn: blk.zhiEn, hourLabel: blk.label,
    hourRange: branchHourRange(zhiBlockIndex(hour)).text,
  };
}
// ============ R37 结束 ============

// ============ R38 嫁娶择日（v0.14.0）============
// 「哪一天适合结婚」层：输入新人双方生日 + 日期范围 → 逐日算建除/天神/二十八宿/红鸾天喜/冲合孤寡，
// 给出硬性排除清单 + 可核对加权评分 + 两套黄黑道的分歧标注。全部事实由引擎实算，页面只排版。
// R38.1 二十八宿值日：一宿值一日、连续 28 日一轮 → xiuIndex = (JDN + 11) % 28，
//       JDN = floor(Date.UTC(y,m-1,d,12)/86400000) + 2440588（该日 UTC 正午的儒略日数）。
//       锚点：2024-01-01 = 毕(18)、2026-09-20 = 房(3)。与外库 Lunar.getXiu() 逐日对账
//       （2024-01-01 起 900 天零失配，test-web-engine 落实）。
//       结构事实（可推导，不手写）：七曜 = ['木','金','土','日','月','火','水'][i%7]；
//       四兽 = floor(i/7)（角亢氐房心尾箕=东方苍龙 … 井鬼柳星张翼轸=南方朱雀）。
// R38.2 十二天神（黄黑道·口诀法）：起点口诀「寅申起子、卯酉起寅、辰戌起辰、巳亥起午、
//       子午起申、丑未起戌」，等价闭式 ti = (日支 + 4 − 2×月支) mod 12。
//       与外库 Lunar.getDayTianShen() 逐日对账（900 天零失配）。
//       黄道 = 青龙/明堂/金匮/天德/玉堂/司命（index 0,1,4,5,7,10，6 黄 6 黑）。
// R38.3 两套「黄黑道」并存且公开分歧：①建除法（歌诀「建满平收黑，除危定执黄，成开皆可用，
//       破闭不相当」）黄道 = 除危定执成开；②天神法（R38.2）。两法在 144 个（月支×日支）组合里
//       恰好只有 72 个结论相同（50.0%，实测）——它们是两套独立系统，本站并列展示并给出差值，
//       不替读者选一种。页面把「本日两法是否一致」作为独立字段展示。
// R38.4 嫁娶吉凶定表（十二建除 / 二十八宿）为「多源共识 + 分歧标记」：每源各有一套宜忌表，
//       没有任何一源是权威。本站取 4 组公开源（bazipai / tthuangli / 易有料 / fengshui.hk /
//       howzan / guoyitang）多数口径，并把源间冲突的日子标 mixed（权重 0，页面注明「源分歧」）。
//       建除：preferred=定/成/开，avoid=建/满/平/破/闭，mixed=除/执/危/收。
//       二十八宿：yes 10 宿（角房尾室壁娄胃毕张轸）/ no 13 宿 / mixed 5 宿（亢斗箕井星）。
// R38.5 硬性排除（任一命中即出局，页面逐条给出触发原因）：月破（日支=月支之冲）、
//       岁破（日支冲流年支）、冲新人本命日支、冲新人本命年支、建除闭日。
// R38.6 评分 = 60 + Σ吉 − Σ凶，clamp [0,100]；权重表公开在页面与 methodology。
//       **这是本站自定权重的可核对加总，不是传统定论**——每条信号的读数与加减都在页面上列出，
//       读者可以不同意权重而自行看信号明细（与合盘页拒绝 match score 的立场一致：
//       我们拒绝的是「不可核对的数字」，不是数字本身）。
// R38.7 已知边界（页面「已知边界」段公开）：①四离四绝（二分二至/四立前一日）**未纳入**——
//       需要 24 节气时刻表，浏览器端无天文算法；本站只有立春定表（R30）。
//       ②「嫁娶周堂图」「男女合婚嫁娶大利月」等流派未纳入。③本层不输出吉凶断言之外的预测。
// R38.8 本命锚点只用年支与日支：出生时刻不影响本页任何规则（只取生肖年支与本命日支），
//       缺省按 12:00 取日柱；晚子时（23:00+）换日仍按 R11 口径。

export var XIU_CN = ['角','亢','氐','房','心','尾','箕','斗','牛','女','虚','危','室','壁','奎','娄','胃','昴','毕','觜','参','井','鬼','柳','星','张','翼','轸'];
export var XIU_EN = ['Jiao - Horn','Kang - Neck','Di - Root','Fang - Room','Xin - Heart','Wei - Tail','Ji - Winnowing Basket','Dou - Dipper','Niu - Ox','Nu - Girl','Xu - Emptiness','Wei - Rooftop','Shi - Encampment','Bi - Wall','Kui - Legs','Lou - Bond','Wei - Stomach','Mao - Hairy Head','Bi - Net','Zi - Turtle Beak','Shen - Three Stars','Jing - Well','Gui - Ghost','Liu - Willow','Xing - Star','Zhang - Extended Net','Yi - Wings','Zhen - Chariot'];
export var XIU_SEVEN_CN = ['木','金','土','日','月','火','水'];
export var XIU_SEVEN_EN = ['Wood','Metal','Earth','Sun','Moon','Fire','Water'];
export var XIU_MANSION_CN = ['东方苍龙','北方玄武','西方白虎','南方朱雀'];
export var XIU_MANSION_EN = ['Azure Dragon of the East','Black Tortoise of the North','White Tiger of the West','Vermilion Bird of the South'];
// 吉凶：多源多数口径（吉 / 平 / 凶）。源间分歧见 XIU_MARRY 的 mixed 标记。
export var XIU_LUCK = ['吉','凶','凶','吉','凶','吉','吉','吉','凶','凶','凶','凶','吉','吉','平','吉','平','平','吉','凶','平','平','凶','凶','平','吉','平','吉'];
export var XIU_LUCK_EN = { '吉':'Auspicious', '平':'Mixed', '凶':'Inauspicious' };
// 嫁娶：yes 10 宿 / no 13 宿 / mixed 5 宿（亢斗箕井星——源间冲突或未明指嫁娶）
export var XIU_MARRY = ['yes','mixed','no','yes','no','yes','mixed','mixed','no','no','no','no','yes','yes','no','yes','yes','no','yes','no','no','mixed','no','no','mixed','yes','no','yes'];
export var XIU_MARRY_DIVERGE = {
  '亢':'Sources disagree: some list it as favourable for marriage, others call it inauspicious; the two readings are both published.',
  '箕':'Most sources rate the mansion auspicious but do not name marriage among its uses.',
  '斗':'Most sources rate the mansion auspicious but do not name marriage among its uses.',
  '井':'Sources disagree: some list marriage as taboo, others treat the mansion as auspicious.',
  '星':'Sources disagree: some list it as favourable for marriage, others as inauspicious.'
};
export var XIU_MARRY_DIVERGE_CN = {
  '亢':'源间冲突：部分源列为宜嫁娶，部分源列为凶、忌嫁娶。',
  '箕':'多数源列为吉宿，但宜忌表中未明指嫁娶。',
  '斗':'多数源列为吉宿，但宜忌表中未明指嫁娶。',
  '井':'源间冲突：部分源列为忌嫁娶，部分源列为吉。',
  '星':'源间冲突：部分源列为宜嫁娶，部分源列为凶。'
};

// 十二天神（黄黑道·口诀法）。顺序固定：青龙、明堂、天刑、朱雀、金匮、天德、白虎、玉堂、天牢、玄武、司命、勾陈。
export var TIAN_SHEN_CN = ['青龙','明堂','天刑','朱雀','金匮','天德','白虎','玉堂','天牢','玄武','司命','勾陈'];
export var TIAN_SHEN_EN = ['Qing Long - Azure Dragon','Ming Tang - Bright Hall','Tian Xing - Heavenly Punishment','Zhu Que - Vermilion Bird','Jin Kui - Golden Coffer','Tian De - Heavenly Virtue','Bai Hu - White Tiger','Yu Tang - Jade Hall','Tian Lao - Heavenly Prison','Xuan Wu - Dark Warrior','Si Ming - Life Controller','Gou Chen - Curled Earth'];
export var TIAN_SHEN_GOOD = [true,true,false,false,true,true,false,true,false,false,true,false];
export var TIAN_SHEN_START_CN = '寅申起子、卯酉起寅、辰戌起辰、巳亥起午、子午起申、丑未起戌';

// 建除法黄道（歌诀「建满平收黑，除危定执黄，成开皆可用，破闭不相当」）
export var JIANCHU_HUANG = [false,true,false,false,true,true,false,true,true,false,true,false];

// 建除十二神 × 嫁娶：grade = preferred / avoid / mixed；weight 为评分增量。
export var OFFICER_MARRY = [
  { grade:'avoid',     weight:-18, noteCn:'建为月建本气、主事多波折，多源列婚嫁忌用。', noteEn:'Jian is the month-establishing day; most sources advise against weddings.' },
  { grade:'mixed',     weight:6,   noteCn:'除主除旧迎新，源间分歧：一派列宜嫁娶、一派列忌嫁娶。', noteEn:'Chu removes the old; sources split between favourable and taboo for marriage.' },
  { grade:'avoid',     weight:-18, noteCn:'满则易溢、怕满极生变，多源不取婚嫁。', noteEn:'Man means fullness and overflow; most sources avoid it for weddings.' },
  { grade:'avoid',     weight:-18, noteCn:'平主平平无功，多源列婚嫁不用。', noteEn:'Ping is level and uneventful; most sources exclude it for weddings.' },
  { grade:'preferred', weight:14,  noteCn:'定主安定、定盟定终身，为嫁娶首选之一。', noteEn:'Ding means settled and sworn; a first-choice officer for weddings.' },
  { grade:'mixed',     weight:6,   noteCn:'执主执守，多源列结婚嫁娶；少数源因主收敛而不用。', noteEn:'Zhi means holding fast; most sources allow weddings, some avoid it as a closing day.' },
  { grade:'avoid',     weight:-18, noteCn:'破日即月破，嫁娶大忌（本层已作硬性排除）。', noteEn:'Po breaks the month; traditionally a major taboo (already excluded here).' },
  { grade:'mixed',     weight:6,   noteCn:'危属黄道，多源列宜结婚纳彩；少数源因名带危而劝避。', noteEn:'Wei is a yellow-path day; most sources allow betrothal and marriage, some avoid it by name.' },
  { grade:'preferred', weight:14,  noteCn:'成主成就圆满，嫁娶首选之一。', noteEn:'Cheng means completion; a first-choice officer for weddings.' },
  { grade:'mixed',     weight:-4,  noteCn:'收属黑道，但歌诀作「收嫁娶」、亦有源列宜嫁娶 —— 两读并列。', noteEn:'Shou is a black-path day, yet the classic verse assigns marriage to it; both readings shown.' },
  { grade:'preferred', weight:14,  noteCn:'开主开启新阶段，嫁娶首选之一。', noteEn:'Kai opens a new stage; a first-choice officer for weddings.' },
  { grade:'avoid',     weight:-18, noteCn:'闭日阴阳闭塞、宜收不宜开，嫁娶大忌（本层已作硬性排除）。', noteEn:'Bi closes; unsuitable for starting anything, a major taboo (already excluded here).' }
];

// 评分权重表（页面公开）。base 与各项权重都是本站自定，可逐项核对。
export var WEDDING_WEIGHTS = {
  base: 60,
  tierTop: 85, tierGood: 70, tierFair: 55,
  officerPreferred: 14, officerAvoid: -18, officerMixedGood: 6, officerMixedBad: -4,
  tianShen: 8, jianChuHuang: 5,
  xiuYes: 12, xiuNo: -14, xiuMixed: 0,
  hongLuan: 9, tianXi: 9, tianShe: 7,
  heDayBranch: 9, trineDayBranch: 6,
  heYearBranch: 5, trineYearBranch: 3,
  harmBranch: -5, punishBranch: -6,
  guChenGroom: -11, guaSuBride: -11, guChenBride: -4, guaSuGroom: -4
};

export function r38Weekday(y, m, d) {
  var w = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();   // 0=周日
  return { index: w, cn: ['日','一','二','三','四','五','六'][w], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][w] };
}

export function jdnOfDate(y, m, d) {
  return Math.floor(Date.UTC(y, m - 1, d, 12) / 86400000) + 2440588;
}

// R38.1 二十八宿值日
export function xiuOfDate(y, m, d) {
  var i = ((jdnOfDate(y, m, d) + 11) % 28 + 28) % 28;
  var seven = i % 7, mansion = Math.floor(i / 7);
  return {
    index: i, cn: XIU_CN[i], en: XIU_EN[i],
    sevenCn: XIU_SEVEN_CN[seven], sevenEn: XIU_SEVEN_EN[seven],
    mansionCn: XIU_MANSION_CN[mansion], mansionEn: XIU_MANSION_EN[mansion],
    luckCn: XIU_LUCK[i], luckEn: XIU_LUCK_EN[XIU_LUCK[i]],
    marriage: XIU_MARRY[i],
    divergeCn: XIU_MARRY_DIVERGE_CN[XIU_CN[i]] || '',
    divergeEn: XIU_MARRY_DIVERGE[XIU_CN[i]] || '',
    jdn: jdnOfDate(y, m, d)
  };
}

// R38.2 十二天神（口诀法）
export function dayTianShenIndex(monthBi, dayBi) {
  if (monthBi < 0 || dayBi < 0) return -1;
  return ((dayBi + 4 - 2 * monthBi) % 12 + 12) % 12;
}

export function dayTianShen(monthBranch, dayBranch) {
  var i = dayTianShenIndex(BRANCHES.indexOf(monthBranch), BRANCHES.indexOf(dayBranch));
  if (i < 0) return null;
  return {
    index: i, cn: TIAN_SHEN_CN[i], en: TIAN_SHEN_EN[i],
    good: TIAN_SHEN_GOOD[i], typeCn: TIAN_SHEN_GOOD[i] ? '黄道' : '黑道',
    typeEn: TIAN_SHEN_GOOD[i] ? 'Yellow path' : 'Black path',
    startCn: TIAN_SHEN_START_CN
  };
}

export function jianChuHuangDao(officerIndex) {
  if (officerIndex < 0 || officerIndex > 11) return null;
  return JIANCHU_HUANG[officerIndex];
}

export function branchTrineOf(a, b) {
  for (var i = 0; i < BRANCH_TRINE.length; i++) {
    var g = BRANCH_TRINE[i].branches;
    if (g.indexOf(a) >= 0 && g.indexOf(b) >= 0) return BRANCH_TRINE[i];
  }
  return null;
}

export function punishBetween(a, b) {
  if (a === b && SELF_PUNISH.indexOf(a) >= 0) return true;
  for (var i = 0; i < PUNISH_GROUPS.length; i++) {
    var g = PUNISH_GROUPS[i].branches;
    if (g.indexOf(a) >= 0 && g.indexOf(b) >= 0) return true;
  }
  return false;
}

// 本命锚点：只取年支（生肖）与日支（本命），出生时刻不影响本层任何规则
export function weddingAnchors(birth, gender) {
  var r = computeBazi(birth);
  if (!r || !r.pillars) return null;
  var yearBranch = r.pillars.year.ganzhi.charAt(1);
  var dayBranch = r.pillars.day.ganzhi.charAt(1);
  return {
    gender: gender === 'F' ? 'F' : 'M',
    yearPillar: r.pillars.year.ganzhi, dayPillar: r.pillars.day.ganzhi,
    yearBranch: yearBranch, dayBranch: dayBranch,
    yearBi: BRANCHES.indexOf(yearBranch), dayBi: BRANCHES.indexOf(dayBranch),
    animalCn: BRANCH_ANIMAL[BRANCHES.indexOf(yearBranch)], animalEn: BRANCH_ANIMAL_EN[BRANCHES.indexOf(yearBranch)],
    guChenCn: SS_GUCHEN[BRANCHES.indexOf(yearBranch)], guaSuCn: SS_GUASU[BRANCHES.indexOf(yearBranch)]
  };
}

// 单日档案：couple = { groom:{yearBi,dayBi,...}, bride:{...} }（weddingAnchors 的产物）
export function weddingDayProfile(y, m, d, couple) {
  var dp = dailyProfile(y, m, d, 12, 0);
  if (!dp) return null;
  var W = WEDDING_WEIGHTS;
  var yearBranch = dp.pillars.year.charAt(1);
  var yBi = BRANCHES.indexOf(yearBranch);
  var mBi = BRANCHES.indexOf(dp.monthBranch);
  var dBi = BRANCHES.indexOf(dp.dayBranch);
  var dayBranch = dp.dayBranch, dayGz = dp.dayGz;
  var ts = dayTianShen(dp.monthBranch, dayBranch);
  var jcHuang = jianChuHuangDao(dp.officer.index);
  var xiu = xiuOfDate(y, m, d);
  var groom = couple.groom, bride = couple.bride;
  var om = OFFICER_MARRY[dp.officer.index];
  var rejects = [], signals = [], delta = 0, i;

  function push(key, cn, en, w, detailCn, detailEn) {
    delta += w;
    signals.push({ key: key, cn: cn, en: en, weight: w, detailCn: detailCn, detailEn: detailEn });
  }
  function reject(key, cn, en, detailCn, detailEn) {
    rejects.push({ key: key, cn: cn, en: en, detailCn: detailCn, detailEn: detailEn });
  }
  function personCn(role) { return role === 'groom' ? '新郎' : '新娘'; }
  function personEn(role) { return role === 'groom' ? 'the groom' : 'the bride'; }

  // ---- 硬性排除 ----
  if (dp.officer.index === 6) {
    reject('month-po', '月破', 'Month breaker',
      '日支 ' + dayBranch + ' 冲月支 ' + dp.monthBranch + '，建除落「破」——月破日嫁娶大忌。',
      'Day branch ' + dayBranch + ' clashes the month branch ' + dp.monthBranch + ' - the officer is Po (breaker).');
  }
  if (dBi === (yBi + 6) % 12) {
    reject('year-po', '岁破', 'Year breaker',
      '日支 ' + dayBranch + ' 冲流年支 ' + yearBranch + '（太岁），岁破日嫁娶大忌。',
      'Day branch ' + dayBranch + ' clashes the year branch ' + yearBranch + ' (Tai Sui) - a year-breaker day.');
  }
  if (dp.officer.index === 11) {
    reject('close-day', '闭日', 'Closing day',
      '建除落「闭」，主闭塞宜收不宜开，传统列嫁娶忌用。',
      'The officer is Bi (closed). Traditionally taboo for weddings, which start something new.');
  }
  var roles = ['groom', 'bride'];
  for (i = 0; i < roles.length; i++) {
    var rl = roles[i], p2 = couple[rl];
    if (!p2) continue;
    if (dBi === (p2.dayBi + 6) % 12) {
      reject('clash-' + rl + '-day', '冲' + personCn(rl) + '本命日支', 'Clashes ' + personEn(rl) + "'s day branch",
        '日支 ' + dayBranch + ' 冲' + personCn(rl) + '本命日支 ' + p2.dayBranch + '——传统择日忌冲新人本命。',
        'Day branch ' + dayBranch + ' clashes ' + personEn(rl) + "'s natal day branch " + p2.dayBranch + '.');
    }
    if (dBi === (p2.yearBi + 6) % 12) {
      reject('clash-' + rl + '-year', '冲' + personCn(rl) + '本命年支', 'Clashes ' + personEn(rl) + "'s year branch",
        '日支 ' + dayBranch + ' 冲' + personCn(rl) + '生肖年支 ' + p2.yearBranch + '（' + p2.animalCn + '）。',
        'Day branch ' + dayBranch + ' clashes ' + personEn(rl) + "'s year branch " + p2.yearBranch + ' (' + p2.animalEn + ').');
    }
  }

  // ---- 加权信号 ----
  push('officer', '建除：' + dp.officer.cn + '日', 'Officer: ' + dp.officer.en, om.weight,
    '十二建除值神「' + dp.officer.cn + '」→ 嫁娶' + (om.grade === 'preferred' ? '首选' : om.grade === 'avoid' ? '多源忌用' : '源间分歧') + '。' + om.noteCn,
    'Twelve officers: ' + dp.officer.en + ' -> ' + (om.grade === 'preferred' ? 'first choice' : om.grade === 'avoid' ? 'widely avoided' : 'sources split') + '. ' + om.noteEn);
  push('tianshen', '十二天神：' + ts.cn + '（' + ts.typeCn + '）', 'Day spirit: ' + ts.en + ' (' + ts.typeEn + ')',
    ts.good ? W.tianShen : -W.tianShen,
    '口诀「' + TIAN_SHEN_START_CN + '」，本月（' + dp.monthBranch + '月）起子推得本日天神为 ' + ts.cn + '，属' + ts.typeCn + '。',
    'Rule: the spirit sequence starts from the month branch; this day lands on ' + ts.en + ', a ' + ts.typeEn + ' day.');
  push('jianchu-huang', '建除黄黑道：' + (jcHuang ? '黄道日' : '黑道日'), 'Officer colour: ' + (jcHuang ? 'yellow path' : 'black path'),
    jcHuang ? W.jianChuHuang : -W.jianChuHuang,
    '歌诀「建满平收黑，除危定执黄，成开皆可用，破闭不相当」——本日为「' + dp.officer.cn + '」。与上一条天神法' + (jcHuang === ts.good ? '结论一致' : '结论相反') + '。',
    'Classic verse: Jian, Man, Ping, Shou are black; Chu, Wei, Ding, Zhi are yellow; Cheng and Kai usable; Bi and Po stand alone. This day is ' + dp.officer.en + ' - here the two colour systems ' + (jcHuang === ts.good ? 'agree' : 'disagree') + '.');
  push('xiu', '二十八宿：' + xiu.cn + '宿（' + xiu.sevenCn + '）', 'Mansion: ' + xiu.en + ' (' + xiu.sevenEn + ')',
    xiu.marriage === 'yes' ? W.xiuYes : xiu.marriage === 'no' ? W.xiuNo : W.xiuMixed,
    '值日星宿 ' + xiu.cn + '（' + xiu.mansionCn + '）吉凶为「' + xiu.luckCn + '」，嫁娶口径 ' + (xiu.marriage === 'yes' ? '宜' : xiu.marriage === 'no' ? '忌' : '源分歧') + '。' + (xiu.divergeCn || ''),
    'Daily mansion ' + xiu.en + ' (' + xiu.mansionEn + ') is rated ' + xiu.luckEn + '; marriage is ' + (xiu.marriage === 'yes' ? 'favourable' : xiu.marriage === 'no' ? 'taboo' : 'disputed') + '. ' + (xiu.divergeEn || ''));

  var hlBi = shenshaHongLuan(yBi), txBi = shenshaTianXi(yBi);
  if (dBi === hlBi) {
    push('hongluan', '红鸾日', 'Red Phoenix day', W.hongLuan,
      '流年支 ' + yearBranch + ' 起红鸾在 ' + BRANCHES[hlBi] + '，本日日支正是 ' + BRANCHES[hlBi] + '——红鸾主婚姻喜事。',
      'For year branch ' + yearBranch + ' the Red Phoenix falls on ' + BRANCHES[hlBi] + '; this day matches it.');
  }
  if (dBi === txBi) {
    push('tianxi', '天喜日', 'Heavenly Joy day', W.tianXi,
      '天喜与红鸾对冲：' + BRANCHES[hlBi] + ' 之冲为 ' + BRANCHES[txBi] + '，本日日支命中。',
      'Heavenly Joy is opposite the Red Phoenix (' + BRANCHES[txBi] + '); this day matches it.');
  }
  var tianSh = shenshaTianShOfDayBranch(mBi);
  if (tianSh && dayGz === tianSh) {
    push('tianshe', '天赦日', 'Heavenly Pardon day', W.tianShe,
      dp.monthBranch + '月属' + (mBi >= 2 && mBi <= 4 ? '春' : mBi >= 5 && mBi <= 7 ? '夏' : mBi >= 8 && mBi <= 10 ? '秋' : '冬') + '，天赦为「' + tianSh + '」，本日干支正合。',
      'For this season the Heavenly Pardon pillar is ' + tianSh + '; this day matches it.');
  }

  var rels = [];
  for (i = 0; i < roles.length; i++) {
    var rl2 = roles[i], p3 = couple[rl2];
    if (!p3) continue;
    if (BRANCH_SIX_HE[dayBranch] === p3.dayBranch) {
      rels.push({ cn: '与' + personCn(rl2) + '本命日支六合', en: 'Six Harmony with ' + personEn(rl2) + "'s day branch" });
      push('he-' + rl2 + '-day', '六合：' + personCn(rl2) + '本命日支', 'Six Harmony with ' + personEn(rl2) + "'s day branch", W.heDayBranch,
        '日支 ' + dayBranch + ' 与' + personCn(rl2) + '本命日支 ' + p3.dayBranch + ' 六合。',
        'Day branch ' + dayBranch + ' forms a Six Harmony with ' + personEn(rl2) + "'s day branch " + p3.dayBranch + '.');
    } else if (branchTrineOf(dayBranch, p3.dayBranch)) {
      var tr = branchTrineOf(dayBranch, p3.dayBranch);
      rels.push({ cn: '与' + personCn(rl2) + '本命日支三合（' + tr.element + '局）', en: 'Three Harmony with ' + personEn(rl2) + "'s day branch" });
      push('trine-' + rl2 + '-day', '三合：' + personCn(rl2) + '本命日支', 'Three Harmony with ' + personEn(rl2) + "'s day branch", W.trineDayBranch,
        '日支 ' + dayBranch + ' 与' + personCn(rl2) + '本命日支 ' + p3.dayBranch + ' 同属' + tr.branches.join('') + tr.element + '三合局。',
        'Day branch ' + dayBranch + ' and ' + personEn(rl2) + "'s day branch " + p3.dayBranch + ' sit in the same ' + tr.elementEn + ' trine.');
    }
    if (BRANCH_SIX_HE[dayBranch] === p3.yearBranch) {
      rels.push({ cn: '与' + personCn(rl2) + '生肖六合', en: 'Six Harmony with ' + personEn(rl2) + "'s year branch" });
      push('he-' + rl2 + '-year', '六合：' + personCn(rl2) + '生肖', 'Six Harmony with ' + personEn(rl2) + "'s year branch", W.heYearBranch,
        '日支 ' + dayBranch + ' 与' + personCn(rl2) + '生肖年支 ' + p3.yearBranch + ' 六合（太岁相合）。',
        'Day branch ' + dayBranch + ' forms a Six Harmony with ' + personEn(rl2) + "'s year branch " + p3.yearBranch + '.');
    } else if (branchTrineOf(dayBranch, p3.yearBranch)) {
      var tr2 = branchTrineOf(dayBranch, p3.yearBranch);
      rels.push({ cn: '与' + personCn(rl2) + '生肖三合（' + tr2.element + '局）', en: 'Three Harmony with ' + personEn(rl2) + "'s year branch" });
      push('trine-' + rl2 + '-year', '三合：' + personCn(rl2) + '生肖', 'Three Harmony with ' + personEn(rl2) + "'s year branch", W.trineYearBranch,
        '日支 ' + dayBranch + ' 与' + personCn(rl2) + '生肖年支 ' + p3.yearBranch + ' 同属' + tr2.branches.join('') + tr2.element + '三合局。',
        'Day branch ' + dayBranch + ' and ' + personEn(rl2) + "'s year branch " + p3.yearBranch + ' sit in the same ' + tr2.elementEn + ' trine.');
    }
    if (BRANCH_HARM[dayBranch] === p3.dayBranch) {
      push('harm-' + rl2, '相害：' + personCn(rl2) + '本命日支', 'Harm with ' + personEn(rl2) + "'s day branch", W.harmBranch,
        '日支 ' + dayBranch + ' 与' + personCn(rl2) + '本命日支 ' + p3.dayBranch + ' 相害。',
        'Day branch ' + dayBranch + ' forms a Harm relation with ' + personEn(rl2) + "'s day branch.");
    }
    if (punishBetween(dayBranch, p3.dayBranch)) {
      push('punish-' + rl2, '相刑：' + personCn(rl2) + '本命日支', 'Punishment with ' + personEn(rl2) + "'s day branch", W.punishBranch,
        '日支 ' + dayBranch + ' 与' + personCn(rl2) + '本命日支 ' + p3.dayBranch + ' 相刑' + (dayBranch === p3.dayBranch ? '（自刑）' : '') + '。',
        'Day branch ' + dayBranch + ' and ' + personEn(rl2) + "'s day branch form a Punishment relation.");
    }
  }
  // 孤辰/寡宿（男怕孤辰、女怕寡宿为主口径；反向组合并列展示、权重较低）
  var gu = [
    { role: 'groom', star: '孤辰', starEn: 'Lone Star', bi: BRANCHES.indexOf(groom.guChenCn), w: W.guChenGroom, key: 'guchen-groom' },
    { role: 'bride', star: '寡宿', starEn: 'Widow Star', bi: BRANCHES.indexOf(bride.guaSuCn), w: W.guaSuBride, key: 'guasu-bride' },
    { role: 'bride', star: '孤辰', starEn: 'Lone Star', bi: BRANCHES.indexOf(bride.guChenCn), w: W.guChenBride, key: 'guchen-bride' },
    { role: 'groom', star: '寡宿', starEn: 'Widow Star', bi: BRANCHES.indexOf(groom.guaSuCn), w: W.guaSuGroom, key: 'guasu-groom' }
  ];
  for (i = 0; i < gu.length; i++) {
    if (dBi === gu[i].bi) {
      var person = couple[gu[i].role];
      push(gu[i].key, gu[i].star + '日（' + personCn(gu[i].role) + '）', gu[i].starEn + ' day (' + personEn(gu[i].role) + ')', gu[i].w,
        personCn(gu[i].role) + '生肖年支 ' + person.yearBranch + ' 之' + gu[i].star + '在 ' + BRANCHES[gu[i].bi] + '，本日日支命中。',
        personEn(gu[i].role) + "'s year branch " + person.yearBranch + ' places the ' + gu[i].starEn + ' on ' + BRANCHES[gu[i].bi] + '; this day matches it.');
    }
  }

  var score = W.base + delta;
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  var tier = score >= W.tierTop ? 'top' : score >= W.tierGood ? 'good' : score >= W.tierFair ? 'fair' : 'poor';
  var tierCn = { top: '优选', good: '吉', fair: '平', poor: '忌' }[tier];
  var tierEn = { top: 'Top pick', good: 'Favourable', fair: 'Neutral', poor: 'Avoid' }[tier];
  var clashBi = BRANCHES.indexOf(dp.clashBranch);

  return {
    y: y, m: m, d: d,
    dateCn: y + '年' + m + '月' + d + '日', dateEn: y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d),
    weekday: r38Weekday(y, m, d),
    yearGz: dp.pillars.year, monthGz: dp.monthGz, dayGz: dayGz, monthBranch: dp.monthBranch, yearBranch: yearBranch, dayBranch: dayBranch,
    officer: { index: dp.officer.index, cn: dp.officer.cn, en: dp.officer.en, grade: om.grade, noteCn: om.noteCn, noteEn: om.noteEn },
    tianShen: ts, jianChuHuangDao: jcHuang, huangDaoAgree: (jcHuang === ts.good),
    xiu: xiu,
    clashBranch: dp.clashBranch, clashAnimalCn: dp.clashAnimalCn, clashAnimalEn: dp.clashAnimalEn,
    naYinCn: dp.naYinCn, naYinEn: dp.naYinEn,
    relations: rels,
    score: score, tier: tier, tierCn: tierCn, tierEn: tierEn,
    signals: signals, rejects: rejects,
    passes: rejects.length === 0
  };
}

// 范围扫描：opts = { groom:{y,m,d,hour,minute}, bride:{...}, from:{y,m,d}, to:{y,m,d}, weekendOnly }
export function weddingScan(opts) {
  var o = opts || {};
  var groom = weddingAnchors(o.groom, 'M');
  var bride = weddingAnchors(o.bride, 'F');
  if (!groom || !bride) return null;
  var couple = { groom: groom, bride: bride };
  var from = o.from, to = o.to;
  var startJ = jdnOfDate(from.y, from.m, from.d), endJ = jdnOfDate(to.y, to.m, to.d);
  if (endJ < startJ) { var t = startJ; startJ = endJ; endJ = t; }
  if (endJ - startJ > 800) endJ = startJ + 800;       // 上限：一次扫描不超过 800 天
  var days = [], rejected = [], byReason = {}, weekendSkipped = 0, huangAgree = 0, total = 0;
  for (var j = startJ; j <= endJ; j++) {
    var dt = new Date((j - 2440588) * 86400000);
    var y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    total++;
    var p = weddingDayProfile(y, m, d, couple);
    if (!p) continue;
    if (p.huangDaoAgree) huangAgree++;
    if (o.weekendOnly && p.weekday.index !== 0 && p.weekday.index !== 6) { weekendSkipped++; continue; }
    if (!p.passes) {
      rejected.push({ dateEn: p.dateEn, dateCn: p.dateCn, weekdayEn: p.weekday.en, rejects: p.rejects });
      for (var k = 0; k < p.rejects.length; k++) byReason[p.rejects[k].key] = (byReason[p.rejects[k].key] || 0) + 1;
      continue;
    }
    days.push(p);
  }
  days.sort(function (a, b) { return b.score - a.score || a.dateEn.localeCompare(b.dateEn); });
  return {
    groom: groom, bride: bride,
    from: { y: from.y, m: from.m, d: from.d }, to: { y: to.y, m: to.m, d: to.d },
    total: total, passed: days.length, excluded: rejected.length,
    weekendSkipped: weekendSkipped, byReason: byReason,
    huangDaoAgree: huangAgree, huangDaoTotal: total,
    days: days, rejected: rejected,
    best: days.length ? days[0] : null
  };
}
// ============ R38 结束 ============

// ============ R39 姓名五行字表（v0.15.0）============
// R39.1 字形五行（部首派）：以《康熙字典》部首定五行——木→木；火/灬/日→火；土/山/田→土；
//       金/钅→金；水/氵/雨/子→水。姓名学笔画换算：氵按水 4 画计入康熙笔画（同类换算规则
//       还有 忄=心4、扌=手4、犭=犬4、王=玉5、艹=艸6、辶=辵7、左阝=阜8、右阝=邑7；
//       本层字表仅涉氵）。字表只收简繁同形或已注明繁体对应的字；查不到的字明确回报
//       unknown，不猜不套——这是与「任意名字都给结论」网站的根本区别。
// R39.2 笔画五行（康熙笔画派）：按康熙笔画的个位数定五行——1,2→木；3,4→火；5,6→土；
//       7,8→金；9,0→水。
// R39.3 两派公开分歧：对字表 72 个常用取名用字，两派结论一致仅 17 字（23.6%，测试断言
//       锁定）。与 R38 双黄道同理：分歧是可核对的事实，不是要被「修正」的误差。

export const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
export const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
// 部首 → 字形五行
export const WUXING_RADICAL_ELEMENT = {
  '木': '木', '火': '火', '灬': '火', '日': '火',
  '土': '土', '山': '土', '田': '土',
  '金': '金', '钅': '金', '水': '水', '氵': '水', '雨': '水', '子': '水',
};
// 姓名学笔画里按繁部计画的部首（氵 3 画按水 4 画计）
export const WUXING_RADICAL_KANGXI = { '氵': 4 };

export function wuxingStrokeElement(kangxi) {
  const band = ((kangxi % 10) + 10) % 10;
  if (band === 0 || band === 9) return '水';
  if (band <= 2) return '木';
  if (band <= 4) return '火';
  if (band <= 6) return '土';
  return '金';
}

// 字表：[字, 部首, 康熙笔画, 拼音, 繁体?]——简繁同形者无第 5 项
const WUXING_CHAR_ROWS = [
  // 木（18）
  ['木', '木', 4, 'mù'], ['材', '木', 7, 'cái'], ['村', '木', 7, 'cūn'], ['杞', '木', 7, 'qǐ'],
  ['林', '木', 8, 'lín'], ['松', '木', 8, 'sōng'], ['果', '木', 8, 'guǒ'], ['柏', '木', 9, 'bǎi'],
  ['相', '木', 9, 'xiàng'], ['柔', '木', 9, 'róu'], ['桂', '木', 10, 'guì'], ['桐', '木', 10, 'tóng'],
  ['梅', '木', 11, 'méi'], ['梓', '木', 11, 'zǐ'], ['森', '木', 12, 'sēn'], ['楠', '木', 13, 'nán'],
  ['楚', '木', 13, 'chǔ'], ['榕', '木', 14, 'róng'],
  // 火（9）
  ['火', '火', 4, 'huǒ'], ['炎', '火', 8, 'yán'], ['焱', '火', 12, 'yàn'], ['煜', '火', 13, 'yù'],
  ['照', '灬', 13, 'zhào'], ['明', '日', 8, 'míng'], ['晴', '日', 12, 'qíng'], ['昊', '日', 8, 'hào'],
  ['春', '日', 9, 'chūn'],
  // 土（12）
  ['土', '土', 3, 'tǔ'], ['圭', '土', 6, 'guī'], ['坤', '土', 8, 'kūn'], ['城', '土', 10, 'chéng'],
  ['培', '土', 11, 'péi'], ['基', '土', 11, 'jī'], ['堂', '土', 11, 'táng'], ['山', '山', 3, 'shān'],
  ['岳', '山', 8, 'yuè'], ['峰', '山', 10, 'fēng'], ['岩', '山', 8, 'yán'], ['田', '田', 5, 'tián'],
  // 金（6）
  ['金', '金', 8, 'jīn'], ['鑫', '金', 24, 'xīn'],
  ['钰', '钅', 13, 'yù', '鈺'], ['铭', '钅', 14, 'míng', '銘'],
  ['锦', '钅', 16, 'jǐn', '錦'], ['银', '钅', 14, 'yín', '銀'],
  // 水（27）
  ['水', '水', 4, 'shuǐ'], ['泰', '水', 9, 'tài'],
  ['江', '氵', 7, 'jiāng'], ['池', '氵', 7, 'chí'], ['汐', '氵', 7, 'xī'], ['沐', '氵', 8, 'mù'],
  ['沁', '氵', 8, 'qìn'], ['汪', '氵', 8, 'wāng'], ['沛', '氵', 8, 'pèi'], ['泓', '氵', 9, 'hóng'],
  ['波', '氵', 9, 'bō'], ['浩', '氵', 11, 'hào'], ['海', '氵', 11, 'hǎi'], ['津', '氵', 10, 'jīn'],
  ['洪', '氵', 10, 'hóng'], ['洋', '氵', 10, 'yáng'], ['淑', '氵', 12, 'shū'], ['淳', '氵', 12, 'chún'],
  ['清', '氵', 12, 'qīng'], ['涵', '氵', 12, 'hán'],
  ['雨', '雨', 8, 'yǔ'], ['雪', '雨', 11, 'xuě'], ['雷', '雨', 13, 'léi'], ['霖', '雨', 16, 'lín'],
  ['震', '雨', 15, 'zhèn'], ['霄', '雨', 15, 'xiāo'],
  ['子', '子', 3, 'zǐ'],
];

function rowToEntry(row) {
  const [c, rad, kangxi, py, trad] = row;
  const formEl = WUXING_RADICAL_ELEMENT[rad];
  const strokeEl = wuxingStrokeElement(kangxi);
  return {
    c: c, rad: rad, radKangxi: WUXING_RADICAL_KANGXI[rad] || null, py: py, trad: trad || null,
    formEl: formEl, kangxi: kangxi, strokeEl: strokeEl, agree: formEl === strokeEl,
  };
}

export const WUXING_CHAR_TABLE = WUXING_CHAR_ROWS.map(rowToEntry);
const WUXING_CHAR_INDEX = {};
for (const e of WUXING_CHAR_TABLE) {
  WUXING_CHAR_INDEX[e.c] = e;
  if (e.trad) WUXING_CHAR_INDEX[e.trad] = e;
}

export function charWuxingOf(ch) { return WUXING_CHAR_INDEX[ch] || null; }

// 姓名五行剖面：逐字给两派结论 + 两派计数；查不到的字标 unknown，不猜
export function nameWuxingProfile(name) {
  const chars = [...String(name || '')].filter((ch) => ch.trim() !== '');
  const per = chars.map((ch) => {
    const e = WUXING_CHAR_INDEX[ch];
    if (!e) return { c: ch, known: false };
    return { c: ch, known: true, py: e.py, rad: e.rad, trad: e.trad, formEl: e.formEl, kangxi: e.kangxi, strokeEl: e.strokeEl, agree: e.agree };
  });
  const known = per.filter((p) => p.known);
  const countBy = (key) => {
    const out = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    for (const p of known) out[p[key]]++;
    return out;
  };
  return {
    total: chars.length, known: known.length, unknownChars: per.filter((p) => !p.known).map((p) => p.c),
    chars: per,
    formCounts: countBy('formEl'), strokeCounts: countBy('strokeEl'),
    agreeCount: known.filter((p) => p.agree).length, disagreeCount: known.filter((p) => !p.agree).length,
  };
}

// 字表级结构统计（页面公开用，测试锁定一致数 17/72）
export function wuxingTableStats() {
  const n = WUXING_CHAR_TABLE.length;
  const agree = WUXING_CHAR_TABLE.filter((e) => e.agree).length;
  const byForm = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const byStroke = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const e of WUXING_CHAR_TABLE) { byForm[e.formEl]++; byStroke[e.strokeEl]++; }
  return { total: n, agree: agree, disagree: n - agree, byForm: byForm, byStroke: byStroke };
}

// 五行两两关系（a 相对 b）：same / aShengB / bShengA / aKeB / bKeA
export function elementRelation(a, b) {
  if (a === b) return 'same';
  if (WUXING_SHENG[a] === b) return 'aShengB';
  if (WUXING_SHENG[b] === a) return 'bShengA';
  if (WUXING_KE[a] === b) return 'aKeB';
  if (WUXING_KE[b] === a) return 'bKeA';
  return null;
}
// ============ R39 结束 ============
