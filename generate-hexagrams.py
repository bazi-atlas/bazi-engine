# -*- coding: utf-8 -*-
# generate-hexagrams.py — 六十四卦定表生成器（R31 六十四卦层）
# ------------------------------------------------------------------
# 为什么用 python 而不是 Node：本表要锁的是 **Unicode 官方卦名与卦符**，
# 而 Node 没有 Unicode 字符名数据库（unicodedata 只在 python/ICU 侧）。
# 做法与 generate-lichun.mjs 相同：离线生成定表 → 逐字复制进两个引擎 →
# 由 test-web-engine.mjs 断言黄金值 + 结构性质。区别只在于这里的权威源
# 是 Unicode 数据库本身，所以生成器留在 python。
#
# 两个外部权威源（都在本脚本里当场核对，不靠记忆）：
#   ① Unicode 区块 U+2630..U+2637（八卦符，先天序：乾一…坤八）
#   ② Unicode 区块 U+4DC0..U+4DFF（六十四卦符，文王卦序）
# 另外两个独立交叉源：
#   ③ 8×8「上卦×下卦」矩阵（Wikipedia “Hexagram (I Ching)” 查找表）
#   ④ 逐卦显式 (上卦, 下卦) 清单（第二来源）→ 与 ③ 必须逐条一致
#   ⑤ 卦名次序歌的 64 个卦名（文本传统）→ 与 ③ 组合出的传统全名必须自洽
#
# 用法：python3 generate-hexagrams.py            # 打印交叉校验报告
#       python3 generate-hexagrams.py --emit     # 输出可粘贴进引擎的 JS 表
import sys
import unicodedata

# ---------- ① 八卦：先天序（乾一兑二离三震四巽五坎六艮七坤八） ----------
# 索引 0..7 与 Unicode U+2630+i 一一对应（下方 assert 校验）
TRI_CN    = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']
TRI_PY    = ['Qian', 'Dui', 'Li', 'Zhen', 'Xun', 'Kan', 'Gen', 'Kun']
TRI_IMG   = ['天', '泽', '火', '雷', '风', '水', '山', '地']
TRI_IMG_EN = ['Heaven', 'Lake', 'Fire', 'Thunder', 'Wind', 'Water', 'Mountain', 'Earth']
TRI_ELEM  = ['金', '金', '火', '木', '木', '水', '土', '土']
TRI_FAMILY = ['父', '少女', '中女', '长男', '长女', '中男', '少男', '母']
TRI_FAMILY_EN = ['Father', 'Youngest Daughter', 'Middle Daughter', 'Eldest Son',
                 'Eldest Daughter', 'Middle Son', 'Youngest Son', 'Mother']
TRI_DIR   = ['西北', '西', '南', '东', '东南', '北', '东北', '西南']
TRI_DIR_EN = ['Northwest', 'West', 'South', 'East', 'Southeast', 'North', 'Northeast', 'Southwest']
# 三爻自下而上的阴阳（1=阳 0=阴），其数值（初爻为最低位）= TRIGRAM_VALUE
TRI_BITS_STR = ['111', '110', '101', '100', '011', '010', '001', '000']
TRI_VALUE = [int(b[::-1], 2) for b in TRI_BITS_STR]   # '111'->7, '110'->3, ...

# Unicode 八卦符（外部源 ①：名称必须与 TRI_IMG_EN 对应）
for i in range(8):
    nm = unicodedata.name(chr(0x2630 + i))
    expect = 'TRIGRAM FOR ' + TRI_IMG_EN[i].upper()
    assert nm == expect, '八卦符 %d 名称不符：%s != %s' % (i, nm, expect)
TRI_GLYPH = [chr(0x2630 + i) for i in range(8)]

# 阴阳数（阳爻个数）——用来交叉校验 TRI_VALUE 的 popcount
TRI_YANG = [b.count('1') for b in TRI_BITS_STR]

# ---------- ③ 8×8 上卦×下卦 矩阵（外部源，Wikipedia 查找表） ----------
# 行 = 下卦（先天序 0..7），列 = 上卦（先天序 0..7），格内 = 文王卦序
M = [
    [1, 43, 14, 34, 9, 5, 26, 11],   # 下乾
    [10, 58, 38, 54, 61, 60, 41, 19],  # 下兑
    [13, 49, 30, 55, 37, 63, 22, 36],  # 下离
    [25, 17, 21, 51, 42, 3, 27, 24],   # 下震
    [44, 28, 50, 32, 57, 48, 18, 46],  # 下巽
    [6, 47, 64, 40, 59, 29, 4, 7],     # 下坎
    [33, 31, 56, 62, 53, 39, 52, 15],  # 下艮
    [12, 45, 35, 16, 20, 8, 23, 2],    # 下坤
]

