import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, publicConfig } from './config.js';
import { KnowledgeBase } from './knowledge.js';
import { HistoryStore } from './history.js';
import { generateImages } from './image.js';
import {
  defaultImageModel,
  getImageModel,
  imageModelPayload,
  isImageModelAvailable,
} from './image-models.js';
import {
  defaultLlmModel,
  getLlmModel,
  llmModelPayload,
} from './llm-models.js';
import { polishPrompt, referenceSummary } from './polish.js';
import { RATIOS, STRENGTHS, STYLES, strengthPayload } from './styles.js';
import {
  HttpError,
  readJsonBody,
  sendJson,
  shortId,
} from './utils.js';

const PUBLIC_DIR = path.resolve(fileURLToPath(new URL('../public', import.meta.url)));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const SAFE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function withCommonHeaders(res) {
  for (const [key, value] of Object.entries(SAFE_HEADERS)) res.setHeader(key, value);
}

function serveStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, '无效的路径');
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, relative);
  if (resolved !== PUBLIC_DIR && !resolved.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    throw new HttpError(403, '禁止访问');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new HttpError(404, '页面不存在');
  }
  const extension = path.extname(resolved).toLowerCase();
  const contentType = MIME[extension] || 'application/octet-stream';
  const cacheControl = extension === '.html' ? 'no-store' : 'public, max-age=60';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    ...SAFE_HEADERS,
  });
  fs.createReadStream(resolved).pipe(res);
}

function normalizePrompt(value) {
  const prompt = String(value || '').replace(/\s+/g, ' ').trim();
  if (prompt.length < 2) throw new HttpError(400, '请先写下你想生成的画面');
  if (prompt.length > 800) throw new HttpError(400, '描述请控制在 800 字以内');
  return prompt;
}

function normalizeCount(value) {
  return Math.min(4, Math.max(1, Number.parseInt(value, 10) || 1));
}

function normalizeRatio(value) {
  return RATIOS.some((item) => item.id === value) ? value : '1:1';
}

function normalizeStrength(value) {
  return STRENGTHS.some((item) => item.id === value) ? value : 'medium';
}

function normalizeStyle(value) {
  return STYLES.some((item) => item.id === value) ? value : 'auto';
}

function normalizeImageModelRequest(value, config) {
  const requested = String(value || '').trim();
  if (!requested) return defaultImageModel(config);
  const model = getImageModel(requested);
  if (!model) throw new HttpError(400, '不支持的生图模型');
  if (!isImageModelAvailable(model, config)) {
    throw new HttpError(400, `${model.label} 尚未配置，请在界面切换模型或补充 API Key`);
  }
  return model.id;
}

function normalizeLlmModelRequest(value) {
  const requested = String(value || '').trim();
  if (!requested) return '';
  if (!getLlmModel(requested)) throw new HttpError(400, '不支持的润色模型');
  return requested;
}

function saveHistory(history, record) {
  if (!history) return null;
  try {
    return history.add(record);
  } catch (error) {
    // 生成记录失败不应影响本次生图结果。
    console.warn('[history] 写入失败：', error.message);
    return null;
  }
}

function historyResponse(history) {
  return { items: history.list(), limit: history.limit };
}

