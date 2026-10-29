import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../server/config.js';
import {
  KnowledgeBase,
  parseKnowledgeDocument,
  harvestFragments,
} from '../server/knowledge.js';

function makeKnowledge() {
  const base = loadConfig({ loadEnvFile: false });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosheng-kb-'));
  const config = {
    ...base,
    dataDir: dir,
    knowledgeFile: path.join(dir, 'knowledge.json'),
    seedFile: base.seedFile,
    maxEntries: 500,
  };
  const kb = new KnowledgeBase(config).init();
  return {
    kb,
    config,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('内置语料可以初始化，并带有分类统计', (t) => {
  const { kb, cleanup } = makeKnowledge();
  t.after(cleanup);

  const stats = kb.stats();
  assert.ok(stats.entries >= 28, `内置语料应至少 28 条，实际 ${stats.entries}`);
  assert.ok(stats.categories >= 10);
  assert.ok(stats.categoryList.some((item) => item.name === '器物·紫砂'));
  assert.ok(stats.terms > 100);
});

test('检索「紫砂壶」能命中器型、泥料与茶席语料', (t) => {
  const { kb, cleanup } = makeKnowledge();
  t.after(cleanup);

  const references = kb.search('生成一个紫砂壶', { topK: 6 });
  assert.ok(references.length >= 3);
  assert.ok(
    references.some((ref) => ref.entry.id === 'seed-zisha-form'),
    '应召回紫砂器型条目',
  );
  assert.ok(
    references.some((ref) =>
      ['seed-zisha-clay', 'seed-zisha-tea', 'seed-zisha-classic'].includes(ref.entry.id),
    ),
    '应召回紫砂泥料 / 茶席 / 经典器型条目',
  );
});

test('Markdown 按标题分节解析，正文与标题都能保留', () => {
  const markdown = [
    '# 补充语料（这一行不应单独成条）',
    '',
    '## 紫砂·掇球壶的颈肩',
    '',
    '掇球壶以球体叠积为骨，壶身、壶盖、壶钮形成由大到小的三个球体。颈肩过渡圆融，线条饱满而不臃肿。',
    '',
    '## 建盏·兔毫的毫纹',
    '',
    '兔毫盏的毫纹从盏心向口沿放射，线条细密、深浅有致，依赖窑火自然成纹，不应呈规则印刷感。',
  ].join('\n');

  const entries = parseKnowledgeDocument({
    filename: '补充语料.md',
    content: markdown,
  });

  assert.equal(entries.length, 2);
  assert.match(entries[0].title, /掇球壶/);
  assert.match(entries[0].content, /球体叠积/);
  assert.equal(entries[0].source, '补充语料.md');
  assert.match(entries[1].title, /建盏/);
});

test('JSON 导入支持 entries 包装与 promptFragments', () => {
  const entries = parseKnowledgeDocument({
    filename: '器物.json',
    content: JSON.stringify({
      entries: [
        {
          title: '明式圈椅',
          category: '器物·家具',
          tags: ['圈椅', '榫卯'],
          content: '圈椅靠背随脊线微弯，扶手一顺而下，重线条、轻雕饰，比例清瘦而有骨力。',
          promptFragments: ['明式圈椅，扶手一顺而下', '线条清瘦有骨力'],
          source: '家具组',
        },
      ],
    }),
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].category, '器物·家具');
  assert.ok(entries[0].promptFragments.includes('明式圈椅，扶手一顺而下'));
  assert.ok(entries[0].promptFragments.includes('线条清瘦有骨力'));
  assert.equal(entries[0].source, '家具组');
});

test('新增语料会持久化，删除后索引同步更新', (t) => {
  const { kb, config, cleanup } = makeKnowledge();
  t.after(cleanup);

  const entry = kb.add({
    title: '测试·竹影粉墙',
    category: '空间·园林',
    content: '白粉墙前几竿修竹，日光把竹影投在墙上，疏密有致，留白处安静可呼吸。',
    tags: ['竹影', '粉墙', '留白'],
  });

  assert.ok(entry.id);
  assert.ok(fs.existsSync(config.knowledgeFile));

  const reloaded = new KnowledgeBase(config).init();
  assert.ok(reloaded.get(entry.id), '重新加载后应保留新增语料');

  const before = reloaded.search('竹影 粉墙', { topK: 5 });
  assert.ok(before.some((ref) => ref.entry.id === entry.id));

  const removed = reloaded.remove(entry.id);
  assert.equal(removed.id, entry.id);
  const after = reloaded.search('竹影 粉墙', { topK: 5 });
  assert.ok(!after.some((ref) => ref.entry.id === entry.id));
});

test('harvestFragments 从长文中抽取可复用短句', () => {
  const fragments = harvestFragments(
    '紫砂壶以宜兴丁蜀为正脉。壶嘴胥出自然，出水收束利落。壶盖与壶口严丝合缝，桥形钮小巧雅致。整体端庄含蓄，线条温润流畅。',
    4,
  );
  assert.ok(fragments.length >= 2);
  assert.ok(fragments.some((text) => /壶嘴|壶盖|线条/.test(text)));
  assert.ok(fragments.every((text) => text.length <= 96));
});