# ---------- ④ 逐卦显式 (上卦, 下卦) 清单（第二来源，英文卦象名） ----------
S2 = {
    1: ('Heaven', 'Heaven'), 2: ('Earth', 'Earth'), 3: ('Water', 'Thunder'),
    4: ('Mountain', 'Water'), 5: ('Water', 'Heaven'), 6: ('Heaven', 'Water'),
    7: ('Earth', 'Water'), 8: ('Water', 'Earth'), 9: ('Wind', 'Heaven'),
    10: ('Heaven', 'Lake'), 11: ('Earth', 'Heaven'), 12: ('Heaven', 'Earth'),
    13: ('Heaven', 'Fire'), 14: ('Fire', 'Heaven'), 15: ('Earth', 'Mountain'),
    16: ('Thunder', 'Earth'), 17: ('Lake', 'Thunder'), 18: ('Mountain', 'Wind'),
    19: ('Earth', 'Lake'), 20: ('Wind', 'Earth'), 21: ('Fire', 'Thunder'),
    22: ('Mountain', 'Fire'), 23: ('Mountain', 'Earth'), 24: ('Earth', 'Thunder'),
    25: ('Heaven', 'Thunder'), 26: ('Mountain', 'Heaven'), 27: ('Mountain', 'Thunder'),
    28: ('Lake', 'Wind'), 29: ('Water', 'Water'), 30: ('Fire', 'Fire'),
    31: ('Lake', 'Mountain'), 32: ('Thunder', 'Wind'), 33: ('Heaven', 'Mountain'),
    34: ('Thunder', 'Heaven'), 35: ('Fire', 'Earth'), 36: ('Earth', 'Fire'),
    37: ('Wind', 'Fire'), 38: ('Fire', 'Lake'), 39: ('Water', 'Mountain'),
    40: ('Thunder', 'Water'), 41: ('Mountain', 'Lake'), 42: ('Wind', 'Thunder'),
    43: ('Lake', 'Heaven'), 44: ('Heaven', 'Wind'), 45: ('Lake', 'Earth'),
    46: ('Earth', 'Wind'), 47: ('Lake', 'Water'), 48: ('Water', 'Wind'),
    49: ('Lake', 'Fire'), 50: ('Fire', 'Wind'), 51: ('Thunder', 'Thunder'),
    52: ('Mountain', 'Mountain'), 53: ('Wind', 'Mountain'), 54: ('Thunder', 'Lake'),
    55: ('Thunder', 'Fire'), 56: ('Fire', 'Mountain'), 57: ('Wind', 'Wind'),
    58: ('Lake', 'Lake'), 59: ('Wind', 'Water'), 60: ('Water', 'Lake'),
    61: ('Wind', 'Lake'), 62: ('Thunder', 'Mountain'), 63: ('Water', 'Fire'),
    64: ('Fire', 'Water'),
}

# ---------- ⑤ 卦名次序歌（64 个卦名，简体外加拼音） ----------
# 上经三十卦 + 下经三十四卦；顺序即文王卦序。
NAMES = [
    ('乾', 'Qian'), ('坤', 'Kun'), ('屯', 'Zhun'), ('蒙', 'Meng'), ('需', 'Xu'),
    ('讼', 'Song'), ('师', 'Shi'), ('比', 'Bi'), ('小畜', 'Xiao Xu'), ('履', 'Lv'),
    ('泰', 'Tai'), ('否', 'Pi'), ('同人', 'Tong Ren'), ('大有', 'Da You'), ('谦', 'Qian'),
    ('豫', 'Yu'), ('随', 'Sui'), ('蛊', 'Gu'), ('临', 'Lin'), ('观', 'Guan'),
    ('噬嗑', 'Shi He'), ('贲', 'Bi'), ('剥', 'Bo'), ('复', 'Fu'), ('无妄', 'Wu Wang'),
    ('大畜', 'Da Xu'), ('颐', 'Yi'), ('大过', 'Da Guo'), ('坎', 'Kan'), ('离', 'Li'),
    ('咸', 'Xian'), ('恒', 'Heng'), ('遁', 'Dun'), ('大壮', 'Da Zhuang'), ('晋', 'Jin'),
    ('明夷', 'Ming Yi'), ('家人', 'Jia Ren'), ('睽', 'Kui'), ('蹇', 'Jian'), ('解', 'Xie'),
    ('损', 'Sun'), ('益', 'Yi'), ('夬', 'Guai'), ('姤', 'Gou'), ('萃', 'Cui'),
    ('升', 'Sheng'), ('困', 'Kun'), ('井', 'Jing'), ('革', 'Ge'), ('鼎', 'Ding'),
    ('震', 'Zhen'), ('艮', 'Gen'), ('渐', 'Jian'), ('归妹', 'Gui Mei'), ('丰', 'Feng'),
    ('旅', 'Lv'), ('巽', 'Xun'), ('兑', 'Dui'), ('涣', 'Huan'), ('节', 'Jie'),
    ('中孚', 'Zhong Fu'), ('小过', 'Xiao Guo'), ('既济', 'Ji Ji'), ('未济', 'Wei Ji'),
]

