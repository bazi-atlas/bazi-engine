# bazi-engine — a verifiable BaZi (Four Pillars) calculation engine

[![test](https://github.com/bazi-atlas/bazi-engine/actions/workflows/test.yml/badge.svg)](https://github.com/bazi-atlas/bazi-engine/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](#english) · [中文](#中文)

<a id="english"></a>

## English

A deterministic BaZi (八字 / Four Pillars of Destiny) engine that powers
[bazi-atlas.com](https://bazi-atlas.com) — every number shown on the site's
700+ pages is computed by this engine and traceable to an explicit, published rule.

**Why open source:** astrology tools usually hide their math. This one doesn't.
Public rules, a public errata log, and a fixture-locked test suite mean you can
verify any calculation yourself — including the places where classical schools
genuinely disagree. The engine states both positions instead of silently picking one.

### What it computes

| Layer | Contents |
|---|---|
| Chart core | Four pillars, hidden stems (藏干), NaYin, ten gods (十神), five-element counts, true solar time, China DST 1986–1991 |
| Luck | Luck pillars (大运) — direction, start age in two published granularities, twelve stages, 10-step sequence |
| Interpretation layers | Favorable element scoring, day-master profiles, seat relations, branch/stem relations (合冲刑害), zodiac |
| Symbolic | Shen sha (神煞), 28 mansions, twelve day officers (建除), wedding-date selection |
| Divination | All 64 hexagrams: NaJia installation, six relations, palace, 世/应, 错/综/互 |
| Other systems | Eight-mansions kua number, name five-element scoring, daily pillar |

### Conventions are declared, not hidden

| Topic | Default | Alternative |
|---|---|---|
| Day switch at 23:00 | Late Zi rolls the day (`sect: 1`, Zi Ping mainstream) | Midnight switch (`sect: 2`) |
| Year pillar switch | LiChun instant (not Lunar New Year) | — |
| Month pillar switch | Solar-term (节) instants, judged on the absolute instant | — |
| Hour pillar | Corrected to true solar time at birth longitude | Pass `longitude: null` to skip |
| Luck start age | `method: 'traditional'` (rounded) | `method: 'precise'` (second-level) |
| Compatibility | Table facts only | **No percentages — the system never grades relationships numerically** |

The full convention set (R1–R39: which clock counts the two-hour blocks, how
strength is tallied, where the climate rule admits its limits, …) is published at
[bazi-atlas.com/methodology](https://bazi-atlas.com/methodology) and mirrored in the
engine source comments next to the code that implements each one.

### Install

```bash
npm install        # only dependency: lunar-javascript (astronomical calendar)
```

```js
import * as E from './engine.mjs';

const birth = { year: 1990, month: 3, day: 15, hour: 6, minute: 30, longitude: 116.4 };

const chart = E.computeBazi(birth);                     // 庚午 己卯 己卯 丁卯
const fav   = E.computeFavorableElement(birth);         // weighted, threshold published
const luck  = E.computeLuckPillars({ ...birth, gender: 1, count: 10 });
const pair  = E.computeCompatibility(birth, { year: 1992, month: 8, day: 22, hour: 14 });
const hex   = E.hexagramProfile(28);                    // 大过 / Preponderance of the Great
```

Every entry point takes **birth options**, never a previously computed chart.
Full reference with verified output shapes: **[docs/API.md](docs/API.md)**.

### Browser

`web/bazi-engine.web.js` is a UMD bundle of the same engine (global `BaziEngine`):

```html
<script src="web/bazi-engine.web.js"></script>
<script>
  const chart = BaziEngine.computeBazi({ year: 1990, month: 3, day: 15, hour: 6, minute: 30 });
</script>
```

### Verification (the point of this repo)

```bash
npm test                        # all suites
node test-web-engine.mjs        # Node engine vs browser bundle: byte-identical JSON
node tools/test-crosscheck.mjs  # every fixture re-derived by a DIFFERENT algorithm path
```

`test-fixtures.json` holds **35 boundary cases** — LiChun edges, solar-term
crossovers down to the minute, late-Zi under both schools, the China DST window
(including the 00:00–01:00 roll-back zone), extreme longitudes (Ürümqi), cross-day
overseas births, leap days, full coverage of the ten day masters.

The differential checker re-derives each case with a different algorithm than the
engine uses — Julian-day integer formula for the day pillar, five-tiger/five-rat
rules for month/hour stems, term tables for month branches. It has already earned
its keep: its first run caught two real engine bugs (an approximate DST window and
a missing date roll-back across midnight), both fixed and now covered by fixtures.

Fixture `expected` blocks are **stamped from the checker**, never hand-typed:

```bash
node generate-fixtures.mjs && node tools/stamp-expected.mjs
```

### Anti-features (deliberate)

- **No compatibility percentages** — the system never grades relationships numerically.
- **No lucky/unlucky pillar grading** — seat relations and stages describe position
  and flow, not fortune.
- **No birth data leaves the browser** — the production site computes client-side;
  there is no upload endpoint.

### Not in this repo

The site's page factory, keyword ledger and build gates are site assets, not engine
code. What ships here is the calculation layer plus everything needed to verify it.

### Known upstream defects worked around

- `lunar-javascript`'s `getYun()` treats a 23:00 birth as Hai hour for luck-start math.
- Its `ZHI_XING` table is the twelve day officers (建除), not the three punishments (三刑).

### Errata

Every engine fix is logged publicly, with how it was found and how it was verified:
[bazi-atlas.com/corrections](https://bazi-atlas.com/corrections).

<a id="中文"></a>

## 中文

驱动 [bazi-atlas.com](https://bazi-atlas.com) 的确定性八字引擎：站上 700+ 页面的
每一个数字都由本引擎实算，并可追溯到显式公开的规则。

**为什么开源**：命理工具通常把算法藏起来，这个不藏。公开规则 + 公开勘误 +
锁死夹具的测试套件，意味着任何一次计算都可以自己核对——包括古典流派**真实存在分歧**
的地方（本引擎把两种口径都写出来，而不偷偷替你选一个）。

### 计算范围

四柱 / 藏干 / 纳音 / 十神 / 五行统计 / 真太阳时 / 中国夏令时 1986–1991；大运（顺逆、
两种已公布粒度的起运、十二长生、十步序列）；喜用神计分、日主十型、坐支关系、合冲刑害、
生肖；神煞、二十八宿、建除十二神、嫁娶择日；六十四卦全套（纳甲、六亲、宫、世应、错综互）；
八宅命卦、姓名五行、每日干支。

### 安装与使用

```bash
npm install
```

```js
import * as E from './engine.mjs';
const birth = { year: 1990, month: 3, day: 15, hour: 6, minute: 30, longitude: 116.4 };
const chart = E.computeBazi(birth);   // 庚午 己卯 己卯 丁卯
```

所有入口函数都吃**出生参数**，不需要把排盘结果再传回去。完整签名与真实输出样例见
[docs/API.md](docs/API.md)；浏览器端用 `web/bazi-engine.web.js`（全局 `BaziEngine`）。

### 验证（本仓库的重点）

```bash
npm test                        # 全部套件
node test-web-engine.mjs        # Node 引擎 vs 浏览器包：JSON 逐字节相等
node tools/test-crosscheck.mjs  # 用另一条算法路径复推每个夹具
```

`test-fixtures.json` 覆盖 35 个边界用例（立春交界、节气交节精确到分钟、两种流派的晚子时、
夏令时含 00:00–01:00 回退窗口、极端经度、跨日海外出生、闰日、十日主全覆盖）。夹具的
`expected` 由差分对拍器**盖章生成**，不靠人工填写。

差分对拍器已经证明过价值：首跑即抓出两个真 bug（夏令时窗口曾经用近似边界；夏令时跨零点
日期未回滚），均已修复并被夹具覆盖。

### 设计立场（刻意的「不做」）

- **拒绝配对百分比**——系统本身从不给关系打分，我们也不打。
- **拒绝吉凶断言**——坐支关系与十二长生描述位置与流转，不描述命运。
- **出生数据不出浏览器**——生产站全部客户端计算，没有上传端点。

### 勘误

每一次引擎修正都公开记录（怎么发现、怎么验证）：
[bazi-atlas.com/corrections](https://bazi-atlas.com/corrections)。

## License

MIT — see [LICENSE](LICENSE).
