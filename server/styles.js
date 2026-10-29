export const STRENGTHS = [
  {
    id: 'light',
    label: '轻润色',
    short: '轻',
    hint: '保留原句，只补关键质感',
    fragmentLimit: 3,
    styleLimit: 1,
    useTail: true,
    description: '轻度润色：保留用户原意与句式，只补充最关键的材质、光线与画质约束，适合已有明确想法的创作。',
  },
  {
    id: 'medium',
    label: '雅致',
    short: '雅',
    hint: '主体 + 美学结构，平衡自然',
    fragmentLimit: 6,
    styleLimit: 2,
    useTail: true,
    description: '中度润色：拆解主体、器型、材质、构图与光线，以克制的修饰密度形成完整的中式视觉描述。',
  },
  {
    id: 'deep',
    label: '极致',
    short: '极',
    hint: '专业成片级，细节与约束拉满',
    fragmentLimit: 9,
    styleLimit: 3,
    useTail: true,
    description: '深度润色：按专业摄影与美术指导的层级组织提示词，覆盖造型、材质、陈设、光影、色彩、景别与细节，并给出负面约束。',
  },
];

export const STYLES = [
  {
    id: 'auto',
    label: '自动',
    hint: '依主体气质匹配',
    fragments: [],
    negative: [],
    summary: '跟随主体气质的中式美学表达',
  },
  {
    id: 'song',
    label: '宋式雅集',
    hint: '克制、清雅、书卷气',
    fragments: [
      '宋式极简雅集气质，陈设克制',
      '书卷气与留白并重，气息清雅',
      '茶褐、月白与黛青的低饱和层次',
    ],
    negative: ['繁复雕饰', '艳俗配色'],
    summary: '宋式极简与文人雅集气质',
  },
  {
    id: 'ink',
    label: '水墨写意',
    hint: '墨分五色，笔意松弛',
    fragments: [
      '水墨写意气质，墨分五色',
      '笔意松弛，边缘自然晕开',
      '大面积留白与淡墨远山',
    ],
    negative: ['油画笔触', '照片写实', '浓艳色彩'],
    summary: '水墨氤氲、以虚写实',
  },
  {
    id: 'gongbi',
    label: '工笔重彩',
    hint: '细线晕染，局部精致',
    fragments: [
      '工笔画的细腻秩序，白描立骨',
      '设色层层晕染，色薄而透',
      '局部精致，背景大面积留白',
    ],
    negative: ['粗劣笔触', '卡通画风'],
    summary: '工笔细描与宋画设色',
  },
  {
    id: 'modern',
    label: '新中式',
    hint: '当代商业摄影质感',
    fragments: [
      '新中式商业摄影质感，干净当代',
      '柔和棚拍光，背景素净',
      '材质细节清晰，构图留白',
    ],
    negative: ['仿古商业街', '符号堆砌'],
    summary: '当代设计语言下的东方质感',
  },
  {
    id: 'cinematic',
    label: '东方电影',
    hint: '叙事光影，浅景深',
    fragments: [
      '东方电影感，叙事性光影',
      '浅景深与空气感，前中后景分明',
      '低饱和胶片颗粒，情绪含蓄',
    ],
    negative: ['电视剧质感', '平光', '过度锐化'],
    summary: '电影镜头里的东方叙事',
  },
  {
    id: 'zen',
    label: '极简禅意',
    hint: '一器一物，大面积空白',
    fragments: [
      '极简禅意，侘寂气息',
      '一器一物，大面积空白',
      '自然光与手工痕迹，安静质朴',
    ],
    negative: ['装饰堆砌', '工业量产感'],
    summary: '少即是多的禅意留白',
  },
];

export const RATIOS = [
  { id: '1:1', label: '1:1', size: '2048x2048', hint: '方图 · 器物' },
  { id: '3:4', label: '3:4', size: '1728x2304', hint: '竖图 · 人像' },
  { id: '4:3', label: '4:3', size: '2304x1728', hint: '横图 · 场景' },
  { id: '16:9', label: '16:9', size: '2560x1440', hint: '宽银幕 · 空间' },
  { id: '9:16', label: '9:16', size: '1440x2560', hint: '竖屏 · 海报' },
];

export const DEFAULT_NEGATIVE = [
  '低质量',
  '模糊',
  '噪点',
  '过曝',
  '高饱和',
  '塑料质感',
  '结构错误',
  '比例失调',
  '畸形',
  '文字乱码',
  '水印',
  'logo',
];

export function getStrength(id) {
  return STRENGTHS.find((item) => item.id === id) || STRENGTHS[1];
}

export function resolveStyle(id, input = '') {
  const explicit = STYLES.find((item) => item.id === id && item.id !== 'auto');
  if (explicit) return explicit;
  if (/水墨|山水|写意|墨色|书法/.test(input)) return STYLES.find((item) => item.id === 'ink');
  if (/工笔|花鸟|敦煌|壁画/.test(input)) return STYLES.find((item) => item.id === 'gongbi');
  if (/电影|胶片|故事|夜色/.test(input)) return STYLES.find((item) => item.id === 'cinematic');
  if (/禅|侘寂|极简|香道/.test(input)) return STYLES.find((item) => item.id === 'zen');
  if (/人像|女子|汉服|旗袍|妆造/.test(input)) return STYLES.find((item) => item.id === 'song');
  if (/商业|产品|海报|摄影/.test(input)) return STYLES.find((item) => item.id === 'modern');
  return STYLES[0];
}

export function getRatio(id) {
  return RATIOS.find((item) => item.id === id) || RATIOS[0];
}

export function strengthPayload() {
  return STRENGTHS.map(({ id, label, short, hint, description }) => ({
    id,
    label,
    short,
    hint,
    description,
  }));
}