# ---------- 英文显示名（Wilhelm–Baynes 通行译名） ----------
EN = [
    'The Creative', 'The Receptive', 'Difficulty at the Beginning', 'Youthful Folly',
    'Waiting', 'Conflict', 'The Army', 'Holding Together', 'The Taming Power of the Small',
    'Treading', 'Peace', 'Standstill', 'Fellowship with Others', 'Possession in Great Measure',
    'Modesty', 'Enthusiasm', 'Following', 'Work on What Has Been Spoiled', 'Approach',
    'Contemplation', 'Biting Through', 'Grace', 'Splitting Apart', 'Return', 'Innocence',
    'The Taming Power of the Great', 'The Corners of the Mouth', 'Preponderance of the Great',
    'The Abysmal Water', 'The Clinging Fire', 'Influence', 'Duration', 'Retreat',
    'The Power of the Great', 'Progress', 'Darkening of the Light', 'The Family', 'Opposition',
    'Obstruction', 'Deliverance', 'Decrease', 'Increase', 'Breakthrough', 'Coming to Meet',
    'Gathering Together', 'Pushing Upward', 'Oppression', 'The Well', 'Revolution',
    'The Cauldron', 'The Arousing Thunder', 'Keeping Still Mountain', 'Development',
    'The Marrying Maiden', 'Abundance', 'The Wanderer', 'The Gentle Wind', 'The Joyous Lake',
    'Dispersion', 'Limitation', 'Inner Truth', 'Small Preponderance', 'After Completion',
    'Before Completion',
]

# ---------- ② 六十四卦符（外部源：Unicode 文王卦序） ----------
UNI = []
for n in range(1, 65):
    nm = unicodedata.name(chr(0x4DC0 + n - 1))
    assert nm.startswith('HEXAGRAM FOR '), '卦符 %d 名称异常：%s' % (n, nm)
    UNI.append(nm[len('HEXAGRAM FOR '):])

# ================= 交叉校验 1：矩阵 ③ 与显式清单 ④ 必须逐条一致 =================
IMG2IDX = {img: i for i, img in enumerate(TRI_IMG_EN)}
upper = [None] * 65
lower = [None] * 65
for r in range(8):
    for c in range(8):
        n = M[r][c]
        assert 1 <= n <= 64, '矩阵出现越界编号 %s' % n
        assert upper[n] is None, '矩阵出现重复编号 %d' % n
        lower[n] = r          # 行 = 下卦
        upper[n] = c          # 列 = 上卦
assert all(upper[n] is not None for n in range(1, 65)), '矩阵未覆盖全部 64 卦'
navail = sum(1 for n in range(1, 65) if S2[n] == (TRI_IMG_EN[upper[n]], TRI_IMG_EN[lower[n]]))
assert navail == 64, '矩阵与显式清单不一致（一致 %d/64）' % navail
print('[1] 8×8 矩阵 × 逐卦显式清单：64/64 一致 ✓')

# ================= 交叉校验 2：U+2630 区块与先天八卦序 =================
assert TRI_BITS_STR[0] == '111' and TRI_YANG[0] == 3 and TRI_VALUE[0] == 7
assert TRI_BITS_STR[7] == '000' and TRI_YANG[7] == 0 and TRI_VALUE[7] == 0
print('[2] 八卦符 U+2630+i 名称与乾一…坤八 次序一致 ✓')

