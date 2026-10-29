/* ============================================================
   墨生 · 中式美学 AIGC — front-end controller
   Zero dependencies. Talks to the local Node API.
   ============================================================ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const SINGLE_IMAGE_MAX_VH = 62;

const dom = {
  enginePill: $('#enginePill'),
  engineText: $('#engineText'),
  openKnowledge: $('#openKnowledge'),
  kbCount: $('#kbCount'),
  openHistory: $('#openHistory'),
  historyCount: $('#historyCount'),
  stage: $('#stage'),
  intro: $('#intro'),
  introKbCount: $('#introKbCount'),
  resultArea: $('#resultArea'),
  resultTitle: $('#resultTitle'),
  viewPrompt: $('#viewPrompt'),
  newWork: $('#newWork'),
  resultGrid: $('#resultGrid'),
  notePrompt: $('#notePrompt'),
  noteMetaEngine: $('#noteMetaEngine'),
  noteMetaModel: $('#noteMetaModel'),
  noteMetaStrength: $('#noteMetaStrength'),
  noteMetaRatio: $('#noteMetaRatio'),
  noteKeywords: $('#noteKeywords'),
  noteRefs: $('#noteRefs'),
  noteMore: $('#noteMore'),
  resultWarning: $('#resultWarning'),
  promptInput: $('#promptInput'),
  charCount: $('#charCount'),
  strengthSeg: $('#strengthSeg'),
  strengthHint: $('#strengthHint'),
  imageModelSelect: $('#imageModelSelect'),
  llmModelSelect: $('#llmModelSelect'),
  styleSelect: $('#styleSelect'),
  ratioSelect: $('#ratioSelect'),
  countSelect: $('#countSelect'),
  polishBtn: $('#polishBtn'),
  generateBtn: $('#generateBtn'),
  footEngine: $('#footEngine'),
  loading: $('#loading'),
  loadingTitle: $('#loadingTitle'),
  loadingSteps: $('#loadingSteps'),
  loadingImageStep: $('#loadingImageStep'),
  loadingQuote: $('#loadingQuote'),
  loadingTime: $('#loadingTime'),
  promptDialog: $('#promptDialog'),
  dialogClose: $('#dialogClose'),
  dialogWarning: $('#dialogWarning'),
  originalText: $('#originalText'),
  polishedText: $('#polishedText'),
  refCount: $('#refCount'),
  refList: $('#refList'),
  keywordList: $('#keywordList'),
  rationaleList: $('#rationaleList'),
  negativeText: $('#negativeText'),
  copyPrompt: $('#copyPrompt'),
  usePrompt: $('#usePrompt'),
  drawer: $('#knowledgeDrawer'),
  drawerScrim: $('#drawerScrim'),
  drawerClose: $('#drawerClose'),
  kbTotal: $('#kbTotal'),
  kbCats: $('#kbCats'),
  kbTerms: $('#kbTerms'),
  kbSearch: $('#kbSearch'),
  toggleManual: $('#toggleManual'),
  manualForm: $('#manualForm'),
  manualTitle: $('#manualTitle'),
  manualCategory: $('#manualCategory'),
  manualContent: $('#manualContent'),
  manualTags: $('#manualTags'),
  cancelManual: $('#cancelManual'),
  categoryOptions: $('#categoryOptions'),
  categoryChips: $('#categoryChips'),
  uploadZone: $('#uploadZone'),
  fileInput: $('#fileInput'),
  kbListMeta: $('#kbListMeta'),
  kbList: $('#kbList'),
  resetKb: $('#resetKb'),
  historyDrawer: $('#historyDrawer'),
  historyScrim: $('#historyScrim'),
  historyClose: $('#historyClose'),
  historyList: $('#historyList'),
  historyTotal: $('#historyTotal'),
  clearHistory: $('#clearHistory'),
  toastStack: $('#toastStack'),
  aboutBtn: $('#aboutBtn'),
};

const state = {
  health: null,
  meta: null,
  strength: 'medium',
  style: 'auto',
  imageModel: 'seedream-4.6',
  llmModel: '',
  ratio: '1:1',
  count: 1,
  busy: false,
  lastResult: null,
  dialogResult: null,
  kb: {
    query: '',
    category: '',
    stats: null,
    entries: [],
    loaded: false,
    seq: 0,
  },
  history: {
    items: [],
    loaded: false,
    seq: 0,
  },
  loading: {
    started: 0,
    timers: [],
    ticker: null,
  },
};

const LOADING_QUOTES = [
  '大音希声，大象无形。',
  '留白处，皆是意境。',
  '器以载道，物以传情。',
  '墨分五色，意在笔先。',
  '一器一物，皆有呼吸。',
];

/* ---------- utilities ---------- */

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => map[char]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiError(message, status = 0) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function api(path, { method = 'GET', body = null, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }
    if (!response.ok) {
      throw apiError(data?.message || `请求失败（${response.status}）`, response.status);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw apiError('请求超时，请检查网络或稍后重试');
    }
    if (error instanceof TypeError) {
      throw apiError('无法连接本地服务，请确认服务已启动');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toast(message, type = 'info', duration = 3600) {
  if (!message) return;
  while (dom.toastStack.children.length >= 3) {
    dom.toastStack.firstElementChild.remove();
  }
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : ''}`;
  el.textContent = message;
  dom.toastStack.append(el);
  window.setTimeout(() => {
    el.classList.add('is-out');
    window.setTimeout(() => el.remove(), 320);
  }, duration);
}

function syncBodyLock() {
  const locked =
    !dom.loading.hidden ||
    dom.drawer.classList.contains('is-open') ||
    dom.historyDrawer.classList.contains('is-open') ||
    dom.promptDialog.open === true;
  document.body.classList.toggle('is-locked', locked);
}

function formatDate(value) {
  if (!value) return '内置';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '内置';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date);
}

function formatHistoryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function truncate(value, length = 110) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function pickKeywords(result) {
  return Array.isArray(result?.keywords) ? result.keywords.filter(Boolean).slice(0, 10) : [];
}

/* ---------- boot ---------- */

async function init() {
  bindEvents();
  updateCharCount();
  autoResizePrompt();

  try {
    const [health, meta] = await Promise.all([
      api('/api/health', { timeout: 8000 }),
      api('/api/meta', { timeout: 8000 }),
    ]);
    state.health = health;
    state.meta = meta;
    applyMeta(meta);
    applyHealth(health);
    void loadHistory({ silent: true });
  } catch (error) {
    dom.engineText.textContent = '服务未连接';
    dom.enginePill.classList.add('is-demo');
    dom.footEngine.textContent = '本地服务尚未连接';
    toast(error.message, 'error', 6000);
  }
}

function applyMeta(meta) {
  const strengths = Array.isArray(meta?.strengths) ? meta.strengths : [];
  if (strengths.length) {
    $$('#strengthSeg button').forEach((button) => {
      const item = strengths.find((entry) => entry.id === button.dataset.strength);
      if (!item) return;
      button.textContent = item.short || item.label;
      button.title = item.hint || item.label;
    });
    updateStrengthHint();
  }

  const llmModels = Array.isArray(meta?.llmModels) ? meta.llmModels : [];
  if (llmModels.length) {
    const available = llmModels.filter((model) => model.available !== false);
    if (available.length) {
      const preferred = [meta.defaultLlmModel, available[0]?.id, llmModels[0]?.id]
        .filter(Boolean)
        .find((id) => llmModels.some((model) => model.id === id && model.available !== false));
      state.llmModel = preferred || available[0].id;
      dom.llmModelSelect.innerHTML = llmModels
        .map((model) => {
          const label = `${model.label}${model.badge ? ` · ${model.badge}` : ''}`;
          const title = [model.hint, model.available === false ? model.reason : '']
            .filter(Boolean)
            .join(' · ');
          return `<option value="${escapeHtml(model.id)}" title="${escapeHtml(title)}"${
            model.available === false ? ' disabled' : ''
          }>${escapeHtml(label)}</option>`;
        })
        .join('');
      dom.llmModelSelect.value = state.llmModel;
    } else {
      state.llmModel = '';
      dom.llmModelSelect.innerHTML =
        '<option value="">本地策展引擎（未配置大模型）</option>';
    }
  }

  const imageModels = Array.isArray(meta?.imageModels) ? meta.imageModels : [];
  if (imageModels.length) {
    const available = imageModels.filter((model) => model.available !== false);
    const preferred = [meta.defaultImageModel, available[0]?.id, imageModels[0]?.id]
      .filter(Boolean)
      .find((id) => imageModels.some((model) => model.id === id && model.available !== false));
    state.imageModel = preferred || imageModels[0]?.id || state.imageModel;
    dom.imageModelSelect.innerHTML = imageModels
      .map((model) => {
        const label = `${model.label}${model.badge ? ` · ${model.badge}` : ''}`;
        const title = [model.hint, model.available === false ? model.reason : '']
          .filter(Boolean)
          .join(' · ');
        return `<option value="${escapeHtml(model.id)}" title="${escapeHtml(title)}"${
          model.available === false ? ' disabled' : ''
        }>${escapeHtml(label)}</option>`;
      })
      .join('');
    dom.imageModelSelect.value = state.imageModel;
    syncImageModelUi();
  }

  const styles = Array.isArray(meta?.styles) ? meta.styles : [];
  if (styles.length) {
    dom.styleSelect.innerHTML = styles
      .map(
        (style) =>
          `<option value="${escapeHtml(style.id)}" title="${escapeHtml(style.hint || '')}">${escapeHtml(
            style.label,
          )}</option>`,
      )
      .join('');
    dom.styleSelect.value = state.style;
  }

  const ratios = Array.isArray(meta?.ratios) ? meta.ratios : [];
  if (ratios.length) {
    dom.ratioSelect.innerHTML = ratios
      .map(
        (ratio) =>
          `<option value="${escapeHtml(ratio.id)}" title="${escapeHtml(ratio.hint || '')}">${escapeHtml(
            ratio.label,
          )}</option>`,
      )
      .join('');
    dom.ratioSelect.value = state.ratio;
  }
}

function applyHealth(health) {
  const stats = health?.knowledge || {};
  state.health = health;
  syncImageModelUi();

  if (stats && typeof stats.entries === 'number') {
    state.kb.stats = stats;
    applyStats(stats, { renderChips: true });
  }
}

function currentImageModel() {
  const models = Array.isArray(state.meta?.imageModels) ? state.meta.imageModels : [];
  return models.find((model) => model.id === state.imageModel) || null;
}

function currentLlmModel() {
  if (!state.llmModel) return null;
  const models = Array.isArray(state.meta?.llmModels) ? state.meta.llmModels : [];
  return models.find((model) => model.id === state.llmModel) || null;
}

function syncImageModelUi() {
  const llmModel = currentLlmModel();
  const llmLive = Boolean(llmModel && llmModel.available !== false);
  const llmName = llmLive ? llmModel.short || '大模型' : '本地';
  const model = currentImageModel();
  const live = Boolean(model && model.available !== false && model.provider !== 'mock');
  const imageName = live ? model?.short || '生图' : '演示';

  dom.enginePill.classList.toggle('is-demo', !live);
  dom.engineText.textContent = `${llmLive ? llmName : '本地'} · ${imageName}`;
  dom.enginePill.title = [
    `润色：${llmLive ? `大模型 · ${llmModel.label}` : '本地策展引擎（RAG）'}`,
    `生图：${live ? model.label : '演示占位图'}`,
    llmModel?.hint || '',
    llmModel?.available === false ? llmModel.reason : '',
    live ? '' : '请在「生图」下拉框选择已配置的模型，或填写 .env 后重启。',
  ]
    .filter(Boolean)
    .join('\n');

  dom.footEngine.textContent = live
    ? `${llmLive ? `${llmName} 润色` : '本地策展引擎'} · ${model.label} 生成`
    : '本地策展引擎 · 演示占位图（配置 API Key 后启用真实生图）';
}

function applyStats(stats, { renderChips = false } = {}) {
  if (!stats) return;
  state.kb.stats = stats;
  dom.kbCount.textContent = stats.entries ?? '—';
  dom.introKbCount.textContent = stats.entries ?? '—';
  dom.kbTotal.textContent = stats.entries ?? '—';
  dom.kbCats.textContent = stats.categories ?? '—';
  dom.kbTerms.textContent = stats.terms ?? '—';

  const categories = Array.isArray(stats.categoryList) ? stats.categoryList : [];
  dom.categoryOptions.innerHTML = categories
    .map((item) => `<option value="${escapeHtml(item.name)}"></option>`)
    .join('');

  if (state.kb.category && !categories.some((item) => item.name === state.kb.category)) {
    state.kb.category = '';
  }
  if (renderChips) renderCategoryChips(categories);
}

function renderCategoryChips(categories = []) {
  const chips = [{ name: '', label: '全部', count: state.kb.stats?.entries || 0 }].concat(
    categories.map((item) => ({ name: item.name, label: item.name, count: item.count })),
  );
  dom.categoryChips.innerHTML = chips
    .map(
      (item) => `<button type="button" data-category="${escapeHtml(item.name)}" class="${
        state.kb.category === item.name ? 'is-active' : ''
      }" title="${escapeHtml(item.label)} · ${item.count} 条">${escapeHtml(item.label)}</button>`,
    )
    .join('');
}

