import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../server/config.js';
import { createApplication } from '../server/index.js';

function makeServer() {
  const base = loadConfig({ loadEnvFile: false });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosheng-api-'));
  const config = {
    ...base,
    dataDir: dir,
    knowledgeFile: path.join(dir, 'knowledge.json'),
    historyFile: path.join(dir, 'history.json'),
    seedFile: base.seedFile,
    maxEntries: 500,
    llm: {
      ...base.llm,
      key: '',
      mode: 'local',
      zhipuAvailable: false,
      arkAvailable: false,
    },
    image: { ...base.image, key: '', provider: 'mock' },
  };
  const { server, knowledge } = createApplication(config);
  return {
    server,
    knowledge,
    config,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function start(app) {
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address();
  return `http://127.0.0.1:${port}`;
}

async function stop(app) {
  app.server.closeAllConnections?.();
  await new Promise((resolve) => app.server.close(resolve));
  app.cleanup();
}

async function json(base, pathname, options) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
  });
  const body = await response.json();
  return { response, body };
}

test('健康检查与元数据可用，且不泄露密钥', async (t) => {
  const app = makeServer();
  const base = await start(app);
  t.after(() => stop(app));

  const health = await json(base, '/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.config.llm.engine, 'local');
  assert.equal(health.body.config.image.engine, 'mock');
  assert.ok(health.body.knowledge.entries >= 28);
  assert.ok(!JSON.stringify(health.body).includes('baseUrl'));

  const meta = await json(base, '/api/meta');
  assert.equal(meta.response.status, 200);
  assert.equal(meta.body.strengths.length, 3);
  assert.ok(meta.body.styles.length >= 7);
  assert.equal(meta.body.ratios.length, 5);
  assert.equal(meta.body.llmModels.length, 2);
  assert.ok(meta.body.llmModels.some((model) => model.id === 'deepseek-v4.1-flash-economy'));
  assert.ok(meta.body.imageModels.length >= 3);
});

test('一次 create：RAG 润色 + 演示生图完整返回', async (t) => {
  const app = makeServer();
  const base = await start(app);
  t.after(() => stop(app));

  const { response, body } = await json(base, '/api/create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '生成一个紫砂壶',
      strength: 'deep',
      style: 'auto',
      ratio: '1:1',
      count: 1,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.original, '生成一个紫砂壶');
  assert.equal(body.engine, 'local');
  assert.equal(body.imageEngine, 'mock');
  assert.equal(body.strength.id, 'deep');
  assert.equal(body.count, 1);
  assert.ok(body.references.length >= 3);
  assert.ok(body.references.some((ref) => ref.id === 'seed-zisha-form'));
  assert.match(body.prompt, /紫砂壶/);
  assert.match(body.prompt, /器型|壶嘴|泥料|茶席/);
  assert.equal(body.images.length, 1);
  assert.match(body.images[0].url, /^data:image\/svg\+xml;base64,/);
  assert.equal(body.images[0].engine, 'mock');
  assert.ok(body.warning);
  assert.ok(body.historyId);

  const history = await json(base, '/api/history');
  assert.equal(history.response.status, 200);
  assert.equal(history.body.items.length, 1);
  assert.equal(history.body.items[0].id, body.historyId);
  assert.equal(history.body.items[0].original, '生成一个紫砂壶');
  assert.ok(history.body.items[0].images.length >= 1);
  assert.equal(history.body.items[0].imageModel, body.imageModel);

  const cleared = await json(base, `/api/history/${encodeURIComponent(body.historyId)}`, {
    method: 'DELETE',
  });
  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.body.items.length, 0);
});

test('generate 接口按给定提示词生图，并校验数量', async (t) => {
  const app = makeServer();
  const base = await start(app);
  t.after(() => stop(app));

  const { response, body } = await json(base, '/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '一把中式紫砂壶，器型端庄，泥料紫褐，原木茶席，柔光，留白构图。',
      ratio: '3:4',
      count: 2,
      style: 'auto',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.engine, 'mock');
  assert.equal(body.ratio, '3:4');
  assert.equal(body.images.length, 2);
  assert.notEqual(body.images[0].url, body.images[1].url);
  assert.equal(body.images[0].width, 1728);
  assert.equal(body.images[0].height, 2304);
});

test('知识库导入、检索、删除闭环', async (t) => {
  const app = makeServer();
  const base = await start(app);
  t.after(() => stop(app));

  const markdown = [
    '## 建盏·兔毫的毫纹',
    '',
    '兔毫盏的毫纹从盏心向口沿放射，线条细密、深浅有致，依赖窑火自然成纹，不应呈规则印刷感。',
    '',
    '## 建盏·油滴的斑纹',
    '',
    '油滴盏的斑纹如夜空星点，分布疏朗，釉面在柔光下呈现金属般的幽微光泽。',
  ].join('\n');

  const imported = await json(base, '/api/knowledge/import', {
    method: 'POST',
    body: JSON.stringify({ filename: '建盏补充.md', content: markdown, category: '器物·瓷器' }),
  });
  assert.equal(imported.response.status, 201);
  assert.equal(imported.body.added, 2);
  assert.ok(imported.body.stats.entries >= 30);

  const found = await json(base, `/api/knowledge?q=${encodeURIComponent('兔毫')}&limit=20`);
  assert.equal(found.response.status, 200);
  const target = found.body.entries.find((entry) => entry.title.includes('兔毫'));
  assert.ok(target);
  assert.equal(target.category, '器物·瓷器');

  const removed = await json(base, `/api/knowledge/${encodeURIComponent(target.id)}`, {
    method: 'DELETE',
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.removed.id, target.id);

  const after = await json(base, `/api/knowledge?q=${encodeURIComponent('兔毫')}&limit=20`);
  assert.ok(!after.body.entries.some((entry) => entry.id === target.id));
});

test('无效输入返回 400，错误结构稳定', async (t) => {
  const app = makeServer();
  const base = await start(app);
  t.after(() => stop(app));

  const { response, body } = await json(base, '/api/create', {
    method: 'POST',
    body: JSON.stringify({ prompt: '壶' }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, true);
  assert.ok(body.message);
});