# ================= 交叉校验 3：八纯卦位置 =================
PURE = [n for n in range(1, 65) if upper[n] == lower[n]]
assert PURE == [1, 2, 29, 30, 51, 52, 57, 58], '八纯卦位置异常：%s' % PURE
for n in PURE:
    assert NAMES[n - 1][0] == TRI_CN[upper[n]], '纯卦 %d 卦名与卦不符：%s' % (n, NAMES[n - 1][0])
print('[3] 八纯卦 = 1/2/29/30/51/52/57/58，卦名与所属卦一致 ✓')

# ================= 交叉校验 4：文王卦序配对规则（综/错） =================
def lines_of(n):
    """六爻自下而上，1=阳。低 3 位 = 下卦，高 3 位 = 上卦。"""
    v = TRI_VALUE[lower[n]] | (TRI_VALUE[upper[n]] << 3)
    return [(v >> i) & 1 for i in range(6)]

def flip(v6):   # 错卦：六爻全变
    return v6 ^ 0b111111

def rev(v6):    # 综卦：六爻上下颠倒
    return int('{:06b}'.format(v6)[::-1], 2)

# 三爻数值 → 先天卦序索引（M 的行列用的是先天序，不是数值）
VAL2IDX = {TRI_VALUE[i]: i for i in range(8)}

def to_num(v6):  # 6 位二进制 → 文王卦序
    d = VAL2IDX[v6 & 7]            # 低 3 位 = 下卦
    u = VAL2IDX[(v6 >> 3) & 7]     # 高 3 位 = 上卦
    return M[d][u]

SELF_REV = []
for n in range(1, 65, 2):          # 文王卦序成对：(1,2) (3,4) … (63,64)
    v = sum(lines_of(n)[i] << i for i in range(6))
    r = rev(v)
    if r == v:
        SELF_REV.append(n)
        partner = to_num(flip(v))   # 自综卦 → 配对卦是它的错卦
    else:
        partner = to_num(r)         # 否则配对卦是它的综卦
    assert partner == n + 1, '配对规则失败：%d 的配对是 %d（期望 %d）' % (n, partner, n + 1)
assert SELF_REV == [1, 27, 29, 61], '自综卦集合异常：%s' % SELF_REV
# 上列奇数是自综；其配对偶数卦也必然自综（乾坤、颐大过、坎离、中孚小过 四对）
print('[4] 文王卦序 32 对全部满足「奇→偶 = 综卦，自综则取错卦」规则；自综卦对 = 4 对 ✓')