/* ---------- composer ---------- */

function updateStrengthHint() {
  const item = state.meta?.strengths?.find((entry) => entry.id === state.strength);
  dom.strengthHint.textContent = item?.hint || '主体 + 美学结构';
  $$('#strengthSeg button').forEach((button) => {
    const active = button.dataset.strength === state.strength;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateCharCount() {
  const length = dom.promptInput.value.length;
  dom.charCount.textContent = String(length);
  dom.charCount.classList.toggle('is-near', length >= 700);
}

function autoResizePrompt() {
  dom.promptInput.style.height = 'auto';
  dom.promptInput.style.height = `${Math.min(dom.promptInput.scrollHeight, 160)}px`;
}

function setBusy(busy) {
  state.busy = busy;
  dom.generateBtn.disabled = busy;
  dom.polishBtn.disabled = busy;
  dom.generateBtn.classList.toggle('is-busy', busy);
}

async function createWork() {
  if (state.busy) return;
  const prompt = dom.promptInput.value.trim();
  if (prompt.length < 2) {
    toast('请先写下你想生成的画面', 'error');
    dom.promptInput.focus();
    return;
  }
  if (prompt.length > 800) {
    toast('描述请控制在 800 字以内', 'error');
    return;
  }

  setBusy(true);
  beginLoading('create');
  try {
    const result = await api('/api/create', {
      method: 'POST',
      timeout: 300000,
      body: {
        prompt,
        strength: state.strength,
        style: state.style,
        imageModel: state.imageModel,
        llmModel: state.llmModel || undefined,
        ratio: state.ratio,
        count: state.count,
      },
    });
    await ensureMinimumLoading(1700);
    if (!Array.isArray(result.images) || !result.images.length) {
      throw apiError('本次没有返回图片，请稍后重试');
    }
    state.lastResult = result;
    renderResult(result);
    if (result.warning) toast(result.warning, 'info', 12000);
    void loadHistory({ silent: true });
  } catch (error) {
    await sleep(500);
    toast(error.message, 'error', 5200);
  } finally {
    endLoading();
    setBusy(false);
  }
}

async function polishOnly() {
  if (state.busy) return;
  const prompt = dom.promptInput.value.trim();
  if (prompt.length < 2) {
    toast('请先写下你想生成的画面', 'error');
    dom.promptInput.focus();
    return;
  }

  setBusy(true);
  beginLoading('polish');
  try {
    const result = await api('/api/polish', {
      method: 'POST',
      timeout: 90000,
      body: {
        prompt,
        strength: state.strength,
        style: state.style,
        llmModel: state.llmModel || undefined,
      },
    });
    await ensureMinimumLoading(1100);
    state.lastResult = result;
    openPromptDialog(result);
    if (result.warning) toast(result.warning, 'info', 12000);
    else toast('已完成润色，可查看手记或直接生成', 'success');
  } catch (error) {
    await sleep(400);
    toast(error.message, 'error', 5200);
  } finally {
    endLoading();
    setBusy(false);
  }
}

async function generateFromPolish(prompt, previous) {
  if (state.busy || !prompt) return;
  setBusy(true);
  beginLoading('image');
  try {
    const generated = await api('/api/generate', {
      method: 'POST',
      timeout: 300000,
      body: {
        prompt,
        original: previous?.original || dom.promptInput.value.trim(),
        subject: previous?.subject || undefined,
        negativePrompt: previous?.negativePrompt || undefined,
        keywords: previous?.keywords || undefined,
        rationale: previous?.rationale || undefined,
        references: previous?.references || undefined,
        strength: previous?.strength?.id || state.strength,
        style: previous?.style?.id || state.style,
        ratio: state.ratio,
        count: state.count,
        imageModel: state.imageModel,
        llmModel: previous?.llmModel || state.llmModel || undefined,
      },
    });
    await ensureMinimumLoading(1500);
    if (!Array.isArray(generated.images) || !generated.images.length) {
      throw apiError('本次没有返回图片，请稍后重试');
    }
    const result = {
      ...(previous || {}),
      ...generated,
      prompt,
      original: previous?.original || dom.promptInput.value.trim(),
      references: previous?.references || [],
      strength: previous?.strength || { id: state.strength, label: state.strength },
      style: previous?.style || { id: state.style, label: '自动' },
      llmModel: previous?.llmModel || state.llmModel || null,
      llmModelLabel:
        previous?.llmModelLabel || currentLlmModel()?.label || '',
      engine: previous?.engine || 'local',
      engineLabel: previous?.engineLabel || '本地策展引擎',
      imageEngine: generated.engine,
      imageModel: generated.model || state.imageModel,
      imageModelLabel:
        generated.modelLabel || currentImageModel()?.label || '生图',
      ratio: state.ratio,
      count: state.count,
      warning: generated.warning || previous?.warning || null,
    };
    state.lastResult = result;
    renderResult(result);
    if (result.warning) toast(result.warning, 'info', 12000);
    void loadHistory({ silent: true });
  } catch (error) {
    await sleep(400);
    toast(error.message, 'error', 5200);
  } finally {
    endLoading();
    setBusy(false);
  }
}

/* ---------- loading ---------- */

function beginLoading(kind) {
  dom.loading.hidden = false;
  syncBodyLock();
  state.loading.started = Date.now();
  clearLoadingTimers();

  const selectedModel = currentImageModel();
  const imageName =
    selectedModel?.provider === 'mock' ? '演示画面' : selectedModel?.short || 'Seedream';
  if (dom.loadingImageStep) dom.loadingImageStep.textContent = `${imageName} 落墨成像`;

  const title =
    kind === 'polish'
      ? '正在检索并润色'
      : kind === 'image'
        ? `${imageName} 正在落墨`
        : '正在检索与落墨';
  dom.loadingTitle.textContent = title;
  dom.loadingTime.textContent = '0.0s';
  dom.loadingQuote.textContent = `“ ${LOADING_QUOTES[0]} ”`;

  const steps = $$('.loading-step', dom.loadingSteps);
  steps.forEach((step) => {
    step.hidden = kind === 'polish' && step.dataset.step === '3';
    step.classList.remove('is-active', 'is-done');
  });

  if (kind === 'image') {
    steps.slice(0, 3).forEach((step) => step.classList.add('is-done'));
    steps[3]?.classList.add('is-active');
  } else {
    markLoadingStep(0);
    const schedule =
      kind === 'polish'
        ? [
            [780, 1],
            [1650, 2],
          ]
        : [
            [850, 1],
            [1850, 2],
            [2900, 3],
          ];
    for (const [delay, index] of schedule) {
      state.loading.timers.push(window.setTimeout(() => markLoadingStep(index), delay));
    }
  }

  state.loading.timers.push(
    window.setInterval(() => {
      dom.loadingTime.textContent = `${((Date.now() - state.loading.started) / 1000).toFixed(1)}s`;
    }, 100),
  );

  state.loading.timers.push(
    window.setInterval(() => {
      const quote = LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)];
      dom.loadingQuote.textContent = `“ ${quote} ”`;
    }, 2600),
  );
}

function markLoadingStep(index) {
  $$('.loading-step', dom.loadingSteps).forEach((step) => {
    const current = Number(step.dataset.step);
    step.classList.toggle('is-active', current === index);
    step.classList.toggle('is-done', current < index);
  });
}

function clearLoadingTimers() {
  for (const timer of state.loading.timers) {
    window.clearTimeout(timer);
    window.clearInterval(timer);
  }
  state.loading.timers = [];
}

function endLoading() {
  clearLoadingTimers();
  dom.loading.hidden = true;
  syncBodyLock();
}

async function ensureMinimumLoading(ms) {
  const elapsed = Date.now() - state.loading.started;
  if (elapsed < ms) await sleep(ms - elapsed);
}

/* ---------- results ---------- */

function renderResult(result) {
  dom.stage.hidden = true;
  dom.resultArea.hidden = false;

  const subject = result.subject || result.original || '东方画面';
  dom.resultTitle.textContent = subject.length > 28 ? `${subject.slice(0, 28)}…` : subject;

  const images = Array.isArray(result.images) ? result.images : [];
  dom.resultGrid.dataset.count = String(Math.min(images.length, 4));
  dom.resultGrid.innerHTML = images
    .map((image, index) => {
      const width = Number(image.width) || 1;
      const height = Number(image.height) || 1;
      const singleWidth = ((SINGLE_IMAGE_MAX_VH * width) / height).toFixed(2);
      return `<figure class="work-card" style="--ratio:${width}/${height};--single-width:${singleWidth}vh">
        <img src="${escapeHtml(image.url)}" alt="${escapeHtml(subject)} · 第 ${index + 1} 张" />
        <div class="work-shade">
          <span class="work-index">${String(index + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}</span>
          <div class="work-tools">
            <button class="work-tool" type="button" data-download="${index}" title="下载原图" aria-label="下载原图">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18.5h14"/></svg>
            </button>
          </div>
        </div>
      </figure>`;
    })
    .join('');

  $$('img', dom.resultGrid).forEach((img) => {
    const syncRatio = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const card = img.closest('.work-card');
      if (!card) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      card.style.setProperty('--ratio', `${img.naturalWidth}/${img.naturalHeight}`);
      card.style.setProperty('--single-width', `${(SINGLE_IMAGE_MAX_VH * ratio).toFixed(2)}vh`);
    };
    if (img.complete) {
      syncRatio();
      img.classList.add('is-loaded');
    } else {
      img.addEventListener(
        'load',
        () => {
          syncRatio();
          img.classList.add('is-loaded');
        },
        { once: true },
      );
    }
    img.addEventListener(
      'error',
      () => {
        img.style.opacity = '1';
        img.alt = '图片加载失败，可尝试重新生成';
        toast('有图片加载失败，请检查网络或重新生成', 'error');
      },
      { once: true },
    );
  });

  $$('[data-download]', dom.resultGrid).forEach((button) => {
    button.addEventListener('click', () => {
      const image = images[Number(button.dataset.download)];
      if (image) downloadImage(image, Number(button.dataset.download));
    });
  });

  dom.notePrompt.textContent = result.prompt || '';
  dom.noteMetaEngine.textContent =
    result.engine === 'llm'
      ? result.engineLabel || '大模型润色'
      : result.engineLabel || '本地策展';
  dom.noteMetaModel.textContent =
    result.imageModelLabel || result.modelLabel || currentImageModel()?.label || '生图';
  dom.noteMetaStrength.textContent = result.strength?.label || '雅致';
  dom.noteMetaRatio.textContent = result.ratio || state.ratio;

  const keywords = pickKeywords(result);
  dom.noteKeywords.innerHTML = keywords.length
    ? keywords.map((keyword) => `<span class="chip">${escapeHtml(keyword)}</span>`).join('')
    : '<span class="ref-empty">本次未提取关键词</span>';

  const references = Array.isArray(result.references) ? result.references : [];
  dom.noteRefs.innerHTML = references.length
    ? references
        .slice(0, 3)
        .map(
          (reference) => `<div class="ref-item">
            <strong>${escapeHtml(reference.title)}</strong>
            <p>${escapeHtml(truncate(reference.excerpt, 90))}</p>
          </div>`,
        )
        .join('')
    : '<p class="ref-empty">本次未命中强相关语料，已按通用中式美学规则补全。</p>';

  const warning =
    result.warning ||
    (result.imageEngine === 'mock'
      ? '当前为演示模式：未配置可用的生图 API Key，画面由本地生成占位图。在 .env 中填入密钥并重启服务即可生成真实图片。'
      : '');
  dom.resultWarning.hidden = !warning;
  dom.resultWarning.textContent = warning;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadImage(image, index) {
  if (!image?.url) return;
  if (image.url.startsWith('data:')) {
    const isSvg = image.url.startsWith('data:image/svg+xml');
    const filename = `mosheng-${Date.now()}-${index + 1}.${isSvg ? 'svg' : 'png'}`;
    const anchor = document.createElement('a');
    anchor.href = image.url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    toast('已开始下载原图', 'success');
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = image.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  toast('已在新标签页打开原图，可右键保存', 'info');
}

function resetWorkspace() {
  state.lastResult = null;
  dom.resultArea.hidden = true;
  dom.stage.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  dom.promptInput.focus({ preventScroll: true });
}

/* ---------- prompt dialog ---------- */

function openPromptDialog(result) {
  if (!result?.prompt) return;
  state.dialogResult = result;
  dom.originalText.textContent = result.original || dom.promptInput.value.trim() || '—';
  dom.polishedText.textContent = result.prompt;

  const references = Array.isArray(result.references) ? result.references : [];
  dom.refCount.textContent = references.length ? `(${references.length})` : '';
  dom.refList.innerHTML = references.length
    ? references
        .map(
          (reference) => `<article class="dialog-ref">
            <div class="dialog-ref-head">
              <strong>${escapeHtml(reference.title)}</strong>
              <span>${escapeHtml(reference.category || '')}</span>
            </div>
            <p>${escapeHtml(truncate(reference.excerpt, 150))}</p>
          </article>`,
        )
        .join('')
    : '<p class="ref-empty">未命中强相关语料，按通用中式美学规则补全。</p>';

  const keywords = pickKeywords(result);
  dom.keywordList.innerHTML = keywords.length
    ? keywords.map((keyword) => `<span class="chip">${escapeHtml(keyword)}</span>`).join('')
    : '<span class="ref-empty">暂无关键词</span>';

  const rationale = Array.isArray(result.rationale) ? result.rationale : [];
  dom.rationaleList.innerHTML = rationale.length
    ? rationale.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>按主体气质与中式视觉语言组织画面。</li>';

  dom.negativeText.textContent = result.negativePrompt || '无';
  dom.usePrompt.textContent = result.images?.length ? '按此提示词再生成' : '用此提示词生成';

  const warning = result.warning ? String(result.warning) : '';
  dom.dialogWarning.hidden = !warning;
  dom.dialogWarning.textContent = warning;

  if (dom.promptDialog.open) dom.promptDialog.close();
  dom.promptDialog.showModal();
  syncBodyLock();
}

function closePromptDialog() {
  if (dom.promptDialog.open) dom.promptDialog.close();
}

async function copyPrompt() {
  const text = state.dialogResult?.prompt;
  if (!text) return;
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    copied = fallbackCopy(text);
  }
  if (!copied) {
    toast('复制失败，请手动选择文本', 'error');
    return;
  }
  const original = dom.copyPrompt.textContent;
  dom.copyPrompt.textContent = '已复制';
  toast('提示词已复制', 'success');
  window.setTimeout(() => {
    dom.copyPrompt.textContent = original;
  }, 1600);
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.append(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

/* ---------- knowledge base ---------- */

function openDrawer() {
  closeHistoryDrawer();
  dom.drawer.classList.add('is-open');
  dom.drawer.setAttribute('aria-hidden', 'false');
  setActiveNav('knowledge');
  syncBodyLock();
  if (!state.kb.loaded) loadKnowledge();
  window.setTimeout(() => dom.kbSearch.focus({ preventScroll: true }), 380);
}

function closeDrawer() {
  dom.drawer.classList.remove('is-open');
  dom.drawer.setAttribute('aria-hidden', 'true');
  setActiveNav('studio');
  syncBodyLock();
}

function setActiveNav(name) {
  $$('.side-link').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.nav === name);
  });
}

