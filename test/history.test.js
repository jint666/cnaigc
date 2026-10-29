import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { HistoryStore, normalizeHistoryRecord } from '../server/history.js';

function tempStore(limit = 10) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosheng-history-'));
  const store = new HistoryStore({ filePath: path.join(dir, 'history.json'), limit }).init();
  return {
    store,
    dir,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('生成记录只保留最近 limit 条，并持久化到本地 JSON', () => {
  const { store, dir, cleanup } = tempStore(10);
  try {
    for (let index = 0; index < 12; index += 1) {
      store.add({
        original: `第 ${index} 次输入`,
        prompt: `第 ${index} 次润色`,
        subject: `测试作品 ${index}`,
        ratio: '1:1',
        count: 1,
        images: [{ url: `https://example.com/${index}.png`, width: 1024, height: 1024 }],
      });
    }

    assert.equal(store.list().length, 10);
    assert.equal(store.list()[0].subject, '测试作品 11');
    assert.equal(store.list().at(-1).subject, '测试作品 2');

    const reloaded = new HistoryStore({ filePath: path.join(dir, 'history.json'), limit: 10 }).init();
    assert.equal(reloaded.list().length, 10);
    assert.equal(reloaded.list()[0].subject, '测试作品 11');
    assert.equal(reloaded.list()[0].images[0].url, 'https://example.com/11.png');
  } finally {
    cleanup();
  }
});

test('生成记录清洗图片 URL、空记录与超长字段', () => {
  const record = normalizeHistoryRecord({
    original: '生成一个紫砂壶',
    prompt: '一把中式紫砂壶，器型端庄。',
    subject: '紫砂壶',
    images: [
      { url: 'javascript:alert(1)' },
      { url: 'https://example.com/zisha.png', width: 900, height: 1200 },
      { url: `data:image/svg+xml;base64,${'a'.repeat(20)}` },
    ],
    keywords: ['紫砂', '', '茶席', '器型', '泥料', '光影', '留白', '低饱和', '原木', '哑光', '细节', '干净', '多余'],
  });

  assert.ok(record);
  assert.equal(record.images.length, 2);
  assert.equal(record.images[0].url, 'https://example.com/zisha.png');
  assert.equal(record.images[1].url.startsWith('data:image/'), true);
  assert.equal(record.keywords.length, 12);
  assert.equal(normalizeHistoryRecord({ prompt: '   ' }), null);
});
