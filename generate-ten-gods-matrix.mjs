// 生成十神工具页的静态 10×10 完整矩阵 HTML 片段（供人工审阅后嵌入页面）
// 用法：node generate-ten-gods-matrix.mjs > matrix-snippet.html
import { deriveTenGod } from './engine.mjs';

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const STEM_EN = { 甲:'Jia', 乙:'Yi', 丙:'Bing', 丁:'Ding', 戊:'Wu', 己:'Ji', 庚:'Geng', 辛:'Xin', 壬:'Ren', 癸:'Gui' };
const EL_EN = { 木:'Wood', 火:'Fire', 土:'Earth', 金:'Metal', 水:'Water' };
const POL_EN = { true:'Yang', false:'Yin' };
const SHORT_EN = {
  比肩:'Peer', 劫财:'Rival', 食神:'Eating God', 伤官:'Hurting Officer',
  偏财:'Indirect Wealth', 正财:'Direct Wealth', 七杀:'Seven Killings',
  正官:'Direct Officer', 偏印:'Indirect Resource', 正印:'Direct Resource'
};

const EL_KEY = { 木:'wood', 火:'fire', 土:'earth', 金:'metal', 水:'water' };

const rows = [];
for (const dm of STEMS) {
  const d = deriveTenGod(dm, dm); // 借自身取日主五行/阴阳
  const cells = STEMS.map(g => {
    const r = deriveTenGod(dm, g);
    return `<td class="g-${r.group}"><b lang="zh">${r.god}</b><span>${SHORT_EN[r.god]}</span></td>`;
  }).join('');
  rows.push(`<tr><th scope="row"><b lang="zh">${dm}</b><span>${STEM_EN[dm]} · ${POL_EN[d.dayPolarityYang]} ${EL_EN[d.dayElement]}</span></th>${cells}</tr>`);
}

const head = STEMS.map(g => `<th scope="col" class="el-${EL_KEY[deriveTenGod(g, g).dayElement]}"><b lang="zh">${g}</b><span>${STEM_EN[g]}</span></th>`).join('');

console.log('<thead><tr><th scope="col" class="corner">Day Master ↓ / Stem →</th>' + head + '</tr></thead>');
console.log('<tbody>');
for (const r of rows) console.log(r);
console.log('</tbody>');
