/**
 * Selectable image-generation providers.
 *
 * The public model ids are stable app-level ids; the provider-specific
 * request shape and upstream model name live in config / image.js.
 */
const MOCK_MODEL = {
  id: 'mock',
  provider: 'mock',
  label: '演示占位图',
  short: '演示',
  badge: 'DEMO',
  hint: '未配置生图 Key 时使用，本地生成宣纸水墨占位图',
  description: '仅用于验证界面与全流程，不会调用线上生图接口。',
};

export const IMAGE_MODELS = [
  {
    id: 'seedream-4.6',
    provider: 'seedream',
    label: 'Seedream 4.6',
    short: 'Seedream',
    badge: '推荐',
    hint: '即梦 Seedream 4.6 · 东方质感、材质与细节更强',
    description: '火山引擎即梦 4.6，适合正式出图与高细节材质表现。',
  },
  {
    id: 'seedream-5.0-flash',
    provider: 'ark',
    label: 'Seedream 5.0 Flash',
    short: 'Seedream 5',
    badge: 'NEW',
    hint: '火山方舟 · doubao-seedream-5-0-flash-260915，速度快、适合快速出图',
    description: '火山方舟上的 Seedream 5.0 Flash，支持文生图和参考图编辑，响应更快。',
  },
  {
    id: 'cogview-3-flash',
    provider: 'cogview',
    label: 'CogView-3-Flash',
    short: 'CogView',
    badge: '免费',
    hint: '智谱 CogView-3-Flash · 免费、快速，适合草稿与批量尝试',
    description: '智谱 BigModel 的免费文生图模型，出图更快，适合快速试构图。',
  },
];

export function getImageModel(id) {
  const value = String(id || '').trim();
  if (value === MOCK_MODEL.id) return MOCK_MODEL;
  return IMAGE_MODELS.find((model) => model.id === value) || null;
}

export function isImageModelAvailable(model, config) {
  if (!model) return false;
  if (model.provider === 'seedream') return Boolean(config?.image?.seedreamAvailable);
  if (model.provider === 'ark') return Boolean(config?.image?.arkAvailable);
  if (model.provider === 'cogview') return Boolean(config?.image?.cogviewAvailable);
  if (model.provider === 'mock') {
    return (
      !config?.image?.seedreamAvailable &&
      !config?.image?.arkAvailable &&
      !config?.image?.cogviewAvailable
    );
  }
  return false;
}

export function imageModelPayload(config) {
  const models = IMAGE_MODELS.map((model) => {
    const available = isImageModelAvailable(model, config);
    return {
      ...model,
      available,
      reason: available
        ? ''
        : model.provider === 'seedream'
          ? '未配置 Seedream 4.6 API Key'
          : model.provider === 'ark'
            ? '未配置火山方舟 ARK API Key'
            : '未配置智谱 API Key',
    };
  });
  if (!models.some((model) => model.available)) {
    models.push({ ...MOCK_MODEL, available: true, reason: '' });
  }
  return models;
}

export function defaultImageModel(config) {
  const preferredId =
    config?.image?.provider === 'cogview'
      ? 'cogview-3-flash'
      : config?.image?.provider === 'ark'
        ? 'seedream-5.0-flash'
        : config?.image?.provider === 'seedream'
          ? 'seedream-4.6'
          : '';
  const preferred = preferredId ? getImageModel(preferredId) : null;
  if (preferred && isImageModelAvailable(preferred, config)) return preferred.id;
  const available = IMAGE_MODELS.find((model) => isImageModelAvailable(model, config));
  return available?.id || MOCK_MODEL.id;
}

export function normalizeImageModel(value, config) {
  const requested = String(value || '').trim();
  if (!requested) return defaultImageModel(config);
  const model = getImageModel(requested);
  return model && isImageModelAvailable(model, config) ? model.id : null;
}