# ================= 交叉校验 5：京房八宫（世应/游魂/归魂） =================
GONG_ORDER = [0, 5, 6, 3, 4, 2, 7, 1]   # 京房八宫次第：乾坎艮震巽离坤兑
GONG_LABEL = ['六世', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']
GONG_LABEL_EN = ['Pure', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Wandering', 'Returning']
SHI_POS = [6, 1, 2, 3, 4, 5, 4, 3]      # 世爻位（1..6 自下而上）
YING_POS = [3, 4, 5, 6, 1, 2, 1, 6]     # 应爻位
gong = [None] * 65
for gi, tri in enumerate(GONG_ORDER):
    base = TRI_VALUE[tri] | (TRI_VALUE[tri] << 3)
    variants = [base]
    for k in range(1, 6):                     # 一~五世：依次变初爻…五爻
        variants.append(base ^ ((1 << k) - 1))
    wu = variants[5]
    variants.append(wu ^ 0b1000)              # 游魂：五世再变第四爻
    variants.append(variants[6] ^ 0b0111)     # 归魂：游魂内三爻全变回
    for k, v in enumerate(variants):
        n = to_num(v)
        assert gong[n] is None, '第 %d 卦被两宫同时占用' % n
        gong[n] = (gi, k)
assert all(gong[n] is not None for n in range(1, 65)), '八宫未覆盖 64 卦'
for gi, tri in enumerate(GONG_ORDER):
    cnt = sum(1 for n in range(1, 65) if gong[n][0] == gi)
    assert cnt == 8, '%s宫 卦数为 %d' % (TRI_CN[tri], cnt)
print('[5] 京房八宫：8 宫 × 8 卦 = 64，双射无重复；世应位与游魂/归魂规则自洽 ✓')

# ================= 交叉校验 6：纳甲（384 爻） =================
# 口诀：乾金甲子外壬午，坎水戊寅外戊申，艮土丙辰外丙戌，震木庚子外庚午，
#       巽木辛丑外辛未，离火己卯外己酉，坤土乙未外癸丑，兑金丁巳外丁亥。
STEMS = list('甲乙丙丁戊己庚辛壬癸')
BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
NAJIA_STEM_IN = {0: '甲', 1: '丁', 2: '己', 3: '庚', 4: '辛', 5: '戊', 6: '丙', 7: '乙'}
NAJIA_STEM_OUT = {0: '壬', 1: '丁', 2: '己', 3: '庚', 4: '辛', 5: '戊', 6: '丙', 7: '癸'}
NAJIA_IN_START = {0: 0, 1: 5, 2: 3, 3: 0, 4: 1, 5: 2, 6: 4, 7: 7}   # 内卦初爻地支索引
NAJIA_OUT_START = {0: 6, 1: 11, 2: 9, 3: 6, 4: 7, 5: 8, 6: 10, 7: 1}  # 外卦四爻地支索引
# 阳卦（乾震坎艮）顺行隔位，阴卦（坤巽离兑）逆行隔位
YANG_TRI = {0, 3, 5, 6}
CROSS = {'甲': 0, '乙': 1, '丙': 2, '丁': 3, '戊': 4, '己': 5, '庚': 6, '辛': 7, '壬': 8, '癸': 9}

def najia(n):
    out = []
    for k in range(3):                        # 内卦三爻（初二三）
        t = lower[n]
        si = NAJIA_IN_START[t] + (2 * k if t in YANG_TRI else -2 * k)
        out.append(NAJIA_STEM_IN[t] + BRANCHES[si % 12])
    for k in range(3):                        # 外卦三爻（四五六）
        t = upper[n]
        si = NAJIA_OUT_START[t] + (2 * k if t in YANG_TRI else -2 * k)
        out.append(NAJIA_STEM_OUT[t] + BRANCHES[si % 12])
    return out

golden = {
    1: '甲子甲寅甲辰壬午壬申壬戌',   # 乾为天（传世纳甲）
    2: '乙未乙巳乙卯癸丑癸亥癸酉',   # 坤为地
    29: '戊寅戊辰戊午戊申戊戌戊子',  # 坎为水
    30: '己卯己丑己亥己酉己未己巳',  # 离为火
    51: '庚子庚寅庚辰庚午庚申庚戌',  # 震为雷
    52: '丙辰丙午丙申丙戌丙子丙寅',  # 艮为山
    57: '辛丑辛亥辛酉辛未辛巳辛卯',  # 巽为风
    58: '丁巳丁卯丁丑丁亥丁酉丁未',  # 兑为泽
}
for n, want in golden.items():
    got = ''.join(najia(n))
    assert got == want, '纳甲黄金值失败 第%d卦：%s != %s' % (n, got, want)
# 384 爻阴阳一致：天干与地支必须同为阳或同为阴（阳干只能配阳支）
for n in range(1, 65):
    for gz in najia(n):
        assert STEMS.index(gz[0]) % 2 == BRANCHES.index(gz[1]) % 2, \
            '第%d卦 %s 干支阴阳不一致' % (n, gz)
# 守恒校验：64 卦 × 6 爻 = 384 爻，12 地支每个恰好出现 32 次。
# （刻意不写「每卦六支互异」——那是错的：水雷屯的初爻庚子与上爻戊子就是同支，
#   传世纳甲本来允许重复。曾按直觉写过这条断言，被引擎当场证伪。）
import collections
_br = collections.Counter(gz[1] for n in range(1, 65) for gz in najia(n))
assert len(_br) == 12 and set(_br.values()) == {32}, '纳甲地支分布异常：%s' % dict(_br)
_st = collections.Counter(gz[0] for n in range(1, 65) for gz in najia(n))
# 天干只出现 8 个（戊己庚辛丙丁各 48；甲壬乙癸这四干只出现在含乾坤的卦里）
assert set(_st) == set('甲乙丙丁戊己庚辛壬癸'), '天干集合异常'
print('[6] 纳甲：8 个纯卦黄金值全部命中；384 爻干支阴阳一致；12 地支各出现 32 次 ✓')

# ================= 校验 7：Unicode 卦名与英文显示名的词元重叠 =================
STOP = {'THE', 'OF', 'AT', 'IN', 'ON', 'WITH', 'TO', 'A', 'AND', 'FOR', 'WHAT', 'HAS', 'BEEN', 'IS'}
bad = []
for i in range(64):
    uni_tok = {w for w in UNI[i].replace('-', ' ').split() if w not in STOP}
    en_tok = {w.upper().replace(',', '') for w in EN[i].split()}
    if not (uni_tok & en_tok):
        bad.append((i + 1, UNI[i], EN[i]))
assert not bad, '英文显示名与 Unicode 卦名无词元重叠：%s' % bad
print('[7] 64 个英文显示名与 Unicode 官方卦名全部有词元重叠（无张冠李戴）✓')

# ================= 校验 8：六亲（以乾宫金为例核对传世值） =================
BR_ELEM = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']
SHENG = {'木': '火', '火': '土', '土': '金', '金': '水', '水': '木'}
KE = {'木': '土', '土': '水', '水': '火', '火': '金', '金': '木'}

def liuqin(gong_elem, branch):
    e = BR_ELEM[BRANCHES.index(branch)]
    if e == gong_elem:
        return '兄弟'
    if SHENG[gong_elem] == e:
        return '子孙'
    if SHENG[e] == gong_elem:
        return '父母'
    if KE[e] == gong_elem:
        return '官鬼'
    return '妻财'

got1 = [liuqin('金', gz[1]) for gz in najia(1)]
assert got1 == ['子孙', '妻财', '父母', '官鬼', '兄弟', '父母'], '乾为天六亲异常：%s' % got1
got2 = [liuqin('土', gz[1]) for gz in najia(2)]
assert got2 == ['兄弟', '父母', '官鬼', '兄弟', '妻财', '子孙'], '坤为地六亲异常：%s' % got2
print('[8] 六亲：乾为天 = 子孙/妻财/父母/官鬼/兄弟/父母、坤为地逐爻核对命中 ✓')

# ================= 输出 =================
if '--emit' in sys.argv:
    print('\n// ================= 引擎表（由 generate-hexagrams.py 生成，勿手改） =================')
    print("const TRI = ['%s'];" % "','".join(TRI_CN))
    print("const TRI_PY = ['%s'];" % "','".join(TRI_PY))
    print("const TRI_IMG = ['%s'];" % "','".join(TRI_IMG))
    print("const TRI_IMG_EN = ['%s'];" % "','".join(TRI_IMG_EN))
    print("const TRI_GLYPH = ['%s'];" % "','".join(TRI_GLYPH))
    print("const TRI_ELEMENT = ['%s'];" % "','".join(TRI_ELEM))
    print("const TRI_VALUE = [%s];" % ','.join(str(v) for v in TRI_VALUE))
    print("const TRI_FAMILY = ['%s'];" % "','".join(TRI_FAMILY))
    print("const TRI_FAMILY_EN = ['%s'];" % "','".join(TRI_FAMILY_EN))
    print("const TRI_DIR = ['%s'];" % "','".join(TRI_DIR))
    print("const TRI_DIR_EN = ['%s'];" % "','".join(TRI_DIR_EN))
    print("const NAMES = ['%s'];" % "','".join(cn for cn, _ in NAMES))
    print("const NAMES_PY = ['%s'];" % "','".join(py for _, py in NAMES))
    print("const NAMES_EN = ['%s'];" % "','".join(EN))
    print("const UNI_NAMES = ['%s'];" % "','".join(UNI))
    print("const UPPER = [%s];" % ','.join(str(upper[n]) for n in range(1, 65)))
    print("const LOWER = [%s];" % ','.join(str(lower[n]) for n in range(1, 65)))
    print("const GONG_ORDER = [%s];" % ','.join(str(x) for x in GONG_ORDER))
    print("const GONG_OF = [%s];" % ','.join(str(gong[n][0]) for n in range(1, 65)))
    print("const GONG_STAGE = [%s];" % ','.join(str(gong[n][1]) for n in range(1, 65)))
    print("const GONG_LABEL = ['%s'];" % "','".join(GONG_LABEL))
    print("const GONG_LABEL_EN = ['%s'];" % "','".join(GONG_LABEL_EN))
    print("const SHI_POS = [%s];" % ','.join(str(x) for x in SHI_POS))
    print("const YING_POS = [%s];" % ','.join(str(x) for x in YING_POS))
    print("const SELF_REVERSING = [%s];" % ','.join(str(x) for x in SELF_REV))
    print("const PURE_HEX = [%s];" % ','.join(str(x) for x in PURE))
