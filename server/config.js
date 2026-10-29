import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

export function loadConfig({ loadEnvFile = true } = {}) {
  if (loadEnvFile) parseEnvFile(path.join(ROOT, '.env'));

  const llmKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  const configuredLlmBaseUrl = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(
    /\/+$/,
    '',
  );
  const usesBigModel = /bigmodel\.cn/i.test(configuredLlmBaseUrl);
  const zhipuBaseUrl = (
    process.env.ZHIPU_BASE_URL ||
    (usesBigModel ? configuredLlmBaseUrl : 'https://open.bigmodel.cn/api/paas/v4')
  ).replace(/\/+$/, '');
  const zhipuModel = process.env.LLM_MODEL || 'glm-4-flash';
  const cogviewKey =
    process.env.COGVIEW_API_KEY ||
    process.env.ZHIPU_IMAGE_API_KEY ||
    (usesBigModel ? llmKey : '');
  const cogviewBaseUrl = (
    process.env.COGVIEW_BASE_URL ||
    (usesBigModel ? configuredLlmBaseUrl : 'https://open.bigmodel.cn/api/paas/v4')
  ).replace(/\/+$/, '');
  const cogviewModel = process.env.COGVIEW_MODEL || 'cogview-3-flash';
  const imageKey = process.env.SEEDREAM_API_KEY || process.env.SEEDREAM4_API_KEY || '';
  const arkKey = process.env.ARK_API_KEY || process.env.SEEDREAM5_API_KEY || '';
  const arkBaseUrl = (process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(
    /\/+$/,
    '',
  );
  const arkModel = process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5-0-flash-260915';
  const arkLlmModel =
    process.env.ARK_LLM_MODEL || 'deepseek-v4-1-flash-economy-261017';
  const arkLlmBaseUrl = (
    process.env.ARK_LLM_BASE_URL ||
    arkBaseUrl
  ).replace(/\/+$/, '');
  const zhipuAvailable = Boolean(llmKey);
  const arkLlmAvailable = Boolean(arkKey);
  const defaultLlmModel =
    process.env.LLM_DEFAULT_MODEL ||
    (zhipuAvailable
      ? 'glm-4-flash'
      : arkLlmAvailable
        ? 'deepseek-v4.1-flash-economy'
        : 'glm-4-flash');
  const imageAccessKey =
    process.env.SEEDREAM_ACCESS_KEY || process.env.SEEDREAM_API_KEY_ID || '';
  const imageSecretKey =
    process.env.SEEDREAM_SECRET_KEY || process.env.SEEDREAM_API_KEY_SECRET || '';
  const hasPairCredentials = Boolean(imageAccessKey && imageSecretKey);
  const requestedAuth = (process.env.SEEDREAM_AUTH || '').toLowerCase();
  // 火山智能视觉有两套凭据：
  //   volc   = IAM AccessKeyID / SecretAccessKey（以 AKLT 开头），走 V4 签名；
  //   apikey = 控制台「API Key ID / API Key Secret」，走 Bearer Secret。
  // 未显式指定时按 AK 前缀自动判断，避免把 API Key 当成 AK/SK 去签名。
  const imageAuth =
    requestedAuth ||
    (hasPairCredentials
      ? imageAccessKey.startsWith('AKLT')
        ? 'volc'
        : 'apikey'
      : imageKey
        ? 'bearer'
        : 'none');
  const hasImageCredentials =
    imageAuth === 'volc' || imageAuth === 'apikey'
      ? hasPairCredentials
      : imageAuth === 'bearer'
        ? Boolean(imageKey)
        : false;
  const hasArkCredentials = Boolean(arkKey);
  const hasCogviewCredentials = Boolean(cogviewKey);
  const requestedImageProvider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase();
  let imageProvider;
  if (requestedImageProvider === 'auto') {
    imageProvider = hasImageCredentials
      ? 'seedream'
      : hasArkCredentials
        ? 'ark'
        : hasCogviewCredentials
          ? 'cogview'
          : 'mock';
  } else if (['seedream', 'ark', 'cogview', 'mock'].includes(requestedImageProvider)) {
    imageProvider = requestedImageProvider;
  } else {
    imageProvider = 'mock';
  }
  // 显式指定的 provider 不可用时，自动退回另一个已配置的线上模型。
  if (imageProvider === 'seedream' && !hasImageCredentials) {
    imageProvider = hasArkCredentials
      ? 'ark'
      : hasCogviewCredentials
        ? 'cogview'
        : 'mock';
  }
  if (imageProvider === 'ark' && !hasArkCredentials) {
    imageProvider = hasImageCredentials
      ? 'seedream'
      : hasCogviewCredentials
        ? 'cogview'
        : 'mock';
  }
  if (imageProvider === 'cogview' && !hasCogviewCredentials) {
    imageProvider = hasImageCredentials
      ? 'seedream'
      : hasArkCredentials
        ? 'ark'
        : 'mock';
  }
  const defaultImageBaseUrl =
    imageAuth === 'apikey'
      ? 'https://openapi.cv.volces.com'
      : imageAuth === 'volc'
        ? 'https://visual.volcengineapi.com'
        : 'https://ark.cn-beijing.volces.com/api/v3';
  const defaultImageModel =
    imageAuth === 'apikey' || imageAuth === 'volc'
      ? 'seedream-4.6'
      : 'doubao-seedream-4-0-250828';

  return {
    root: ROOT,
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 5173),
    dataDir: path.join(ROOT, 'data'),
    knowledgeFile: path.join(ROOT, 'data', 'knowledge.json'),
    seedFile: path.join(ROOT, 'data', 'knowledge.seed.json'),
    historyFile: path.join(ROOT, 'data', 'history.json'),
    historyLimit: 10,
    maxEntries: Number(process.env.MAX_KNOWLEDGE_ENTRIES || 500),
    llm: {
      key: llmKey,
      baseUrl: configuredLlmBaseUrl,
      model: zhipuModel,
      defaultModel: defaultLlmModel,
      zhipuAvailable,
      arkAvailable: arkLlmAvailable,
      mode: zhipuAvailable || arkLlmAvailable ? 'live' : 'local',
      zhipu: {
        key: llmKey,
        baseUrl: zhipuBaseUrl,
        model: zhipuModel,
      },
      ark: {
        key: arkKey,
        baseUrl: arkLlmBaseUrl,
        model: arkLlmModel,
      },
    },
    image: {
      key: imageKey,
      accessKey: imageAccessKey,
      secretKey: imageSecretKey,
      auth: imageAuth,
      baseUrl: (process.env.SEEDREAM_BASE_URL || defaultImageBaseUrl).replace(/\/+$/, ''),
      model: process.env.SEEDREAM_MODEL || defaultImageModel,
      reqKey: process.env.SEEDREAM_REQ_KEY || 'jimeng_t2i_v46',
      action: process.env.SEEDREAM_ACTION || 'CVSync2AsyncSubmitTask',
      submitPath: process.env.SEEDREAM_SUBMIT_PATH || '/api/common/v3/submit_task_v2',
      resultPath: process.env.SEEDREAM_RESULT_PATH || '/api/common/v3/get_result_v2',
      version: process.env.SEEDREAM_VERSION || '2022-08-31',
      region: process.env.SEEDREAM_REGION || 'cn-north-1',
      service: process.env.SEEDREAM_SERVICE || 'cv',
      pollIntervalMs: Number(process.env.SEEDREAM_POLL_INTERVAL_MS || 2000),
      timeoutMs: Number(process.env.SEEDREAM_TIMEOUT_MS || 180000),
      provider: imageProvider,
      requestedProvider: requestedImageProvider,
      seedreamAvailable: hasImageCredentials && imageProvider !== 'mock',
      arkAvailable: hasArkCredentials && imageProvider !== 'mock',
      cogviewAvailable: hasCogviewCredentials && imageProvider !== 'mock',
      ark: {
        key: arkKey,
        baseUrl: arkBaseUrl,
        model: arkModel,
        timeoutMs: Number(process.env.ARK_TIMEOUT_MS || 180000),
      },
      cogview: {
        key: cogviewKey,
        baseUrl: cogviewBaseUrl,
        model: cogviewModel,
        timeoutMs: Number(process.env.COGVIEW_TIMEOUT_MS || 120000),
      },
    },
  };
}

export function publicConfig(config) {
  const provider = config.image.provider || 'mock';
  const model =
    provider === 'seedream'
      ? config.image.model
      : provider === 'ark'
        ? config.image.ark?.model || 'doubao-seedream-5-0-flash-260915'
        : provider === 'cogview'
          ? config.image.cogview?.model || 'cogview-3-flash'
          : '演示占位图';
  return {
    llm: {
      engine: config.llm.mode === 'live' ? 'llm' : 'local',
      model: config.llm.mode === 'live' ? config.llm.model : '本地策展引擎',
      defaultModel: config.llm.defaultModel,
      zhipuAvailable: Boolean(config.llm.zhipuAvailable),
      arkAvailable: Boolean(config.llm.arkAvailable),
    },
    image: {
      engine: provider,
      model,
      auth: config.image.auth,
      provider,
    },
    knowledgeLimit: config.maxEntries,
  };
}
