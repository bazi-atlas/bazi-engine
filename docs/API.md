# bazi-engine API

All examples below are **verified against engine v0.15.1** — signatures and output
shapes are copied from real runs, not from memory. Every function takes birth
options directly and re-uses one another internally, so you never need to pass a
computed chart back in.

## Conventions first (read this before trusting any output)

The engine does **not** silently pick a school. Where classical traditions
genuinely disagree, the convention is declared in the output itself:

| Topic | Default | Alternative |
|---|---|---|
| Day-pillar day switch | Late Zi (23:00+) rolls to next day (`sect: 1`, Zi Ping mainstream) | Midnight switch (`sect: 2`) |
| Year pillar switch | LiChun instant (not Lunar New Year) | — |
| Month pillar switch | Jie (节) solar-term instants, judged on the absolute instant | — |
| Solar time | Hour pillar corrected to true solar time at birth longitude | Pass `longitude: null` to skip |
| Luck pillar start age | `method: 'traditional'` (rounded) | `method: 'precise'` (second-level) |
| Compatibility | Table facts only (six relations + ten-god reads) | **No percentages — the system never grades relationships numerically** |

## Install

```bash
npm install          # installs lunar-javascript, the only dependency
```

`engine.mjs` resolves `lunar-javascript` through standard `node_modules`. If it is
missing, the engine throws a message telling you to run `npm install`.

## Node (ESM)

```js
import * as E from './engine.mjs';

const birth = { year: 1990, month: 3, day: 15, hour: 6, minute: 30, longitude: 116.4 };

// 1. The chart — one call gives pillars, hidden stems, nayin, ten gods, five-element counts
const chart = E.computeBazi(birth);

// 2. Favorable element — transparent weighted scoring, threshold 0.55/0.45
const fav = E.computeFavorableElement(birth);          // same opts as computeBazi

// 3. Luck pillars (Da Yun) — needs gender
const luck = E.computeLuckPillars({ ...birth, gender: 1, count: 10 });

// 4. Pair compatibility — takes BOTH birth-opts, not computed charts
const pair = E.computeCompatibility(birth, { year: 1992, month: 8, day: 22, hour: 14 });

// 5. Hexagram profile — najia, liuqin, palace/shi-ying, cuo/zong/hu
const hex = E.hexagramProfile(28);                     // Da Guo / Preponderance of the Great
```

### `computeBazi(birth)` → output shape (verified)

```js
{
  input: { year, month, day, hour, minute, longitude, tzOffsetHours, unknownTime, sect },
  meta: {
    dayMaster: '己', dayElement: '土',
    trueSolarTime: { hour: 6, minute: 15, dateShifted: false },   // 06:30 clock → 06:15 true solar @116.4°E
    sectLabel: '晚子时日柱归次日（23:00 换日）', sectLabelEn: '…',
    // …absoluteInstantBeijing, dstApplied, engine, engineVersion
  },
  pillars: {
    year:  { ganzhi: '庚午', hideGan: ['丁','己'], shiShenGan: '伤官', naYin: '路旁土' },
    month: { ganzhi: '己卯', … },
    day:   { ganzhi: '己卯', hideGan: ['乙'], shiShenGan: '日主', naYin: '城头土' },
    time:  { ganzhi: '丁卯', … },
  },
  fiveElements: { stemsBranchesOnly: {…}, withHiddenStems: {…} },
  tenGodsEn: {…},
}
```

`birth` options: `year, month, day, hour = null, minute = 0, longitude = null,
tzCentralMeridian = null, tzOffsetHours = null, unknownTime = false, sect = 1`.
`hour: null` + `unknownTime: true` produces a three-pillar chart (time pillar
marked unknown, downstream functions degrade gracefully).

### Other entry points (all verified signatures)

| Function | Input | Returns |
|---|---|---|
| `computeBazi(opts)` | birth opts | chart (see above) |
| `computeFavorableElement(opts)` | birth opts | `{ dayMaster, season, score, fuYang, tiaoHou, synthesis, conventionNote }` |
| `computeLuckPillars(opts)` | birth opts + `gender, count, method, frame, today` | `{ direction, start, preLuck, pillars[], current, frameAlt, sensitivity }` |
| `computeCompatibility(aOpts, bOpts)` | two birth-opts | `{ dayMasters, stems, branches, zodiac, trines, dayPair, conventionNote }` |
| `hexagramProfile(n)` | 1–64 | `{ cn, py, en, glyph, palace, najia[], liuqin, shi/ying, cuo, zong, hu }` |
| `kuaNumberOf(y, gender)` | birth year + gender | Eight Mansions life-gua |
| `dailyProfile(dateOpts)` | date | day pillar, 12 officers, 28 mansions |
| `shenshaScan(opts)` | birth opts | symbolic stars (nobleman, peach blossom, …) |

Naming constants (`STEMS`, `BRANCHES`, `JIAZI`, `NAYIN`, `BRANCH_HIDE_GAN`,
`STAGE_NAMES`, ten-god tables, hexagram tables) are all exported too — pages
built on this engine reference the same tables instead of duplicating them.

## Browser

`web/bazi-engine.web.js` is a UMD bundle of the same engine (global `BaziEngine`):

```html
<script src="bazi-engine.web.js"></script>
<script>
  const chart = BaziEngine.computeBazi({ year: 1990, month: 3, day: 15, hour: 6, minute: 30 });
  document.title = chart.pillars.day.ganzhi;   // 己卯
</script>
```

`test-web-engine.mjs` asserts the Node engine and this bundle emit **byte-identical
JSON** for a fixture corpus — so browser and server results cannot drift.

## Verification

Two independent nets, both in this repo:

```bash
node test-web-engine.mjs      # Node engine vs browser bundle, byte-identical JSON
node tools/test-crosscheck.mjs  # every fixture re-derived by a DIFFERENT algorithm path
```

`test-fixtures.json` holds 35 boundary cases (LiChun edges, term-instant crossovers
down to the minute, late-Zi under both schools, China DST including the 00:00–01:00
roll-back window, extreme longitudes, cross-day overseas births, leap days). Each
case's `expected` block is **stamped from the differential checker**, not typed by
hand — regenerate with `node generate-fixtures.mjs && node tools/stamp-expected.mjs`.

## Known upstream defects worked around

- `lunar-javascript`'s `getYun()` treats a 23:00 birth as Hai hour for luck-start
  math — this engine computes luck start itself.
- lunar's `ZHI_XING` table is the 12 officers (建除), not the three punishments
  (三刑) — punishment tables here are first-party.

## Error behaviour

Birth dates outside lunar-javascript's supported range throw
`Error: wrong solar year …` — validate input years before calling.