function createHandler({ config, knowledge, history }) {
  return async function handle(req, res) {
    const started = Date.now();
    withCommonHeaders(res);
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const { pathname, searchParams } = url;

    try {
      if (pathname === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          name: '墨生 · 中式美学 AIGC',
          version: '0.1.0',
          config: publicConfig(config),
          knowledge: knowledge.stats(),
        });
        return;
      }

      if (pathname === '/api/meta' && req.method === 'GET') {
        sendJson(res, 200, {
          strengths: strengthPayload(),
          styles: STYLES.map(({ id, label, hint, summary }) => ({ id, label, hint, summary })),
          ratios: RATIOS,
          llmModels: llmModelPayload(config),
          defaultLlmModel: defaultLlmModel(config),
          imageModels: imageModelPayload(config),
          defaultImageModel: defaultImageModel(config),
        });
        return;
      }

      if (pathname === '/api/history' && req.method === 'GET') {
        sendJson(res, 200, historyResponse(history));
        return;
      }

      if (pathname === '/api/history' && req.method === 'DELETE') {
        history.clear();
        sendJson(res, 200, { ok: true, ...historyResponse(history) });
        return;
      }

      const historyMatch = pathname.match(/^\/api\/history\/([^/]+)$/);
      if (historyMatch && req.method === 'DELETE') {
        const removed = history.remove(decodeURIComponent(historyMatch[1]));
        if (!removed) throw new HttpError(404, '这条生成记录不存在');
        sendJson(res, 200, {
          ok: true,
          removed: { id: removed.id, subject: removed.subject },
          ...historyResponse(history),
        });
        return;
      }

      if (pathname === '/api/knowledge' && req.method === 'GET') {
        const entries = knowledge.list({
          q: searchParams.get('q') || '',
          category: searchParams.get('category') || '',
          limit: Math.max(1, Math.min(200, Number.parseInt(searchParams.get('limit'), 10) || 100)),
        });
        sendJson(res, 200, { entries, stats: knowledge.stats() });
        return;
      }

      if (pathname === '/api/knowledge' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const entry = knowledge.add(body);
        sendJson(res, 201, { entry, stats: knowledge.stats() });
        return;
      }

      if (pathname === '/api/knowledge/import' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.content) throw new HttpError(400, '请上传语料内容');
        const result = knowledge.importDocument({
          filename: String(body.filename || '专业补充.md').slice(0, 120),
          content: String(body.content),
          category: String(body.category || ''),
        });
        sendJson(res, 201, {
          added: result.added,
          skipped: result.skipped,
          entries: result.entries.map(({ content, ...entry }) => ({
            ...entry,
            excerpt: content.slice(0, 100),
          })),
          stats: knowledge.stats(),
        });
        return;
      }

      if (pathname === '/api/knowledge/reset' && req.method === 'POST') {
        const stats = knowledge.reset();
        sendJson(res, 200, { ok: true, stats });
        return;
      }

      const knowledgeMatch = pathname.match(/^\/api\/knowledge\/([^/]+)$/);
      if (knowledgeMatch && req.method === 'DELETE') {
        const removed = knowledge.remove(decodeURIComponent(knowledgeMatch[1]));
        sendJson(res, 200, { ok: true, removed: { id: removed.id, title: removed.title }, stats: knowledge.stats() });
        return;
      }

      if (pathname === '/api/polish' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const input = normalizePrompt(body.prompt);
        const strengthId = normalizeStrength(body.strength);
        const styleId = normalizeStyle(body.style);
        const llmModel = normalizeLlmModelRequest(body.llmModel);
        const startedPolish = Date.now();
        let references = knowledge.search(input, { topK: 6 });
        if (!references.length) references = knowledge.search('中式美学 构图 光影 低饱和 材质', { topK: 3 });
        const polished = await polishPrompt({
          input,
          strengthId,
          styleId,
          references,
          config,
          llmModel,
        });
        sendJson(res, 200, {
          id: shortId('polish'),
          original: input,
          references: references.map(referenceSummary),
          elapsedMs: Date.now() - startedPolish,
          ...polished,
        });
        return;
      }

      if (pathname === '/api/generate' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const prompt = String(body.prompt || '').trim();
        if (prompt.length < 4) throw new HttpError(400, '请先生成或填写润色后的提示词');
        if (prompt.length > 3000) throw new HttpError(400, '提示词过长，请控制在 3000 字以内');
        const ratio = normalizeRatio(body.ratio);
        const count = normalizeCount(body.count);
        const strengthId = normalizeStrength(body.strength);
        const styleId = normalizeStyle(body.style);
        const strength = STRENGTHS.find((item) => item.id === strengthId) || STRENGTHS[1];
        const style = STYLES.find((item) => item.id === styleId) || STYLES[0];
        const imageModel = normalizeImageModelRequest(body.imageModel, config);
        const llmModel = normalizeLlmModelRequest(body.llmModel);
        const startedImage = Date.now();
        let generated;
        try {
          generated = await generateImages({
            prompt,
            ratio,
            count,
            style: styleId,
            model: imageModel,
            config,
          });
        } catch (error) {
          throw new HttpError(502, error.message || '生图服务暂时不可用');
        }
        const warning = generated.warning || generated.partialError || null;
        const historyItem = saveHistory(history, {
          original: body.original,
          prompt,
          subject: body.subject || prompt,
          negativePrompt: body.negativePrompt,
          keywords: body.keywords,
          rationale: body.rationale,
          references: body.references,
          strength: { id: strength.id, label: strength.label },
          style: { id: style.id, label: style.label },
          llmModel,
          llmModelLabel: llmModel ? getLlmModel(llmModel)?.label : '',
          ratio,
          count,
          imageModel: generated.model || imageModel,
          imageModelLabel: generated.modelLabel || imageModel,
          imageEngine: generated.engine,
          warning,
          images: generated.images,
        });
        sendJson(res, 200, {
          id: shortId('image'),
          prompt,
          ratio,
          count,
          elapsedMs: Date.now() - startedImage,
          ...generated,
          imageModel: generated.model || imageModel,
          imageModelLabel: generated.modelLabel || imageModel,
          historyId: historyItem?.id || null,
        });
        return;
      }

      if (pathname === '/api/create' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const input = normalizePrompt(body.prompt);
        const strengthId = normalizeStrength(body.strength);
        const styleId = normalizeStyle(body.style);
        const ratio = normalizeRatio(body.ratio);
        const count = normalizeCount(body.count);
        const imageModel = normalizeImageModelRequest(body.imageModel, config);
        const llmModel = normalizeLlmModelRequest(body.llmModel);

        const startedAll = Date.now();
        let references = knowledge.search(input, { topK: 6 });
        if (!references.length) references = knowledge.search('中式美学 构图 光影 低饱和 材质', { topK: 3 });
        const polished = await polishPrompt({
          input,
          strengthId,
          styleId,
          references,
          config,
          llmModel,
        });

        let generated;
        try {
          generated = await generateImages({
            prompt: polished.prompt,
            ratio,
            count,
            style: polished.style.id,
            model: imageModel,
            config,
          });
        } catch (error) {
          throw new HttpError(502, error.message || '生图服务暂时不可用');
        }

        sendJson(res, 200, {
          id: shortId('work'),
          original: input,
          ratio,
          count,
          references: references.map(referenceSummary),
          elapsedMs: Date.now() - startedAll,
          ...polished,
          images: generated.images,
          imageEngine: generated.engine,
          imageModel: generated.model || imageModel,
          imageModelLabel: generated.modelLabel || imageModel,
          warning: polished.warning || generated.warning || generated.partialError || null,
          historyId: saveHistory(history, {
            original: input,
            prompt: polished.prompt,
            subject: polished.subject || input,
            negativePrompt: polished.negativePrompt,
            keywords: polished.keywords,
            rationale: polished.rationale,
            references: references.map(referenceSummary),
            strength: polished.strength,
            style: polished.style,
            llmModel: polished.llmModel,
            llmModelLabel: polished.llmModelLabel,
            ratio,
            count,
            imageModel: generated.model || imageModel,
            imageModelLabel: generated.modelLabel || imageModel,
            imageEngine: generated.engine,
            warning: polished.warning || generated.warning || generated.partialError || null,
            images: generated.images,
          })?.id || null,
        });
        return;
      }

      if (pathname.startsWith('/api/')) throw new HttpError(404, '接口不存在');
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, '不支持该请求方法');
      serveStatic(req, res, pathname);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500 && !(error instanceof HttpError)) {
        console.error('[server]', error);
      }
      if (!res.headersSent) {
        sendJson(res, status, {
          error: true,
          message: error.message || '服务内部错误',
          ...(error.details ? { details: error.details } : {}),
        });
      } else {
        res.end();
      }
    } finally {
      const ms = Date.now() - started;
      if (ms > 700 || pathname.startsWith('/api/')) {
        console.log(`${req.method} ${pathname} ${res.statusCode} ${ms}ms`);
      }
    }
  };
}

