import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../server/config.js';
import { KnowledgeBase } from '../server/knowledge.js';
import { buildLocalPrompt, extractSubject } from '../server/polish.js';

function makeReferences(query = '生成一个紫砂壶') {
  const base = loadConfig({ loadEnvFile: false });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosheng-polish-'));
  const kb = new KnowledgeBase({
    ...base,
    dataDir: dir,
    knowledgeFile: path.join(dir, 'knowledge.json'),
    seedFile: base.seedFile,
    maxEntries: 500,
  }).init();
  return {
    references: kb.search(query, { topK: 6 }),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('extractSubject 去掉指令词，并为简单主体补上量词', () => {
  const subject = extractSubject('请帮我生成一个紫砂壶');
  assert.equal(subject.simple, true);
  assert.match(subject.phrase, /一把/);
  assert.match(subject.phrase, /紫砂壶/);

  const scene = extractSubject('雨后的江南园林，月洞门里有一枝竹');
  assert.equal(scene.simple, false);
  assert.match(scene.opening, /东方美学画面/);
});

test('紫砂壶的深度润色包含器型、泥料、茶席与光影', (t) => {
  const { references, cleanup } = makeReferences();
  t.after(cleanup);

  const result = buildLocalPrompt({
    input: '生成一个紫砂壶',
    strengthId: 'deep',
    styleId: 'auto',
    references,
  });

  assert.equal(result.engine, 'local');
  assert.equal(result.strength.id, 'deep');
  assert.match(result.prompt, /紫砂壶/);
  assert.match(result.prompt, /器型|壶嘴|壶把|壶盖/);
  assert.match(result.prompt, /泥料|砂粒|哑光|紫褐/);
  assert.match(result.prompt, /茶席|留白|静谧/);
  assert.match(result.prompt, /光影|低饱和/);
  assert.ok(result.prompt.length >= 120, `润色结果过短：${result.prompt.length}`);
  assert.ok(result.prompt.length <= 1200);
  assert.ok(result.negativePrompt.length >= 10);
  assert.ok(Array.isArray(result.keywords) && result.keywords.length >= 3);
  assert.ok(Array.isArray(result.rationale) && result.rationale.length >= 2);
  assert.ok(result.subject.includes('紫砂壶'));
});

test('润色强度越深，参考片段与提示词越完整', (t) => {
  const { references, cleanup } = makeReferences();
  t.after(cleanup);

  const light = buildLocalPrompt({
    input: '生成一个紫砂壶',
    strengthId: 'light',
    styleId: 'auto',
    references,
  });
  const deep = buildLocalPrompt({
    input: '生成一个紫砂壶',
    strengthId: 'deep',
    styleId: 'auto',
    references,
  });

  assert.ok(deep.prompt.length > light.prompt.length);
  assert.ok(deep.keywords.length >= light.keywords.length);
  assert.match(deep.prompt, /高清细节/);
});

test('显式风格会改变提示词，并保持结构化返回', (t) => {
  const { references, cleanup } = makeReferences('水墨山水');
  t.after(cleanup);

  const result = buildLocalPrompt({
    input: '画一幅水墨山水，远山有雾',
    strengthId: 'medium',
    styleId: 'ink',
    references,
  });

  assert.equal(result.style.id, 'ink');
  assert.ok(result.style.label);
  assert.ok(result.style.summary);
  assert.ok(result.prompt.includes(result.style.summary) || result.prompt.includes('水墨'));
  assert.match(result.prompt, /生成一幅东方美学画面/);
});

test('没有检索结果时也能生成稳定提示词', () => {
  const result = buildLocalPrompt({
    input: '一只白瓷杯',
    strengthId: 'medium',
    styleId: 'auto',
    references: [],
  });

  assert.match(result.prompt, /白瓷杯/);
  assert.ok(result.prompt.length >= 30);
  assert.ok(result.negativePrompt.length >= 10);
  assert.ok(result.keywords.length >= 1);
});
