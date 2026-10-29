import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMAGE_MODELS,
  defaultImageModel,
  getImageModel,
  imageModelPayload,
  isImageModelAvailable,
} from '../server/image-models.js';

function config(overrides = {}) {
  return {
    image: {
      provider: 'ark',
      seedreamAvailable: true,
      arkAvailable: true,
      cogviewAvailable: true,
      ark: { model: 'doubao-seedream-5-0-flash-260915' },
      ...overrides,
    },
  };
}

test('Seedream 5.0 Flash 是独立的火山方舟模型', () => {
  const model = getImageModel('seedream-5.0-flash');
  assert.ok(model);
  assert.equal(model.provider, 'ark');
  assert.equal(model.label, 'Seedream 5.0 Flash');
  assert.equal(defaultImageModel(config()), 'seedream-5.0-flash');
  assert.equal(imageModelPayload(config()).filter((item) => item.provider === 'ark')[0].available, true);
});

test('缺少 ARK Key 时 Seedream 5.0 Flash 不可用且会被置灰', () => {
  const model = getImageModel('seedream-5.0-flash');
  const noArk = config({ arkAvailable: false });
  assert.equal(isImageModelAvailable(model, noArk), false);
  const payload = imageModelPayload(noArk);
  const target = payload.find((item) => item.id === 'seedream-5.0-flash');
  assert.equal(target.available, false);
  assert.match(target.reason, /ARK API Key/);
});

test('三种线上模型 + 演示图都注册在模型表中', () => {
  const providers = IMAGE_MODELS.map((model) => model.provider);
  assert.deepEqual(providers, ['seedream', 'ark', 'cogview']);
  assert.equal(getImageModel('seedream-4.6').provider, 'seedream');
  assert.equal(getImageModel('cogview-3-flash').provider, 'cogview');
});
