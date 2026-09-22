// 生成 30 个万年历抽检用例（P1 放行条件的一部分）
// 用例覆盖：普通盘 / 立春分界 / 节气换月分界 / 晚子时 / 未知时辰 / 夏令时 / 极端经度
import { writeFileSync } from 'node:fs';
import { computeBazi } from './engine.mjs';

const cases = [
  // 基础盘
  { name: 'basic-1986', year: 1986, month: 4, day: 21, hour: 12, minute: 0, longitude: 114.06 },  // 深圳
  { name: 'basic-1990', year: 1990, month: 8, day: 15, hour: 8, minute: 30, longitude: 121.47 },  // 上海
  { name: 'basic-1995', year: 1995, month: 11, day: 3, hour: 16, minute: 45, longitude: 113.25 }, // 广州
  { name: 'basic-2000', year: 2000, month: 1, day: 1, hour: 0, minute: 15, longitude: 116.4 },    // 北京 零点边界
  { name: 'basic-2003', year: 2003, month: 6, day: 18, hour: 10, minute: 0, longitude: 104.07 },  // 成都
  // 立春分界（2024-02-04 16:26 立春）
  { name: 'lichun-before', year: 2024, month: 2, day: 4, hour: 10, minute: 0, longitude: 116.4 },
  { name: 'lichun-after', year: 2024, month: 2, day: 4, hour: 18, minute: 0, longitude: 116.4 },
  // 节气换月边界（清明 2025-04-04 20:48）
  { name: 'jieqi-before', year: 2025, month: 4, day: 4, hour: 15, minute: 0, longitude: 120.15 },
  { name: 'jieqi-after', year: 2025, month: 4, day: 4, hour: 22, minute: 0, longitude: 120.15 },
  // 晚子时两种流派
  { name: 'late-zi-sect1', year: 1986, month: 4, day: 21, hour: 23, minute: 30, longitude: 114.06, sect: 1 },
  { name: 'late-zi-sect2', year: 1986, month: 4, day: 21, hour: 23, minute: 30, longitude: 114.06, sect: 2 },
  // 未知时辰
  { name: 'unknown-hour', year: 1992, month: 9, day: 9, unknownTime: true, longitude: 118.78 },   // 南京
  // 夏令时窗口（1986-1991，v0.15.1 起用官方逐年日期表）
  { name: 'dst-1988', year: 1988, month: 7, day: 10, hour: 14, minute: 0, longitude: 114.06 },
  { name: 'no-dst-1988', year: 1988, month: 12, day: 10, hour: 14, minute: 0, longitude: 114.06 },
  { name: 'dst-1988-april', year: 1988, month: 4, day: 20, hour: 10, minute: 0, longitude: 114.06, expectedNote: 'v0.15.1 回归守卫：1988 年夏令时实际 4/10 起（官方），旧粗边界 5/4 会漏减 1 小时。4/20 10:00 应按夏令时还原为标准时 09:00' },
  { name: 'dst-midnight-1988', year: 1988, month: 7, day: 11, hour: 0, minute: 30, longitude: 114.06, expectedNote: 'v0.15.1 回归守卫：夏令时期间凌晨 00:30 出生，减 1 小时跨零点，日期须回滚到 07-10 23:30（标准时）→ 真太阳时 23:06 → sect1 晚子时日柱归次日。旧版日期不回滚导致日柱错位一天' },
  // 极端经度（真太阳时偏差大）
  { name: 'xinjiang', year: 1994, month: 5, day: 5, hour: 9, minute: 0, longitude: 87.62 },       // 乌鲁木齐，偏差约-2h9m
  { name: 'heilongjiang', year: 1994, month: 5, day: 5, hour: 9, minute: 0, longitude: 126.53 },  // 哈尔滨，偏差约+26m
  // 海外出生
  { name: 'overseas-nyc', year: 1991, month: 3, day: 23, hour: 11, minute: 0, longitude: -74.01, tzOffsetHours: -5, expectedNote: '人工核验✓(2026-09-16, 老雷APP对照): 辛未 辛卯 壬辰 丙午。此用例曾暴露引擎bug：真太阳时基准误用东经120°，已修为当地时区中央经线（v0.2）' },
  { name: 'overseas-london', year: 1993, month: 7, day: 7, hour: 15, minute: 30, longitude: -0.13, tzOffsetHours: 1, expectedNote: '月柱已验证(2026-09-16): 小暑=1993-07-07 10:32:02北京时间(三源一致: lunar-javascript/sojson/rilicha)，出生15:30 BST=北京22:30=UTC14:30，晚于小暑12h → 未月己未。注意：老雷APP排戊午(午月)有误，疑按日期而非时刻切月。时柱分歧属流派差异：APP用钟表时间(15:30→申时壬申)，本引擎用真太阳时(14:29→未时辛未)，Methodology声明真太阳时口径' },
  // 小暑交界三连（1993-07-07 10:32:02 北京时间交节）——月柱按绝对时刻判定的永久回归用例
  { name: 'xiaoshu-before', year: 1993, month: 7, day: 7, hour: 10, minute: 0, longitude: 116.4, expectedNote: '交节前32分钟 → 午月（戊午）。若排己未即为月柱bug' },
  { name: 'xiaoshu-after', year: 1993, month: 7, day: 7, hour: 11, minute: 0, longitude: 116.4, expectedNote: '交节后28分钟 → 未月（己未）。若排戊午即为月柱bug' },
  { name: 'overseas-la-crossday', year: 1993, month: 7, day: 6, hour: 20, minute: 0, longitude: -118.24, tzOffsetHours: -8, expectedNote: '洛杉矶7月6日20:00 PST = 北京7月7日12:00，晚于小暑10:32 → 未月己未。v0.2把当地时间当北京时间(7月6日20:00)会误判午月——本用例是v0.3绝对时刻修复的回归守卫' },
  // 更早年与大范围年份
  { name: 'old-1965', year: 1965, month: 2, day: 14, hour: 6, minute: 20, longitude: 117.2 },
  { name: 'recent-2025', year: 2025, month: 8, day: 23, hour: 20, minute: 5, longitude: 113.26 },
  // 各日主轮换抽查（天干全覆盖）
  { name: 'dm-jia', year: 1984, month: 2, day: 2, hour: 12, minute: 0, longitude: 114.06 },
  { name: 'dm-bing', year: 1996, month: 6, day: 6, hour: 12, minute: 0, longitude: 114.06 },
  { name: 'dm-wu', year: 1998, month: 8, day: 8, hour: 12, minute: 0, longitude: 114.06 },
  { name: 'dm-geng', year: 2000, month: 10, day: 10, hour: 12, minute: 0, longitude: 114.06 },
  { name: 'dm-ren', year: 2002, month: 12, day: 12, hour: 12, minute: 0, longitude: 114.06 },
  // 午夜前后
  { name: 'midnight-2355', year: 1999, month: 3, day: 19, hour: 23, minute: 55, longitude: 114.06, sect: 1 },
  { name: 'midnight-0005', year: 1999, month: 3, day: 20, hour: 0, minute: 5, longitude: 114.06, sect: 1 },
  // 闰年与月末
  { name: 'leap-day', year: 1996, month: 2, day: 29, hour: 9, minute: 15, longitude: 114.06 },
  { name: 'month-end', year: 2001, month: 1, day: 31, hour: 21, minute: 40, longitude: 114.06 },
  // 春节附近（农历年界不影响八字，但值得抽检）
  { name: 'cny-2020', year: 2020, month: 1, day: 24, hour: 13, minute: 0, longitude: 114.06 },
];

const results = cases.map(c => ({ name: c.name, expectedNote: '', result: computeBazi(c) }));
const out = {
  note: 'P1 万年历抽检基准。expected 字段待人工核对后填写：请老雷按八字功底抽查，重点：lichun/jieqi/late-zi/dst/xinjiang/xiaoshu/overseas 七类边界。核对方式：万年历或专业排盘工具对照四柱干支。',
  generatedAt: new Date().toISOString(),
  cases: results
};
writeFileSync(new URL('./test-fixtures.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('fixtures written:', results.length, 'cases');
// 快速自检输出：关键边界用例
for (const r of results) {
  if (['basic-1986','lichun-after','overseas-nyc','overseas-london','xiaoshu-before','xiaoshu-after','overseas-la-crossday','dst-1988'].includes(r.name)) {
    const p = r.result.pillars;
    console.log(r.name.padEnd(20), p.year.ganzhi, p.month.ganzhi, p.day.ganzhi, p.time.ganzhi ?? '(无时辰)');
  }
}