async function loadKnowledge() {
  const seq = ++state.kb.seq;
  const params = new URLSearchParams();
  if (state.kb.query) params.set('q', state.kb.query);
  if (state.kb.category) params.set('category', state.kb.category);
  params.set('limit', '200');
  dom.kbListMeta.textContent = '检索中…';

  try {
    const data = await api(`/api/knowledge?${params.toString()}`, { timeout: 15000 });
    if (seq !== state.kb.seq) return;
    state.kb.entries = Array.isArray(data.entries) ? data.entries : [];
    state.kb.loaded = true;
    applyStats(data.stats, { renderChips: true });
    renderKnowledge(data.entries);
  } catch (error) {
    if (seq !== state.kb.seq) return;
    dom.kbListMeta.textContent = '读取失败';
    dom.kbList.innerHTML = `<div class="kb-empty"><strong>知识库读取失败</strong>${escapeHtml(
      error.message,
    )}</div>`;
    toast(error.message, 'error');
  }
}

function renderKnowledge(entries) {
  const list = Array.isArray(entries) ? entries : [];
  dom.kbListMeta.textContent = `${list.length} 条`;
  if (!list.length) {
    dom.kbList.innerHTML = `<div class="kb-empty"><strong>没有找到相关语料</strong>${
      state.kb.query || state.kb.category ? '试试清除搜索或切换分类' : '可手动录入，或上传 .md / .txt / .json 文件'
    }</div>`;
    return;
  }

  dom.kbList.innerHTML = list
    .map(
      (entry) => `<article class="kb-item">
        <div class="kb-item-top">
          <span class="kb-cat">${escapeHtml(entry.category)}</span>
          <button class="kb-delete" type="button" data-id="${escapeHtml(
            entry.id,
          )}" title="删除该语料" aria-label="删除 ${escapeHtml(entry.title)}">×</button>
        </div>
        <h4>${escapeHtml(entry.title)}</h4>
        <p>${escapeHtml(entry.content)}</p>
        <div class="kb-tags">${(entry.tags || [])
          .slice(0, 5)
          .map((tag) => `<span>${escapeHtml(tag)}</span>`)
          .join('')}</div>
        <span class="kb-source">${escapeHtml(entry.source || '未标注来源')} · ${escapeHtml(
          formatDate(entry.createdAt),
        )}</span>
      </article>`,
    )
    .join('');
}

