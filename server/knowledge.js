import fs from 'node:fs';
import path from 'node:path';
import { HttpError, shortId } from './utils.js';

const STOP_CHARS = new Set('的了是在和与及或把被让给向从到就都而也很更最着过吗呢啊吧之其以为于'.split(''));
const STOP_WORDS = new Set([
  '生成', '一张', '一个', '一幅', '帮我', '请', '图片', '画面', '照片', '想要', '需要', '可以',
  'the', 'a', 'an', 'of', 'and', 'with', 'to', 'in', 'on', 'for', 'image', 'photo',
]);

const CATEGORY_RULES = [
  ['器物·紫砂', ['紫砂', '宜兴', '泥料', '石瓢', '西施壶', '供春', '朱泥', '段泥']],
  ['器物·瓷器', ['青花', '瓷器', '汝窑', '青瓷', '釉色', '开片', '景德镇', '粉彩', '斗彩']],
  ['器物·家具', ['家具', '圈椅', '官帽椅', '明式', '榫卯', '黄花梨', '紫檀', '条案']],
  ['空间·园林', ['园林', '月洞门', '漏窗', '庭院', '回廊', '假山', '茶室', '纸窗', '竹帘']],
  ['绘画·水墨', ['水墨', '山水', '书法', '篆刻', '写意', '皴法', '墨色', '宣纸']],
  ['绘画·工笔', ['工笔', '花鸟', '敦煌', '飞天', '壁画', '白描', '绢本']],
  ['人物·服饰', ['汉服', '旗袍', '人物', '妆造', '仕女', '服饰', '马面裙', '人像']],
  ['建筑·新中式', ['建筑', '新中式', '屋檐', '白墙', '木格栅', '清水混凝土']],
  ['色彩·材质', ['色彩', '玉', '大漆', '螺钿', '铜器', '丝绸', '低饱和', '材质']],
  ['构图·光影', ['构图', '留白', '光影', '柔光', '景深', '微距', '摄影', '散点']],
  ['纹样·细节', ['纹样', '云纹', '回纹', '缠枝', '海水江崖', '刺绣']],
  ['场景·茶事', ['茶席', '茶道', '香道', '品茗', '茶汤', '茶具', '焚香']],
  ['节令·氛围', ['雪', '雨', '雾', '节令', '冬', '秋', '春', '夏']],
  ['质感·约束', ['负面', '约束', '避免', '失真']],
];

const TAG_VOCAB = [
  '紫砂壶', '宜兴紫砂', '紫砂', '紫泥', '朱泥', '段泥', '石瓢', '西施', '仿古', '供春',
  '器型', '壶嘴', '壶把', '壶盖', '桥形钮', '泥料', '砂粒', '包浆', '哑光', '茶席', '茶道',
  '茶汤', '品茗杯', '香道', '青花瓷', '青花', '汝窑', '青瓷', '天青', '开片', '釉色', '宋瓷',
  '明式家具', '圈椅', '榫卯', '黄花梨', '园林', '月洞门', '漏窗', '借景', '假山', '回廊',
  '水墨', '山水', '工笔', '花鸟', '敦煌', '飞天', '壁画', '汉服', '旗袍', '马面裙', '盘扣',
  '东方人像', '仕女', '妆造', '新中式', '建筑', '木格栅', '留白', '构图', '光影', '柔光',
  '侧逆光', '窗棂', '低饱和', '黛青', '月白', '朱砂', '赭石', '宣纸', '丝绸', '玉石', '大漆',
  '螺钿', '铜器', '纹样', '云纹', '缠枝莲', '刺绣', '节令', '雪', '雨', '雾', '微距', '景深',
];

const VISUAL_TERMS = [
  '色', '光', '影', '线', '纹', '质', '形', '器', '釉', '木', '石', '纸', '布', '丝', '玉',
  '铜', '茶', '花', '枝', '叶', '山', '水', '云', '雾', '雨', '雪', '窗', '墙', '院', '廊',
  '静', '雅', '润', '素', '淡', '古', '拙', '清', '柔', '薄', '透', '沉', '暖', '冷',
];

