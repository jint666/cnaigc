import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LLM_MODELS,
  defaultLlmModel,
  getLlmModel,
  llmModelPayload,
  isLlmModelAvailable,
} from '../server/llm-models.js';

function config(overrides = {}) {
  return {
    llm: {
      zhipuAvailable: true,
      arkAvailable: true,
      defaultModel: 'deepseek-v4.1-flash-economy',
      zhipu: { model: 'glm-4-flash' },
      ark: { model: 'deepseek-v4-1-flash-economy-261017' },
      ...overrides,
    },
  };
}

test('DeepSeek V4.1 Flash 作为独立润色模型注册', () => {
  const model = getLlmModel('deepseek-v4.1-flash-economy');
  assert.ok(model);
  assert.equal(model.provider, 'ark');
  assert.equal(model.label, 'DeepSeek V4.1 Flash');
  const payload = llmModelPayload(config()).find((item) => item.id === model.id);
  assert.equal(payload.model, 'deepseek-v4-1-flash-economy-261017');
  assert.equal(payload.available, true);
});

test('缺少 ARK Key 时 DeepSeek 润色模型置灰', () => {
  const model = getLlmModel('deepseek-v4.1-flash-economy');
  const noArk = config({ arkAvailable: false });
  assert.equal(isLlmModelAvailable(model, noArk), false);
  const payload = llmModelPayload(noArk).find((item) => item.id === model.id);
  assert.equal(payload.available, false);
  assert.match(payload.reason, /ARK API Key/);
});

test('默认润色模型尊重配置，并在不可用时回退到可用模型', () => {
  assert.equal(defaultLlmModel(config()), 'deepseek-v4.1-flash-economy');
  assert.equal(defaultLlmModel(config({ defaultModel: 'glm-4-flash' })), 'glm-4-flash');
  assert.equal(
    defaultLlmModel(config({ defaultModel: 'deepseek-v4-1-flash-economy-261017' })),
    'deepseek-v4.1-flash-economy',
  );
  assert.equal(
    defaultLlmModel(config({ defaultModel: 'glm-4-flash', zhipuAvailable: false })),
    'deepseek-v4.1-flash-economy',
  );
  assert.equal(
    defaultLlmModel(config({ defaultModel: '', zhipuAvailable: false })),
    'deepseek-v4.1-flash-economy',
  );
});

test('模型表只包含两种润色模型且顺序稳定', () => {
  assert.deepEqual(
    LLM_MODELS.map((model) => model.id),
    ['glm-4-flash', 'deepseek-v4.1-flash-economy'],
  );
});
