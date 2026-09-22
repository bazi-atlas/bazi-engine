/* ============================================================
 * BaZi Engine (Web) v0.13.0 — single source of conventions with engine.mjs
 *
 * Convention summary (all declared publicly on the Methodology page):
 *  R1  Year pillar switches at LiChun instant (not Lunar New Year)
 *  R2  Month pillar switches at Jie (节) solar-term instants
 *  R3  Day pillar: late Zi (23:00+) rolls to next day by default (sect=1);
 *      sect=2 (midnight switch) offered as a school option
 *  R4  True solar time v1: longitude term only, baseline = local timezone
 *      central meridian (tzOffsetHours×15 preferred, else round(lon/15)×15).
 *      Equation of Time (±16 min) is planned for v2 and NOT applied yet.
 *  R4b Year/Month pillars determined by ABSOLUTE instant (clock − tz = UTC,
 *      +8h → Beijing) against the solar-term table; Day/Hour pillars use
 *      local true solar time (day rolls at LOCAL Zi hour). [v0.3 fix]
 *  R5  China DST 1986–1991: clock time −1h (approx bounds 5/4–9/14), flagged
 *  R6  Unknown hour: three-pillar chart, hour never guessed
 *  R7  Five-element counts in three conventions (stems+branch main-qi /
 *      hidden-stems half-weight / hidden-stems full)
 *  R8  Luck-pillar direction: yang-stem year + male, or yin-stem year +
 *      female, runs forward; the other two combinations run backward.
 *  R9  Luck-pillar start: distance measured to the JIE (节) instant —
 *      next jie when forward, previous jie when backward — in absolute time,
 *      same reference frame as R4b.
 *  R10 Conversion 3 days = 1 year, 1 day = 4 months, 1 two-hour block =
 *      10 days. Two granularities are published: "traditional" (block
 *      quantised, the mainstream app convention) and "precise" (same ratio,
 *      minute resolution). The gap between them is shown, not hidden.
 *  R11 The 2-hour blocks are counted on the birth locality's standard civil
 *      clock (the time you typed, DST normalised back). True-solar counting
 *      is offered as a sensitivity comparison.
 *  R12 Changeover date = recorded birth date/time + the start offset.
 *      Equation of Time is not applied in v1.
 *  R13 Stem combinations (tian gan wu he): Jia+Ji->Earth, Yi+Geng->Metal,
 *      Bing+Xin->Water, Ding+Ren->Wood, Wu+Gui->Fire.
 *  R14 Stem clashes: Jia-Geng, Yi-Xin, Bing-Ren, Ding-Gui; Wu/Ji (center) never clash.
 *  R15 Branch six harmonies: Zi-Chou, Yin-Hai, Mao-Xu, Chen-You, Si-Shen, Wu-Wei.
 *      Transform element by tradition (Wu-Wei as Earth; some schools say Sun-Moon,
 *      no transformation — flagged, not hidden).
 *  R16 Trines: Shen-Zi-Chen (Water), Hai-Mao-Wei (Wood), Yin-Wu-Xu (Fire),
 *      Si-You-Chou (Metal). Two branches across the two charts = "half trine",
 *      published as a contested convention. Same-chart-only groupings are
 *      excluded from the compatibility view.
 *  R17 Harms: Zi-Wei, Chou-Wu, Yin-Si, Mao-Chen, Shen-Hai, You-Xu.
 *  R18 Punishments: Yin-Si-Shen (any pair), Chou-Xu-Wei (any pair), Zi-Mao,
 *      self-punishment (Chen, Wu, You, Hai). All relations are enumerated side
 *      by side; no priority resolves harmony against clash (Si-Shen is both).
 *  R19 Cross-chart interaction is a modern synastry convention; the engine only
 *      enumerates relations and never produces a match percentage.
 *  R20 Favorable-element strength scoring: every visible stem (except the day
 *      master itself) scores 1 for its element; every branch scores its main
 *      qi 1 plus 0.5 per hidden stem (the same half-weight convention as R7);
 *      the month pillar's whole contribution is doubled ("the month branch
 *      holds the season's authority"). A fully transparent weighted tally —
 *      not the only school, and published as weights, not a black box.
 *  R21 Verdict thresholds: support (peers + resource) / total >= 0.55 strong,
 *      <= 0.45 weak, otherwise balanced. Declared values, schools differ.
 *  R22 Support & suppress (fu yang): strong -> output/wealth/influence are
 *      favorable, peers/resource unfavorable; weak -> resource/peers favorable;
 *      balanced -> the balance school gives no direction. No luck percentage.
 *  R23 Climate adjustment (tiao hou) simplified rule: summer months
 *      (Si/Wu/Wei) take Water, winter months (Hai/Zi/Chou) take Fire; other
 *      months get no season-level answer (the classical per-stem-per-month
 *      table cannot be compressed into one line). School agreement/disagreement
 *      is flagged, never adjudicated.
 *  R24 Nayin (sixty jiazi sound-element): fixed classical table, one nayin per
 *      PAIR of pillars (Jia-Zi & Yi-Chou share "Gold in the Sea"). Chinese
 *      names are the single source of truth; English names are the site's own
 *      literal renderings for display only.
 *  R25 Day-pillar profile: structural facts only — hidden stems with their
 *      ten-god roles, the twelve stage of the stem seated on the branch,
 *      nayin, and the five stem-branch seat relations (same / support / drain
 *      / control "gai tou" / undercut "jie jiao"). NO personality verdicts:
 *      one pillar = one personality is a popular simplification this site
 *      explicitly rejects; meaning depends on the month command and the full
 *      chart.
 *  R26 Stem polarity is derived from the index: even index (Jia, Bing, Wu, Geng,
 *      Ren) is yang, odd is yin. A grouped hand-typed table had silently
 *      swapped Yi/Bing, Ji/Geng and Gui/Jia while STEMS_EN in the same block
 *      disagreed — the labels are now index-derived, with a cross-assertion.
 *  R27 Branch attributes are derived, not typed in: yin/yang, element, animal,
 *      month, hour window, direction, hidden stems and all six relation types
 *      come from the index or from a table already in the engine.
 *  R28 The twelve stages: one entry per (stem, branch) seat, plus the stage
 *      profile published on the family pages.
 *  R29 Ten gods on a pillar resolve to exactly one stem (the bijection that
 *      makes the god pages checkable). Only year, month and hour pillars are
 *      listed — the day pillar is the self palace and is deliberately left out.
 *  R30 Year/zodiac layer (v0.9.0): the zodiac and the year pillar both switch
 *  R31 Hexagram layer: Wen Wang sequence 1..64 as the primary number (identical to
 *      Unicode U+4DC0..U+4DFF), with the binary/Fu Xi sequence published alongside;
 *      six lines counted bottom-up (1 = yang); inner (lower) trigram = lines 1-3,
 *      outer (upper) = lines 4-6; Jing Fang na jia for the stem-branch of each line;
 *      eight-palace (ba gong) assignment, shi/ying line, cuo/zong/hu relations are ALL
 *      derived from the two trigrams — there is no second hand-kept data set.
 *      at the LICHUN INSTANT (sun at 315° ecliptic longitude) — not at 1 Jan,
 *      and not at the lunar new year, which is where most zodiac sites differ.
 *      Lichun is an astronomical instant, so the browser engine carries a
 *      verbatim 1900–2100 table (LICHUN) generated by generate-lichun.mjs and
 *      asserted byte-for-byte against the Node engine. Fan tai sui is read off
 *      five fixed tables (own year / clash / punishment / harm / break) and is
 *      published as relations only: no fortune verdict, and nothing is sold to
 *      "fix" it. The six-break table coincides with six-harmony for Yin-Hai and
 *      Si-Shen — declared as a disagreement, not silently resolved.
 *
 * Depends on lunar-javascript UMD build (global Solar / Lunar).
 * This file is loaded both by the browser pages and by Node regression
 * tests (test-web-engine.mjs) so the site can never drift from the engine.
 * ============================================================ */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BaziEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Single source of truth for the public version string. Pages render it via
  // [data-engine-version]; test-site-consistency.mjs reconciles every page and
  // the Node engine against this constant.
  var ENGINE_VERSION = 'v0.15.1';

  var STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var STEMS_EN = ['Jia Yang Wood','Yi Yin Wood','Bing Yang Fire','Ding Yin Fire','Wu Yang Earth','Ji Yin Earth','Geng Yang Metal','Xin Yin Metal','Ren Yang Water','Gui Yin Water'];
  var STEM_ELEMENT = ['木','木','火','火','土','土','金','金','水','水'];
  // R26 天干阴阳（声明性约定）：由索引奇偶决定（甲丙戊庚壬为阳）。不要写成两两成组的写法——那会与上面的
  // STEMS_EN（'Yi Yin Wood'）自相矛盾，并让页面上的阴阳标签整批出错。
  var STEM_POLARITY = STEMS.map(function (s, i) { return i % 2 === 0 ? '阳' : '阴'; });
  var BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var BRANCH_ELEMENT = ['水','土','木','木','土','火','火','土','金','金','土','水'];
  var BRANCH_EN = ['Zi (Rat)','Chou (Ox)','Yin (Tiger)','Mao (Rabbit)','Chen (Dragon)','Si (Snake)','Wu (Horse)','Wei (Goat)','Shen (Monkey)','You (Rooster)','Xu (Dog)','Hai (Pig)'];

  var TEN_GODS_EN = {
    '比肩':'Peer (BiJian)','劫财':'Rival (JieCai)','食神':'Eating God (ShiShen)','伤官':'Hurting Officer (ShangGuan)',
    '偏财':'Indirect Wealth (PianCai)','正财':'Direct Wealth (ZhengCai)','七杀':'Seven Killings (QiSha)',
    '正官':'Direct Officer (ZhengGuan)','偏印':'Indirect Resource (PianYin)','正印':'Direct Resource (ZhengYin)'
  };

  // China DST official date table (1986-1991, v0.15.1): State Council notices,
  // 1986 first year 5/4-9/14, afterwards mid-April 1st Sunday 02:00 to mid-Sept
  // 1st Sunday 02:00. Clock granularity on transition days (declared approximation).
  var CN_DST_RANGES = [
    [1986, 504, 914], [1987, 412, 913], [1988, 410, 911],
    [1989, 416, 917], [1990, 415, 916], [1991, 414, 915]
  ];

  function tzCentralMeridianOf(longitude) {
    return Math.round(longitude / 15) * 15;
  }
  function trueSolarOffsetMinutes(longitude, tzCentralMeridian) {
    if (longitude == null) return 0;
    var central = tzCentralMeridian != null ? tzCentralMeridian : tzCentralMeridianOf(longitude);
    return (longitude - central) * 4;
  }
  function inCnDst(y, m, d) {
    var md = m * 100 + d;
    for (var i = 0; i < CN_DST_RANGES.length; i++) {
      var r = CN_DST_RANGES[i];
      if (y === r[0] && md >= r[1] && md <= r[2]) return true;
    }
    return false;
  }

  // 十神判定：相对真实日主（本地盘日柱天干）。v0.3.1：年/月柱十神不得使用绝对时刻盘的日主
  // （海外出生跨日时日主会变，十神全错）——与 engine.mjs 同步。
  var SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
  var KE = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
  function tenGodOf(dayGan, gan) {
    var di = STEMS.indexOf(dayGan), gi = STEMS.indexOf(gan);
    var de = STEM_ELEMENT[di], ge = STEM_ELEMENT[gi];
    var samePolarity = (di % 2) === (gi % 2);
    if (de === ge) return samePolarity ? '比肩' : '劫财';
    if (SHENG[de] === ge) return samePolarity ? '食神' : '伤官';
    if (KE[de] === ge) return samePolarity ? '偏财' : '正财';
    if (SHENG[ge] === de) return samePolarity ? '偏印' : '正印';
    return samePolarity ? '七杀' : '正官';
  }

  // ---------- 十神推导（v0.3.3）—— 与 engine.mjs 单一约定 ----------
  var TEN_GOD_GROUPS = {
    '比肩':'peers','劫财':'peers','食神':'output','伤官':'output','偏财':'wealth','正财':'wealth',
    '七杀':'influence','正官':'influence','偏印':'resource','正印':'resource'
  };
  var TEN_GOD_GROUP_LABEL = { peers:'Self & Peers', output:'Output', wealth:'Wealth', influence:'Influence', resource:'Resource' };
  var TEN_GOD_GROUP_CN = { peers:'比劫', output:'食伤', wealth:'财星', influence:'官杀', resource:'印星' };

  function tenGodRelation(dayElement, ganElement) {
    if (dayElement === ganElement) return 'peers';
    if (SHENG[dayElement] === ganElement) return 'output';
    if (KE[dayElement] === ganElement) return 'wealth';
    if (SHENG[ganElement] === dayElement) return 'resource';
    return 'influence';
  }

  function deriveTenGod(dayGan, gan) {
    var di = STEMS.indexOf(dayGan), gi = STEMS.indexOf(gan);
    if (di < 0 || gi < 0) return null;
    var dayElement = STEM_ELEMENT[di], ganElement = STEM_ELEMENT[gi];
    var god = tenGodOf(dayGan, gan);
    var group = TEN_GOD_GROUPS[god];
    return {
      god: god, godEn: TEN_GODS_EN[god], group: group,
      groupLabel: TEN_GOD_GROUP_LABEL[group], groupCn: TEN_GOD_GROUP_CN[group],
      relation: tenGodRelation(dayElement, ganElement),
      dayElement: dayElement, ganElement: ganElement,
      samePolarity: (di % 2) === (gi % 2),
      dayPolarityYang: di % 2 === 0, ganPolarityYang: gi % 2 === 0
    };
  }
  function pad2(n) { return String(n).padStart(2, '0'); }

  function computeBazi(opts) {
    var year = opts.year, month = opts.month, day = opts.day;
    var hour = opts.hour != null ? opts.hour : null;
    var minute = opts.minute || 0;
    var longitude = opts.longitude != null ? opts.longitude : null;
    var tzCentralMeridian = opts.tzCentralMeridian != null ? opts.tzCentralMeridian : null;
    var tzOffsetHours = opts.tzOffsetHours != null ? opts.tzOffsetHours : null;
    var unknownTime = !!opts.unknownTime;
    var sect = opts.sect || 1;

    var h = hour, min = minute, dstApplied = false, tsOffset = 0, tsCorrected = null;
    // v0.3.2: true-solar baseline is ALWAYS tz central meridian = UTC-offset × 15
    // (default UTC+8 → 120°E). Must match engine.mjs.
    var tzOff = tzOffsetHours != null ? tzOffsetHours : 8;
    var central = tzCentralMeridian != null ? tzCentralMeridian : tzOff * 15;

    // R5: China DST window (v0.15.1: official per-year dates + midnight date rollback)
    var ry = year, rm = month, rd = day;
    if (inCnDst(ry, rm, rd)) {
      h -= 1; dstApplied = true;
      if (h < 0) {
        h += 24;
        var prevDay = new Date(Date.UTC(ry, rm - 1, rd) - 86400000);
        ry = prevDay.getUTCFullYear(); rm = prevDay.getUTCMonth() + 1; rd = prevDay.getUTCDate();
      }
    }

    // R4b: year/month pillars by ABSOLUTE instant (clock − tz = UTC, +8h = Beijing)
    var bj = new Date(Date.UTC(ry, rm - 1, rd, h == null ? 12 : h, min) - tzOff * 3600000 + 8 * 3600000);
    var by = bj.getUTCFullYear(), bm = bj.getUTCMonth() + 1, bd = bj.getUTCDate(), bh = bj.getUTCHours(), bmin = bj.getUTCMinutes();

    // R4: true solar time (longitude term), rolling via UTC to handle day crossover
    var cy = ry, cm = rm, cd = rd;
    if (longitude != null && central != null && !unknownTime) {
      tsOffset = trueSolarOffsetMinutes(longitude, central);
      var base = Date.UTC(ry, rm - 1, rd, h == null ? 12 : h, min);
      var shifted = new Date(base + tsOffset * 60000);
      cy = shifted.getUTCFullYear(); cm = shifted.getUTCMonth() + 1; cd = shifted.getUTCDate();
      h = shifted.getUTCHours(); min = shifted.getUTCMinutes();
      tsCorrected = { hour: h, minute: min, dateShifted: (cy !== ry || cm !== rm || cd !== rd) };
    }

    // Local chart (true-solar local time) → day & hour pillars
    var solar = Solar.fromYmdHms(cy, cm, cd, h == null ? 12 : h, min, 0);
    var ec = solar.getLunar().getEightChar();
    ec.setSect(sect);
    // Absolute-instant chart → year & month pillars (solar-term boundary)
    var absEc = Solar.fromYmdHms(by, bm, bd, bh, bmin, 0).getLunar().getEightChar();

    // Year/Month: ganzhi/hideGan/naYin from absolute-instant chart; ten gods recomputed
    // against the TRUE day master (local chart) — v0.3.1
    var dayGan = ec.getDayGan();
    var pillars = {
      year:  { ganzhi: absEc.getYear(),  hideGan: absEc.getYearHideGan(),  shiShenGan: tenGodOf(dayGan, absEc.getYear()[0]),  naYin: absEc.getYearNaYin() },
      month: { ganzhi: absEc.getMonth(), hideGan: absEc.getMonthHideGan(), shiShenGan: tenGodOf(dayGan, absEc.getMonth()[0]), naYin: absEc.getMonthNaYin() },
      day:   { ganzhi: ec.getDay(),      hideGan: ec.getDayHideGan(),      shiShenGan: '日主',                     naYin: ec.getDayNaYin() },
      time:  unknownTime ? null : { ganzhi: ec.getTime(), hideGan: ec.getTimeHideGan(), shiShenGan: ec.getTimeShiShenGan(), naYin: ec.getTimeNaYin() }
    };

    var dayIdx = STEMS.indexOf(dayGan);

    // R7: five-element counts, three conventions
    var countAll = { 木:0, 火:0, 土:0, 金:0, 水:0 };
    var countMain = { 木:0, 火:0, 土:0, 金:0, 水:0 };
    var arr = [pillars.year, pillars.month, pillars.day, pillars.time];
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p || !p.ganzhi) continue;
      countMain[STEM_ELEMENT[STEMS.indexOf(p.ganzhi[0])]]++;
      countMain[BRANCH_ELEMENT[BRANCHES.indexOf(p.ganzhi[1])]]++;
      for (var j = 0; j < p.hideGan.length; j++) countAll[STEM_ELEMENT[STEMS.indexOf(p.hideGan[j])]]++;
      countAll[STEM_ELEMENT[STEMS.indexOf(p.ganzhi[0])]]++;
    }
    var countStemsBranches = JSON.parse(JSON.stringify(countMain));
    for (var k = 0; k < arr.length; k++) {
      var q = arr[k];
      if (!q || !q.ganzhi) continue;
      for (var w = 0; w < q.hideGan.length; w++) countMain[STEM_ELEMENT[STEMS.indexOf(q.hideGan[w])]] += 0.5;
    }

    return {
      input: { year: year, month: month, day: day, hour: hour, minute: minute, longitude: longitude, tzOffsetHours: tzOff, unknownTime: unknownTime, sect: sect },
      meta: {
        dayMaster: dayGan, dayMasterEn: STEMS_EN[dayIdx], dayElement: STEM_ELEMENT[dayIdx], dayPolarity: STEM_POLARITY[dayIdx],
        dstApplied: dstApplied, trueSolarOffsetMinutes: tsOffset, tzCentralMeridian: central, tzOffsetHours: tzOff,
        trueSolarTime: tsCorrected,
        absoluteInstantBeijing: by + '-' + pad2(bm) + '-' + pad2(bd) + ' ' + pad2(bh) + ':' + pad2(bmin),
        engine: 'lunar-javascript', engineVersion: 'lunar-javascript + BaZi Engine ' + ENGINE_VERSION, sect: sect,
        sectLabel: sect === 1 ? '晚子时日柱归次日（23:00 换日）' : '零点换日',
        sectLabelEn: sect === 1
          ? 'Late-Zi rule — the day pillar rolls over at 23:00 local true solar time (mainstream)'
          : 'Midnight rule — the day pillar changes at 00:00'
      },
      pillars: pillars,
      fiveElements: { stemsBranchesOnly: countStemsBranches, withHiddenHalfWeight: countMain, withHiddenFull: countAll },
      tenGodsEn: TEN_GODS_EN,
      branchEn: BRANCH_EN,
      stemEn: STEMS_EN
    };
  }

  // ============================================================
  // 大运（Luck Pillars）v0.4.0 — 与 engine.mjs 单一约定，逐行对应
  // 约定 R8–R12 见 Methodology 页。
  // ============================================================
  var JIAZI = (function () { var a = []; for (var i = 0; i < 60; i++) a.push(STEMS[i % 10] + BRANCHES[i % 12]); return a; })();

  var JIE_EN = {
    '立春': 'Start of Spring', '惊蛰': 'Awakening of Insects', '清明': 'Clear and Bright', '立夏': 'Start of Summer',
    '芒种': 'Grain in Ear', '小暑': 'Minor Heat', '立秋': 'Start of Autumn', '白露': 'White Dew',
    '寒露': 'Cold Dew', '立冬': 'Start of Winter', '大雪': 'Major Snow', '小寒': 'Minor Cold'
  };

  // 藏干顺序与历法库 getXxxHideGan() 完全一致（否则四柱与大运的藏干会自相矛盾）
  var BRANCH_HIDE_GAN = {
    '子': ['癸'], '丑': ['己', '癸', '辛'], '寅': ['甲', '丙', '戊'], '卯': ['乙'],
    '辰': ['戊', '乙', '癸'], '巳': ['丙', '庚', '戊'], '午': ['丁', '己'], '未': ['己', '丁', '乙'],
    '申': ['庚', '壬', '戊'], '酉': ['辛'], '戌': ['戊', '辛', '丁'], '亥': ['壬', '甲']
  };

  var STAGE_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  var STAGE_EN = ['Birth', 'Bathing', 'Attiring', 'Official Post', 'Prosperity', 'Decline', 'Illness', 'Death', 'Tomb', 'Extinction', 'Conception', 'Nourishment'];
  var STAGE_START_BRANCH = { '甲': '亥', '乙': '午', '丙': '寅', '丁': '酉', '戊': '寅', '己': '酉', '庚': '巳', '辛': '子', '壬': '申', '癸': '卯' };

  function twelveStage(dayGan, branch) {
    var di = STEMS.indexOf(dayGan), bi = BRANCHES.indexOf(branch);
    if (di < 0 || bi < 0) return null;
    var start = STAGE_START_BRANCH[dayGan];
    var sbi = BRANCHES.indexOf(start);
    var yang = di % 2 === 0;
    var offset = yang ? ((bi - sbi) % 12 + 12) % 12 : ((sbi - bi) % 12 + 12) % 12;
    return {
      stage: STAGE_NAMES[offset], stageEn: STAGE_EN[offset], index: offset,
      yangDirection: yang, startBranch: start, startBranchEn: BRANCH_EN[sbi], dayGan: dayGan
    };
  }

  // ============================================================
  // v0.7.0 纳音与日柱剖面（与 engine.mjs 逐字对应；R24/R25）
  // ============================================================
  var NAYIN_PAIRS = [
    ['海中金', 'Gold in the Sea'], ['炉中火', 'Furnace Fire'], ['大林木', 'Forest Wood'],
    ['路旁土', 'Roadside Earth'], ['剑锋金', 'Sword-edge Metal'], ['山头火', 'Mountaintop Fire'],
    ['涧下水', 'Ravine Stream Water'], ['城头土', 'City Wall Earth'], ['白蜡金', 'White Wax Metal'],
    ['杨柳木', 'Willow Wood'], ['泉中水', 'Spring Water'], ['屋上土', 'Rooftop Earth'],
    ['霹雳火', 'Thunderbolt Fire'], ['松柏木', 'Pine and Cypress Wood'], ['长流水', 'Long Flowing Water'],
    ['沙中金', 'Gold in the Sand'], ['山下火', 'Foothill Fire'], ['平地木', 'Plain Wood'],
    ['壁上土', 'Wall Earth'], ['金箔金', 'Gold Foil'], ['覆灯火', 'Lamp Flame Fire'],
    ['天河水', 'Celestial River Water'], ['大驿土', 'Post Road Earth'], ['钗钏金', 'Hairpin Metal'],
    ['桑柘木', 'Mulberry Wood'], ['大溪水', 'Great Stream Water'], ['沙中土', 'Sand Earth'],
    ['天上火', 'Sky Fire'], ['石榴木', 'Pomegranate Wood'], ['大海水', 'Great Sea Water']
  ];
  var NAYIN = NAYIN_PAIRS.flatMap ? NAYIN_PAIRS.flatMap(function (p) { return [p[0], p[0]]; })
                                    : (function () { var a = []; NAYIN_PAIRS.forEach(function (p) { a.push(p[0], p[0]); }); return a; })();
  var NAYIN_EN = NAYIN_PAIRS.flatMap ? NAYIN_PAIRS.flatMap(function (p) { return [p[1], p[1]]; })
                                     : (function () { var a = []; NAYIN_PAIRS.forEach(function (p) { a.push(p[1], p[1]); }); return a; })();

  function nayinOf(gz) {
    var i = JIAZI.indexOf(gz);
    if (i < 0) return null;
    return {
      cn: NAYIN[i], en: NAYIN_EN[i],
      pairIndex: i >> 1,
      partner: JIAZI[i % 2 === 0 ? i + 1 : i - 1]
    };
  }

  var SEAT_KIND = {
    same: { cn: '比和', en: 'Same element (bi he)' },
    support: { cn: '得地', en: 'Branch generates stem (de di)' },
    drain: { cn: '泄', en: 'Stem generates branch (xie)' },
    control: { cn: '盖头', en: 'Stem controls branch (gai tou)' },
    undercut: { cn: '截脚', en: 'Branch controls stem (jie jiao)' }
  };

  function dayPillarProfile(gz) {
    if (typeof gz !== 'string' || gz.length !== 2) return null;
    var si = STEMS.indexOf(gz[0]), bi = BRANCHES.indexOf(gz[1]);
    if (si < 0 || bi < 0) return null;
    var stem = gz[0], branch = gz[1];
    var se = STEM_ELEMENT[si], be = BRANCH_ELEMENT[bi];
    var seat;
    if (se === be) seat = 'same';
    else if (SHENG[be] === se) seat = 'support';
    else if (SHENG[se] === be) seat = 'drain';
    else if (KE[se] === be) seat = 'control';
    else seat = 'undercut';
    var hidden = BRANCH_HIDE_GAN[branch].map(function (g, pos) {
      var d = deriveTenGod(stem, g);
      return {
        gan: g, ganEn: STEMS_EN[STEMS.indexOf(g)],
        pos: pos === 0 ? 'main' : pos === 1 ? 'middle' : 'residual',
        posCn: pos === 0 ? '本气' : pos === 1 ? '中气' : '余气',
        element: STEM_ELEMENT[STEMS.indexOf(g)],
        god: d.god, godEn: d.godEn, group: d.group, groupCn: d.groupCn, groupLabel: d.groupLabel,
        relation: d.relation
      };
    });
    var ny = nayinOf(gz);
    var st = twelveStage(stem, branch);
    return {
      gz: gz,
      stem: stem, branch: branch, stemIdx: si, branchIdx: bi,
      stemEn: STEMS_EN[si], branchEn: BRANCH_EN[bi], animalEn: BRANCH_ANIMAL_EN[bi],
      stemElement: se, branchElement: be, stemPolarity: STEM_POLARITY[si],
      seat: seat, seatCn: SEAT_KIND[seat].cn, seatEn: SEAT_KIND[seat].en,
      hidden: hidden,
      stage: st.stage, stageEn: st.stageEn, stageIndex: st.index,
      nayin: ny.cn, nayinEn: ny.en, nayinPartner: ny.partner, nayinPairIndex: ny.pairIndex
    };
  }

  // R8 顺逆
  function luckDirection(yearGan, gender) {
    var gi = STEMS.indexOf(yearGan);
    var yang = gi % 2 === 0;
    var male = gender === 1 || gender === 'male' || gender === 'M' || gender === true;
    var forward = (yang && male) || (!yang && !male);
    var polEn = yang ? 'yang' : 'yin';
    var genderEn = male ? 'Male' : 'Female';
    return {
      forward: forward, male: male, yearGan: yearGan, yearGanYang: yang, yearGanIndex: gi,
      rule: (yang ? '阳' : '阴') + '年干（' + yearGan + '）' + (male ? '男' : '女') + '命 → ' + (forward ? '顺排' : '逆排'),
      ruleEn: polEn + '-stem year (' + yearGan + ') + ' + genderEn.toLowerCase() + ' → sequence runs ' + (forward ? 'forward' : 'backward'),
      ruleShortEn: yang ? (male ? 'Yang-year male → forward' : 'Yang-year female → backward')
        : (male ? 'Yin-year male → backward' : 'Yin-year female → forward'),
      directionEn: forward ? 'Forward (shun pai)' : 'Backward (ni pai)'
    };
  }

  // R11 时辰块：子 23:00–00:59、丑 01:00–02:59 …… 亥 21:00–22:59
  function zhiBlockIndex(hour) { return Math.floor((((hour % 24) + 25) % 24) / 2); }
  function zhiBlockOf(hour) {
    var i = zhiBlockIndex(hour);
    var s = i === 0 ? 23 : i * 2 - 1;
    var e = i === 0 ? 0 : i * 2;
    return {
      index: i, zhi: BRANCHES[i], zhiEn: BRANCH_EN[i],
      label: BRANCHES[i] + ' (' + String(s).padStart(2, '0') + ':00–' + String(e).padStart(2, '0') + ':59)'
    };
  }

  function calendarDayDiff(a, b) {
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  }
  // 数 (fromMin, toMin] 内落着的时辰边界（奇数整点）；子时自 23:00 起，故 23:00 是边界
  function boundariesBetween(fromMin, toMin) {
    var n = 0;
    for (var m = (Math.floor(fromMin / 60) + 1) * 60; m <= toMin; m += 60) if ((m / 60) % 2 === 1) n++;
    return n;
  }

  // R10 传统「时辰块」法
  function luckStartTraditional(a, b) {
    var wholeDays = calendarDayDiff(a, b);
    var ta = a.h * 60 + a.mi, tb = b.h * 60 + b.mi;
    var blocks;
    if (tb >= ta) { blocks = boundariesBetween(ta, tb); }
    else { blocks = boundariesBetween(ta, 1440) + boundariesBetween(0, tb); wholeDays -= 1; }
    var monthCarry = Math.floor(blocks * 10 / 30);
    var monthTotal = wholeDays * 4 + monthCarry;
    var days = blocks * 10 - monthCarry * 30;
    var years = Math.floor(monthTotal / 12);
    var months = monthTotal - years * 12;
    return {
      method: 'traditional', years: years, months: months, days: days, hours: 0,
      offsetDays: years * 360 + months * 30 + days, wholeDays: wholeDays, blocks: blocks,
      blocksEn: blocks + ' two-hour block' + (blocks === 1 ? '' : 's') + ' crossed'
    };
  }

  // R10 精确分钟法：1 岁=3 日=259200 秒，1 月=21600 秒，1 日=720 秒，1 时=30 秒
  function luckStartPrecise(totalSeconds) {
    var rem = Math.abs(Math.round(totalSeconds));
    var seconds = rem;
    var years = Math.floor(rem / 259200); rem -= years * 259200;
    var months = Math.floor(rem / 21600); rem -= months * 21600;
    var days = Math.floor(rem / 720); rem -= days * 720;
    var hours = rem / 30;
    return {
      method: 'precise', years: years, months: months, days: days, hours: hours,
      offsetDays: years * 360 + months * 30 + days + hours / 24, realSeconds: seconds
    };
  }

  function parseInstant(s) {
    var parts = String(s).split(' '), dparts = parts[0].split('-'), tparts = parts[1].split(':');
    return { y: +dparts[0], m: +dparts[1], d: +dparts[2], h: +tparts[0], mi: +tparts[1], s: +(tparts[2] || 0) };
  }
  function fmtInstant(o, withSeconds) {
    return o.y + '-' + pad2(o.m) + '-' + pad2(o.d) + ' ' + pad2(o.h) + ':' + pad2(o.mi) + (withSeconds ? ':' + pad2(o.s || 0) : '');
  }
  function shiftInstant(o, minutes) {
    var dt = new Date(Date.UTC(o.y, o.m - 1, o.d, o.h, o.mi, o.s || 0) + Math.round(minutes) * 60000);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds() };
  }
  function instantUTC(o) { return Date.UTC(o.y, o.m - 1, o.d, o.h, o.mi, o.s || 0); }
  function addCalendar(base, y, m, d, hours) {
    hours = hours || 0;
    var M = base.m - 1 + m;
    var Y = base.y + y + Math.floor(M / 12);
    var mNorm = ((M % 12) + 12) % 12;
    var dim = new Date(Date.UTC(Y, mNorm + 1, 0)).getUTCDate();
    var D = Math.min(base.d, dim);
    var dt = new Date(Date.UTC(Y, mNorm, D, base.h, base.mi) + d * 86400000 + Math.round(hours * 3600000));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: dt.getUTCHours(), mi: dt.getUTCMinutes() };
  }

  function computeLuckPillars(opts) {
    var male = !(opts.gender === 0 || opts.gender === 'female' || opts.gender === 'F' || opts.gender === false);
    var gender = male ? 1 : 0;
    var count = opts.count || 10;
    var method = opts.method === 'precise' ? 'precise' : 'traditional';
    var frame = opts.frame === 'true-solar' ? 'true-solar' : 'civil';
    var todayISO = opts.today || new Date().toISOString().slice(0, 10);

    var bazi = computeBazi(opts);                       // 复用排盘，约定只实现一次
    var monthPillar = bazi.pillars.month.ganzhi;
    var yearPillar = bazi.pillars.year.ganzhi;
    var dir = luckDirection(yearPillar[0], gender);
    var tzOff = bazi.meta.tzOffsetHours;
    var tsOffset = bazi.meta.trueSolarOffsetMinutes;
    var dstApplied = bazi.meta.dstApplied;

    var birthBeijing = parseInstant(bazi.meta.absoluteInstantBeijing);
    var frameShift = (tzOff - 8) * 60 + (frame === 'true-solar' ? tsOffset : 0);

    var lunarBirth = Solar.fromYmdHms(birthBeijing.y, birthBeijing.m, birthBeijing.d, birthBeijing.h, birthBeijing.mi, 0).getLunar();
    var jieSrc = dir.forward ? lunarBirth.getNextJie() : lunarBirth.getPrevJie();
    var jieBeijing = parseInstant(jieSrc.getSolar().toYmdHms());
    var jieNameCn = jieSrc.getName();

    var birthLocal = shiftInstant(birthBeijing, frameShift);
    var jieLocal = shiftInstant(jieBeijing, frameShift);
    var a = dir.forward ? birthLocal : jieLocal;
    var b = dir.forward ? jieLocal : birthLocal;
    var elapsedSec = (instantUTC(b) - instantUTC(a)) / 1000;

    var trad = luckStartTraditional(a, b);
    var prec = luckStartPrecise(elapsedSec);
    var chosen = method === 'precise' ? prec : trad;
    var diffDays = Math.round((prec.offsetDays - trad.offsetDays) * 10000) / 10000;

    var anchorHourRaw = (opts.hour == null ? 12 : opts.hour) - (dstApplied ? 1 : 0);
    var anchor = { y: opts.year, m: opts.month, d: opts.day, h: anchorHourRaw, mi: opts.minute || 0 };
    if (anchor.h < 0) {
      anchor.h += 24;
      var prevD = new Date(Date.UTC(anchor.y, anchor.m - 1, anchor.d) - 86400000);
      anchor.y = prevD.getUTCFullYear(); anchor.m = prevD.getUTCMonth() + 1; anchor.d = prevD.getUTCDate();
    }

    var D = JIAZI.indexOf(monthPillar);
    var startIndex = D < 0 ? 0 : D;
    var pillars = [];
    for (var i = 1; i <= count; i++) {
      var raw = startIndex + (dir.forward ? i : -i);
      var ganzhi = JIAZI[((raw % 60) + 60) % 60];
      var stem = ganzhi[0], branch = ganzhi[1];
      var stepY = chosen.years + (i - 1) * 10;
      var startAt = addCalendar(anchor, stepY, chosen.months, chosen.days, chosen.hours || 0);
      var endAt = addCalendar(anchor, stepY + 10, chosen.months, chosen.days, chosen.hours || 0);
      var hideGan = BRANCH_HIDE_GAN[branch];
      var sTG = deriveTenGod(bazi.meta.dayMaster, stem);
      var bTG = deriveTenGod(bazi.meta.dayMaster, hideGan[0]);
      var st = twelveStage(bazi.meta.dayMaster, branch);
      var hideGods = [];
      for (var hi = 0; hi < hideGan.length; hi++) {
        var ht = deriveTenGod(bazi.meta.dayMaster, hideGan[hi]);
        hideGods.push({ gan: hideGan[hi], god: ht.god, godEn: ht.godEn, group: ht.group });
      }
      pillars.push({
        index: i, ganzhi: ganzhi, stem: stem, branch: branch,
        stemEn: STEMS_EN[STEMS.indexOf(stem)], branchEn: BRANCH_EN[BRANCHES.indexOf(branch)],
        element: STEM_ELEMENT[STEMS.indexOf(stem)], branchElement: BRANCH_ELEMENT[BRANCHES.indexOf(branch)],
        stemTenGod: sTG && { god: sTG.god, godEn: sTG.godEn, group: sTG.group, groupLabel: sTG.groupLabel, relation: sTG.relation },
        branchTenGod: bTG && { god: bTG.god, godEn: bTG.godEn, group: bTG.group, groupLabel: bTG.groupLabel, relation: bTG.relation },
        hideGan: hideGan, hideGanTenGods: hideGods,
        stage: st && st.stage, stageEn: st && st.stageEn, stageIndex: st && st.index,
        startAgeSui: startAt.y - anchor.y + 1, endAgeSui: endAt.y - anchor.y,
        startYear: startAt.y, endYear: endAt.y - 1, yearLabel: startAt.y + '–' + (endAt.y - 1),
        startDate: fmtInstant(startAt).slice(0, 10), endDate: fmtInstant(endAt).slice(0, 10),
        startDateTime: fmtInstant(startAt), endDateTime: fmtInstant(endAt),
        _startAt: startAt
      });
    }

    var nowT = Date.parse(todayISO + 'T00:00:00Z');
    var currentIndex = 0;
    for (var pi = 0; pi < pillars.length; pi++) {
      var p = pillars[pi];
      if (Date.UTC(p._startAt.y, p._startAt.m - 1, p._startAt.d) <= nowT) currentIndex = p.index;
    }
    for (var pj = 0; pj < pillars.length; pj++) { pillars[pj].isCurrent = pillars[pj].index === currentIndex; delete pillars[pj]._startAt; }

    var first = pillars[0];
    var run = {
      gender: gender, genderLabel: male ? 'Male' : 'Female', direction: dir,
      dayMaster: bazi.meta.dayMaster, dayMasterEn: bazi.meta.dayMasterEn, dayElement: bazi.meta.dayElement,
      monthPillar: monthPillar, yearPillar: yearPillar,
      chart: { year: yearPillar, month: monthPillar, day: bazi.pillars.day.ganzhi, time: bazi.pillars.time && bazi.pillars.time.ganzhi },
      instant: {
        frame: frame, frameShiftMinutes: frameShift, tzOffsetHours: tzOff, trueSolarOffsetMinutes: tsOffset, dstApplied: dstApplied,
        birthBeijing: fmtInstant(birthBeijing), birthLocal: fmtInstant(birthLocal),
        birthBlock: zhiBlockOf(birthLocal.h), jieBlock: zhiBlockOf(jieLocal.h),
        jie: { name: jieNameCn, nameEn: JIE_EN[jieNameCn] || jieNameCn, beijing: fmtInstant(jieBeijing, true), local: fmtInstant(jieLocal, true), direction: dir.forward ? 'next' : 'previous' }
      },
      elapsed: {
        totalSeconds: elapsedSec, totalHours: elapsedSec / 3600, totalDays: elapsedSec / 86400,
        days: Math.floor(Math.abs(elapsedSec) / 86400),
        hours: Math.floor((Math.abs(elapsedSec) % 86400) / 3600),
        minutes: Math.floor((Math.abs(elapsedSec) % 3600) / 60)
      },
      start: {
        method: method, traditional: trad, precise: prec, chosen: chosen, differenceDays: diffDays,
        startDate: fmtInstant(addCalendar(anchor, chosen.years, chosen.months, chosen.days, chosen.hours || 0)).slice(0, 10),
        startDateTime: fmtInstant(addCalendar(anchor, chosen.years, chosen.months, chosen.days, chosen.hours || 0)),
        exactAgeAtStart: { years: chosen.years, months: chosen.months, days: chosen.days, hours: chosen.hours || 0 },
        startAgeSui: first.startAgeSui
      },
      preLuck: { startYear: anchor.y, endYear: first.startYear - 1, suiAgeFrom: 1, suiAgeTo: first.startAgeSui - 1 },
      pillars: pillars,
      current: { index: currentIndex, pill: currentIndex ? pillars[currentIndex - 1] : null, today: todayISO },
      frameAlt: null, today: todayISO
    };

    var altFrame = frame === 'civil' ? 'true-solar' : 'civil';
    var altShift = (tzOff - 8) * 60 + (altFrame === 'true-solar' ? tsOffset : 0);
    var aAlt = shiftInstant(dir.forward ? birthBeijing : jieBeijing, altShift);
    var bAlt = shiftInstant(dir.forward ? jieBeijing : birthBeijing, altShift);
    var altSec = (instantUTC(bAlt) - instantUTC(aAlt)) / 1000;
    run.frameAlt = { frame: altFrame, shiftMinutes: altShift, traditional: luckStartTraditional(aAlt, bAlt), precise: luckStartPrecise(altSec) };

    var probe = function (h) {
      var bb = { y: birthBeijing.y, m: birthBeijing.m, d: birthBeijing.d, h: ((h % 24) + 24) % 24, mi: birthBeijing.mi };
      var bl = shiftInstant(bb, frameShift);
      var x = dir.forward ? bl : jieLocal, y2 = dir.forward ? jieLocal : bl;
      return luckStartTraditional(x, y2);
    };
    run.sensitivity = {
      minus2: probe(birthLocal.h - 2), minus1: probe(birthLocal.h - 1), base: trad,
      plus1: probe(birthLocal.h + 1), plus2: probe(birthLocal.h + 2)
    };

    if (bazi.input.unknownTime) {
      var dayStart = shiftInstant({ y: birthBeijing.y, m: birthBeijing.m, d: birthBeijing.d, h: 0, mi: 0 }, frameShift);
      var dayEnd = shiftInstant({ y: birthBeijing.y, m: birthBeijing.m, d: birthBeijing.d, h: 23, mi: 59 }, frameShift);
      var mk = function (bl) {
        var back = shiftInstant(bl, -frameShift);
        var j = Solar.fromYmdHms(back.y, back.m, back.d, back.h, back.mi, 0).getLunar();
        var js = dir.forward ? j.getNextJie() : j.getPrevJie();
        var jl = shiftInstant(parseInstant(js.getSolar().toYmdHms()), frameShift);
        var x = dir.forward ? bl : jl, y3 = dir.forward ? jl : bl;
        var sec = (instantUTC(y3) - instantUTC(x)) / 1000;
        return { jie: js.getName(), jieEn: JIE_EN[js.getName()] || js.getName(), jieLocal: fmtInstant(jl, true), traditional: luckStartTraditional(x, y3), precise: luckStartPrecise(sec) };
      };
      var lo = mk(dayStart), hi = mk(dayEnd);
      run.unknownTime = {
        windowStart: fmtInstant(dayStart), windowEnd: fmtInstant(dayEnd),
        low: lo, high: hi, jieAmbiguous: lo.jie !== hi.jie, monthPillarAssumedNoon: monthPillar
      };
    } else { run.unknownTime = null; }

    return run;
  }

  // ---------- 合盘（Compatibility）v0.5.0 — 与 engine.mjs 逐行对应（R13–R19） ----------
  var STEM_COMBINE = { '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊' };
  // 合化表 key 为「按码点排序的两字串」（子丑→丑子、寅亥→亥寅、甲己→己甲），
  // 与 [x,y].sort().join('') 查找键一致——按传统写法写 key 会静默查空。
  var STEM_COMBINE_ELEMENT = { '己甲':'土','乙庚':'金','丙辛':'水','丁壬':'木','戊癸':'火' };
  var STEM_CLASH = { '甲':'庚','庚':'甲','乙':'辛','辛':'乙','丙':'壬','壬':'丙','丁':'癸','癸':'丁' };
  var BRANCH_SIX_HE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };
  var SIX_HE_ELEMENT = { '丑子':'土','亥寅':'木','卯戌':'火','辰酉':'金','巳申':'水','午未':'土' };
  var BRANCH_CLASH = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
  var BRANCH_TRINE = [
    { branches:['申','子','辰'], element:'水', elementEn:'Water' },
    { branches:['亥','卯','未'], element:'木', elementEn:'Wood' },
    { branches:['寅','午','戌'], element:'火', elementEn:'Fire' },
    { branches:['巳','酉','丑'], element:'金', elementEn:'Metal' }
  ];
  var BRANCH_HARM = { '子':'未','未':'子','丑':'午','午':'丑','寅':'巳','巳':'寅','卯':'辰','辰':'卯','申':'亥','亥':'申','酉':'戌','戌':'酉' };
  var PUNISH_GROUPS = [
    { branches:['寅','巳','申'], kind:'恃势之刑', kindEn:'Punishment of Arrogance',
      note:'命名存在流派分歧：《阴符经》义理派以「木生火、火生土，生者还刑其生」论，作「无恩之刑」；本引擎从另一派作「恃势之刑」。两派对寅巳申/丑戌未的分组完全一致，仅名称互换，出处引文互见（渊海子平/三命通会传本即有异文）。',
      noteEn:'Naming diverges by school: the YinFuJing-reasoning school labels this "Punishment of Ingratitude" (the generated constrains its generator); this engine follows the school labeling it "Punishment of Arrogance". The grouping itself (Yin-Si-Shen / Chou-Xu-Wei) is unanimous across schools — only the labels swap.' },
    { branches:['丑','戌','未'], kind:'无恩之刑', kindEn:'Punishment of Ingratitude',
      note:'与寅巳申组互为镜像：义理派（土旺恃势相刑）称本组为「恃势之刑」，本引擎从另一派称「无恩之刑」。分组一致，名称互换。',
      noteEn:'Mirror of the Yin-Si-Shen group: the reasoning school calls this group "Punishment of Arrogance" (earth relying on strength); this engine follows the school calling it "Punishment of Ingratitude". Grouping unanimous, labels swapped.' },
    { branches:['子','卯'], kind:'无礼之刑', kindEn:'Punishment of Discourtesy' }
  ];
  var SELF_PUNISH = ['辰','午','酉','亥'];
  var BRANCH_ANIMAL = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  var BRANCH_ANIMAL_EN = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];

  function stemRelation(s1, s2) {
    var out = [];
    if (STEM_COMBINE[s1] === s2) out.push({ type: '天干五合', typeEn: 'stem combination', element: STEM_COMBINE_ELEMENT[[s1, s2].sort().join('')] });
    if (STEM_CLASH[s1] === s2) out.push({ type: '天干相冲', typeEn: 'stem clash' });
    return out;
  }

  function branchRelations(b1, b2) {
    var out = [], g, i;
    if (BRANCH_SIX_HE[b1] === b2) out.push({ type: '六合', typeEn: 'six harmony', element: SIX_HE_ELEMENT[[b1, b2].sort().join('')] });
    if (BRANCH_CLASH[b1] === b2) out.push({ type: '六冲', typeEn: 'clash' });
    if (BRANCH_HARM[b1] === b2) out.push({ type: '六害', typeEn: 'harm' });
    for (i = 0; i < PUNISH_GROUPS.length; i++) {
      g = PUNISH_GROUPS[i];
      if (g.branches.indexOf(b1) >= 0 && g.branches.indexOf(b2) >= 0 && b1 !== b2) {
        out.push({ type: '相刑', typeEn: 'punishment', kind: g.kind, kindEn: g.kindEn });
        break;
      }
    }
    if (b1 === b2 && SELF_PUNISH.indexOf(b1) >= 0) out.push({ type: '自刑', typeEn: 'self-punishment' });
    for (i = 0; i < BRANCH_TRINE.length; i++) {
      g = BRANCH_TRINE[i];
      if (b1 !== b2 && g.branches.indexOf(b1) >= 0 && g.branches.indexOf(b2) >= 0) {
        out.push({ type: '半三合', typeEn: 'half trine (contested)', element: g.element, elementEn: g.elementEn });
        break;
      }
    }
    return out;
  }

  var POS_ORDER = ['year', 'month', 'day', 'time'];
  var POS_CN = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' };
  var POS_EN = { year: 'Year', month: 'Month', day: 'Day', time: 'Hour' };

  function chartBrief(C) {
    var chart = {}, pos, yb, yi, p;
    for (var i = 0; i < POS_ORDER.length; i++) { pos = POS_ORDER[i]; p = C.pillars[pos]; chart[pos] = p ? p.ganzhi : null; } // web 引擎未知时辰时 pillars.time 为 null
    yb = C.pillars.year.ganzhi[1];
    yi = BRANCHES.indexOf(yb);
    return {
      dayMaster: C.meta.dayMaster, dayMasterEn: C.meta.dayMasterEn, dayElement: C.meta.dayElement,
      dayBranch: C.pillars.day.ganzhi[1], yearBranch: yb,
      animal: BRANCH_ANIMAL[yi], animalEn: BRANCH_ANIMAL_EN[yi],
      chart: chart, fiveElements: C.fiveElements
    };
  }

  function computeCompatibility(aOpts, bOpts) {
    var A = computeBazi(aOpts), B = computeBazi(bOpts);
    var a = chartBrief(A), b = chartBrief(B);
    var dmA = a.dayMaster, dmB = b.dayMaster;

    var aSeesB = deriveTenGod(dmA, dmB), bSeesA = deriveTenGod(dmB, dmA);

    var stems = [], pa, pb, sa, sb, tg, i, j;
    for (i = 0; i < POS_ORDER.length; i++) {
      pa = POS_ORDER[i]; sa = a.chart[pa]; if (!sa) continue;
      for (j = 0; j < POS_ORDER.length; j++) {
        pb = POS_ORDER[j]; sb = b.chart[pb]; if (!sb) continue;
        tg = deriveTenGod(dmA, sb[0]);
        stems.push({ aPos: pa, aPosCn: POS_CN[pa], aPosEn: POS_EN[pa], aStem: sa[0], bPos: pb, bPosCn: POS_CN[pb], bPosEn: POS_EN[pb], bStem: sb[0], tenGod: tg.god, tenGodEn: tg.godEn, group: tg.group, groupEn: tg.groupLabel, relations: stemRelation(sa[0], sb[0]) });
      }
    }

    var branches = [], ga, gb;
    for (i = 0; i < POS_ORDER.length; i++) {
      pa = POS_ORDER[i]; ga = a.chart[pa]; if (!ga) continue;
      for (j = 0; j < POS_ORDER.length; j++) {
        pb = POS_ORDER[j]; gb = b.chart[pb]; if (!gb) continue;
        branches.push({ aPos: pa, aPosCn: POS_CN[pa], aPosEn: POS_EN[pa], aBranch: ga[1], bPos: pb, bPosCn: POS_CN[pb], bPosEn: POS_EN[pb], bBranch: gb[1], relations: branchRelations(ga[1], gb[1]), involvesDayPalace: pa === 'day' || pb === 'day' });
      }
    }

    var union = [];
    for (i = 0; i < POS_ORDER.length; i++) { pa = POS_ORDER[i]; if (a.chart[pa]) union.push({ branch: a.chart[pa][1], from: 'A', pos: pa }); }
    for (i = 0; i < POS_ORDER.length; i++) { pb = POS_ORDER[i]; if (b.chart[pb]) union.push({ branch: b.chart[pb][1], from: 'B', pos: pb }); }
    var trinesFull = [], trinesHalf = [], present, distinct, seen, crossChart, p;
    for (i = 0; i < BRANCH_TRINE.length; i++) {
      present = []; seen = {};
      for (j = 0; j < union.length; j++) { if (BRANCH_TRINE[i].branches.indexOf(union[j].branch) >= 0) present.push(union[j]); }
      distinct = [];
      for (j = 0; j < present.length; j++) { if (!seen[present[j].branch]) { seen[present[j].branch] = 1; distinct.push(present[j].branch); } }
      crossChart = false;
      var hasA = false, hasB = false;
      for (j = 0; j < present.length; j++) { p = present[j]; if (p.from === 'A') hasA = true; if (p.from === 'B') hasB = true; }
      crossChart = hasA && hasB;
      if (!crossChart) continue;
      if (distinct.length === 3) trinesFull.push({ element: BRANCH_TRINE[i].element, elementEn: BRANCH_TRINE[i].elementEn, members: present });
      else if (distinct.length === 2) trinesHalf.push({ element: BRANCH_TRINE[i].element, elementEn: BRANCH_TRINE[i].elementEn, branches: distinct, holders: present });
    }

    var yai = BRANCHES.indexOf(a.yearBranch), ybi = BRANCHES.indexOf(b.yearBranch);
    var zodiac = {
      a: { branch: a.yearBranch, animal: a.animal, animalEn: a.animalEn },
      b: { branch: b.yearBranch, animal: b.animal, animalEn: b.animalEn },
      relations: branchRelations(a.yearBranch, b.yearBranch)
    };

    var unionElements = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    var keys = ['木','火','土','金','水'], k;
    for (i = 0; i < keys.length; i++) { k = keys[i]; unionElements[k] = (a.fiveElements.stemsBranchesOnly[k] || 0) + (b.fiveElements.stemsBranchesOnly[k] || 0); }

    var counts = { stemCombine: 0, stemClash: 0, sixHe: 0, clash: 0, harm: 0, punishment: 0, halfTrine: 0 };
    for (i = 0; i < stems.length; i++) {
      for (j = 0; j < stems[i].relations.length; j++) {
        if (stems[i].relations[j].type === '天干五合') counts.stemCombine++;
        if (stems[i].relations[j].type === '天干相冲') counts.stemClash++;
      }
    }
    for (i = 0; i < branches.length; i++) {
      for (j = 0; j < branches[i].relations.length; j++) {
        var rt = branches[i].relations[j].type;
        if (rt === '六合') counts.sixHe++;
        if (rt === '六冲') counts.clash++;
        if (rt === '六害') counts.harm++;
        if (rt === '相刑' || rt === '自刑') counts.punishment++;
        if (rt === '半三合') counts.halfTrine++;
      }
    }

    var dayPair = null;
    for (i = 0; i < branches.length; i++) { if (branches[i].aPos === 'day' && branches[i].bPos === 'day') { dayPair = branches[i]; break; } }

    return {
      engineVersion: ENGINE_VERSION,
      a: a, b: b,
      dayMasters: {
        a: dmA, b: dmB,
        aSeesB: { god: aSeesB.god, godEn: aSeesB.godEn, group: aSeesB.group, groupEn: aSeesB.groupLabel },
        bSeesA: { god: bSeesA.god, godEn: bSeesA.godEn, group: bSeesA.group, groupEn: bSeesA.groupLabel },
        sameElement: a.dayElement === b.dayElement, elements: [a.dayElement, b.dayElement]
      },
      stems: stems, branches: branches,
      zodiac: zodiac, trines: { full: trinesFull, half: trinesHalf },
      combinedElements: { a: a.fiveElements.stemsBranchesOnly, b: b.fiveElements.stemsBranchesOnly, union: unionElements },
      counts: counts, dayPair: dayPair,
      conventionNote: {
        crossChartEn: 'Cross-chart interaction is a modern synastry convention; no classical text makes two charts interact. Every relation below is enumerated, none is weighted.',
        noScoreEn: 'No match percentage is given. Any weight or score would be invented, and this site does not invent.'
      }
    };
  }

  // ---------- 喜用神（Favorable Element）v0.6.0 — 与 engine.mjs 逐行对应（R20–R23） ----------
  var BRANCH_SEASON = {
    '寅': 'spring', '卯': 'spring', '辰': 'spring',
    '巳': 'summer', '午': 'summer', '未': 'summer',
    '申': 'autumn', '酉': 'autumn', '戌': 'autumn',
    '亥': 'winter', '子': 'winter', '丑': 'winter'
  };
  var SEASON_EN = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
  var STRENGTH_THRESHOLDS = { strong: 0.55, weak: 0.45 };
  var EL_EN5 = { '木': 'Wood', '火': 'Fire', '土': 'Earth', '金': 'Metal', '水': 'Water' };

  function producerOf(el) {
    for (var k in SHENG) { if (SHENG[k] === el) return k; }
    return null;
  }
  function controllerOf(el) {
    for (var k in KE) { if (KE[k] === el) return k; }
    return null;
  }

  function computeFavorableElement(opts) {
    var C = computeBazi(opts);
    var dm = C.meta.dayMaster;
    var de = C.meta.dayElement;
    var generated = SHENG[de];      // 我生 = 食伤
    var controlled = KE[de];        // 我克 = 财
    var produced = producerOf(de);  // 生我 = 印
    var controls = controllerOf(de); // 克我 = 官杀

    // R20 计分：逐柱逐字，月柱 ×2，日主天干除外
    var perElement = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
    var breakdown = [];
    var POS_ORDER2 = ['year', 'month', 'day', 'time'];
    for (var pi = 0; pi < POS_ORDER2.length; pi++) {
      var pos = POS_ORDER2[pi];
      var p = C.pillars[pos];
      if (!p || !p.ganzhi) continue;
      var boost = pos === 'month' ? 2 : 1;
      if (pos !== 'day') {
        var stem = p.ganzhi[0];
        var el = STEM_ELEMENT[STEMS.indexOf(stem)];
        perElement[el] += 1 * boost;
        breakdown.push({ pos: pos, kind: 'stem', char: stem, element: el, weight: 1 * boost, monthBoosted: boost === 2 });
      }
      var branch = p.ganzhi[1];
      var bEl = BRANCH_ELEMENT[BRANCHES.indexOf(branch)];
      perElement[bEl] += 1 * boost;
      breakdown.push({ pos: pos, kind: 'branch-main-qi', char: branch, element: bEl, weight: 1 * boost, monthBoosted: boost === 2 });
      for (var hi = 0; hi < p.hideGan.length; hi++) {
        var hg = p.hideGan[hi];
        var hEl = STEM_ELEMENT[STEMS.indexOf(hg)];
        perElement[hEl] += 0.5 * boost;
        breakdown.push({ pos: pos, kind: 'branch-hidden', char: hg, element: hEl, weight: 0.5 * boost, monthBoosted: boost === 2 });
      }
    }

    var support = perElement[de] + perElement[produced];
    var drain = perElement[generated] + perElement[controlled] + perElement[controls];
    var total = support + drain;
    var ratio = total > 0 ? support / total : 0;
    var verdict = ratio >= STRENGTH_THRESHOLDS.strong ? 'strong' : ratio <= STRENGTH_THRESHOLDS.weak ? 'weak' : 'balanced';

    // R22 扶抑取用（组顺序固定：身弱 印→比劫；身强 泄→耗→克）
    // ES5 无计算属性名：逐键构造 GROUP_OF / REASON
    var GROUP_OF = {};
    GROUP_OF[produced] = { group: 'resource', cn: '印星', label: 'Resource' };
    GROUP_OF[de] = { group: 'peers', cn: '比劫', label: 'Self & Peers' };
    GROUP_OF[generated] = { group: 'output', cn: '食伤', label: 'Output' };
    GROUP_OF[controlled] = { group: 'wealth', cn: '财星', label: 'Wealth' };
    GROUP_OF[controls] = { group: 'influence', cn: '官杀', label: 'Influence' };
    var REASON = { weak: {}, strong: {} };
    REASON.weak[produced] = EL_EN5[produced] + ' produces ' + EL_EN5[de] + ' — it feeds a weak day master';
    REASON.weak[de] = EL_EN5[de] + ' is the day master\'s own phase — peers reinforce a weak day master';
    REASON.strong[generated] = EL_EN5[de] + ' produces ' + EL_EN5[generated] + ' — it drains a strong day master';
    REASON.strong[controlled] = EL_EN5[de] + ' controls ' + EL_EN5[controlled] + ' — a strong day master spends itself on wealth';
    REASON.strong[controls] = EL_EN5[controls] + ' controls ' + EL_EN5[de] + ' — it disciplines a strong day master';
    var favEls = verdict === 'strong' ? [generated, controlled, controls]
      : verdict === 'weak' ? [produced, de] : [];
    var unfavEls = verdict === 'strong' ? [de, produced]
      : verdict === 'weak' ? [generated, controlled, controls] : [];
    var mk = function (el) {
      return {
        element: el, elementEn: EL_EN5[el],
        group: GROUP_OF[el].group, groupCn: GROUP_OF[el].cn, groupLabel: GROUP_OF[el].label,
        reasonEn: (REASON[verdict] && REASON[verdict][el]) || null
      };
    };
    var favorable = [], unfavorable = [], fi, ui;
    for (fi = 0; fi < favEls.length; fi++) favorable.push(mk(favEls[fi]));
    for (ui = 0; ui < unfavEls.length; ui++) unfavorable.push(mk(unfavEls[ui]));

    // R23 调候简则
    var monthBranch = C.pillars.month.ganzhi[1];
    var season = BRANCH_SEASON[monthBranch];
    var tiaoHou;
    if (season === 'summer') {
      tiaoHou = { applicable: true, element: '水', elementEn: 'Water', rule: 'summer months (Si/Wu/Wei) run hot — the climate school takes Water to moisten', ruleCn: '夏月炎燥，调候取水' };
    } else if (season === 'winter') {
      tiaoHou = { applicable: true, element: '火', elementEn: 'Fire', rule: 'winter months (Hai/Zi/Chou) run cold — the climate school takes Fire to warm', ruleCn: '冬月寒凝，调候取火' };
    } else {
      tiaoHou = { applicable: false, element: null, elementEn: null, rule: 'no season-level climate adjustment in the simplified rule; the classical school consults a per-day-stem, per-month table (Qiong Tong Bao Jian) that cannot be compressed into one line', ruleCn: '春秋月无季节级调候简则；经典调候按日主逐月查表' };
    }

    // 两派对照：调候元素落在用方 = 同判；落在忌方 = 分歧；无调候或不涉及 = 不适用
    var agree = null;
    if (tiaoHou.applicable && verdict !== 'balanced') {
      var fHit = false, uHit = false, fx, ux;
      for (fx = 0; fx < favorable.length; fx++) { if (favorable[fx].element === tiaoHou.element) fHit = true; }
      for (ux = 0; ux < unfavorable.length; ux++) { if (unfavorable[ux].element === tiaoHou.element) uHit = true; }
      if (fHit) agree = true; else if (uHit) agree = false;
    }
    var synthesisNote = null;
    if (agree === true) synthesisNote = 'Both schools point the same way on ' + EL_EN5[tiaoHou.element] + '.';
    else if (agree === false) synthesisNote = 'The two schools disagree: the balance school wants ' + EL_EN5[favorable[0].element] + ', the climate school wants ' + EL_EN5[tiaoHou.element] + '. Both readings are shown; this site does not break the tie.';
    else if (agree === null && tiaoHou.applicable && verdict === 'balanced') synthesisNote = 'The day master is balanced, so the balance school gives no direction; the climate school takes ' + EL_EN5[tiaoHou.element] + '.';

    return {
      engineVersion: ENGINE_VERSION,
      dayMaster: { stem: dm, stemEn: C.meta.dayMasterEn, element: de, elementEn: EL_EN5[de], polarity: (STEMS.indexOf(dm) % 2 === 0 ? 'yang' : 'yin') },
      chart: { year: C.pillars.year.ganzhi, month: C.pillars.month.ganzhi, day: C.pillars.day.ganzhi, time: C.pillars.time ? C.pillars.time.ganzhi : null },
      monthBranch: monthBranch, monthBranchEn: BRANCH_EN[BRANCHES.indexOf(monthBranch)],
      season: season, seasonEn: SEASON_EN[season], unknownTime: !!C.input.unknownTime,
      score: { perElement: perElement, breakdown: breakdown, support: support, drain: drain, total: total, ratio: ratio, thresholds: STRENGTH_THRESHOLDS, verdict: verdict, verdictEn: verdict === 'strong' ? 'Strong day master' : verdict === 'weak' ? 'Weak day master' : 'Balanced day master', verdictCn: verdict === 'strong' ? '身强' : verdict === 'weak' ? '身弱' : '中和' },
      fuYang: { method: 'support & suppress (扶抑)', favorable: favorable, unfavorable: unfavorable },
      tiaoHou: (function (t) { t.method = 'climate adjustment (调候)'; return t; })(tiaoHou),
      synthesis: { agree: agree, noteEn: synthesisNote },
      fiveElements: C.fiveElements,
      conventionNote: {
        scoringEn: 'Strength here is a weighted tally: every visible stem scores 1, every branch scores its main qi 1 plus 0.5 per hidden stem (the same half-weight convention as the five-element counts), and the month pillar counts double. Practitioners who also weigh roots, combinations and clashes by hand may reach a different verdict — the weights, not a black box, are published.',
        noLuckEn: 'No luck percentage, no gemstone, no colour prescription. The favorable element is the output of two published rules, shown with their disagreement.'
      }
    };
  }

  // ============================================================
  // R27/R28/R29 十二地支属性 + 三个族剖面（v0.8.0）—— 与 engine.mjs 逐行对应
  // ============================================================
  var ELEMENT_EN = { '木': 'Wood', '火': 'Fire', '土': 'Earth', '金': 'Metal', '水': 'Water' };
  var BRANCH_POLARITY = BRANCHES.map(function (s, i) { return i % 2 === 0 ? '阳' : '阴'; });

  var BRANCH_DIR_CN = ['北', '东北', '东北', '东', '东南', '东南', '南', '西南', '西南', '西', '西北', '西北'];
  var BRANCH_DIR_EN = ['North', 'Northeast', 'Northeast', 'East', 'Southeast', 'Southeast', 'South', 'Southwest', 'Southwest', 'West', 'Northwest', 'Northwest'];
  var BRANCH_JIE = ['大雪', '小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬'];

  var BRANCH_MEETING = [
    { branches: ['寅', '卯', '辰'], element: '木', elementEn: 'Wood', dirCn: '东方', dirEn: 'East' },
    { branches: ['巳', '午', '未'], element: '火', elementEn: 'Fire', dirCn: '南方', dirEn: 'South' },
    { branches: ['申', '酉', '戌'], element: '金', elementEn: 'Metal', dirCn: '西方', dirEn: 'West' },
    { branches: ['亥', '子', '丑'], element: '水', elementEn: 'Water', dirCn: '北方', dirEn: 'North' }
  ];

  function branchHourRange(bi) {
    function two(n) { return (n < 10 ? '0' : '') + n; }
    var start = (23 + 2 * bi) % 24, end = (start + 2) % 24;
    return { start: start, end: end, text: two(start) + ':00–' + two(end) + ':00' };
  }

  // ---------- R27 十二地支剖面 ----------
  function branchProfile(branch) {
    var bi = BRANCHES.indexOf(branch);
    if (bi < 0) return null;
    var element = BRANCH_ELEMENT[bi];
    var hidden = BRANCH_HIDE_GAN[branch].map(function (g, pos) {
      var gi = STEMS.indexOf(g);
      return {
        gan: g, ganEn: STEMS_EN[gi], element: STEM_ELEMENT[gi], polarity: STEM_POLARITY[gi],
        pos: pos === 0 ? 'main' : pos === 1 ? 'middle' : 'residual',
        posCn: pos === 0 ? '本气' : pos === 1 ? '中气' : '余气'
      };
    });
    var trine = BRANCH_TRINE.filter(function (t) { return t.branches.indexOf(branch) >= 0; })[0];
    var meeting = BRANCH_MEETING.filter(function (t) { return t.branches.indexOf(branch) >= 0; })[0];
    var sixHe = BRANCH_SIX_HE[branch];
    var sixHeKey = [branch, sixHe].sort().join('');
    var clashB = BRANCH_CLASH[branch], harmB = BRANCH_HARM[branch];
    var punishGroups = PUNISH_GROUPS.filter(function (g) { return g.branches.indexOf(branch) >= 0; }).map(function (g) {
      return { kind: g.kind, kindEn: g.kindEn, members: g.branches.slice(),
               peers: g.branches.filter(function (b) { return b !== branch; }) };
    });
    var stageOf = STEMS.map(function (s, si) {
      var st = twelveStage(s, branch);
      return { gan: s, ganEn: STEMS_EN[si], polarity: STEM_POLARITY[si], element: STEM_ELEMENT[si],
               stage: st.stage, stageEn: st.stageEn, stageIndex: st.index };
    });
    var jie = BRANCH_JIE[bi];
    return {
      branch: branch, index: bi, element: element, elementEn: ELEMENT_EN[element], polarity: BRANCH_POLARITY[bi],
      branchEn: BRANCH_EN[bi], animalCn: BRANCH_ANIMAL[bi], animalEn: BRANCH_ANIMAL_EN[bi],
      dirCn: BRANCH_DIR_CN[bi], dirEn: BRANCH_DIR_EN[bi],
      hour: branchHourRange(bi), month: ((bi + 10) % 12) + 1, jie: jie, jieEn: JIE_EN[jie],
      season: BRANCH_SEASON[branch], seasonEn: SEASON_EN[BRANCH_SEASON[branch]],
      hidden: hidden,
      sixHe: { branch: sixHe, branchEn: BRANCH_EN[BRANCHES.indexOf(sixHe)],
               element: SIX_HE_ELEMENT[sixHeKey], elementEn: ELEMENT_EN[SIX_HE_ELEMENT[sixHeKey]] },
      clash: { branch: clashB, branchEn: BRANCH_EN[BRANCHES.indexOf(clashB)] },
      harm: { branch: harmB, branchEn: BRANCH_EN[BRANCHES.indexOf(harmB)] },
      trine: { element: trine.element, elementEn: trine.elementEn, members: trine.branches.slice(),
               peers: trine.branches.filter(function (b) { return b !== branch; }) },
      meeting: { element: meeting.element, elementEn: meeting.elementEn, dirCn: meeting.dirCn, dirEn: meeting.dirEn,
                 members: meeting.branches.slice(), peers: meeting.branches.filter(function (b) { return b !== branch; }) },
      punishGroups: punishGroups, selfPunish: SELF_PUNISH.indexOf(branch) >= 0,
      stageOf: stageOf, pillars: JIAZI.filter(function (gz) { return gz[1] === branch; })
    };
  }

  // ---------- R28 十二长生剖面 ----------
  function stageProfile(index) {
    if (typeof index !== 'number' || index % 1 !== 0 || index < 0 || index > 11) return null;
    var stageCn = STAGE_NAMES[index], stageEn = STAGE_EN[index];
    var rows = STEMS.map(function (s, si) {
      var yang = si % 2 === 0;
      var sbi = BRANCHES.indexOf(STAGE_START_BRANCH[s]);
      var bi = yang ? (sbi + index) % 12 : ((sbi - index) % 12 + 12) % 12;
      var b = BRANCHES[bi];
      var st = twelveStage(s, b);
      return {
        gan: s, ganEn: STEMS_EN[si], polarity: STEM_POLARITY[si], element: STEM_ELEMENT[si],
        branch: b, branchEn: BRANCH_EN[bi], animalCn: BRANCH_ANIMAL[bi], animalEn: BRANCH_ANIMAL_EN[bi],
        yangDirection: yang, startBranch: STAGE_START_BRANCH[s],
        startBranchEn: BRANCH_EN[BRANCHES.indexOf(STAGE_START_BRANCH[s])],
        stageIndex: st.index, verified: st.stage === stageCn
      };
    });
    var pillars = [];
    for (var i = 0; i < 60; i++) {
      var gz = JIAZI[i];
      if (twelveStage(gz[0], gz[1]).stage === stageCn) {
        pillars.push({ gz: gz, stemIdx: STEMS.indexOf(gz[0]), branchIdx: BRANCHES.indexOf(gz[1]) });
      }
    }
    return { index: index, stageCn: stageCn, stageEn: stageEn, rows: rows, pillars: pillars,
             yangRows: rows.filter(function (r) { return r.yangDirection; }),
             yinRows: rows.filter(function (r) { return !r.yangDirection; }) };
  }

  // ---------- R29 十神 × 柱位剖面 ----------
  var PILLAR_POS = [
    { id: 'year', cn: '年柱', en: 'Year Pillar', palaceCn: '祖上与早年环境宫', palaceEn: 'ancestry & early environment' },
    { id: 'month', cn: '月柱', en: 'Month Pillar', palaceCn: '父母与事业环境宫', palaceEn: 'career environment & upbringing' },
    { id: 'hour', cn: '时柱', en: 'Hour Pillar', palaceCn: '子女与晚景宫', palaceEn: 'children & later life' }
  ];
  var TEN_GOD_ORDER = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];

  function tenGodPillarProfile(god, pos) {
    if (TEN_GOD_ORDER.indexOf(god) < 0) return null;
    var posDef = PILLAR_POS.filter(function (p) { return p.id === pos; })[0];
    if (!posDef) return null;
    var rows = STEMS.map(function (dg, di) {
      var gan = STEMS.filter(function (g) { return tenGodOf(dg, g) === god; })[0];
      var d = deriveTenGod(dg, gan);
      var gi = STEMS.indexOf(gan);
      return {
        dayGan: dg, dayGanEn: STEMS_EN[di], dayElement: STEM_ELEMENT[di], dayPolarity: STEM_POLARITY[di],
        gan: gan, ganEn: STEMS_EN[gi], ganElement: STEM_ELEMENT[gi], ganPolarity: STEM_POLARITY[gi],
        god: d.god, godEn: d.godEn, group: d.group, groupLabel: d.groupLabel, groupCn: d.groupCn,
        relation: d.relation, samePolarity: d.samePolarity
      };
    });
    return { god: god, godEn: rows[0].godEn, group: rows[0].group, groupLabel: rows[0].groupLabel,
             groupCn: rows[0].groupCn, relation: rows[0].relation, pos: pos, posDef: posDef, rows: rows };
  }

  // ============================================================
  // R30 流年 / 生肖层（v0.9.0）—— 与 engine.mjs 逐行对应
  // 生肖与年柱的换柱线是「立春」，不是元旦、也不是农历正月初一。
  // 立春是天文时刻，浏览器不能带历法库，所以整张表逐字复制（与 JIAZI/NAYIN 同法），
  // 由 test-web-engine.mjs 的 JSON 字节相等断言锁死两张表一致。
  // ============================================================

  var LICHUN_FROM = 1900;   // 表首年份
  var LICHUN = [   // index = year - LICHUN_FROM；每项 'MMDDHHmm'（北京时间）
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

  function lichunOf(year) {
    var i = year - LICHUN_FROM;
    if (i < 0 || i >= LICHUN.length) return null;
    var s = LICHUN[i];
    return {
      year: year,
      month: +s.slice(0, 2), day: +s.slice(2, 4), hour: +s.slice(4, 6), minute: +s.slice(6, 8),
      text: year + '-' + s.slice(0, 2) + '-' + s.slice(2, 4) + ' ' + s.slice(4, 6) + ':' + s.slice(6, 8),
      dateText: year + '-' + s.slice(0, 2) + '-' + s.slice(2, 4)
    };
  }

  // 年柱：公历年 Y 的立春起，年柱为六十甲子第 (Y - 1984) 位。1984 = 甲子。
  function yearGanzhiIndex(year) {
    return (((year - 1984) % 60) + 60) % 60;
  }
  function yearGanzhi(year) {
    var i = yearGanzhiIndex(year);
    return STEMS[i % 10] + BRANCHES[i % 12];
  }
  // 生肖 = 年支。索引与地支一致（0 = 子鼠 … 11 = 亥猪）。
  function zodiacIndexForYear(year) {
    return (((year - 1984) % 12) + 12) % 12;
  }

  // 生肖换柱：按立春的**时刻**比较，精确到分钟，不是按日比较。
  function zodiacIndexFromDateTime(year, month, day, hour, minute) {
    if (hour === undefined) hour = 12;
    if (minute === undefined) minute = 0;
    var lc = lichunOf(year);
    if (!lc) return null;
    var stamp = month * 1000000 + day * 10000 + hour * 100 + minute;
    var line = lc.month * 1000000 + lc.day * 10000 + lc.hour * 100 + lc.minute;
    return zodiacIndexForYear(stamp < line ? year - 1 : year);
  }

  function zodiacYears(bi, from, to) {
    var out = [];
    for (var y = from; y <= to; y++) if (zodiacIndexForYear(y) === bi) out.push(y);
    return out;
  }

  // 六破表（传统定表）。寅亥同时是六合、巳申同时是六合且三合互含——
  // 各流派对「已合之支是否再论破」有分歧，本站照表全列并在页面声明。
  var BRANCH_BREAK = {
    '子': '酉', '酉': '子', '丑': '辰', '辰': '丑', '寅': '亥', '亥': '寅',
    '卯': '午', '午': '卯', '巳': '申', '申': '巳', '未': '戌', '戌': '未'
  };

  // 犯太岁的五种关系：值 / 冲 / 刑 / 害 / 破（可以并存）。
  var TAI_SUI_KINDS = [
    { key: 'zhi', cn: '值太岁', en: 'Own year', noteCn: '生肖与流年地支相同，即本命年', noteEn: 'your animal is the year branch — ben ming nian' },
    { key: 'chong', cn: '冲太岁', en: 'Clash', noteCn: '生肖与流年地支相隔六位', noteEn: 'your branch sits six positions from the year branch' },
    { key: 'xing', cn: '刑太岁', en: 'Punishment', noteCn: '生肖与流年地支同处一个相刑组，或同属自刑之支', noteEn: 'your branch shares a punishment group with the year branch, or both self-punish' },
    { key: 'hai', cn: '害太岁', en: 'Harm', noteCn: '生肖与流年地支构成六害', noteEn: 'your branch forms a six-harm pair with the year branch' },
    { key: 'po', cn: '破太岁', en: 'Break', noteCn: '生肖与流年地支构成六破', noteEn: 'your branch forms a six-break pair with the year branch' }
  ];

  function taiSuiRelations(yearBi) {
    var yb = BRANCHES[yearBi];
    if (!yb) return null;
    return BRANCHES.map(function (b, bi) {
      var p = branchProfile(b);
      var kinds = [];
      if (bi === yearBi) kinds.push('zhi');
      if (p.clash.branch === yb) kinds.push('chong');
      if (p.harm.branch === yb) kinds.push('hai');
      if (BRANCH_BREAK[b] === yb) kinds.push('po');
      var inGroup = p.punishGroups.filter(function (g) { return g.peers.indexOf(yb) >= 0; }).length > 0;
      if (inGroup || (p.selfPunish && b === yb)) kinds.push('xing');
      return { bi: bi, branch: b, animalCn: BRANCH_ANIMAL[bi], animalEn: BRANCH_ANIMAL_EN[bi], kinds: kinds };
    });
  }

  function zodiacTaiSuiYears(bi, from, to) {
    var out = [];
    for (var y = from; y <= to; y++) {
      var rel = taiSuiRelations(zodiacIndexForYear(y)).filter(function (r) { return r.bi === bi; })[0];
      if (rel && rel.kinds.length) out.push({ year: y, ganzhi: yearGanzhi(y), kinds: rel.kinds.slice() });
    }
    return out;
  }

  // 五虎遁：年上起月。寅月天干由年干决定——甲己之年丙作首、乙庚之岁戊为头、
  // 丙辛必定寻庚起、丁壬壬位顺行流、戊癸之年甲寅求。
  function monthStemIndex(yearStemIndex, monthOrdinal) {
    var first = [2, 4, 6, 8, 0][yearStemIndex % 5];
    return (first + (monthOrdinal - 1)) % 10;
  }

  function yearMonthPillars(year) {
    var ysi = yearGanzhiIndex(year) % 10;
    var out = [];
    for (var k = 0; k < 12; k++) {
      var bi = (k + 2) % 12;                 // 寅 = 2 起，顺行
      var si = monthStemIndex(ysi, k + 1);
      out.push({
        ordinal: k + 1, month: ((bi + 10) % 12) + 1,
        ganzhi: STEMS[si] + BRANCHES[bi], stem: STEMS[si], branch: BRANCHES[bi],
        stemIndex: si, branchIndex: bi, jie: BRANCH_JIE[bi], jieEn: JIE_EN[BRANCH_JIE[bi]]
      });
    }
    return out;
  }

  function yearProfile(year) {
    var gi = yearGanzhiIndex(year);
    var si = gi % 10, bi = gi % 12;
    var gz = STEMS[si] + BRANCHES[bi];
    var ny = nayinOf(gz);
    var relations = taiSuiRelations(bi);
    return {
      year: year, ganzhi: gz, stem: STEMS[si], branch: BRANCHES[bi], stemIndex: si, branchIndex: bi,
      stemEn: STEMS_EN[si], branchEn: BRANCH_EN[bi],
      stemElement: STEM_ELEMENT[si], branchElement: BRANCH_ELEMENT[bi],
      stemPolarity: STEM_POLARITY[si], branchPolarity: BRANCH_POLARITY[bi],
      elementEn: ELEMENT_EN[STEM_ELEMENT[si]],
      nayin: ny.cn, nayinEn: ny.en, nayinPartner: ny.partner,
      zodiacCn: BRANCH_ANIMAL[bi], zodiacEn: BRANCH_ANIMAL_EN[bi],
      jie: BRANCH_JIE[bi], jieEn: JIE_EN[BRANCH_JIE[bi]],
      lichun: lichunOf(year), nextLichun: lichunOf(year + 1),
      relations: relations,
      offenders: relations.filter(function (r) { return r.kinds.length > 0; }),
      months: yearMonthPillars(year)
    };
  }

  // 生肖页与地支页的分工：地支页 = 位置页（藏干/月建/时辰/长生/甲子柱）；
  // 生肖页 = 日历页（公历年表/立春边界/犯太岁年份/与其它生肖的关系）。两页互链。
  function zodiacProfile(bi) {
    if (!(bi >= 0 && bi <= 11)) return null;
    var branch = BRANCHES[bi];
    var p = branchProfile(branch);
    return {
      index: bi, branch: branch, branchEn: p.branchEn,
      animalCn: p.animalCn, animalEn: p.animalEn,
      polarity: p.polarity, element: p.element, elementEn: p.elementEn,
      dirCn: p.dirCn, dirEn: p.dirEn, hour: p.hour, month: p.month, jie: p.jie, jieEn: p.jieEn,
      season: p.season, seasonEn: p.seasonEn, hidden: p.hidden,
      sixHe: p.sixHe, clash: p.clash, harm: p.harm, trine: p.trine, meeting: p.meeting,
      punishGroups: p.punishGroups, selfPunish: p.selfPunish,
      breakBranch: BRANCH_BREAK[branch],
      years: zodiacYears(bi, 1900, 2043),
      pillars: p.pillars
    };
  }


  /* ============================================================
   * R31 六十四卦层（v0.10.0）— 与 engine.mjs 逐行对应
   * 定表来源与 8 组交叉校验见 generate-hexagrams.py；本文件只做移植，
   * 任何数值上的改动都必须先在 engine.mjs 改，再原样搬过来
   * （test-web-engine.mjs 的 R31 段会逐字段对账，不一致直接红）。
   * ============================================================ */

  // 八卦：先天卦序 0..7 = 乾一 兑二 离三 震四 巽五 坎六 艮七 坤八（与 Unicode U+2630+i 一致）
  var TRI = ['乾','兑','离','震','巽','坎','艮','坤'];
  var TRI_PY = ['Qian','Dui','Li','Zhen','Xun','Kan','Gen','Kun'];
  var TRI_IMG = ['天','泽','火','雷','风','水','山','地'];
  var TRI_IMG_EN = ['Heaven','Lake','Fire','Thunder','Wind','Water','Mountain','Earth'];
  var TRI_GLYPH = ['☰','☱','☲','☳','☴','☵','☶','☷'];
  var TRI_ELEMENT = ['金','金','火','木','木','水','土','土'];
  var TRI_VALUE = [7,3,5,1,6,2,4,0];
  var TRI_FAMILY = ['父','少女','中女','长男','长女','中男','少男','母'];
  var TRI_FAMILY_EN = ['Father','Youngest Daughter','Middle Daughter','Eldest Son','Eldest Daughter','Middle Son','Youngest Son','Mother'];
  var TRI_DIR = ['西北','西','南','东','东南','北','东北','西南'];
  var TRI_DIR_EN = ['Northwest','West','South','East','Southeast','North','Northeast','Southwest'];
  var TRI_YANG = [1,0,0,1,0,1,1,0];

  var NAJIA_STEM_IN  = ['甲','丁','己','庚','辛','戊','丙','乙'];
  var NAJIA_STEM_OUT = ['壬','丁','己','庚','辛','戊','丙','癸'];
  var NAJIA_IN_START  = [0,5,3,0,1,2,4,7];
  var NAJIA_OUT_START = [6,11,9,6,7,8,10,1];

  var HEX_CN = ['乾','坤','屯','蒙','需','讼','师','比','小畜','履','泰','否','同人','大有','谦','豫','随','蛊','临','观','噬嗑','贲','剥','复','无妄','大畜','颐','大过','坎','离','咸','恒','遁','大壮','晋','明夷','家人','睽','蹇','解','损','益','夬','姤','萃','升','困','井','革','鼎','震','艮','渐','归妹','丰','旅','巽','兑','涣','节','中孚','小过','既济','未济'];
  var HEX_PY = ['Qian','Kun','Zhun','Meng','Xu','Song','Shi','Bi','Xiao Xu','Lv','Tai','Pi','Tong Ren','Da You','Qian','Yu','Sui','Gu','Lin','Guan','Shi He','Bi','Bo','Fu','Wu Wang','Da Xu','Yi','Da Guo','Kan','Li','Xian','Heng','Dun','Da Zhuang','Jin','Ming Yi','Jia Ren','Kui','Jian','Xie','Sun','Yi','Guai','Gou','Cui','Sheng','Kun','Jing','Ge','Ding','Zhen','Gen','Jian','Gui Mei','Feng','Lv','Xun','Dui','Huan','Jie','Zhong Fu','Xiao Guo','Ji Ji','Wei Ji'];
  var HEX_EN = ['The Creative','The Receptive','Difficulty at the Beginning','Youthful Folly','Waiting','Conflict','The Army','Holding Together','The Taming Power of the Small','Treading','Peace','Standstill','Fellowship with Others','Possession in Great Measure','Modesty','Enthusiasm','Following','Work on What Has Been Spoiled','Approach','Contemplation','Biting Through','Grace','Splitting Apart','Return','Innocence','The Taming Power of the Great','The Corners of the Mouth','Preponderance of the Great','The Abysmal Water','The Clinging Fire','Influence','Duration','Retreat','The Power of the Great','Progress','Darkening of the Light','The Family','Opposition','Obstruction','Deliverance','Decrease','Increase','Breakthrough','Coming to Meet','Gathering Together','Pushing Upward','Oppression','The Well','Revolution','The Cauldron','The Arousing Thunder','Keeping Still Mountain','Development','The Marrying Maiden','Abundance','The Wanderer','The Gentle Wind','The Joyous Lake','Dispersion','Limitation','Inner Truth','Small Preponderance','After Completion','Before Completion'];
  var HEX_UNI = ['THE CREATIVE HEAVEN','THE RECEPTIVE EARTH','DIFFICULTY AT THE BEGINNING','YOUTHFUL FOLLY','WAITING','CONFLICT','THE ARMY','HOLDING TOGETHER','SMALL TAMING','TREADING','PEACE','STANDSTILL','FELLOWSHIP','GREAT POSSESSION','MODESTY','ENTHUSIASM','FOLLOWING','WORK ON THE DECAYED','APPROACH','CONTEMPLATION','BITING THROUGH','GRACE','SPLITTING APART','RETURN','INNOCENCE','GREAT TAMING','MOUTH CORNERS','GREAT PREPONDERANCE','THE ABYSMAL WATER','THE CLINGING FIRE','INFLUENCE','DURATION','RETREAT','GREAT POWER','PROGRESS','DARKENING OF THE LIGHT','THE FAMILY','OPPOSITION','OBSTRUCTION','DELIVERANCE','DECREASE','INCREASE','BREAKTHROUGH','COMING TO MEET','GATHERING TOGETHER','PUSHING UPWARD','OPPRESSION','THE WELL','REVOLUTION','THE CAULDRON','THE AROUSING THUNDER','THE KEEPING STILL MOUNTAIN','DEVELOPMENT','THE MARRYING MAIDEN','ABUNDANCE','THE WANDERER','THE GENTLE WIND','THE JOYOUS LAKE','DISPERSION','LIMITATION','INNER TRUTH','SMALL PREPONDERANCE','AFTER COMPLETION','BEFORE COMPLETION'];
  var HEX_UPPER = [0,7,5,6,5,0,7,5,4,0,7,0,0,2,7,3,1,6,7,4,2,6,6,7,0,6,6,1,5,2,1,3,0,3,2,7,4,2,5,3,6,4,1,0,1,7,1,5,1,2,3,6,4,3,3,2,4,1,4,5,4,3,5,2];
  var HEX_LOWER = [0,7,3,5,0,5,5,7,0,1,0,7,2,0,6,7,3,4,1,7,3,2,7,3,3,0,3,4,5,2,6,4,6,0,7,2,2,1,6,5,1,3,0,4,7,4,5,4,2,4,3,6,6,1,2,6,4,1,5,1,1,6,2,5];

  var GONG_ORDER = [0,5,6,3,4,2,7,1];
  var GONG_OF = [0,6,1,5,6,5,1,6,4,2,6,0,5,0,7,3,3,4,6,0,4,2,0,6,4,2,4,3,1,5,7,3,0,6,0,1,4,2,7,3,2,4,6,0,7,3,7,3,1,5,3,2,2,7,1,5,4,7,5,1,2,7,1,5];
  var GONG_STAGE = [0,0,2,4,6,6,7,7,1,5,3,3,7,7,5,1,7,7,2,4,5,1,5,1,4,2,6,6,0,0,3,3,2,4,6,6,2,4,4,2,3,3,5,1,2,4,1,5,4,2,0,0,7,7,5,1,0,0,5,1,6,6,3,3];
  var GONG_LABEL = ['六世','一世','二世','三世','四世','五世','游魂','归魂'];
  var GONG_LABEL_EN = ['Pure','First','Second','Third','Fourth','Fifth','Wandering','Returning'];
  var SHI_POS = [6,1,2,3,4,5,4,3];
  var YING_POS = [3,4,5,6,1,2,1,6];
  var HEX_SELF_REVERSING = [1,27,29,61];
  var HEX_PURE = [1,2,29,30,51,52,57,58];
  var SIX_SPIRITS = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
  var SIX_SPIRITS_EN = ['Azure Dragon','Vermilion Bird','Gouchen','Flying Serpent','White Tiger','Black Tortoise'];
  var SPIRIT_START_BY_STEM = [0,0,1,1,2,3,4,4,5,5];

  var HEX_BY_VALUE = (function () {
    var a = [];
    for (var n = 1; n <= 64; n++) a[TRI_VALUE[HEX_LOWER[n - 1]] | (TRI_VALUE[HEX_UPPER[n - 1]] << 3)] = n;
    return a;
  })();

  var HEXAGRAM_COUNT = 64;
  var TRIGRAM_COUNT = 8;

  function hexGlyph(n) { return String.fromCharCode(0x4DC0 + n - 1); }
  function triGlyph(ti) { return TRI_GLYPH[ti]; }
  function hexLines(n) {
    if (!(n >= 1 && n <= 64)) return null;
    var v = TRI_VALUE[HEX_LOWER[n - 1]] | (TRI_VALUE[HEX_UPPER[n - 1]] << 3);
    var out = [];
    for (var i = 0; i < 6; i++) out.push((v >> i) & 1);
    return out;
  }
  function hexValueOf(n) { return TRI_VALUE[HEX_LOWER[n - 1]] | (TRI_VALUE[HEX_UPPER[n - 1]] << 3); }
  function hexBinaryIndex(n) { return hexValueOf(n) + 1; }
  function hexFromBinaryIndex(k) { return HEX_BY_VALUE[k - 1] || 0; }
  function hexFullCn(n) {
    var i = n - 1, u = HEX_UPPER[i], l = HEX_LOWER[i];
    return u === l ? HEX_CN[i] + '为' + TRI_IMG[u] : TRI_IMG[u] + TRI_IMG[l] + HEX_CN[i];
  }
  function triYangCount(ti) { var c = 0, v = TRI_VALUE[ti]; for (var i = 0; i < 3; i++) if ((v >> i) & 1) c++; return c; }

  function cuoHex(n) { return hexFromBinaryIndex((hexValueOf(n) ^ 63) + 1); }
  function zongHex(n) {
    var v = hexValueOf(n), r = 0;
    for (var i = 0; i < 6; i++) if ((v >> i) & 1) r |= 1 << (5 - i);
    return hexFromBinaryIndex(r + 1);
  }
  function huHex(n) {
    var L = hexLines(n);
    var lo = L[1] | (L[2] << 1) | (L[3] << 2);
    var up = L[2] | (L[3] << 1) | (L[4] << 2);
    return hexFromBinaryIndex(((up << 3) | lo) + 1);
  }

  function najiaOf(n) {
    if (!(n >= 1 && n <= 64)) return null;
    var u = HEX_UPPER[n - 1], l = HEX_LOWER[n - 1];
    var out = [], k, t, bi;
    for (k = 0; k < 3; k++) {
      t = l;
      bi = (((NAJIA_IN_START[t] + (TRI_YANG[t] ? 2 * k : -2 * k)) % 12) + 12) % 12;
      out.push({ pos: k + 1, inner: true, stem: NAJIA_STEM_IN[t], stemIndex: STEMS.indexOf(NAJIA_STEM_IN[t]), branch: BRANCHES[bi], branchIndex: bi, ganzhi: NAJIA_STEM_IN[t] + BRANCHES[bi] });
    }
    for (k = 0; k < 3; k++) {
      t = u;
      bi = (((NAJIA_OUT_START[t] + (TRI_YANG[t] ? 2 * k : -2 * k)) % 12) + 12) % 12;
      out.push({ pos: k + 4, inner: false, stem: NAJIA_STEM_OUT[t], stemIndex: STEMS.indexOf(NAJIA_STEM_OUT[t]), branch: BRANCHES[bi], branchIndex: bi, ganzhi: NAJIA_STEM_OUT[t] + BRANCHES[bi] });
    }
    return out;
  }

  function liuQinOf(gongElement, branchIndex) {
    var e = BRANCH_ELEMENT[branchIndex];
    if (e === gongElement) return '兄弟';
    if (SHENG[gongElement] === e) return '子孙';
    if (SHENG[e] === gongElement) return '父母';
    if (KE[e] === gongElement) return '官鬼';
    return '妻财';
  }
  function sixSpiritsOfDayStem(stemIndex) {
    var s = SPIRIT_START_BY_STEM[stemIndex];
    var out = [];
    for (var k = 0; k < 6; k++) { var i = (s + k) % 6; out.push({ pos: k + 1, cn: SIX_SPIRITS[i], en: SIX_SPIRITS_EN[i] }); }
    return out;
  }

  function hexagonsInGong(gi) {
    var out = [];
    for (var n = 1; n <= 64; n++) if (GONG_OF[n - 1] === gi) out.push(n);
    return out;
  }
  function hexagonsWithTrigram(ti, where) {
    var arr = where === 'lower' ? HEX_LOWER : HEX_UPPER;
    var out = [];
    for (var n = 1; n <= 64; n++) if (arr[n - 1] === ti) out.push(n);
    return out;
  }

  function triView(t) {
    return {
      index: t, cn: TRI[t], py: TRI_PY[t], img: TRI_IMG[t], imgEn: TRI_IMG_EN[t], glyph: TRI_GLYPH[t],
      element: TRI_ELEMENT[t], elementEn: ELEMENT_EN[TRI_ELEMENT[t]], value: TRI_VALUE[t],
      yang: !!TRI_YANG[t], yangCount: triYangCount(t), family: TRI_FAMILY[t], familyEn: TRI_FAMILY_EN[t],
      dir: TRI_DIR[t], dirEn: TRI_DIR_EN[t]
    };
  }

  function hexagramProfile(n) {
    if (!(n >= 1 && n <= 64)) return null;
    var i = n - 1;
    var u = HEX_UPPER[i], l = HEX_LOWER[i];
    var gi = GONG_OF[i], st = GONG_STAGE[i];
    var gongTri = GONG_ORDER[gi];
    var gongElement = TRI_ELEMENT[gongTri];
    var raw = najiaOf(n), najia = [], k, x;
    for (k = 0; k < raw.length; k++) {
      x = raw[k];
      najia.push({
        pos: x.pos, inner: x.inner, stem: x.stem, stemIndex: x.stemIndex, branch: x.branch, branchIndex: x.branchIndex, ganzhi: x.ganzhi,
        branchElement: BRANCH_ELEMENT[x.branchIndex], branchElementEn: ELEMENT_EN[BRANCH_ELEMENT[x.branchIndex]],
        liuqin: liuQinOf(gongElement, x.branchIndex)
      });
    }
    var brs = [], dbr = [], jz = [];
    for (k = 0; k < najia.length; k++) {
      brs.push(najia[k].branch);
      if (dbr.indexOf(najia[k].branch) < 0) dbr.push(najia[k].branch);
      if (JIAZI.indexOf(najia[k].ganzhi) >= 0) jz.push(najia[k].ganzhi);
    }
    var lines = hexLines(n);
    return {
      n: n, cn: HEX_CN[i], py: HEX_PY[i], en: HEX_EN[i], unicodeName: HEX_UNI[i],
      glyph: hexGlyph(n), fullCn: hexFullCn(n),
      upper: triView(u), lower: triView(l),
      lines: lines, lineStr: lines.join(''),
      binaryIndex: hexBinaryIndex(n),
      pure: HEX_PURE.indexOf(n) >= 0,
      selfReversing: HEX_SELF_REVERSING.indexOf(n) >= 0,
      palace: {
        index: gi, trigram: TRI[gongTri], trigramPy: TRI_PY[gongTri], glyph: TRI_GLYPH[gongTri],
        element: gongElement, elementEn: ELEMENT_EN[gongElement],
        stage: st, stageCn: GONG_LABEL[st], stageEn: GONG_LABEL_EN[st],
        shi: SHI_POS[st], ying: YING_POS[st], members: hexagonsInGong(gi)
      },
      najia: najia,
      najiaBranches: brs, distinctBranches: dbr,
      cuo: cuoHex(n), zong: zongHex(n), hu: huHex(n),
      upperSiblings: hexagonsWithTrigram(u, 'upper'),
      lowerSiblings: hexagonsWithTrigram(l, 'lower'),
      jiaziHits: jz
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

  var SS_LU = ['寅','卯','巳','午','巳','午','申','酉','亥','子'];
  var SS_YANG_REN = ['卯','','午','','午','','酉','','子',''];
  var SS_YIN_REN = ['','寅','','巳','','巳','','申','','亥'];
  var SS_NOBLEMAN = ['丑未','子申','亥酉','亥酉','丑未','子申','丑未','午寅','卯巳','卯巳'];
  var SS_NOBLEMAN_ALT = ['丑未','子申','亥酉','亥酉','丑未','子申','寅午','寅午','卯巳','卯巳'];
  var SS_WENCHANG = ['巳','午','申','酉','申','酉','亥','子','寅','卯'];
  var SS_TAIJI = ['子午','子午','卯酉','卯酉','辰戌丑未','辰戌丑未','寅亥','寅亥','巳申','巳申'];
  var SS_GUOYIN = ['戌','亥','丑','寅','丑','寅','辰','巳','未','申'];
  var SS_FUXING = ['寅子','丑卯','寅子','亥','申','未','午','巳','辰','丑卯'];
  var SS_JINYU = ['辰','巳','未','申','未','申','戌','亥','丑','寅'];
  var SS_KONGWANG = ['戌亥','申酉','午未','辰巳','寅卯','子丑'];
  var SS_SHI_E = ['甲辰','乙巳','壬申','丙申','丁亥','庚辰','戊戌','癸亥','辛巳','己丑'];
  var SS_KUIGANG = ['壬辰','庚戌','庚辰','戊戌'];
  var SS_CHACUO = ['丙子','丁丑','戊寅','辛卯','壬辰','癸巳','丙午','丁未','戊申','辛酉','壬戌','癸亥'];
  var SS_TIANSH = ['戊寅','甲午','戊申','甲子'];
  var SS_HONGLUAN = ['卯','寅','丑','子','亥','戌','酉','申','未','午','巳','辰'];
  var SS_TIANDOCTOR = ['丑','寅','卯','辰','巳','午','未','申','酉','戌','亥','子'];
  var SS_XUEREN = ['丑','未','寅','申','卯','酉','辰','戌','巳','亥','午','子'];
  var SS_TIANDI = ['丁','申','壬','辛','亥','甲','癸','寅','丙','乙','巳','庚'];
  var SS_TRINE_STAR = {
    taohua:    { '寅午戌':'卯','申子辰':'酉','巳酉丑':'午','亥卯未':'子' },
    yima:      { '寅午戌':'申','申子辰':'寅','巳酉丑':'亥','亥卯未':'巳' },
    huagai:    { '寅午戌':'戌','申子辰':'辰','巳酉丑':'丑','亥卯未':'未' },
    jiangxing: { '寅午戌':'午','申子辰':'子','巳酉丑':'酉','亥卯未':'卯' },
    wangshen:  { '寅午戌':'巳','申子辰':'亥','巳酉丑':'申','亥卯未':'寅' },
    jiesha:    { '寅午戌':'亥','申子辰':'巳','巳酉丑':'寅','亥卯未':'申' },
    zaisha:    { '寅午戌':'子','申子辰':'午','巳酉丑':'卯','亥卯未':'酉' }
  };
  var SS_YUEDE = { '寅':'丙','午':'丙','戌':'丙','申':'壬','子':'壬','辰':'壬','巳':'庚','酉':'庚','丑':'庚','亥':'甲','卯':'甲','未':'甲' };
  var SS_GUCHEN = ['寅','寅','巳','巳','巳','申','申','申','亥','亥','亥','寅'];
  var SS_GUASU  = ['戌','戌','丑','丑','丑','辰','辰','辰','未','未','未','戌'];
  var SS_TONGZI = {
    springAutumn: ['寅','子'],      // 春秋月（寅卯辰/申酉戌）日支或时支见
    winterSummer: ['卯','未','辰'], // 冬夏月（亥子丑/巳午未）日支或时支见
    nayin: { '金': ['午','卯'], '木': ['午','卯'], '水': ['酉','戌'], '火': ['酉','戌'], '土': ['辰','巳'] }
  };
  var SS_LUOWANG = {
    tianLuo: { elements: ['火'], branches: ['戌','亥'] },
    diWang:  { elements: ['水','土'], branches: ['辰','巳'] }
  };

  function kongWangOf(jiaziIdx) {
    var xun = Math.floor(jiaziIdx / 10);
    return [(xun * 10 + 10) % 12, (xun * 10 + 11) % 12];
  }
  function kongWangOfDayGz(gz) {
    var i = JIAZI.indexOf(gz);
    if (i < 0) return null;
    var voids = kongWangOf(i);
    return { xunStart: JIAZI[Math.floor(i / 10) * 10], voids: [BRANCHES[voids[0]], BRANCHES[voids[1]]] };
  }
  function shiEDerived() {   // 十恶大败 = 日干禄落本旬空亡（与 SS_SHI_E 互证）
    var out = [];
    for (let k = 0; k < 60; k++) {
      var stem = STEMS[k % 10], branch = BRANCHES[k % 12];
      var voids = SS_KONGWANG[Math.floor(k / 10)];
      if (voids.indexOf(SS_LU[k % 10]) >= 0) out.push(stem + branch);
    }
    return out;
  }

  var SS_DAY_TABLES = {
    nobleman: SS_NOBLEMAN, noblemanAlt: SS_NOBLEMAN_ALT, wenchang: SS_WENCHANG,
    taiji: SS_TAIJI, guoyin: SS_GUOYIN, fuxing: SS_FUXING, jinyu: SS_JINYU,
    lu: null, yangren: null, yinren: null
  };
  function shenshaDayStemBranches(starKey, stemIdx) {
    if (stemIdx < 0 || stemIdx > 9) return [];
    if (starKey === 'lu') return [BRANCHES.indexOf(SS_LU[stemIdx])];
    if (starKey === 'yangren') { var b = SS_YANG_REN[stemIdx]; return b ? [BRANCHES.indexOf(b)] : []; }
    if (starKey === 'yinren')  { var b = SS_YIN_REN[stemIdx];  return b ? [BRANCHES.indexOf(b)] : []; }
    var tbl = SS_DAY_TABLES[starKey];
    if (!tbl) return [];
    return tbl[stemIdx].split('').map(function (b) { return BRANCHES.indexOf(b); });
  }
  function shenshaTrineBranch(starKey, branchIdx) {
    var tbl = SS_TRINE_STAR[starKey];
    if (!tbl || branchIdx < 0 || branchIdx > 11) return -1;
    for (var g in tbl) if (g.indexOf(BRANCHES[branchIdx]) >= 0) return BRANCHES.indexOf(tbl[g]);
    return -1;
  }
  function shenshaMonthBranch(starKey, monthOrdinal) {  // monthOrdinal 0=寅月
    if (monthOrdinal < 0 || monthOrdinal > 11) return -1;
    if (starKey === 'tiandoctor') return (monthOrdinal + 1) % 12;  // 天医=月支-1
    if (starKey === 'xueren') return BRANCHES.indexOf(SS_XUEREN[monthOrdinal]);
    return -1;
  }
  function shenshaYueDeStem(monthBi) {
    for (var g in SS_YUEDE) if (g.indexOf(BRANCHES[monthBi]) >= 0) return SS_YUEDE[g];
    return '';
  }
  function shenshaYueDeHeStem(monthBi) {
    var s = shenshaYueDeStem(monthBi);
    return s ? STEM_COMBINE[s] : '';
  }
  function shenshaTianDeTarget(monthOrdinal) {  // 0=寅月；四维以同支寄宫（申亥寅巳）
    if (monthOrdinal < 0 || monthOrdinal > 11) return null;
    var v = SS_TIANDI[monthOrdinal];
    var si = STEMS.indexOf(v);
    return si >= 0 ? { type: 'stem', idx: si, cn: v } : { type: 'branch', idx: BRANCHES.indexOf(v), cn: v };
  }
  function shenshaHongLuan(yearBi) { return (3 - yearBi + 24) % 12; }
  function shenshaTianXi(yearBi) { return (shenshaHongLuan(yearBi) + 6) % 12; }
  function shenshaBingFu(yearBi) { return (yearBi + 11) % 12; }
  function shenshaGuChen(yearBi) { return BRANCHES.indexOf(SS_GUCHEN[yearBi]); }
  function shenshaGuaSu(yearBi)  { return BRANCHES.indexOf(SS_GUASU[yearBi]); }

  // 官/财/印/食四星：各日干 × 12 支主气（BRANCH_MAIN_QI 藏干首位）的十神归属
  function shenshaTenGodBranches(dayStemIdx, family) {
    // family: 'officer'(官杀) | 'wealth'(财星) | 'seal'(印星) | 'output'(食伤)
    var dayGan = STEMS[dayStemIdx];
    var famMap = {
      officer: ['七杀', '正官'], wealth: ['偏财', '正财'],
      seal: ['偏印', '正印'], output: ['食神', '伤官']
    };
    var target = famMap[family];
    if (!target) return [];
    var rows = [];
    for (let bi = 0; bi < 12; bi++) {
      var mainQi = BRANCH_HIDE_GAN[BRANCHES[bi]][0];
      var god = tenGodOf(dayGan, mainQi);
      if (target.indexOf(god) >= 0) rows.push({ branchIdx: bi, hidden: mainQi, god: god });
    }
    return rows;
  }

  var SS_TIANSH_SEASON = [   // 季（月支组）→ 天赦柱：春寅卯辰/夏巳午未/秋申酉戌/冬亥子丑
    ['寅','卯','辰'], ['巳','午','未'], ['申','酉','戌'], ['亥','子','丑']
  ];
  function shenshaTianShOfDayBranch(monthBi) {
    for (let s = 0; s < 4; s++) if (SS_TIANSH_SEASON[s].indexOf(BRANCHES[monthBi]) >= 0) return SS_TIANSH[s];
    return '';
  }

  // 八字神煞扫描：输入 4 柱干支（年/月/日/时，无时传空串），返回命中清单。
  // 锚点流派：三合组星按 年支、日支 双锚分别标注（起年/起日两派都算，不偷偷选）。
  function shenshaScan(pillars) {
    var gz = pillars || [];
    var branches = gz.map(function (p) { return p ? BRANCHES.indexOf(p.charAt(1)) : -1; });
    var stems = gz.map(function (p) { return p ? STEMS.indexOf(p.charAt(0)) : -1; });
    var di = stems[2], yBi = branches[0], mBi = branches[1], dBi = branches[2];
    var hits = [];
    var whereCn = ['年支', '月支', '日支', '时支'];
    function scanBranches(anchorLabel, biList) {
      return function (key, cn, check) {
        var found = [];
        for (let i = 0; i < 4; i++) {
          if (branches[i] >= 0 && check(i, branches[i])) found.push(i);
        }
        if (found.length) hits.push({ key: key, cn: cn, where: found.map(function (i) { return whereCn[i]; }).join('、'), anchor: anchorLabel });
      };
    }
    // ① 日干起：贵人/文昌/禄/刃/金舆/太极/国印/福星
    if (di >= 0) {
      var dayScan = scanBranches('日干' + STEMS[di], null);
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
    var trineStars = [['taohua','咸池桃花'],['yima','驿马'],['huagai','华盖'],['jiangxing','将星'],['wangshen','亡神'],['jiesha','劫煞'],['zaisha','灾煞']];
    for (let t = 0; t < trineStars.length; t++) {
      var key = trineStars[t][0], cn = trineStars[t][1];
      var anchors = [];
      if (yBi >= 0 && shenshaTrineBranch(key, yBi) >= 0) anchors.push('起年支');
      if (dBi >= 0 && shenshaTrineBranch(key, dBi) >= 0) anchors.push('起日支');
      var found = [];
      for (let i = 0; i < 4; i++) {
        if (branches[i] < 0) continue;
        var byYear = yBi >= 0 && shenshaTrineBranch(key, yBi) === branches[i];
        var byDay = dBi >= 0 && shenshaTrineBranch(key, dBi) === branches[i];
        if (byYear || byDay) found.push(whereCn[i] + (byYear && byDay ? '（年日双起）' : byYear ? '（起年支）' : '（起日支）'));
      }
      if (found.length) hits.push({ key: key, cn: cn, where: found.join('、'), anchor: anchors.join(' / ') || '' });
    }
    // ③ 月支起：天医、血刃、天德、月德
    if (mBi >= 0) {
      var mo = (mBi + 10) % 12;  // 月支索引 → 月序（0=寅月）
      var doc = shenshaMonthBranch('tiandoctor', mo);
      var xue = shenshaMonthBranch('xueren', mo);
      for (let i = 0; i < 4; i++) {
        if (branches[i] === doc) hits.push({ key: 'tiandoctor', cn: '天医', where: whereCn[i], anchor: '月支' + BRANCHES[mBi] });
        if (branches[i] === xue) hits.push({ key: 'xueren', cn: '血刃', where: whereCn[i], anchor: '月支' + BRANCHES[mBi] });
      }
      var td = shenshaTianDeTarget(mo);
      for (let i = 0; i < 4; i++) {
        if (td && td.type === 'stem' && stems[i] === td.idx) hits.push({ key: 'tiande', cn: '天德贵人', where: whereCn[i] + '干', anchor: '月支' + BRANCHES[mBi] });
        if (td && td.type === 'branch' && branches[i] === td.idx) hits.push({ key: 'tiande', cn: '天德贵人', where: whereCn[i], anchor: '月支' + BRANCHES[mBi] });
      }
      var yd = shenshaYueDeStem(mBi), ydh = shenshaYueDeHeStem(mBi);
      for (let i = 0; i < 4; i++) {
        if (stems[i] >= 0 && STEMS[stems[i]] === yd) hits.push({ key: 'yuede', cn: '月德贵人', where: whereCn[i] + '干', anchor: '月支' + BRANCHES[mBi] });
        if (stems[i] >= 0 && STEMS[stems[i]] === ydh) hits.push({ key: 'yuedehe', cn: '月德合', where: whereCn[i] + '干', anchor: '月支' + BRANCHES[mBi] });
      }
    }
    // ④ 年支起：红鸾、天喜、病符、孤辰、寡宿
    if (yBi >= 0) {
      var hl = shenshaHongLuan(yBi), tx = shenshaTianXi(yBi), bf = shenshaBingFu(yBi);
      var gc = shenshaGuChen(yBi), gs = shenshaGuaSu(yBi);
      for (let i = 0; i < 4; i++) {
        if (branches[i] === hl) hits.push({ key: 'hongluan', cn: '红鸾', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
        if (branches[i] === tx) hits.push({ key: 'tianxi', cn: '天喜', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
        if (branches[i] === bf) hits.push({ key: 'bingfu', cn: '病符', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
        if (branches[i] === gc) hits.push({ key: 'guchen', cn: '孤辰', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
        if (branches[i] === gs) hits.push({ key: 'guasu', cn: '寡宿', where: whereCn[i], anchor: '年支' + BRANCHES[yBi] });
      }
    }
    // ⑤ 固定柱表：魁罡 / 阴阳差错 / 十恶大败（以日柱为主，其余柱标注）
    var listStars = [['kuigang','魁罡',SS_KUIGANG],['chacuo','阴阳差错',SS_CHACUO],['shie','十恶大败',SS_SHI_E]];
    for (let L = 0; L < listStars.length; L++) {
      var key = listStars[L][0], cn = listStars[L][1], tbl = listStars[L][2];
      for (let i = 0; i < 4; i++) {
        if (gz[i] && tbl.indexOf(gz[i]) >= 0) {
          hits.push({ key: key, cn: cn, where: whereCn[i] + '柱' + (i === 2 ? '' : '（传统以日柱为主）'), anchor: '' });
        }
      }
    }
    // ⑥ 天赦：月支季组 + 日柱
    if (mBi >= 0 && gz[2]) {
      var ts = shenshaTianShOfDayBranch(mBi);
      if (ts && ts === gz[2]) hits.push({ key: 'tianshe', cn: '天赦', where: '日柱', anchor: '月支' + BRANCHES[mBi] });
    }
    // ⑦ 空亡：日柱所在旬，四支逢之为空
    if (gz[2]) {
      var kw = kongWangOfDayGz(gz[2]);
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
      var mo = (mBi + 10) % 12;
      var season = (mo <= 2 || (mo >= 6 && mo <= 8)) ? 'springAutumn' : 'winterSummer';
      var ny = nayinOf(gz[0]);
      var el = ny ? ny.cn.charAt(ny.cn.length - 1) : '';
      for (let i = 0; i < 4; i++) {
        if (i !== 2 && i !== 3) continue;  // 只看日支、时支
        if (branches[i] >= 0) {
          var b = BRANCHES[branches[i]];
          var hitSeason = SS_TONGZI[season].indexOf(b) >= 0;
          var hitNayin = el && SS_TONGZI.nayin[el] && SS_TONGZI.nayin[el].indexOf(b) >= 0;
          if (hitSeason || hitNayin) {
            hits.push({ key: 'tongzi', cn: '童子煞', where: whereCn[i], anchor: (hitSeason ? season === 'springAutumn' ? '春秋月' : '冬夏月' : '') + (hitSeason && hitNayin ? '+' : '') + (hitNayin ? '年纳音属' + el : '') });
          }
        }
      }
    }
    // ⑨ 天罗地网：日柱纳音五行条件
    if (gz[2]) {
      var ny = nayinOf(gz[2]);
      var el = ny ? ny.cn.charAt(ny.cn.length - 1) : '';
      for (let i = 0; i < 4; i++) {
        if (branches[i] < 0) continue;
        var b = BRANCHES[branches[i]];
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
      var godStars = [['guanxing','官星','officer'],['caixing','财星','wealth'],['yinxing','印星','seal'],['shishenxing','食伤星','output']];
      for (let g = 0; g < godStars.length; g++) {
        var rows = shenshaTenGodBranches(di, godStars[g][2]);
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

  // ============ R36 八宅命卦（v0.12.0） ============
  // 与 engine.mjs R36 段逐行对应：大游年歌定表 + 立春风水年 + 命卦数（余0作9、
  // 余5男寄坤2/女寄艮8）+ 全档案。断言（对称/每行八星/东西不相混/两公式同余）
  // 在 test-web-engine.mjs 落实。
  var KUA_DIRS = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];
  var KUA_DIR_META = {
    '坎': { dirCn: '正北', dirEn: 'North' },
    '艮': { dirCn: '东北', dirEn: 'Northeast' },
    '震': { dirCn: '正东', dirEn: 'East' },
    '巽': { dirCn: '东南', dirEn: 'Southeast' },
    '离': { dirCn: '正南', dirEn: 'South' },
    '坤': { dirCn: '西南', dirEn: 'Southwest' },
    '兑': { dirCn: '正西', dirEn: 'West' },
    '乾': { dirCn: '西北', dirEn: 'Northwest' }
  };
  var KUA_GUA = {
    1: { gua: '坎', py: 'Kan',  elCn: '水', elEn: 'Water',  houseCn: '中男', houseEn: 'Middle Son', group: 'east' },
    2: { gua: '坤', py: 'Kun',  elCn: '土', elEn: 'Earth',  houseCn: '母亲', houseEn: 'Mother',     group: 'west' },
    3: { gua: '震', py: 'Zhen', elCn: '木', elEn: 'Wood',   houseCn: '长男', houseEn: 'Eldest Son', group: 'east' },
    4: { gua: '巽', py: 'Xun',  elCn: '木', elEn: 'Wood',   houseCn: '长女', houseEn: 'Eldest Daughter', group: 'east' },
    6: { gua: '乾', py: 'Qian', elCn: '金', elEn: 'Metal',  houseCn: '父亲', houseEn: 'Father',     group: 'west' },
    7: { gua: '兑', py: 'Dui',  elCn: '金', elEn: 'Metal',  houseCn: '少女', houseEn: 'Youngest Daughter', group: 'west' },
    8: { gua: '艮', py: 'Gen',  elCn: '土', elEn: 'Earth',  houseCn: '少男', houseEn: 'Youngest Son', group: 'west' },
    9: { gua: '离', py: 'Li',   elCn: '火', elEn: 'Fire',   houseCn: '中女', houseEn: 'Middle Daughter', group: 'east' }
  };
  var KUA_STAR_META = {
    '生气': { en: 'Sheng Qi — Growing Qi',     starCn: '贪狼', starEn: 'Tan Lang',  elCn: '木', elEn: 'Wood',   luck: 1 },
    '延年': { en: 'Yan Nian — Longevity',      starCn: '武曲', starEn: 'Wu Qu',     elCn: '金', elEn: 'Metal',  luck: 1 },
    '天医': { en: 'Tian Yi — Heavenly Doctor', starCn: '巨门', starEn: 'Ju Men',    elCn: '土', elEn: 'Earth',  luck: 1 },
    '伏位': { en: 'Fu Wei — Self Seat',        starCn: '辅弼', starEn: 'Fu Bi',     elCn: '木', elEn: 'Wood',   luck: 1 },
    '祸害': { en: 'Huo Hai — Mishap',          starCn: '禄存', starEn: 'Lu Cun',    elCn: '土', elEn: 'Earth',  luck: -1 },
    '六煞': { en: 'Liu Sha — Six Killings',    starCn: '文曲', starEn: 'Wen Qu',    elCn: '水', elEn: 'Water',  luck: -1 },
    '五鬼': { en: 'Wu Gui — Five Ghosts',      starCn: '廉贞', starEn: 'Lian Zhen', elCn: '火', elEn: 'Fire',   luck: -1 },
    '绝命': { en: 'Jue Ming — Life Severed',   starCn: '破军', starEn: 'Po Jun',    elCn: '金', elEn: 'Metal',  luck: -1 }
  };
  var KUA_STAR_OF_CHAR = {
    '生': '生气', '延': '延年', '天': '天医', '伏': '伏位',
    '祸': '祸害', '六': '六煞', '五': '五鬼', '绝': '绝命'
  };
  var KUA_SONG = [
    ['乾', '坎艮震巽离坤兑', '六天五祸绝延生'],
    ['坎', '艮震巽离坤兑乾', '五天生延绝祸六'],
    ['艮', '震巽离坤兑乾坎', '六绝祸生延天五'],
    ['震', '巽离坤兑乾坎艮', '延生祸绝五天六'],
    ['巽', '离坤兑乾坎艮震', '天五六祸生绝延'],
    ['离', '坤兑乾坎艮震巽', '六五绝延祸生天'],
    ['坤', '兑乾坎艮震巽离', '天延绝生祸五六'],
    ['兑', '乾坎艮震巽离坤', '生祸延绝六五天']
  ];
  var KUA_MANSIONS = {};
  for (var _ksi = 0; _ksi < KUA_SONG.length; _ksi++) {
    var _kh = KUA_SONG[_ksi][0], _kd = KUA_SONG[_ksi][1], _kw = KUA_SONG[_ksi][2];
    var _krow = {}; _krow[_kh] = '伏位';
    for (var _kj = 0; _kj < 7; _kj++) _krow[_kd.charAt(_kj)] = KUA_STAR_OF_CHAR[_kw.charAt(_kj)];
    KUA_MANSIONS[_kh] = _krow;
  }
  function kuaFengShuiYear(year, month, day, hour, minute) {
    if (hour === undefined) hour = 12;
    if (minute === undefined) minute = 0;
    var lc = lichunOf(year);
    if (!lc) return null;
    var stamp = month * 1000000 + day * 10000 + hour * 100 + minute;
    var line = lc.month * 1000000 + lc.day * 10000 + lc.hour * 100 + lc.minute;
    return stamp < line ? year - 1 : year;
  }
  function kuaRaw(fsYear, gender) {
    var yy = fsYear % 100;
    var n;
    if (gender === 'male') n = (fsYear < 2000 ? 100 - yy : 99 - yy) % 9;
    else n = (((yy - (fsYear < 2000 ? 4 : -6)) % 9) + 9) % 9;
    return n === 0 ? 9 : n;
  }
  function kuaNumberOf(fsYear, gender) {
    var n = kuaRaw(fsYear, gender);
    return n === 5 ? (gender === 'male' ? 2 : 8) : n;
  }
  function kuaFiveHandled(fsYear, gender) { return kuaRaw(fsYear, gender) === 5; }
  function kuaProfile(year, month, day, gender, hour, minute) {
    var fsYear = kuaFengShuiYear(year, month, day, hour, minute);
    if (!fsYear) return null;
    var kua = kuaNumberOf(fsYear, gender);
    var g = KUA_GUA[kua];
    var row = KUA_MANSIONS[g.gua];
    var guaPy = {};
    for (var _gk in KUA_GUA) guaPy[KUA_GUA[_gk].gua] = KUA_GUA[_gk].py;
    var directions = [];
    for (var _di = 0; _di < KUA_DIRS.length; _di++) {
      var dg = KUA_DIRS[_di];
      var starCn = row[dg];
      var m = KUA_STAR_META[starCn];
      directions.push({
        gua: dg, guaPy: guaPy[dg],
        dirCn: KUA_DIR_META[dg].dirCn, dirEn: KUA_DIR_META[dg].dirEn,
        starCn: starCn, starEn: m.en, starXingCn: m.starCn, starXingEn: m.starEn,
        elCn: m.elCn, elEn: m.elEn, luck: m.luck
      });
    }
    return {
      fsYear: fsYear, fsYearGanzhi: yearGanzhi(fsYear), kua: kua,
      fiveHandled: kuaFiveHandled(fsYear, gender),
      gua: g.gua, guaPy: g.py, elCn: g.elCn, elEn: g.elEn,
      houseCn: g.houseCn, houseEn: g.houseEn,
      group: g.group, groupCn: g.group === 'east' ? '东四命' : '西四命',
      groupEn: g.group === 'east' ? 'East group' : 'West group',
      directions: directions
    };
  }
  // ============ R36 结束 ============

  // ============ R37 每日干支（v0.13.0） ============
  // 与 engine.mjs R37 段逐行对应：建除十二神表 + 月建起顺推 + dailyProfile 组装。
  // 断言（12 官轮转/建⟺同支/破⟺冲月支/lunar 对账）在 test-web-engine.mjs 落实。
  var DAILY_OFFICERS = [
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
    { cn: '闭', en: 'Bi — Close' }
  ];
  function dailyOfficerIndex(monthBranch, dayBranch) {
    var m = BRANCHES.indexOf(monthBranch);
    var d = BRANCHES.indexOf(dayBranch);
    if (m < 0 || d < 0) return -1;
    return (d - m + 12) % 12;
  }
  function dailyOfficer(monthBranch, dayBranch) {
    var i = dailyOfficerIndex(monthBranch, dayBranch);
    if (i < 0) return null;
    return { index: i, cn: DAILY_OFFICERS[i].cn, en: DAILY_OFFICERS[i].en };
  }
  function dailyProfile(year, month, day, hour, minute) {
    if (hour === undefined) hour = 12;
    if (minute === undefined) minute = 0;
    var r = computeBazi({ year: year, month: month, day: day, hour: hour, minute: minute });
    if (!r || !r.pillars) return null;
    var p = r.pillars;
    var dayGz = p.day.ganzhi;
    var monthGz = p.month.ganzhi;
    var monthBranch = monthGz.charAt(1);
    var dayBranch = dayGz.charAt(1);
    var officer = dailyOfficer(monthBranch, dayBranch);
    var dbi = BRANCHES.indexOf(dayBranch);
    var mbi = BRANCHES.indexOf(monthBranch);
    var clashBranch = BRANCH_CLASH[dayBranch];
    var cbi = BRANCHES.indexOf(clashBranch);
    var kw = kongWangOfDayGz(dayGz);
    var ny = nayinOf(dayGz);
    var blk = zhiBlockOf(hour);
    return {
      pillars: { year: p.year.ganzhi, month: monthGz, day: dayGz, hour: p.time.ganzhi },
      dayGz: dayGz, monthGz: monthGz, monthBranch: monthBranch, dayBranch: dayBranch,
      officer: officer,
      isPoDay: officer.index === 6,
      poIsMonthClash: officer.index === 6 && dbi === (mbi + 6) % 12,
      clashBranch: clashBranch, clashAnimalCn: BRANCH_ANIMAL[cbi], clashAnimalEn: BRANCH_ANIMAL_EN[cbi],
      voids: kw.voids, xunStart: kw.xunStart,
      naYinCn: ny.cn, naYinEn: ny.en,
      hourZhi: blk.zhi, hourZhiEn: blk.zhiEn, hourLabel: blk.label,
      hourRange: branchHourRange(zhiBlockIndex(hour)).text
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

var XIU_CN = ['角','亢','氐','房','心','尾','箕','斗','牛','女','虚','危','室','壁','奎','娄','胃','昴','毕','觜','参','井','鬼','柳','星','张','翼','轸'];
var XIU_EN = ['Jiao - Horn','Kang - Neck','Di - Root','Fang - Room','Xin - Heart','Wei - Tail','Ji - Winnowing Basket','Dou - Dipper','Niu - Ox','Nu - Girl','Xu - Emptiness','Wei - Rooftop','Shi - Encampment','Bi - Wall','Kui - Legs','Lou - Bond','Wei - Stomach','Mao - Hairy Head','Bi - Net','Zi - Turtle Beak','Shen - Three Stars','Jing - Well','Gui - Ghost','Liu - Willow','Xing - Star','Zhang - Extended Net','Yi - Wings','Zhen - Chariot'];
var XIU_SEVEN_CN = ['木','金','土','日','月','火','水'];
var XIU_SEVEN_EN = ['Wood','Metal','Earth','Sun','Moon','Fire','Water'];
var XIU_MANSION_CN = ['东方苍龙','北方玄武','西方白虎','南方朱雀'];
var XIU_MANSION_EN = ['Azure Dragon of the East','Black Tortoise of the North','White Tiger of the West','Vermilion Bird of the South'];
// 吉凶：多源多数口径（吉 / 平 / 凶）。源间分歧见 XIU_MARRY 的 mixed 标记。
var XIU_LUCK = ['吉','凶','凶','吉','凶','吉','吉','吉','凶','凶','凶','凶','吉','吉','平','吉','平','平','吉','凶','平','平','凶','凶','平','吉','平','吉'];
var XIU_LUCK_EN = { '吉':'Auspicious', '平':'Mixed', '凶':'Inauspicious' };
// 嫁娶：yes 10 宿 / no 13 宿 / mixed 5 宿（亢斗箕井星——源间冲突或未明指嫁娶）
var XIU_MARRY = ['yes','mixed','no','yes','no','yes','mixed','mixed','no','no','no','no','yes','yes','no','yes','yes','no','yes','no','no','mixed','no','no','mixed','yes','no','yes'];
var XIU_MARRY_DIVERGE = {
  '亢':'Sources disagree: some list it as favourable for marriage, others call it inauspicious; the two readings are both published.',
  '箕':'Most sources rate the mansion auspicious but do not name marriage among its uses.',
  '斗':'Most sources rate the mansion auspicious but do not name marriage among its uses.',
  '井':'Sources disagree: some list marriage as taboo, others treat the mansion as auspicious.',
  '星':'Sources disagree: some list it as favourable for marriage, others as inauspicious.'
};
var XIU_MARRY_DIVERGE_CN = {
  '亢':'源间冲突：部分源列为宜嫁娶，部分源列为凶、忌嫁娶。',
  '箕':'多数源列为吉宿，但宜忌表中未明指嫁娶。',
  '斗':'多数源列为吉宿，但宜忌表中未明指嫁娶。',
  '井':'源间冲突：部分源列为忌嫁娶，部分源列为吉。',
  '星':'源间冲突：部分源列为宜嫁娶，部分源列为凶。'
};

// 十二天神（黄黑道·口诀法）。顺序固定：青龙、明堂、天刑、朱雀、金匮、天德、白虎、玉堂、天牢、玄武、司命、勾陈。
var TIAN_SHEN_CN = ['青龙','明堂','天刑','朱雀','金匮','天德','白虎','玉堂','天牢','玄武','司命','勾陈'];
var TIAN_SHEN_EN = ['Qing Long - Azure Dragon','Ming Tang - Bright Hall','Tian Xing - Heavenly Punishment','Zhu Que - Vermilion Bird','Jin Kui - Golden Coffer','Tian De - Heavenly Virtue','Bai Hu - White Tiger','Yu Tang - Jade Hall','Tian Lao - Heavenly Prison','Xuan Wu - Dark Warrior','Si Ming - Life Controller','Gou Chen - Curled Earth'];
var TIAN_SHEN_GOOD = [true,true,false,false,true,true,false,true,false,false,true,false];
var TIAN_SHEN_START_CN = '寅申起子、卯酉起寅、辰戌起辰、巳亥起午、子午起申、丑未起戌';

// 建除法黄道（歌诀「建满平收黑，除危定执黄，成开皆可用，破闭不相当」）
var JIANCHU_HUANG = [false,true,false,false,true,true,false,true,true,false,true,false];

// 建除十二神 × 嫁娶：grade = preferred / avoid / mixed；weight 为评分增量。
var OFFICER_MARRY = [
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
var WEDDING_WEIGHTS = {
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

function r38Weekday(y, m, d) {
  var w = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();   // 0=周日
  return { index: w, cn: ['日','一','二','三','四','五','六'][w], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][w] };
}

function jdnOfDate(y, m, d) {
  return Math.floor(Date.UTC(y, m - 1, d, 12) / 86400000) + 2440588;
}

// R38.1 二十八宿值日
function xiuOfDate(y, m, d) {
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
function dayTianShenIndex(monthBi, dayBi) {
  if (monthBi < 0 || dayBi < 0) return -1;
  return ((dayBi + 4 - 2 * monthBi) % 12 + 12) % 12;
}

function dayTianShen(monthBranch, dayBranch) {
  var i = dayTianShenIndex(BRANCHES.indexOf(monthBranch), BRANCHES.indexOf(dayBranch));
  if (i < 0) return null;
  return {
    index: i, cn: TIAN_SHEN_CN[i], en: TIAN_SHEN_EN[i],
    good: TIAN_SHEN_GOOD[i], typeCn: TIAN_SHEN_GOOD[i] ? '黄道' : '黑道',
    typeEn: TIAN_SHEN_GOOD[i] ? 'Yellow path' : 'Black path',
    startCn: TIAN_SHEN_START_CN
  };
}

function jianChuHuangDao(officerIndex) {
  if (officerIndex < 0 || officerIndex > 11) return null;
  return JIANCHU_HUANG[officerIndex];
}

function branchTrineOf(a, b) {
  for (var i = 0; i < BRANCH_TRINE.length; i++) {
    var g = BRANCH_TRINE[i].branches;
    if (g.indexOf(a) >= 0 && g.indexOf(b) >= 0) return BRANCH_TRINE[i];
  }
  return null;
}

function punishBetween(a, b) {
  if (a === b && SELF_PUNISH.indexOf(a) >= 0) return true;
  for (var i = 0; i < PUNISH_GROUPS.length; i++) {
    var g = PUNISH_GROUPS[i].branches;
    if (g.indexOf(a) >= 0 && g.indexOf(b) >= 0) return true;
  }
  return false;
}

// 本命锚点：只取年支（生肖）与日支（本命），出生时刻不影响本层任何规则
function weddingAnchors(birth, gender) {
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
function weddingDayProfile(y, m, d, couple) {
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
function weddingScan(opts) {
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
//       金/钅→金；水/氵/雨/子→水。氵按水 4 画计入康熙笔画。字表只收简繁同形或已注明
//       繁体对应的字；查不到的字明确回报 unknown，不猜不套。
// R39.2 笔画五行（康熙笔画派）：按康熙笔画的个位数定五行——1,2→木；3,4→火；5,6→土；
//       7,8→金；9,0→水。
// R39.3 两派公开分歧：72 个常用取名用字中两派一致仅 17 字（23.6%，测试断言锁定）。

var WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
var WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
var WUXING_RADICAL_ELEMENT = {
  '木': '木', '火': '火', '灬': '火', '日': '火',
  '土': '土', '山': '土', '田': '土',
  '金': '金', '钅': '金', '水': '水', '氵': '水', '雨': '水', '子': '水'
};
var WUXING_RADICAL_KANGXI = { '氵': 4 };

function wuxingStrokeElement(kangxi) {
  var band = ((kangxi % 10) + 10) % 10;
  if (band === 0 || band === 9) return '水';
  if (band <= 2) return '木';
  if (band <= 4) return '火';
  if (band <= 6) return '土';
  return '金';
}

// 字表：[字, 部首, 康熙笔画, 拼音, 繁体?]——简繁同形者无第 5 项
var WUXING_CHAR_ROWS = [
  ['木', '木', 4, 'mù'], ['材', '木', 7, 'cái'], ['村', '木', 7, 'cūn'], ['杞', '木', 7, 'qǐ'],
  ['林', '木', 8, 'lín'], ['松', '木', 8, 'sōng'], ['果', '木', 8, 'guǒ'], ['柏', '木', 9, 'bǎi'],
  ['相', '木', 9, 'xiàng'], ['柔', '木', 9, 'róu'], ['桂', '木', 10, 'guì'], ['桐', '木', 10, 'tóng'],
  ['梅', '木', 11, 'méi'], ['梓', '木', 11, 'zǐ'], ['森', '木', 12, 'sēn'], ['楠', '木', 13, 'nán'],
  ['楚', '木', 13, 'chǔ'], ['榕', '木', 14, 'róng'],
  ['火', '火', 4, 'huǒ'], ['炎', '火', 8, 'yán'], ['焱', '火', 12, 'yàn'], ['煜', '火', 13, 'yù'],
  ['照', '灬', 13, 'zhào'], ['明', '日', 8, 'míng'], ['晴', '日', 12, 'qíng'], ['昊', '日', 8, 'hào'],
  ['春', '日', 9, 'chūn'],
  ['土', '土', 3, 'tǔ'], ['圭', '土', 6, 'guī'], ['坤', '土', 8, 'kūn'], ['城', '土', 10, 'chéng'],
  ['培', '土', 11, 'péi'], ['基', '土', 11, 'jī'], ['堂', '土', 11, 'táng'], ['山', '山', 3, 'shān'],
  ['岳', '山', 8, 'yuè'], ['峰', '山', 10, 'fēng'], ['岩', '山', 8, 'yán'], ['田', '田', 5, 'tián'],
  ['金', '金', 8, 'jīn'], ['鑫', '金', 24, 'xīn'],
  ['钰', '钅', 13, 'yù', '鈺'], ['铭', '钅', 14, 'míng', '銘'],
  ['锦', '钅', 16, 'jǐn', '錦'], ['银', '钅', 14, 'yín', '銀'],
  ['水', '水', 4, 'shuǐ'], ['泰', '水', 9, 'tài'],
  ['江', '氵', 7, 'jiāng'], ['池', '氵', 7, 'chí'], ['汐', '氵', 7, 'xī'], ['沐', '氵', 8, 'mù'],
  ['沁', '氵', 8, 'qìn'], ['汪', '氵', 8, 'wāng'], ['沛', '氵', 8, 'pèi'], ['泓', '氵', 9, 'hóng'],
  ['波', '氵', 9, 'bō'], ['浩', '氵', 11, 'hào'], ['海', '氵', 11, 'hǎi'], ['津', '氵', 10, 'jīn'],
  ['洪', '氵', 10, 'hóng'], ['洋', '氵', 10, 'yáng'], ['淑', '氵', 12, 'shū'], ['淳', '氵', 12, 'chún'],
  ['清', '氵', 12, 'qīng'], ['涵', '氵', 12, 'hán'],
  ['雨', '雨', 8, 'yǔ'], ['雪', '雨', 11, 'xuě'], ['雷', '雨', 13, 'léi'], ['霖', '雨', 16, 'lín'],
  ['震', '雨', 15, 'zhèn'], ['霄', '雨', 15, 'xiāo'],
  ['子', '子', 3, 'zǐ']
];

function rowToEntry(row) {
  var c = row[0], rad = row[1], kangxi = row[2], py = row[3], trad = row.length > 4 ? row[4] : null;
  var formEl = WUXING_RADICAL_ELEMENT[rad];
  var strokeEl = wuxingStrokeElement(kangxi);
  return {
    c: c, rad: rad, radKangxi: WUXING_RADICAL_KANGXI[rad] || null, py: py, trad: trad || null,
    formEl: formEl, kangxi: kangxi, strokeEl: strokeEl, agree: formEl === strokeEl
  };
}

var WUXING_CHAR_TABLE = WUXING_CHAR_ROWS.map(rowToEntry);
var WUXING_CHAR_INDEX = {};
for (var _r39i = 0; _r39i < WUXING_CHAR_TABLE.length; _r39i++) {
  WUXING_CHAR_INDEX[WUXING_CHAR_TABLE[_r39i].c] = WUXING_CHAR_TABLE[_r39i];
  if (WUXING_CHAR_TABLE[_r39i].trad) WUXING_CHAR_INDEX[WUXING_CHAR_TABLE[_r39i].trad] = WUXING_CHAR_TABLE[_r39i];
}

function charWuxingOf(ch) { return WUXING_CHAR_INDEX[ch] || null; }

function nameWuxingProfile(name) {
  var chars = String(name || '').split('').filter(function (ch) { return ch.trim() !== ''; });
  var per = chars.map(function (ch) {
    var e = WUXING_CHAR_INDEX[ch];
    if (!e) return { c: ch, known: false };
    return { c: ch, known: true, py: e.py, rad: e.rad, trad: e.trad, formEl: e.formEl, kangxi: e.kangxi, strokeEl: e.strokeEl, agree: e.agree };
  });
  var known = per.filter(function (p) { return p.known; });
  var countBy = function (key) {
    var out = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    for (var i = 0; i < known.length; i++) out[known[i][key]]++;
    return out;
  };
  var agreeCount = 0, disagreeCount = 0;
  for (var j = 0; j < known.length; j++) { if (known[j].agree) agreeCount++; else disagreeCount++; }
  var unknownChars = [];
  for (var k = 0; k < per.length; k++) { if (!per[k].known) unknownChars.push(per[k].c); }
  return {
    total: chars.length, known: known.length, unknownChars: unknownChars,
    chars: per,
    formCounts: countBy('formEl'), strokeCounts: countBy('strokeEl'),
    agreeCount: agreeCount, disagreeCount: disagreeCount
  };
}

function wuxingTableStats() {
  var n = WUXING_CHAR_TABLE.length, agree = 0;
  var byForm = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  var byStroke = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (var i = 0; i < n; i++) {
    var e = WUXING_CHAR_TABLE[i];
    if (e.agree) agree++;
    byForm[e.formEl]++; byStroke[e.strokeEl]++;
  }
  return { total: n, agree: agree, disagree: n - agree, byForm: byForm, byStroke: byStroke };
}

function elementRelation(a, b) {
  if (a === b) return 'same';
  if (WUXING_SHENG[a] === b) return 'aShengB';
  if (WUXING_SHENG[b] === a) return 'bShengA';
  if (WUXING_KE[a] === b) return 'aKeB';
  if (WUXING_KE[b] === a) return 'bKeA';
  return null;
}
// ============ R39 结束 ============


  return {
    // ---------- v0.15.0 姓名五行字表（R39）----------
    wuxingStrokeElement: wuxingStrokeElement, charWuxingOf: charWuxingOf,
    nameWuxingProfile: nameWuxingProfile, wuxingTableStats: wuxingTableStats, elementRelation: elementRelation,
    WUXING_SHENG: WUXING_SHENG, WUXING_KE: WUXING_KE,
    WUXING_RADICAL_ELEMENT: WUXING_RADICAL_ELEMENT, WUXING_RADICAL_KANGXI: WUXING_RADICAL_KANGXI,
    WUXING_CHAR_TABLE: WUXING_CHAR_TABLE,
    // ---------- v0.14.0 嫁娶择日（R38）----------
    weddingScan: weddingScan, weddingDayProfile: weddingDayProfile, weddingAnchors: weddingAnchors,
    xiuOfDate: xiuOfDate, dayTianShen: dayTianShen, dayTianShenIndex: dayTianShenIndex,
    jianChuHuangDao: jianChuHuangDao,
    XIU_CN: XIU_CN, XIU_EN: XIU_EN, XIU_LUCK: XIU_LUCK, XIU_MARRY: XIU_MARRY,
    XIU_SEVEN_CN: XIU_SEVEN_CN, XIU_MANSION_CN: XIU_MANSION_CN, XIU_MANSION_EN: XIU_MANSION_EN,
    XIU_MARRY_DIVERGE_CN: XIU_MARRY_DIVERGE_CN, XIU_MARRY_DIVERGE: XIU_MARRY_DIVERGE,
    TIAN_SHEN_CN: TIAN_SHEN_CN, TIAN_SHEN_EN: TIAN_SHEN_EN, TIAN_SHEN_GOOD: TIAN_SHEN_GOOD,
    TIAN_SHEN_START_CN: TIAN_SHEN_START_CN, JIANCHU_HUANG: JIANCHU_HUANG,
    OFFICER_MARRY: OFFICER_MARRY, WEDDING_WEIGHTS: WEDDING_WEIGHTS,
    BRANCH_TRINE: BRANCH_TRINE, PUNISH_GROUPS: PUNISH_GROUPS, SELF_PUNISH: SELF_PUNISH,
    BRANCH_HARM: BRANCH_HARM, BRANCH_SIX_HE: BRANCH_SIX_HE, BRANCH_CLASH: BRANCH_CLASH,
    dailyProfile: dailyProfile, dailyOfficer: dailyOfficer, DAILY_OFFICERS: DAILY_OFFICERS,
    shenshaHongLuan: shenshaHongLuan, shenshaTianXi: shenshaTianXi,
    shenshaGuChen: shenshaGuChen, shenshaGuaSu: shenshaGuaSu,
    shenshaTianShOfDayBranch: shenshaTianShOfDayBranch, SS_GUCHEN: SS_GUCHEN, SS_GUASU: SS_GUASU,
    computeBazi: computeBazi,
    tzCentralMeridianOf: tzCentralMeridianOf,
    trueSolarOffsetMinutes: trueSolarOffsetMinutes,
    inCnDst: inCnDst,
    tenGodOf: tenGodOf,
    tenGodRelation: tenGodRelation,
    deriveTenGod: deriveTenGod,
    TEN_GOD_GROUPS: TEN_GOD_GROUPS,
    TEN_GOD_GROUP_LABEL: TEN_GOD_GROUP_LABEL,
    TEN_GOD_GROUP_CN: TEN_GOD_GROUP_CN,
    STEMS: STEMS, BRANCHES: BRANCHES, STEM_ELEMENT: STEM_ELEMENT, BRANCH_ELEMENT: BRANCH_ELEMENT,
    STEM_POLARITY: STEM_POLARITY,
    TEN_GODS_EN: TEN_GODS_EN, BRANCH_EN: BRANCH_EN, STEMS_EN: STEMS_EN,
    ENGINE_VERSION: ENGINE_VERSION,
    // ---------- v0.4.0 大运 ----------
    computeLuckPillars: computeLuckPillars,
    luckDirection: luckDirection,
    luckStartTraditional: luckStartTraditional,
    luckStartPrecise: luckStartPrecise,
    twelveStage: twelveStage,
    zhiBlockIndex: zhiBlockIndex,
    zhiBlockOf: zhiBlockOf,
    JIAZI: JIAZI, JIE_EN: JIE_EN, BRANCH_HIDE_GAN: BRANCH_HIDE_GAN,
    STAGE_NAMES: STAGE_NAMES, STAGE_EN: STAGE_EN, STAGE_START_BRANCH: STAGE_START_BRANCH,
    // ---------- v0.5.0 合盘 ----------
    computeCompatibility: computeCompatibility,
    stemRelation: stemRelation,
    branchRelations: branchRelations,
    STEM_COMBINE: STEM_COMBINE, STEM_COMBINE_ELEMENT: STEM_COMBINE_ELEMENT, STEM_CLASH: STEM_CLASH,
    BRANCH_SIX_HE: BRANCH_SIX_HE, SIX_HE_ELEMENT: SIX_HE_ELEMENT, BRANCH_CLASH: BRANCH_CLASH,
    BRANCH_HARM: BRANCH_HARM, BRANCH_TRINE: BRANCH_TRINE, PUNISH_GROUPS: PUNISH_GROUPS,
    SELF_PUNISH: SELF_PUNISH, BRANCH_ANIMAL: BRANCH_ANIMAL, BRANCH_ANIMAL_EN: BRANCH_ANIMAL_EN,
    // ---------- v0.6.0 喜用神 ----------
    computeFavorableElement: computeFavorableElement,
    BRANCH_SEASON: BRANCH_SEASON, SEASON_EN: SEASON_EN, STRENGTH_THRESHOLDS: STRENGTH_THRESHOLDS,
    // ---------- v0.7.0 纳音 / 日柱剖面 ----------
    nayinOf: nayinOf, dayPillarProfile: dayPillarProfile,
    NAYIN: NAYIN, NAYIN_EN: NAYIN_EN, NAYIN_PAIRS: NAYIN_PAIRS, SEAT_KIND: SEAT_KIND,
    // ---------- v0.8.0 十二地支属性 / 地支·长生·十神柱位剖面 ----------
    ELEMENT_EN: ELEMENT_EN, BRANCH_POLARITY: BRANCH_POLARITY, BRANCH_MEETING: BRANCH_MEETING,
    branchHourRange: branchHourRange, branchProfile: branchProfile, stageProfile: stageProfile,
    tenGodPillarProfile: tenGodPillarProfile, PILLAR_POS: PILLAR_POS, TEN_GOD_ORDER: TEN_GOD_ORDER,
    // ---------- v0.9.0 流年 / 生肖层 ----------
    LICHUN: LICHUN, LICHUN_FROM: LICHUN_FROM, lichunOf: lichunOf,
    yearGanzhi: yearGanzhi, yearGanzhiIndex: yearGanzhiIndex, zodiacIndexForYear: zodiacIndexForYear,
    zodiacIndexFromDateTime: zodiacIndexFromDateTime, zodiacYears: zodiacYears,
    BRANCH_BREAK: BRANCH_BREAK, TAI_SUI_KINDS: TAI_SUI_KINDS,
    taiSuiRelations: taiSuiRelations, zodiacTaiSuiYears: zodiacTaiSuiYears,
    monthStemIndex: monthStemIndex, yearMonthPillars: yearMonthPillars,
    yearProfile: yearProfile, zodiacProfile: zodiacProfile,
    // ---------- v0.10.0 六十四卦层 ----------
    hexagramProfile: hexagramProfile, najiaOf: najiaOf, liuQinOf: liuQinOf,
    sixSpiritsOfDayStem: sixSpiritsOfDayStem, hexLines: hexLines, hexGlyph: hexGlyph,
    triGlyph: triGlyph, hexBinaryIndex: hexBinaryIndex, hexFromBinaryIndex: hexFromBinaryIndex,
    hexFullCn: hexFullCn, triYangCount: triYangCount, cuoHex: cuoHex, zongHex: zongHex, huHex: huHex,
    hexagonsInGong: hexagonsInGong, hexagonsWithTrigram: hexagonsWithTrigram,
    TRI: TRI, TRI_PY: TRI_PY, TRI_IMG: TRI_IMG, TRI_IMG_EN: TRI_IMG_EN, TRI_GLYPH: TRI_GLYPH,
    TRI_ELEMENT: TRI_ELEMENT, TRI_VALUE: TRI_VALUE, TRI_FAMILY: TRI_FAMILY, TRI_FAMILY_EN: TRI_FAMILY_EN,
    TRI_DIR: TRI_DIR, TRI_DIR_EN: TRI_DIR_EN, TRI_YANG: TRI_YANG,
    HEX_CN: HEX_CN, HEX_PY: HEX_PY, HEX_EN: HEX_EN, HEX_UNI: HEX_UNI,
    HEX_UPPER: HEX_UPPER, HEX_LOWER: HEX_LOWER, HEX_PURE: HEX_PURE, HEX_SELF_REVERSING: HEX_SELF_REVERSING,
    GONG_ORDER: GONG_ORDER, GONG_OF: GONG_OF, GONG_STAGE: GONG_STAGE,
    GONG_LABEL: GONG_LABEL, GONG_LABEL_EN: GONG_LABEL_EN, SHI_POS: SHI_POS, YING_POS: YING_POS,
    NAJIA_STEM_IN: NAJIA_STEM_IN, NAJIA_STEM_OUT: NAJIA_STEM_OUT,
    NAJIA_IN_START: NAJIA_IN_START, NAJIA_OUT_START: NAJIA_OUT_START,
    SIX_SPIRITS: SIX_SPIRITS, SIX_SPIRITS_EN: SIX_SPIRITS_EN, SPIRIT_START_BY_STEM: SPIRIT_START_BY_STEM,
    HEXAGRAM_COUNT: HEXAGRAM_COUNT, TRIGRAM_COUNT: TRIGRAM_COUNT,
    SS_LU: SS_LU, SS_YANG_REN: SS_YANG_REN, SS_YIN_REN: SS_YIN_REN,
    SS_NOBLEMAN: SS_NOBLEMAN, SS_NOBLEMAN_ALT: SS_NOBLEMAN_ALT, SS_WENCHANG: SS_WENCHANG,
    SS_TAIJI: SS_TAIJI, SS_GUOYIN: SS_GUOYIN, SS_FUXING: SS_FUXING, SS_JINYU: SS_JINYU,
    SS_KONGWANG: SS_KONGWANG, SS_SHI_E: SS_SHI_E, SS_KUIGANG: SS_KUIGANG, SS_CHACUO: SS_CHACUO,
    SS_TIANSH: SS_TIANSH, SS_HONGLUAN: SS_HONGLUAN, SS_TIANDOCTOR: SS_TIANDOCTOR,
    SS_XUEREN: SS_XUEREN, SS_TIANDI: SS_TIANDI, SS_TRINE_STAR: SS_TRINE_STAR, SS_YUEDE: SS_YUEDE,
    SS_GUCHEN: SS_GUCHEN, SS_GUASU: SS_GUASU, SS_TONGZI: SS_TONGZI, SS_LUOWANG: SS_LUOWANG,
    kongWangOf: kongWangOf, kongWangOfDayGz: kongWangOfDayGz, shiEDerived: shiEDerived,
    shenshaDayStemBranches: shenshaDayStemBranches, shenshaTrineBranch: shenshaTrineBranch,
    shenshaMonthBranch: shenshaMonthBranch, shenshaYueDeStem: shenshaYueDeStem,
    shenshaYueDeHeStem: shenshaYueDeHeStem, shenshaTianDeTarget: shenshaTianDeTarget,
    shenshaHongLuan: shenshaHongLuan, shenshaTianXi: shenshaTianXi, shenshaBingFu: shenshaBingFu,
    shenshaGuChen: shenshaGuChen, shenshaGuaSu: shenshaGuaSu, shenshaTenGodBranches: shenshaTenGodBranches,
    shenshaTianShOfDayBranch: shenshaTianShOfDayBranch, shenshaScan: shenshaScan,
    // ---------- v0.12.0 八宅命卦 ----------
    KUA_DIRS: KUA_DIRS, KUA_DIR_META: KUA_DIR_META, KUA_GUA: KUA_GUA, KUA_STAR_META: KUA_STAR_META,
    KUA_MANSIONS: KUA_MANSIONS, kuaFengShuiYear: kuaFengShuiYear, kuaNumberOf: kuaNumberOf,
    kuaFiveHandled: kuaFiveHandled, kuaProfile: kuaProfile,
    // ---------- v0.13.0 每日干支 ----------
    DAILY_OFFICERS: DAILY_OFFICERS, dailyOfficerIndex: dailyOfficerIndex,
    dailyOfficer: dailyOfficer, dailyProfile: dailyProfile
  };
});