const QUERY_EXPANSIONS = {
  紫砂壶: ['宜兴紫砂', '器型', '泥料', '茶席'],
  紫砂: ['紫砂壶', '泥料', '砂粒', '茶席'],
  茶席: ['茶道', '茶具', '原木', '留白'],
  茶: ['茶席', '茶汤', '茶具', '静谧'],
  瓷器: ['青瓷', '釉色', '开片', '宋瓷'],
  青花: ['青花瓷', '钴蓝', '缠枝莲', '白瓷'],
  园林: ['江南', '月洞门', '借景', '庭院'],
  人像: ['东方人像', '妆造', '骨相', '柔光'],
  汉服: ['交领', '马面裙', '丝绸', '妆造'],
  旗袍: ['海派', '盘扣', '真丝', '民国'],
  水墨: ['山水', '墨色', '留白', '宣纸'],
  工笔: ['花鸟', '白描', '晕染', '绢本'],
  家具: ['明式', '圈椅', '榫卯', '木纹'],
  建筑: ['新中式', '屋檐', '白墙', '格栅'],
  香: ['香道', '香炉', '烟气', '禅意'],
  雪: ['冬', '枯枝', '薄雪', '清寒'],
  雨: ['湿润', '青石', '芭蕉', '冷光'],
};

function normalizeText(value = '') {
  return String(value).normalize('NFKC').replace(/\r\n/g, '\n').trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[|,，、;；\n]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function unique(values) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function safeId(value, fallback) {
  const id = normalizeText(value)
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return id || fallback;
}

export function tokenize(text = '') {
  const normalized = normalizeText(text).toLowerCase();
  const tokens = [];
  const latin = normalized.match(/[a-z][a-z0-9+#.-]{1,}/g) || [];
  for (const word of latin) {
    if (!STOP_WORDS.has(word) && word.length >= 2) tokens.push(word);
  }
  const hanRuns = normalized.match(/[\p{Script=Han}]+/gu) || [];
  for (const run of hanRuns) {
    for (let i = 0; i < run.length; i += 1) {
      const char = run[i];
      if (!STOP_CHARS.has(char)) tokens.push(char);
      if (i < run.length - 1) tokens.push(run.slice(i, i + 2));
      if (i < run.length - 2) tokens.push(run.slice(i, i + 3));
    }
    if (run.length <= 8) tokens.push(run);
  }
  for (const word of [...STOP_WORDS]) {
    if (normalized.includes(word)) {
      const index = tokens.indexOf(word);
      if (index >= 0) tokens.splice(index, 1);
    }
  }
  return tokens;
}

function addWeighted(target, text, weight) {
  for (const token of tokenize(text)) {
    target.set(token, (target.get(token) || 0) + weight);
  }
}

function buildDoc(entry) {
  const tf = new Map();
  addWeighted(tf, entry.title, 3.2);
  addWeighted(tf, asArray(entry.tags).join(' '), 2.8);
  addWeighted(tf, entry.category, 1.6);
  addWeighted(tf, entry.content, 1);
  addWeighted(tf, asArray(entry.promptFragments).join(' '), 1.25);
  let length = 0;
  for (const value of tf.values()) length += value;
  return { tf, length: Math.max(1, length) };
}

function inferCategory(text, fallback = '') {
  if (fallback) return fallback;
  for (const [category, keywords] of CATEGORY_RULES) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return '专业语料·待归类';
}

function inferTags(text, title = '') {
  return unique(TAG_VOCAB.filter((tag) => text.includes(tag) || title.includes(tag))).slice(0, 12);
}

function splitSentences(text) {
  return text
    .split(/(?<=[。！？!?；;\n])/u)
    .map((sentence) => sentence.trim().replace(/[。！？!?；;]+$/u, ''))
    .filter((sentence) => sentence.length >= 8 && sentence.length <= 96);
}

export function harvestFragments(content, limit = 4) {
  const sentences = splitSentences(content);
  const scored = sentences
    .map((sentence, index) => {
      let score = 0;
      for (const term of VISUAL_TERMS) if (sentence.includes(term)) score += 1;
      if (sentence.length >= 14 && sentence.length <= 60) score += 2;
      if (/[，,]/.test(sentence)) score += 1;
      return { sentence, score, index };
    })
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index);
  return unique(scored.map((item) => item.sentence.replace(/^[，,、\s]+/, '')));
}

function titleFromText(text, fallback = '未命名语料') {
  const first = text
    .split(/\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  if (!first) return fallback;
  return first.length > 30 ? `${first.slice(0, 30)}…` : first;
}

function splitLongText(content, maxLength = 760) {
  const paragraphs = content.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxLength) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) chunks.push(current);
  if (chunks.length === 1 && chunks[0].length > maxLength * 1.6) {
    const text = chunks[0];
    const sentences = text.split(/(?<=[。！？!?])/u);
    const merged = [];
    let buffer = '';
    for (const sentence of sentences) {
      if (buffer && buffer.length + sentence.length > maxLength) {
        merged.push(buffer);
        buffer = '';
      }
      buffer += sentence;
    }
    if (buffer) merged.push(buffer);
    return merged;
  }
  return chunks;
}

export function parseKnowledgeDocument({ filename = '手动录入', content = '', category = '' }) {
  const text = normalizeText(content).replace(/^\uFEFF/, '');
  if (!text) throw new HttpError(400, '语料内容为空');
  if (text.length > 50000) throw new HttpError(400, '单次导入请控制在 5 万字以内');

  const extension = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, extension) || '上传语料';
  const entries = [];

  if (extension === '.json') {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'JSON 文件解析失败，请检查格式');
    }
    const rawEntries = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(rawEntries)) {
      throw new HttpError(400, 'JSON 需为条目数组，或包含 entries 数组的对象');
    }
    for (const raw of rawEntries.slice(0, 100)) {
      if (!raw || typeof raw !== 'object') continue;
      const entryContent = normalizeText(raw.content || raw.text || '');
      if (!entryContent) continue;
      entries.push({
        title: normalizeText(raw.title) || titleFromText(entryContent, baseName),
        category: normalizeText(raw.category) || inferCategory(entryContent, category),
        tags: unique([...asArray(raw.tags), ...inferTags(entryContent, raw.title)]),
        content: entryContent,
        promptFragments: unique([
          ...asArray(raw.promptFragments || raw.fragments),
          ...harvestFragments(entryContent),
        ]).slice(0, 8),
        negativeFragments: asArray(raw.negativeFragments || raw.negative),
        source: normalizeText(raw.source) || filename,
      });
    }
  } else if (extension === '.md' || extension === '.markdown') {
    const headingPattern = /^(#{1,4})\s+(.+)$/gm;
    const heads = [...text.matchAll(headingPattern)];
    if (heads.length) {
      for (let i = 0; i < heads.length; i += 1) {
        const heading = heads[i];
        const start = heading.index + heading[0].length;
        const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
        const body = text.slice(start, end).trim();
        if (body.length < 12) continue;
        for (const chunk of splitLongText(body)) {
          entries.push({
            title: normalizeText(heading[2]),
            category: inferCategory(`${heading[2]}\n${chunk}`, category),
            tags: inferTags(`${heading[2]}\n${chunk}`, heading[2]),
            content: chunk,
            promptFragments: harvestFragments(chunk),
            negativeFragments: [],
            source: filename,
          });
        }
      }
    } else {
      for (const chunk of splitLongText(text)) {
        entries.push({
          title: titleFromText(chunk, baseName),
          category: inferCategory(chunk, category),
          tags: inferTags(chunk),
          content: chunk,
          promptFragments: harvestFragments(chunk),
          negativeFragments: [],
          source: filename,
        });
      }
    }
  } else {
    for (const chunk of splitLongText(text)) {
      entries.push({
        title: titleFromText(chunk, baseName),
        category: inferCategory(chunk, category),
        tags: inferTags(chunk),
        content: chunk,
        promptFragments: harvestFragments(chunk),
        negativeFragments: [],
        source: filename,
      });
    }
  }

  if (!entries.length) throw new HttpError(400, '未从文件中解析出有效语料');
  return entries.map((entry) => ({ ...entry, title: entry.title.slice(0, 100) })).slice(0, 80);
}

