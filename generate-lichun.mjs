// generate-lichun.mjs —— 生成「立春时刻表」（R30）
// ------------------------------------------------------------------
// 为什么需要这张表：生肖与年柱的换柱线是**立春**，不是元旦、也不是农历正月初一。
// 立春是天文时刻（太阳到达黄经 315°），浏览器引擎不能带历法库，所以只能做成
// 定表逐字复制进双引擎——与 JIAZI / NAYIN / BRANCH_HIDE_GAN 同一套做法，
// 靠 test-web-engine.mjs 的 JSON 字节相等断言锁死两张表一致。
//
// 用法：node generate-lichun.mjs          → 打印可直接粘贴的 JS 片段
//       node generate-lichun.mjs --check  → 只校验现有表与历法库是否一致（退出码）
//
// 扩展年份：把 FROM/TO 改大，重跑，替换双引擎里的 LICHUN 段，并跑闸门。
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Solar;
try {
  ({ Solar } = require('lunar-javascript'));
} catch (err) {
  throw new Error('Run `npm install` first — lunar-javascript is required. (' + err.message + ')');
}

const FROM = 1900, TO = 2100;

// 取某公历年的立春。历法库的节气表挂在「农历年」上，直接查 2 月 4 日的农历对象
// 不一定命中目标年份（立春可能落在 2 月 3 日），所以从 2 月中旬起查、再回退。
function lichunOf(year) {
  for (const [m, d] of [[6, 1], [2, 15], [2, 4]]) {
    const t = Solar.fromYmd(year, m, d).getLunar().getJieQiTable()['立春'];
    if (t && t.getYear() === year) return t;
  }
  return null;
}

function build() {
  const rows = [];
  for (let y = FROM; y <= TO; y++) {
    const t = lichunOf(y);
    if (!t) throw new Error('取不到立春: ' + y);
    const mm = String(t.getMonth()).padStart(2, '0');
    const dd = String(t.getDay()).padStart(2, '0');
    const hh = String(t.getHour()).padStart(2, '0');
    const mi = String(t.getMinute()).padStart(2, '0');
    rows.push({ y, code: mm + dd + hh + mi, month: t.getMonth(), day: t.getDay(), hh, mi, full: t.toYmdHms() });
  }
  return rows;
}

const rows = build();

// ---------- 自检 1：立春必须落在 2 月 3–5 日 ----------
const odd = rows.filter((r) => r.month !== 2 || r.day < 3 || r.day > 5);
if (odd.length) {
  console.error('✗ 有立春不在 2 月 3–5 日：', odd.slice(0, 5).map((r) => r.full).join(', '));
  process.exit(1);
}

// ---------- 自检 2：与已发布站点/常识核对过的 5 个黄金值 ----------
const GOLD = {
  2024: '2024-02-04 16:27:07',
  2025: '2025-02-03 22:10:28',
  2026: '2026-02-04 04:02:08',
  2027: '2027-02-04 09:46:18',
  2028: '2028-02-04 15:31:13',
};
let bad = 0;
for (const [y, want] of Object.entries(GOLD)) {
  const got = rows.find((r) => r.y === +y).full;
  if (got !== want) { console.error(`✗ 黄金值不符 ${y}: 得到 ${got} / 期望 ${want}`); bad++; }
}
if (bad) process.exit(1);

// ---------- --check：拿磁盘上引擎里的表逐项对账 ----------
if (process.argv.includes('--check')) {
  // 动态导入：首次生成时 engine.mjs 里还没有 LICHUN 段，静态 import 会直接崩。
  const { LICHUN, LICHUN_FROM } = await import('./engine.mjs');
  const mismatch = [];
  for (const r of rows) {
    const i = r.y - LICHUN_FROM;
    if (i < 0 || i >= LICHUN.length) { mismatch.push(`${r.y} 超出表范围`); continue; }
    if (LICHUN[i] !== r.code) mismatch.push(`${r.y}: 表 ${LICHUN[i]} / 历法库 ${r.code}`);
  }
  if (LICHUN_FROM !== FROM || LICHUN.length !== rows.length) {
    mismatch.push(`表范围 ${LICHUN_FROM}–${LICHUN_FROM + LICHUN.length - 1} ≠ 生成范围 ${FROM}–${TO}`);
  }
  if (mismatch.length) {
    console.error('✗ 立春表与历法库不一致：');
    for (const m of mismatch.slice(0, 10)) console.error('   ', m);
    process.exit(1);
  }
  console.log(`✓ 立春表 ${LICHUN.length} 条（${LICHUN_FROM}–${LICHUN_FROM + LICHUN.length - 1}）与历法库逐项一致；5 个黄金值吻合；全部落在 2 月 3–5 日`);
  process.exit(0);
}

// ---------- 默认：打印可粘贴片段 ----------
const lines = [];
for (let i = 0; i < rows.length; i += 8) {
  lines.push('  ' + rows.slice(i, i + 8).map((r) => `'${r.code}'`).join(', ') + ',');
}
console.log(`export const LICHUN_FROM = ${FROM};   // 表首年份`);
console.log(`export const LICHUN = [   // index = year - LICHUN_FROM；每项 'MMDDHHmm'（北京时间）`);
console.log(lines.join('\n'));
console.log('];');
console.log(`\n// 共 ${rows.length} 条（${FROM}–${TO}），全部落在 2 月 3–5 日，5 个黄金值与历法库吻合`);