export function createApplication(config = loadConfig()) {
  const knowledge = new KnowledgeBase(config).init();
  const history = new HistoryStore({
    filePath: config.historyFile || path.join(config.dataDir, 'history.json'),
    limit: config.historyLimit || 10,
  }).init();
  const server = http.createServer(createHandler({ config, knowledge, history }));
  return { server, config, knowledge, history };
}

export async function startServer(config = loadConfig()) {
  const { server, knowledge } = createApplication(config);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  const mode = publicConfig(config);
  const lines = [
    '',
    '  墨生 · 中式美学 AIGC',
    '  ─────────────────────────────',
    `  本地地址   http://${config.host}:${config.port}`,
    `  润色引擎   ${
      mode.llm.engine === 'llm'
        ? `大模型 · ${getLlmModel(config.llm.defaultModel)?.label || config.llm.model}`
        : '本地策展引擎（RAG）'
    }`,
    `  生图引擎   ${
      mode.image.engine === 'mock'
        ? '演示占位图（未配置 API Key）'
        : `${
            mode.image.engine === 'seedream'
              ? 'Seedream'
              : mode.image.engine === 'ark'
                ? 'Seedream 5.0 Flash'
                : 'CogView'
          } · ${mode.image.model}`
    }`,
    `  知识库     ${knowledge.stats().entries} 条 / ${knowledge.stats().categories} 个分类`,
    `  生成记录   最近 ${config.historyLimit || 10} 条`,
    '  ─────────────────────────────',
    '  按 Ctrl+C 停止服务',
    '',
  ];
  console.log(lines.join('\n'));
  return { server, config, knowledge };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startServer().catch((error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`端口 ${process.env.PORT || 5173} 已被占用，请在 .env 中修改 PORT。`);
    } else {
      console.error('启动失败：', error);
    }
    process.exitCode = 1;
  });
}