export class KnowledgeBase {
  constructor(config) {
    this.config = config;
    this.entries = [];
    this.index = { docs: new Map(), df: new Map(), avgLength: 1, tokenCount: 0 };
    this.updatedAt = null;
  }

  init() {
    fs.mkdirSync(this.config.dataDir, { recursive: true });
    if (fs.existsSync(this.config.knowledgeFile)) {
      try {
        const payload = JSON.parse(fs.readFileSync(this.config.knowledgeFile, 'utf8'));
        this.entries = (payload.entries || []).map((entry) => this.normalizeEntry(entry));
        this.updatedAt = payload.updatedAt || null;
      } catch (error) {
        console.warn('[knowledge] 运行数据损坏，回退到内置种子语料：', error.message);
      }
    }
    if (!this.entries.length) {
      this.entries = this.loadSeed();
      this.persist();
    }
    this.rebuild();
    return this;
  }

  loadSeed() {
    if (!fs.existsSync(this.config.seedFile)) return [];
    const payload = JSON.parse(fs.readFileSync(this.config.seedFile, 'utf8'));
    return (payload.entries || []).map((entry) => this.normalizeEntry({ ...entry, source: entry.source || '内置测试语料' }));
  }

  normalizeEntry(raw) {
    const content = normalizeText(raw.content);
    const title = normalizeText(raw.title) || titleFromText(content);
    return {
      id: safeId(raw.id, shortId('k')),
      title: title.slice(0, 120),
      category: normalizeText(raw.category) || inferCategory(content),
      tags: unique(asArray(raw.tags)),
      content,
      promptFragments: unique(asArray(raw.promptFragments)),
      negativeFragments: unique(asArray(raw.negativeFragments)),
      source: normalizeText(raw.source) || '未标注来源',
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }

  persist() {
    const payload = {
      version: 1,
      updatedAt: this.updatedAt,
      entries: this.entries,
    };
    const tmp = `${this.config.knowledgeFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, this.config.knowledgeFile);
  }

  rebuild() {
    const docs = new Map();
    const df = new Map();
    let totalLength = 0;
    for (const entry of this.entries) {
      const doc = buildDoc(entry);
      docs.set(entry.id, doc);
      totalLength += doc.length;
      for (const token of doc.tf.keys()) df.set(token, (df.get(token) || 0) + 1);
    }
    this.index = {
      docs,
      df,
      avgLength: this.entries.length ? totalLength / this.entries.length : 1,
      tokenCount: df.size,
    };
    return this.index;
  }

  stats() {
    const categories = new Map();
    for (const entry of this.entries) {
      categories.set(entry.category, (categories.get(entry.category) || 0) + 1);
    }
    return {
      entries: this.entries.length,
      categories: categories.size,
      terms: this.index.tokenCount,
      updatedAt: this.updatedAt,
      categoryList: [...categories.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  list({ q = '', category = '', limit = 100 } = {}) {
    let entries = this.entries;
    const safeLimit = Number(limit) || 100;
    if (normalizeText(q)) {
      const scored = this.search(q, { topK: Math.max(this.entries.length, safeLimit) });
      const byId = new Map(scored.map((item) => [item.entry.id, item.score]));
      entries = scored
        .map((item) => item.entry)
        .filter((entry) => !category || entry.category === category)
        .slice(0, safeLimit);
      return entries.map((entry) => ({ ...entry, _score: Number((byId.get(entry.id) || 0).toFixed(3)) }));
    }
    if (category) entries = entries.filter((entry) => entry.category === category);
    return entries
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, safeLimit);
  }

  get(id) {
    return this.entries.find((entry) => entry.id === id) || null;
  }

  search(query, { topK = 5, includeConstraint = false } = {}) {
    const text = normalizeText(query);
    if (!text) return [];
    const baseTerms = unique(tokenize(text));
    const queryTerms = new Map();
    for (const token of baseTerms) queryTerms.set(token, 1);
    for (const [key, expansions] of Object.entries(QUERY_EXPANSIONS)) {
      if (!text.includes(key)) continue;
      for (const expansion of expansions) {
        for (const token of tokenize(expansion)) {
          if (!queryTerms.has(token)) queryTerms.set(token, 0.55);
        }
      }
    }

    const N = this.entries.length || 1;
    const { docs, df, avgLength } = this.index;
    const results = [];
    for (const entry of this.entries) {
      if (!includeConstraint && entry.category === '质感·约束') continue;
      const doc = docs.get(entry.id);
      if (!doc) continue;
      let score = 0;
      for (const [token, weight] of queryTerms) {
        const tf = doc.tf.get(token) || 0;
        if (!tf) continue;
        const docFreq = df.get(token) || 0;
        const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
        const saturation = (tf * 2.4) / (tf + 1.2 * (1 - 0.72 + (0.72 * doc.length) / avgLength));
        score += idf * saturation * weight;
      }
      const lowerTitle = entry.title.toLowerCase();
      const lowerQuery = text.toLowerCase();
      if (lowerTitle.includes(lowerQuery)) score += 3.2;
      for (const tag of entry.tags) {
        const lowerTag = tag.toLowerCase();
        if (lowerQuery.includes(lowerTag)) score += lowerTag.length >= 2 ? 1.35 : 0.3;
        else if (lowerTag.includes(lowerQuery)) score += 0.45;
      }
      if (score > 0.08) {
        results.push({
          entry,
          score,
          matched: [...queryTerms.keys()].filter((token) => doc.tf.has(token)).slice(0, 8),
        });
      }
    }
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK))
      .map((item) => ({ ...item, score: Number(item.score.toFixed(3)) }));
  }

  add(raw) {
    if (!raw || typeof raw !== 'object') throw new HttpError(400, '请提交语料对象');
    if (this.entries.length >= this.config.maxEntries) {
      throw new HttpError(400, `知识库已达到 ${this.config.maxEntries} 条上限`);
    }
    const content = normalizeText(raw.content);
    if (!content) throw new HttpError(400, '请填写语料正文');
    if (content.length > 12000) throw new HttpError(400, '单条语料请控制在 1.2 万字以内');
    const entry = this.normalizeEntry({
      ...raw,
      id: shortId('k'),
      content,
      source: normalizeText(raw.source) || '专业补充',
      promptFragments: asArray(raw.promptFragments).length
        ? raw.promptFragments
        : harvestFragments(content),
      createdAt: new Date().toISOString(),
    });
    this.entries.push(entry);
    this.updatedAt = new Date().toISOString();
    this.persist();
    this.rebuild();
    return entry;
  }

  importDocument({ filename, content, category = '' }) {
    const parsed = parseKnowledgeDocument({ filename, content, category });
    const room = this.config.maxEntries - this.entries.length;
    if (room <= 0) throw new HttpError(400, `知识库已达到 ${this.config.maxEntries} 条上限`);
    const added = parsed.slice(0, room).map((item) =>
      this.normalizeEntry({
        ...item,
        id: shortId('k'),
        source: item.source || filename || '上传语料',
        createdAt: new Date().toISOString(),
      }),
    );
    this.entries.push(...added);
    this.updatedAt = new Date().toISOString();
    this.persist();
    this.rebuild();
    return { added: added.length, skipped: Math.max(0, parsed.length - added.length), entries: added };
  }

  remove(id) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new HttpError(404, '未找到该条语料');
    const [removed] = this.entries.splice(index, 1);
    this.updatedAt = new Date().toISOString();
    this.persist();
    this.rebuild();
    return removed;
  }

  reset() {
    const seed = this.loadSeed();
    if (!seed.length) throw new HttpError(500, '内置种子语料缺失');
    this.entries = seed;
    this.updatedAt = new Date().toISOString();
    this.persist();
    this.rebuild();
    return this.stats();
  }
}
