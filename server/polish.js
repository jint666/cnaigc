import { harvestFragments, tokenize } from './knowledge.js';
import {
  defaultLlmModel,
  getLlmModel,
  isLlmModelAvailable,
  llmApiModel,
} from './llm-models.js';
import {
  DEFAULT_NEGATIVE,
  STYLES,
  getStrength,
  resolveStyle,
} from './styles.js';

const REQUEST_PREFIXES = [
  '请帮我', '麻烦帮我', '帮我', '请', '麻烦', '我想', '我要', '我需要', '想要', '需要',
  '生成', '绘制', '画', '做', '来', '给我', '出一', '输出',
];

const SCENE_VERBS = /穿|站|坐|躺|放|摆|正在|倚|靠|端|拿|持|倒|走|回|望|飘|落|流|映|悬|挂|盛|飞|游|卧|俯|仰|侧身|回头/;

const CLASSIFIERS = [
  [/壶|茶壶/, '一把'],
  [/人|女子|少女|仕女|男子|公子|孩童|老者/, '一位'],
  [/园林|庭院|院落|建筑|宫殿|楼阁|桥|塔|亭/, '一座'],
  [/茶席|香席|空间|场景|角落/, '一处'],
  [/瓶|瓷|盏|杯|器|炉|砚|印|佩|首饰|衣|袍|裙|扇|琴|香|画|作品/, '一件'],
  [/花|枝|莲|梅|兰|竹/, '一枝'],
  [/灯|烛/, '一盏'],
  [/猫|鸟|鱼|鹤|鹿/, '一只'],
  [/山水|风景|远景|山峦/, '一幅'],
];

function stripRequest(text) {
  let result = text.trim().replace(/[，。；;,.!?！？\s]+$/u, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of REQUEST_PREFIXES) {
      if (result.startsWith(prefix)) {
        result = result.slice(prefix.length).replace(/^[，,。\s]+/u, '');
        changed = true;
      }
    }
  }
  return result || text.trim();
}

function classify(noun) {
  for (const [pattern, classifier] of CLASSIFIERS) {
    if (pattern.test(noun)) return classifier;
  }
  return '一件';
}

export function extractSubject(input) {
  const cleaned = stripRequest(String(input || '').slice(0, 800));
  const isScene = cleaned.length > 20 || /[，,；;]/u.test(cleaned) || SCENE_VERBS.test(cleaned);
  if (isScene) {
    return {
      simple: false,
      phrase: cleaned,
      opening: `生成一幅东方美学画面，${cleaned}`,
    };
  }

  const withoutMeasure = cleaned.replace(/^一[个位把件座只幅组些张处枝盏轮缕卷方]/u, '').trim();
  const noun = withoutMeasure || cleaned;
  const hasCultureWord = /中式|东方|国风|宋式|明式|海派|敦煌|江南/.test(noun);
  const isPerson = /人|女子|少女|仕女|男子|公子|孩童|老者/.test(noun);
  const phrase = `${classify(noun)}${hasCultureWord ? '' : isPerson ? '东方' : '中式'}${noun}`;
  return {
    simple: true,
    phrase,
    opening: `生成${phrase}`,
  };
}

