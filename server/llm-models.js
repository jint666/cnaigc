/**
 * 可切换的润色大模型。
 *
 * `id` 是应用内稳定标识，`model` 是服务商实际模型 ID，两者分开，
 * 这样以后服务商改名不会影响已经保存的生成记录。
 */
export const LLM_MODELS = [
  {
    id: 'glm-4-flash',
    provider: 'zhipu',
    label: '智谱 GLM-4-Flash',
    short: 'GLM',
    model: 'glm-4-flash',
    hint: '智谱 BigModel，中文语感稳定，适合日常润色',
  },
  {
    id: 'deepseek-v4.1-flash-economy',
    provider: 'ark',
    label: 'DeepSeek V4.1 Flash',
    short: 'DeepSeek',
    model: 'deepseek-v4-1-flash-economy-261017',
    hint: '火山方舟 ARK，响应更快，适合批量出图前的快速润色',
  },
];

export function getLlmModel(id) {
  return LLM_MODELS.find((model) => model.id === id) || null;
}

export function llmApiModel(model, config) {
  if (!model) return '';
  if (model.provider === 'zhipu') {
    return config?.llm?.zhipu?.model || model.model;
  }
  if (model.provider === 'ark') {
    return config?.llm?.ark?.model || model.model;
  }
  return model.model;
}

export function isLlmModelAvailable(model, config) {
  if (!model) return false;
  if (model.provider === 'zhipu') return Boolean(config?.llm?.zhipuAvailable);
  if (model.provider === 'ark') return Boolean(config?.llm?.arkAvailable);
  return false;
}

export function llmModelReason(model, config) {
  if (!model) return '未知模型';
  if (isLlmModelAvailable(model, config)) return '';
  if (model.provider === 'ark') return '未配置火山方舟 ARK API Key';
  return '未配置智谱 BigModel API Key';
}

export function llmModelPayload(config) {
  return LLM_MODELS.map((model) => ({
    id: model.id,
    provider: model.provider,
    label: model.label,
    short: model.short,
    model: llmApiModel(model, config),
    hint: model.hint,
    available: isLlmModelAvailable(model, config),
    reason: llmModelReason(model, config),
  }));
}

export function defaultLlmModel(config) {
  const available = LLM_MODELS.filter((model) => isLlmModelAvailable(model, config));
  const preferred = config?.llm?.defaultModel;
  const preferredModel = LLM_MODELS.find(
    (model) => model.id === preferred || model.model === preferred,
  );
  if (preferredModel && isLlmModelAvailable(preferredModel, config)) return preferredModel.id;
  if (available.length) return available[0].id;
  // 没有可用模型时仍返回主模型 id，方便前端显示禁用的默认项。
  return preferredModel?.id || preferred || LLM_MODELS[0].id;
}

export function hasLlmModel(config) {
  return LLM_MODELS.some((model) => isLlmModelAvailable(model, config));
}