async function deleteEntry(button) {
  const id = button.dataset.id;
  const entry = state.kb.entries.find((item) => item.id === id);
  if (!id) return;
  if (!window.confirm(`确定删除「${entry?.title || '这条语料'}」吗？删除后不可恢复。`)) return;
  button.disabled = true;
  try {
    const data = await api(`/api/knowledge/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      timeout: 15000,
    });
    applyStats(data.stats, { renderChips: true });
    await loadKnowledge();
    toast('语料已删除', 'success');
  } catch (error) {
    button.disabled = false;
    toast(error.message, 'error');
  }
}

async function addManualEntry(event) {
  event.preventDefault();
  const content = dom.manualContent.value.trim();
  if (content.length < 10) {
    toast('语料内容太短，请至少写 10 个字', 'error');
    dom.manualContent.focus();
    return;
  }
  const submit = $('button[type="submit"]', dom.manualForm);
  submit.disabled = true;
  submit.textContent = '存入中…';
  try {
    const data = await api('/api/knowledge', {
      method: 'POST',
      timeout: 15000,
      body: {
        title: dom.manualTitle.value.trim(),
        category: dom.manualCategory.value.trim(),
        content,
        tags: dom.manualTags.value
          .split(/[,，、\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        source: '专业补充',
      },
    });
    applyStats(data.stats, { renderChips: true });
    dom.manualForm.reset();
    dom.manualForm.hidden = true;
    dom.toggleManual.textContent = '手动录入';
    state.kb.query = '';
    state.kb.category = '';
    dom.kbSearch.value = '';
    await loadKnowledge();
    toast('已存入知识库，下一轮润色即可检索', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = '存入知识库';
  }
}

function readFileText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}

async function importFiles(fileList) {
  const allowed = /\.(md|markdown|txt|json)$/i;
  const files = [...fileList].filter((file) => allowed.test(file.name)).slice(0, 8);
  if (!files.length) {
    toast('请选择 .md、.txt 或 .json 文件', 'error');
    return;
  }

  const label = $('strong', dom.uploadZone);
  const originalLabel = label.textContent;
  let added = 0;
  let skipped = 0;
  let failed = 0;
  let latestStats = null;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    label.textContent = `正在导入 ${index + 1}/${files.length}…`;
    if (file.size > 1.8 * 1024 * 1024) {
      failed += 1;
      continue;
    }
    try {
      const content = await readFileText(file);
      const data = await api('/api/knowledge/import', {
        method: 'POST',
        timeout: 30000,
        body: { filename: file.name, content, category: state.kb.category || '' },
      });
      added += data.added || 0;
      skipped += data.skipped || 0;
      latestStats = data.stats || latestStats;
    } catch {
      failed += 1;
    }
  }

  label.textContent = originalLabel;
  dom.fileInput.value = '';
  if (latestStats) applyStats(latestStats, { renderChips: true });
  state.kb.query = '';
  state.kb.category = '';
  dom.kbSearch.value = '';
  await loadKnowledge();

  const parts = [];
  if (added) parts.push(`新增 ${added} 条`);
  if (skipped) parts.push(`跳过 ${skipped} 条（超出知识库上限）`);
  if (failed) parts.push(`${failed} 个文件失败`);
  toast(parts.length ? parts.join('，') : '没有导入有效语料', failed ? 'error' : 'success', 5200);
}

async function resetKnowledge() {
  if (!window.confirm('确定恢复为内置测试语料吗？所有手动上传和录入的语料都会被清除。')) return;
  dom.resetKb.disabled = true;
  try {
    const data = await api('/api/knowledge/reset', { method: 'POST', timeout: 15000 });
    applyStats(data.stats, { renderChips: true });
    state.kb.query = '';
    state.kb.category = '';
    dom.kbSearch.value = '';
    await loadKnowledge();
    toast('已恢复内置测试语料', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    dom.resetKb.disabled = false;
  }
}

/* ---------- generation history ---------- */

function updateHistoryCount() {
  const count = state.history.items.length;
  if (dom.historyCount) dom.historyCount.textContent = String(count);
  if (dom.historyTotal) dom.historyTotal.textContent = String(count);
}

async function loadHistory({ silent = false } = {}) {
  const seq = ++state.history.seq;
  try {
    const data = await api('/api/history', { timeout: 15000 });
    if (seq !== state.history.seq) return;
    state.history.items = Array.isArray(data.items) ? data.items : [];
    state.history.loaded = true;
    renderHistory();
  } catch (error) {
    if (seq !== state.history.seq) return;
    dom.historyList.innerHTML = `<div class="history-empty"><strong>生成记录读取失败</strong>${escapeHtml(
      error.message,
    )}</div>`;
    if (!silent) toast(error.message, 'error');
  }
}

function renderHistory() {
  updateHistoryCount();
  const items = state.history.items;
  if (!items.length) {
    dom.historyList.innerHTML =
      '<div class="history-empty"><strong>还没有生成记录</strong>完成一次「润色并生成」后，作品会自动保存在这里。</div>';
    return;
  }

  dom.historyList.innerHTML = items
    .map((item, index) => {
      const thumb = item.images?.[0]?.url || '';
      const title = item.subject || item.original || '未命名作品';
      return `<article class="history-card" data-id="${escapeHtml(
        item.id,
      )}" tabindex="0" role="button" aria-label="查看生成记录：${escapeHtml(title)}">
        <div class="history-thumb${thumb ? '' : ' is-empty'}">${
          thumb ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(title)}" loading="lazy" />` : ''
        }</div>
        <div class="history-info">
          <div class="history-top">
            <span class="kb-cat">${escapeHtml(
              item.imageModelLabel || item.style?.label || '生图',
            )}</span>
            <time class="history-time">${escapeHtml(formatHistoryTime(item.createdAt))}</time>
          </div>
          <h4>${escapeHtml(title)}</h4>
          <p class="history-prompt">${escapeHtml(truncate(item.prompt || item.original, 90))}</p>
          <div class="history-actions">
            <button class="text-btn" type="button" data-history-regenerate>再生成</button>
            <button class="text-btn" type="button" data-history-prompt>润色手记</button>
            <button class="kb-delete history-delete" type="button" data-history-delete title="删除该记录" aria-label="删除第 ${
              index + 1
            } 条记录">×</button>
          </div>
        </div>
      </article>`;
    })
    .join('');

  $$('.history-thumb img', dom.historyList).forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.closest('.history-thumb')?.classList.add('is-empty');
      },
      { once: true },
    );
  });
}

function findHistoryItem(id) {
  return state.history.items.find((item) => item.id === id) || null;
}

function applyHistorySettings(item) {
  if (item.strength?.id) {
    state.strength = item.strength.id;
    updateStrengthHint();
  }
  if (item.style?.id) {
    const hasStyle = $$('option', dom.styleSelect).some((option) => option.value === item.style.id);
    if (hasStyle) {
      state.style = item.style.id;
      dom.styleSelect.value = item.style.id;
    }
  }
  if (item.ratio) {
    state.ratio = item.ratio;
    if ($$('option', dom.ratioSelect).some((option) => option.value === item.ratio)) {
      dom.ratioSelect.value = item.ratio;
    }
  }
  if (item.count) {
    state.count = Number(item.count) || 1;
    dom.countSelect.value = String(state.count);
  }
  if (item.llmModel) {
    const option = $$('option', dom.llmModelSelect).find(
      (entry) => entry.value === item.llmModel && !entry.disabled,
    );
    if (option) {
      state.llmModel = item.llmModel;
      dom.llmModelSelect.value = item.llmModel;
      syncImageModelUi();
    }
  }
  if (item.imageModel) {
    const option = $$('option', dom.imageModelSelect).find(
      (entry) => entry.value === item.imageModel && !entry.disabled,
    );
    if (option) {
      state.imageModel = item.imageModel;
      dom.imageModelSelect.value = item.imageModel;
      syncImageModelUi();
    }
  }
  if (item.original) {
    dom.promptInput.value = item.original;
    updateCharCount();
    autoResizePrompt();
  }
}

function openHistoryRecord(id) {
  const item = findHistoryItem(id);
  if (!item) return;
  state.lastResult = item;
  applyHistorySettings(item);
  renderResult(item);
  closeHistoryDrawer();
}

function regenerateHistoryRecord(id) {
  const item = findHistoryItem(id);
  if (!item?.prompt) return;
  applyHistorySettings(item);
  closeHistoryDrawer();
  generateFromPolish(item.prompt, item);
}

function openHistoryPrompt(id) {
  const item = findHistoryItem(id);
  if (item) openPromptDialog(item);
}

async function deleteHistoryRecord(id, button) {
  const item = findHistoryItem(id);
  if (!item) return;
  if (!window.confirm(`确定删除「${item.subject || item.original || '这条记录'}」吗？`)) return;
  button.disabled = true;
  try {
    const data = await api(`/api/history/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      timeout: 15000,
    });
    state.history.items = Array.isArray(data.items) ? data.items : [];
    state.history.loaded = true;
    renderHistory();
    toast('生成记录已删除', 'success');
  } catch (error) {
    button.disabled = false;
    toast(error.message, 'error');
  }
}