function dedupeClauses(clauses) {
  const seen = new Set();
  const result = [];
  for (const clause of clauses) {
    const normalized = String(clause || '')
      .replace(/^[，,、\s]+|[。；;，,\s]+$/gu, '')
      .trim();
    if (!normalized || normalized.length < 3) continue;
    const key = normalized.replace(/[，,。.\s]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function referenceFragments(reference) {
  const entry = reference.entry;
  const explicit = Array.isArray(entry.promptFragments) ? entry.promptFragments : [];
  return explicit.length ? explicit : harvestFragments(entry.content, 4);
}

function pickReferenceFragments(references, limit) {
  const quotas = limit <= 3 ? [2, 1, 1] : limit <= 6 ? [2, 2, 1, 1] : [3, 3, 2, 1, 1, 1];
  const picked = [];
  const used = new Set();
  references.forEach((reference, index) => {
    const quota = quotas[index] || 0;
    if (quota <= 0) return;
    let taken = 0;
    for (const fragment of referenceFragments(reference)) {
      if (picked.length >= limit || taken >= quota) break;
      const key = fragment.replace(/[，,。.\s]/g, '');
      if (used.has(key)) continue;
      used.add(key);
      picked.push(fragment);
      taken += 1;
    }
  });

  if (picked.length < limit) {
    for (let round = 0; picked.length < limit && round < 4; round += 1) {
      for (const reference of references) {
        if (picked.length >= limit) break;
        const fragment = referenceFragments(reference)[round];
        if (!fragment) continue;
        const key = fragment.replace(/[，,。.\s]/g, '');
        if (used.has(key)) continue;
        used.add(key);
        picked.push(fragment);
      }
    }
  }
  return picked;
}

function buildNegative(references, style) {
  const fragments = [];
  for (const reference of references.slice(0, 4)) {
    fragments.push(...(reference.entry.negativeFragments || []));
  }
  fragments.push(...style.negative, ...DEFAULT_NEGATIVE);
  return dedupeClauses(fragments).slice(0, 18).join('，');
}

function qualityTail(strength) {
  if (strength.id === 'light') return '画面干净，主体清晰，质感自然';
  if (strength.id === 'medium') return '构图完整，光影柔和，低饱和东方色调，细节清晰';
  return '光影柔和温润，国风留白构图，低饱和色调，东方静谧美学，质感厚重古朴，高清细节，材质纹理清晰，干净雅致，无多余杂物';
}

function buildKeywords(references, style, input) {
  const tags = [];
  for (const reference of references.slice(0, 5)) tags.push(...(reference.entry.tags || []).slice(0, 4));
  const words = tokenize(input)
    .filter((token) => token.length >= 2 && token.length <= 6)
    .slice(0, 4);
  return [...new Set([...tags, style.label, ...words])].slice(0, 12);
}

export function buildLocalPrompt({ input, strengthId = 'medium', styleId = 'auto', references = [] }) {
  const strength = getStrength(strengthId);
  const style = resolveStyle(styleId, input);
  const subject = extractSubject(input);

  const styleFragments = style.id === 'auto' ? [] : style.fragments.slice(0, strength.styleLimit);
  const refFragments = pickReferenceFragments(references, strength.fragmentLimit);
  const clauses = dedupeClauses([
    ...styleFragments,
    ...refFragments,
    ...(strength.useTail ? [qualityTail(strength)] : []),
  ]);

  const prompt = dedupeClauses([subject.opening, ...clauses]).join('，') + '。';
  const negativePrompt = buildNegative(references, style);

  const rationale = [
    `识别主体：${subject.simple ? subject.phrase : `「${subject.phrase}」`}，保留原始创作意图。`,
    references.length
      ? `从知识库检索到 ${references.length} 条相关语料，优先引用「${references
          .slice(0, 2)
          .map((item) => item.entry.title)
          .join('」「')}」。`
      : '未命中强相关语料，按通用中式美学规则补全。',
    `以「${strength.label}」强度组织 ${clauses.length} 组视觉修饰，覆盖${subject.simple ? '器型、材质、陈设' : '场景、服饰、氛围'}与光影。`,
    `风格锚点：${style.label}${style.id === 'auto' ? '（跟随主体）' : `（${style.summary}）`}。`,
  ];

  return {
    prompt,
    negativePrompt,
    keywords: buildKeywords(references, style, input),
    rationale,
    subject: subject.phrase,
    engine: 'local',
    engineLabel: '本地策展引擎',
    model: 'rule-based-rag',
    style: { id: style.id, label: style.label, summary: style.summary },
    strength: { id: strength.id, label: strength.label },
  };
}

function parseLooseJson(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizePrompt(value) {
  return String(value || '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^(最终)?提示词[：:]\s*/u, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n+\s*/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/。{2,}/g, '。')
    .trim()
    .slice(0, 2000);
}

function sanitizeKeywords(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
  if (typeof value === 'string') {
    return value
      .split(/[，,、|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function buildMessages({ input, strength, style, references }) {
  const context = references
    .map(
      (reference, index) =>
        `[${index + 1}] ${reference.entry.title}（${reference.entry.category}）\n${reference.entry.content}\n可复用表达：${referenceFragments(reference).join('；')}`,
    )
    .join('\n\n');

  return [
    {
      role: 'system',
      content:
        '你是「墨生」的中式美学视觉提示词总监，熟悉紫砂、瓷器、明式家具、宋画、园林、汉服、东方人像与商业静物摄影。你的任务是把用户的日常描述改写成可直接交给 Seedream 生图模型的中文提示词。你必须忠于用户主体，不得替换、添加用户未要求的主要对象；只做视觉语言的专业化补全。',
    },
    {
      role: 'user',
      content: `用户原始描述：
${input}

润色强度：${strength.label}（${strength.description}）
目标风格：${style.label}（${style.summary}）

知识库参考（仅作为专业细节依据，不要照抄整段，不要提及“知识库”）：
${context || '无强相关参考，请按通用中式美学规则处理。'}

请输出严格 JSON，不要 Markdown，不要额外解释：
{
  "prompt": "一段连续、自然、专业的中文生图提示词；保留主体；按空间与视觉层级组织器型/材质/陈设/构图/光影/色彩/画质；120-360 字；不要分点；不要引号；不要出现“提示词”字样",
  "negative_prompt": "8-16 个逗号分隔的负面约束词，针对该主体最可能出现的失真",
  "keywords": ["5-10 个中文关键词"],
  "rationale": ["3-4 条简短说明，解释你如何参考知识库与组织画面"]
}`,
    },
  ];
}

function resolveLlmSelection(modelId, config) {
  const model =
    getLlmModel(modelId) ||
    getLlmModel(defaultLlmModel(config)) ||
    getLlmModel('glm-4-flash');
  if (!model) return null;
  if (!isLlmModelAvailable(model, config)) {
    return { model, unavailable: true };
  }
  const provider = model.provider === 'ark' ? config?.llm?.ark : config?.llm?.zhipu;
  if (!provider?.key) return { model, unavailable: true };
  return {
    model,
    unavailable: false,
    baseUrl: provider.baseUrl,
    key: provider.key,
    apiModel: llmApiModel(model, config),
  };
}

function describeLlmFailure(status, text) {
  try {
    const payload = JSON.parse(text);
    const error = payload?.error;
    if (error) {
      const code = error.code || error.type || `HTTP ${status}`;
      return `${code}: ${error.message || '未知错误'}`;
    }
  } catch {
    // 非 JSON 错误页，保留原文。
  }
  return text.slice(0, 300);
}

async function callLlm({ input, strength, style, references, selected }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const body = {
      model: selected.apiModel,
      messages: buildMessages({ input, strength, style, references }),
      temperature: 0.65,
      max_tokens: 2400,
      stream: false,
    };
    // V4.1 Flash 默认开启深度思考，思考 token 会挤占输出并显著增加耗时；
    // 提示词润色不需要推理链，显式关闭以保证 1 分钟内返回。
    if (selected.model.provider === 'ark' && /deepseek/i.test(selected.apiModel)) {
      body.thinking = { type: 'disabled' };
    }

    const response = await fetch(`${selected.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${selected.key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`LLM HTTP ${response.status}: ${describeLlmFailure(response.status, detail)}`);
    }
    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      const reason = choice?.finish_reason || 'empty';
      throw new Error(`LLM 返回空内容（finish_reason=${reason}）`);
    }
    const parsed = parseLooseJson(content);
    if (!parsed || !sanitizePrompt(parsed.prompt) || sanitizePrompt(parsed.prompt).length < 20) {
      throw new Error('LLM 返回内容无法解析为有效提示词');
    }
    return { parsed, usage: data?.usage || null };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('LLM 请求超时（75 秒）');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function polishPrompt({
  input,
  strengthId = 'medium',
  styleId = 'auto',
  references = [],
  config,
  llmModel,
}) {
  const strength = getStrength(strengthId);
  const style = resolveStyle(styleId, input);
  const local = buildLocalPrompt({ input, strengthId: strength.id, styleId: style.id, references });
  const selected = resolveLlmSelection(llmModel, config);

  if (!selected) return { ...local, fallback: false };
  if (selected.unavailable) {
    // 用户可能保存了旧选择，或凭据被移除；不阻断创作，回退本地并说明原因。
    return llmModel
      ? {
          ...local,
          fallback: true,
          llmModel: selected.model.id,
          llmModelLabel: selected.model.label,
          warning: `${selected.model.label} 未配置可用的 API Key，已回退到本地策展引擎。`,
        }
      : { ...local, fallback: false };
  }

  try {
    const { parsed, usage } = await callLlm({
      input,
      strength,
      style,
      references,
      selected,
    });
    const prompt = sanitizePrompt(parsed.prompt);
    const negativePrompt = dedupeClauses([
      ...String(parsed.negative_prompt || '')
        .split(/[，,、]/)
        .map((item) => item.trim()),
      ...local.negativePrompt.split('，'),
    ])
      .slice(0, 20)
      .join('，');
    return {
      ...local,
      prompt,
      negativePrompt,
      keywords: sanitizeKeywords(parsed.keywords).length
        ? sanitizeKeywords(parsed.keywords)
        : local.keywords,
      rationale: Array.isArray(parsed.rationale) && parsed.rationale.length
        ? parsed.rationale.map((item) => String(item)).slice(0, 5)
        : local.rationale,
      engine: 'llm',
      engineLabel: `大模型 · ${selected.model.label}`,
      model: selected.apiModel,
      llmModel: selected.model.id,
      llmModelLabel: selected.model.label,
      usage,
      fallback: false,
    };
  } catch (error) {
    console.warn(`[polish] ${selected.model.label} 调用失败：${error.message}`);
    return {
      ...local,
      fallback: true,
      llmModel: selected.model.id,
      llmModelLabel: selected.model.label,
      warning: `${selected.model.label} 调用失败，已回退到本地策展引擎：${error.message}`,
    };
  }
}

export function referenceSummary(reference, index) {
  return {
    index: index + 1,
    id: reference.entry.id,
    title: reference.entry.title,
    category: reference.entry.category,
    tags: (reference.entry.tags || []).slice(0, 6),
    excerpt:
      reference.entry.content.length > 150
        ? `${reference.entry.content.slice(0, 150)}…`
        : reference.entry.content,
    fragments: referenceFragments(reference).slice(0, 3),
    score: Math.round(reference.score * 100) / 100,
    source: reference.entry.source,
  };
}

export { STYLES };