async function clearHistoryRecords() {
  if (!state.history.items.length) {
    toast('暂时没有可清空的记录', 'info');
    return;
  }
  if (!window.confirm('确定清空最近 10 条生成记录吗？提示词与作品缩略信息都会被删除。')) return;
  dom.clearHistory.disabled = true;
  try {
    const data = await api('/api/history', { method: 'DELETE', timeout: 15000 });
    state.history.items = Array.isArray(data.items) ? data.items : [];
    state.history.loaded = true;
    renderHistory();
    toast('生成记录已清空', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    dom.clearHistory.disabled = false;
  }
}

function openHistoryDrawer() {
  if (dom.drawer.classList.contains('is-open')) closeDrawer();
  dom.historyDrawer.classList.add('is-open');
  dom.historyDrawer.setAttribute('aria-hidden', 'false');
  setActiveNav('studio');
  syncBodyLock();
  if (!state.history.loaded) loadHistory();
  window.setTimeout(() => dom.historyClose.focus({ preventScroll: true }), 360);
}

function closeHistoryDrawer() {
  dom.historyDrawer.classList.remove('is-open');
  dom.historyDrawer.setAttribute('aria-hidden', 'true');
  syncBodyLock();
}

/* ---------- events ---------- */

function bindEvents() {
  $$('#strengthSeg button').forEach((button) => {
    button.addEventListener('click', () => {
      state.strength = button.dataset.strength;
      updateStrengthHint();
    });
  });

  dom.llmModelSelect.addEventListener('change', () => {
    state.llmModel = dom.llmModelSelect.value;
    syncImageModelUi();
  });
  dom.imageModelSelect.addEventListener('change', () => {
    state.imageModel = dom.imageModelSelect.value;
    syncImageModelUi();
  });
  dom.styleSelect.addEventListener('change', () => {
    state.style = dom.styleSelect.value;
  });
  dom.ratioSelect.addEventListener('change', () => {
    state.ratio = dom.ratioSelect.value;
  });
  dom.countSelect.addEventListener('change', () => {
    state.count = Number(dom.countSelect.value) || 1;
  });

  dom.promptInput.addEventListener('input', () => {
    updateCharCount();
    autoResizePrompt();
  });

  dom.promptInput.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      createWork();
    }
  });

  $$('.idea').forEach((button) => {
    button.addEventListener('click', () => {
      dom.promptInput.value = button.dataset.idea || '';
      updateCharCount();
      autoResizePrompt();
      dom.promptInput.focus();
    });
  });

  dom.generateBtn.addEventListener('click', createWork);
  dom.polishBtn.addEventListener('click', polishOnly);

  dom.viewPrompt.addEventListener('click', () => {
    if (state.lastResult) openPromptDialog(state.lastResult);
  });
  dom.noteMore.addEventListener('click', () => {
    if (state.lastResult) openPromptDialog(state.lastResult);
  });
  dom.newWork.addEventListener('click', resetWorkspace);

  dom.dialogClose.addEventListener('click', closePromptDialog);
  dom.promptDialog.addEventListener('close', syncBodyLock);
  dom.promptDialog.addEventListener('click', (event) => {
    if (event.target === dom.promptDialog) closePromptDialog();
  });
  dom.copyPrompt.addEventListener('click', copyPrompt);
  dom.usePrompt.addEventListener('click', () => {
    const result = state.dialogResult;
    if (!result?.prompt) return;
    closePromptDialog();
    closeHistoryDrawer();
    generateFromPolish(result.prompt, result);
  });

  dom.openKnowledge.addEventListener('click', openDrawer);
  dom.drawerClose.addEventListener('click', closeDrawer);
  dom.drawerScrim.addEventListener('click', closeDrawer);

  dom.openHistory.addEventListener('click', openHistoryDrawer);
  dom.historyClose.addEventListener('click', closeHistoryDrawer);
  dom.historyScrim.addEventListener('click', closeHistoryDrawer);
  dom.clearHistory.addEventListener('click', clearHistoryRecords);

  dom.historyList.addEventListener('click', (event) => {
    const card = event.target.closest('.history-card');
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;

    if (event.target.closest('[data-history-delete]')) {
      event.stopPropagation();
      deleteHistoryRecord(id, event.target.closest('[data-history-delete]'));
      return;
    }
    if (event.target.closest('[data-history-regenerate]')) {
      event.stopPropagation();
      regenerateHistoryRecord(id);
      return;
    }
    if (event.target.closest('[data-history-prompt]')) {
      event.stopPropagation();
      openHistoryPrompt(id);
      return;
    }
    openHistoryRecord(id);
  });

  dom.historyList.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('button')) return;
    const card = event.target.closest('.history-card');
    if (!card?.dataset.id) return;
    event.preventDefault();
    openHistoryRecord(card.dataset.id);
  });

  $$('.side-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.dataset.nav === 'knowledge') {
        openDrawer();
      } else {
        closeDrawer();
        closeHistoryDrawer();
      }
    });
  });

  dom.enginePill.addEventListener('click', () => {
    const config = state.health?.config;
    if (!config) {
      toast('尚未连接到本地服务', 'error');
      return;
    }
    const model = currentImageModel();
    const live = Boolean(model && model.available !== false && model.provider !== 'mock');
    toast(
      `润色：${config.llm?.engine === 'llm' ? `大模型 ${config.llm.model}` : '本地策展引擎（RAG）'}；生图：${
        live ? model.label : '演示占位图'
      }；知识库 ${state.kb.stats?.entries ?? '—'} 条。${
        live ? '可在底部「生图」下拉框切换模型。' : '配置 Seedream、Seedream 5.0 Flash 或智谱 CogView API Key 后重启即可生成真实图片。'
      }`,
      'info',
      7000,
    );
  });

  dom.aboutBtn.addEventListener('click', () => {
    toast(
      '墨生 · 中式美学 AIGC｜输入日常描述，系统检索中式美学语料并润色为专业提示词，再由 Seedream 4.6、Seedream 5.0 Flash 或 CogView 落墨成像。Demo 语料可自行扩充。',
      'info',
      7000,
    );
  });

  let searchTimer = null;
  dom.kbSearch.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.kb.query = dom.kbSearch.value.trim();
      loadKnowledge();
    }, 260);
  });

  dom.categoryChips.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    state.kb.category = button.dataset.category || '';
    renderCategoryChips(state.kb.stats?.categoryList || []);
    loadKnowledge();
  });

  dom.kbList.addEventListener('click', (event) => {
    const button = event.target.closest('.kb-delete');
    if (button) deleteEntry(button);
  });

  dom.toggleManual.addEventListener('click', () => {
    const willOpen = dom.manualForm.hidden;
    dom.manualForm.hidden = !willOpen;
    dom.toggleManual.textContent = willOpen ? '收起录入' : '手动录入';
    if (willOpen) dom.manualTitle.focus();
  });
  dom.cancelManual.addEventListener('click', () => {
    dom.manualForm.reset();
    dom.manualForm.hidden = true;
    dom.toggleManual.textContent = '手动录入';
  });
  dom.manualForm.addEventListener('submit', addManualEntry);

  dom.uploadZone.addEventListener('click', () => dom.fileInput.click());
  dom.uploadZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dom.fileInput.click();
    }
  });
  dom.fileInput.addEventListener('change', () => importFiles(dom.fileInput.files));

  ['dragenter', 'dragover'].forEach((name) => {
    dom.uploadZone.addEventListener(name, (event) => {
      event.preventDefault();
      dom.uploadZone.classList.add('is-dragging');
    });
  });
  dom.uploadZone.addEventListener('dragleave', (event) => {
    if (!dom.uploadZone.contains(event.relatedTarget)) {
      dom.uploadZone.classList.remove('is-dragging');
    }
  });
  dom.uploadZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dom.uploadZone.classList.remove('is-dragging');
    if (event.dataTransfer?.files?.length) importFiles(event.dataTransfer.files);
  });

  dom.resetKb.addEventListener('click', resetKnowledge);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (dom.drawer.classList.contains('is-open')) closeDrawer();
    if (dom.historyDrawer.classList.contains('is-open')) closeHistoryDrawer();
  });

  window.addEventListener('beforeunload', () => {
    clearLoadingTimers();
  });
}

init();
