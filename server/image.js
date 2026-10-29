import { escapeXml, sleep } from './utils.js';
import { signVolcRequest } from './volc.js';
import {
  defaultImageModel,
  getImageModel,
  isImageModelAvailable,
} from './image-models.js';

const RATIO_DIMENSIONS = {
  '1:1': [2048, 2048],
  '3:4': [1728, 2304],
  '4:3': [2304, 1728],
  '16:9': [2560, 1440],
  '9:16': [1440, 2560],
};

const DIMENSIONS = {
  '1:1': [1024, 1024],
  '3:4': [864, 1152],
  '4:3': [1152, 864],
  '16:9': [1440, 720],
  '9:16': [720, 1440],
};

function hashString(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function detectSubject(prompt) {
  if (/紫砂|茶壶|壶/.test(prompt)) return 'teapot';
  if (/瓷|瓶|汝窑|青花|罐|盏|器/.test(prompt)) return 'vessel';
  if (/园林|月洞|庭院|建筑|屋檐|亭|院|回廊/.test(prompt)) return 'garden';
  if (/人像|女子|少女|仕女|汉服|旗袍|公子|人物/.test(prompt)) return 'figure';
  if (/椅|案|桌|家具|榻|柜/.test(prompt)) return 'furniture';
  if (/花|鸟|梅|兰|竹|莲|枝/.test(prompt)) return 'flora';
  return 'landscape';
}

function subjectLabel(prompt) {
  const firstClause = prompt.split(/[，,。]/)[0] || '东方美学';
  return firstClause.replace(/^生成(一幅|一张)?/u, '').replace(/^以/u, '').slice(0, 10) || '东方美学';
}

function drawTeapot(ink, bodyFill, accent) {
  return `
    <g fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-112 2 C-114 -44 -78 -74 -12 -75 C52 -76 92 -42 96 1 C100 46 62 73 0 75 C-64 77 -110 47 -112 2 Z" fill="${bodyFill}"/>
      <path d="M-42 -76 C-34 -94 24 -96 34 -76" />
      <path d="M-12 -95 C-6 -108 16 -108 24 -96" />
      <ellipse cx="6" cy="-96" rx="15" ry="7" fill="${bodyFill}"/>
      <path d="M-106 -18 C-146 -38 -172 -72 -184 -108 C-170 -113 -153 -100 -140 -80 C-127 -61 -114 -46 -98 -35 Z" fill="${bodyFill}"/>
      <path d="M94 -14 C132 -34 158 -12 158 20 C158 58 132 79 99 80" stroke-width="14"/>
      <path d="M-88 -34 C-66 -54 -38 -62 -10 -60" stroke-width="2.2" opacity=".55"/>
      <path d="M-58 32 C-24 44 28 44 56 28" stroke-width="2" opacity=".45"/>
    </g>
    <g fill="none" stroke="${ink}" stroke-width="2.4" opacity=".5">
      <path d="M-260 148 L250 148" />
      <path d="M128 148 C128 112 158 100 184 102 C214 104 228 122 228 148" fill="${bodyFill}"/>
      <ellipse cx="178" cy="102" rx="50" ry="8" fill="${bodyFill}"/>
      <path d="M-214 148 C-214 124 -196 112 -176 112 C-154 112 -138 126 -138 148" fill="none"/>
      <ellipse cx="-176" cy="112" rx="38" ry="6" fill="none"/>
    </g>
    <g fill="${accent}" opacity=".8">
      <circle cx="252" cy="-118" r="5"/>
    </g>`;
}

function drawVessel(ink, bodyFill, accent) {
  return `
    <g fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-46 -142 L46 -142 C40 -116 32 -100 54 -84 C100 -55 110 18 78 60 C48 102 -40 105 -76 66 C-108 20 -98 -50 -52 -81 C-30 -96 -38 -116 -46 -142 Z" fill="${bodyFill}"/>
      <ellipse cx="0" cy="-142" rx="46" ry="10" fill="${bodyFill}"/>
      <path d="M-72 52 C-40 68 42 68 74 52" stroke-width="2.4" opacity=".55"/>
      <path d="M-20 -54 C-4 -20 6 16 -12 48" stroke-width="1.6" opacity=".45"/>
      <path d="M14 -46 C34 -18 38 20 22 54" stroke-width="1.6" opacity=".45"/>
      <path d="M-44 -20 C-30 -6 -36 16 -50 24" stroke-width="1.4" opacity=".4"/>
      <path d="M52 -16 C64 0 62 20 50 30" stroke-width="1.4" opacity=".4"/>
    </g>
    <g fill="none" stroke="${ink}" stroke-width="2.2" opacity=".45">
      <path d="M-240 146 L240 146"/>
      <path d="M-132 146 C-132 120 -116 108 -98 108 C-78 108 -64 122 -64 146" />
      <path d="M150 146 C150 120 166 108 184 108 C204 108 218 122 218 146" />
    </g>
    <g fill="${accent}" opacity=".75">
      <circle cx="-154" cy="-84" r="4"/>
      <circle cx="176" cy="-54" r="3"/>
    </g>`;
}

function drawGarden(ink, bodyFill, accent) {
  return `
    <g fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="-18" cy="-18" r="151" fill="${bodyFill}"/>
      <circle cx="-18" cy="-18" r="151"/>
      <path d="M-300 158 L270 158" />
      <path d="M-290 -108 C-230 -178 -110 -210 -20 -208 C80 -206 196 -160 248 -92" opacity=".6"/>
      <path d="M-300 -72 C-246 -124 -168 -142 -98 -138" opacity=".35"/>
      <path d="M-86 156 C-86 60 -78 -46 -62 -124" />
      <path d="M-62 -124 C-44 -108 -40 -84 -44 -64" />
      <path d="M-74 -52 C-110 -76 -132 -70 -146 -46" />
      <path d="M-72 -20 C-40 -48 -18 -46 -2 -24" />
      <path d="M-82 42 C-118 20 -140 26 -152 48" />
      <path d="M16 156 C24 72 24 -10 16 -76" opacity=".5"/>
      <path d="M16 -40 C40 -62 60 -58 72 -40" opacity=".5"/>
      <path d="M170 156 L170 24" opacity=".35"/>
      <path d="M146 24 L194 24" opacity=".35"/>
    </g>
    <g fill="${accent}" opacity=".85">
      <circle cx="-146" cy="-46" r="5"/>
      <circle cx="-2" cy="-24" r="4"/>
      <circle cx="72" cy="-40" r="4"/>
    </g>`;
}

function drawFigure(ink, bodyFill, accent) {
  return `
    <g fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="0" cy="-158" r="38" fill="${bodyFill}"/>
      <path d="M-34 -172 C-24 -204 22 -206 34 -174 C24 -188 -18 -190 -34 -172 Z" fill="${ink}" opacity=".85"/>
      <path d="M-6 -196 C6 -208 20 -202 24 -190" />
      <path d="M-8 -120 C-16 -96 -32 -84 -58 -74 C-82 -64 -92 -38 -80 -18 C-64 8 -44 18 -34 44 C-24 72 -34 104 -48 130 C-58 150 -58 164 -54 178" />
      <path d="M8 -120 C20 -96 40 -84 62 -72 C86 -60 92 -34 80 -14 C64 12 44 22 36 48 C28 76 38 106 52 132 C62 152 62 166 58 178" />
      <path d="M-8 -118 C-2 -84 2 -38 -2 -6 C-6 28 -8 74 -4 108" opacity=".55"/>
      <path d="M-54 178 C-24 166 28 166 58 178" />
      <path d="M-58 -74 C-44 -36 -34 12 -40 56" opacity=".5"/>
      <path d="M64 -72 C50 -36 42 10 46 54" opacity=".5"/>
      <path d="M-62 -52 C-92 -42 -112 -20 -120 4" opacity=".65"/>
      <path d="M66 -52 C92 -46 112 -30 122 -8" opacity=".65"/>
    </g>
    <g fill="none" stroke="${ink}" stroke-width="1.8" opacity=".4">
      <path d="M-134 180 L128 180"/>
      <path d="M-106 180 C-104 168 -96 160 -86 160 C-76 160 -68 168 -66 180" />
    </g>
    <g fill="${accent}" opacity=".8">
      <path d="M-10 -150 C-2 -143 -8 -134 -16 -138" />
    </g>`;
}

function drawFurniture(ink, bodyFill, accent) {
  return `
    <g fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-138 -6 C-118 -44 -72 -62 -10 -62 C54 -62 104 -40 122 -2 C130 16 120 30 100 30 L-116 30 C-138 30 -146 12 -138 -6 Z" fill="${bodyFill}"/>
      <path d="M-110 30 L-126 178" />
      <path d="M102 30 L120 178" />
      <path d="M-118 126 L110 126" />
      <path d="M-132 178 L-108 178" />
      <path d="M104 178 L128 178" />
      <path d="M-34 30 L-24 104" opacity=".5"/>
      <path d="M42 30 L34 104" opacity=".5"/>
      <path d="M-84 -52 C-54 -74 42 -78 88 -48" stroke-width="2" opacity=".45"/>
    </g>
    <g fill="none" stroke="${ink}" stroke-width="2.2" opacity=".4">
      <path d="M-234 178 L236 178"/>
      <path d="M156 178 L156 52 L214 52" />
    </g>
    <g fill="${accent}" opacity=".8">
      <circle cx="188" cy="40" r="5"/>
      <path d="M188 40 L188 -8" stroke="${ink}" stroke-width="2" opacity=".5"/>
    </g>`;
}

function drawFlora(ink, bodyFill, accent) {
  return `
    <g fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-170 172 C-118 120 -82 44 -56 -38 C-44 -76 -18 -108 14 -128" />
      <path d="M-106 92 C-148 72 -178 44 -186 8" />
      <path d="M-82 32 C-44 18 -12 -2 8 -30" />
      <path d="M-56 -38 C-84 -70 -86 -98 -66 -124" />
      <path d="M-64 24 C-76 52 -70 76 -52 92" opacity=".5"/>
      <path d="M-132 62 C-156 38 -158 12 -142 -8" opacity=".5"/>
    </g>
    <g fill="${bodyFill}" stroke="${ink}" stroke-width="2.4">
      <circle cx="14" cy="-132" r="24"/>
      <circle cx="-10" cy="-108" r="18"/>
      <circle cx="-190" cy="2" r="22"/>
      <circle cx="10" cy="-32" r="19"/>
      <circle cx="-66" cy="-126" r="18"/>
      <circle cx="-52" cy="96" r="16"/>
    </g>
    <g fill="${accent}" opacity=".8">
      <circle cx="14" cy="-132" r="5"/>
      <circle cx="-190" cy="2" r="5"/>
      <circle cx="10" cy="-32" r="4"/>
    </g>
    <g fill="none" stroke="${ink}" stroke-width="2" opacity=".35">
      <path d="M-230 180 L220 180"/>
      <path d="M-202 180 C-200 164 -190 154 -176 154 C-162 154 -150 164 -148 180" />
    </g>`;
}

function drawLandscape(ink, bodyFill, accent) {
  return `
    <g fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-290 120 C-220 54 -172 34 -118 58 C-74 78 -36 96 18 72 C78 46 126 20 184 44 C232 64 264 96 292 126" opacity=".28"/>
      <path d="M-300 152 C-238 92 -186 72 -132 96 C-86 116 -44 132 10 108 C64 84 116 62 170 84 C220 104 258 134 292 156" opacity=".45"/>
      <path d="M-292 186 C-224 132 -170 118 -118 140 C-68 160 -20 178 34 158 C88 138 144 118 198 138 C242 154 272 178 296 198" opacity=".7"/>
      <path d="M-38 206 C-18 188 -4 166 8 140 C20 166 34 188 54 206" opacity=".5"/>
      <path d="M-202 208 C-186 192 -174 174 -164 152 C-154 176 -142 194 -126 208" opacity=".35"/>
    </g>
    <g fill="${bodyFill}" opacity=".7">
      <path d="M-298 210 L296 210 L296 250 L-298 250 Z"/>
    </g>
    <g fill="${accent}" opacity=".8">
      <circle cx="206" cy="-96" r="6"/>
    </g>`;
}

function drawScene(kind, ink, bodyFill, accent) {
  if (kind === 'teapot') return drawTeapot(ink, bodyFill, accent);
  if (kind === 'vessel') return drawVessel(ink, bodyFill, accent);
  if (kind === 'garden') return drawGarden(ink, bodyFill, accent);
  if (kind === 'figure') return drawFigure(ink, bodyFill, accent);
  if (kind === 'furniture') return drawFurniture(ink, bodyFill, accent);
  if (kind === 'flora') return drawFlora(ink, bodyFill, accent);
  return drawLandscape(ink, bodyFill, accent);
}

export function buildMockSvg({ prompt, ratio = '1:1', index = 0, style = 'auto' }) {
  const [width, height] = DIMENSIONS[ratio] || DIMENSIONS['1:1'];
  const dark = style === 'cinematic';
  const hash = hashString(`${prompt}-${index}`);
  const kind = detectSubject(prompt);
  const paper = dark ? '#242420' : '#f0eadf';
  const paperDeep = dark ? '#191917' : '#e6ddce';
  const ink = dark ? '#e6dfcd' : '#25231f';
  const bodyFill = dark ? 'rgba(213,201,178,.10)' : 'rgba(120,98,72,.10)';
  const accent = dark ? '#c07a5d' : '#9c3b2f';
  const label = subjectLabel(prompt);
  const chars = [...label].slice(0, 8);
  const min = Math.min(width, height);
  const scale = min / 1060;
  const cx = width * (width > height * 1.2 ? 0.62 : 0.56);
  const cy = height * 0.56;
  const titleSize = Math.max(24, min * 0.038);
  const titleX = width * 0.085;
  const titleY = height * 0.19;
  const scene = drawScene(kind, ink, bodyFill, accent);

  const vertical = chars
    .map(
      (char, i) =>
        `<text x="${titleX}" y="${titleY + i * titleSize * 1.38}" font-family="Songti SC, STSong, SimSun, serif" font-size="${titleSize}" fill="${ink}" opacity=".82">${escapeXml(char)}</text>`,
    )
    .join('');

  const poem =
    index % 2 === 0
      ? '器以载道 · 美在含蓄'
      : '一器一物 · 皆见东方';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)} 演示占位图">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${paper}"/>
      <stop offset="0.55" stop-color="${paper}"/>
      <stop offset="1" stop-color="${paperDeep}"/>
    </linearGradient>
    <radialGradient id="moon" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${dark ? '#d9c9a8' : '#c9b38c'}" stop-opacity=".26"/>
      <stop offset="1" stop-color="${dark ? '#d9c9a8' : '#c9b38c'}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope=".22"/></feComponentTransfer>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="${min * 0.012}"/></filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#paper)"/>
  <circle cx="${width * 0.76}" cy="${height * 0.24}" r="${min * 0.28}" fill="url(#moon)"/>
  <circle cx="${width * 0.76}" cy="${height * 0.24}" r="${min * 0.17}" fill="none" stroke="${ink}" stroke-width="1.2" opacity=".13"/>

  <g opacity=".38" filter="url(#soft)">
    <path d="M0 ${height * 0.78} C ${width * 0.18} ${height * 0.7}, ${width * 0.3} ${height * 0.84}, ${width * 0.46} ${height * 0.78} S ${width * 0.78} ${height * 0.7}, ${width} ${height * 0.8} L ${width} ${height} L 0 ${height} Z" fill="${ink}" opacity=".12"/>
  </g>

  <rect x="${width * 0.035}" y="${height * 0.045}" width="${width * 0.93}" height="${height * 0.91}" fill="none" stroke="${ink}" stroke-width="1" opacity=".16"/>

  <g transform="translate(${cx} ${cy}) scale(${scale})">
    ${scene}
  </g>

  ${vertical}
  <path d="M ${titleX + titleSize * 0.5} ${titleY + chars.length * titleSize * 1.38 + 4} L ${titleX + titleSize * 0.5} ${titleY + chars.length * titleSize * 1.38 + titleSize * 1.6}" stroke="${accent}" stroke-width="1.4" opacity=".55"/>

  <g transform="translate(${width * 0.85} ${height * 0.79}) rotate(-2)">
    <rect width="${min * 0.076}" height="${min * 0.076}" rx="${min * 0.006}" fill="${accent}" opacity=".92"/>
    <text x="${min * 0.038}" y="${min * 0.029}" text-anchor="middle" font-family="Songti SC, STSong, SimSun, serif" font-size="${min * 0.02}" fill="${paper}">墨</text>
    <text x="${min * 0.038}" y="${min * 0.055}" text-anchor="middle" font-family="Songti SC, STSong, SimSun, serif" font-size="${min * 0.02}" fill="${paper}">生</text>
  </g>

  <text x="${width * 0.085}" y="${height * 0.925}" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="${Math.max(10, min * 0.013)}" letter-spacing="${Math.max(1, min * 0.002)}" fill="${ink}" opacity=".46">${poem}</text>
  <text x="${width * 0.915}" y="${height * 0.925}" text-anchor="end" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="${Math.max(9, min * 0.011)}" letter-spacing=".8" fill="${ink}" opacity=".4">DEMO · AIGC READY</text>
  <text x="${width * 0.5}" y="${height * 0.965}" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="${Math.max(9, min * 0.011)}" letter-spacing="1" fill="${ink}" opacity=".32">演示占位图 · 配置 Seedream / CogView API 后生成真实画面</text>

  <rect width="${width}" height="${height}" filter="url(#grain)" opacity=".5" style="mix-blend-mode:multiply"/>
</svg>`;
}

function mockResult({ prompt, ratio, index, style }) {
  const svg = buildMockSvg({ prompt, ratio, index, style });
  const [width, height] = RATIO_DIMENSIONS[ratio] || RATIO_DIMENSIONS['1:1'];
  return {
    url: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
    width,
    height,
    engine: 'mock',
    label: '演示占位图',
    seed: hashString(`${prompt}-${index}`) % 1000000,
  };
}

function normalizeSeedreamItems(payload) {
  const items = payload?.data || payload?.images || payload?.result?.data || [];
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return { url: item };
      const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
      return url
        ? {
            url,
            width: item.width || item.size?.width,
            height: item.height || item.size?.height,
            revisedPrompt: item.revised_prompt,
          }
        : null;
    })
    .filter(Boolean);
}

function normalizeVolcItems(payload) {
  const rawCode = payload?.code;
  const code = rawCode === undefined ? undefined : Number(rawCode);
  const success =
    rawCode === undefined ||
    code === 0 ||
    code === 10000 ||
    String(rawCode).toLowerCase() === 'success';
  if (!success) {
    throw new Error(
      `[${rawCode}] ${payload?.message || payload?.msg || '火山引擎返回失败'}`.slice(0, 300),
    );
  }
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const outerResult = payload?.Result || payload?.result || {};
  const nested = data.result && typeof data.result === 'object' ? data.result : outerResult;
  const urls =
    data.image_urls ||
    data.imageUrls ||
    data.image_url ||
    data.imageUrl ||
    data.urls ||
    data.images ||
    nested.image_urls ||
    nested.ImageURLs ||
    nested.imageUrls ||
    nested.image_url ||
    nested.images ||
    (Array.isArray(data.result) ? data.result : []);
  const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
  const items = list.map((item) => {
    if (typeof item === 'string') return { url: item };
    if (item?.url) return item;
    return { url: item?.image_url || item?.imageUrl || '' };
  });
  const base64 =
    data.binary_data_base64 ||
    data.binaryDataBase64 ||
    nested.binary_data_base64 ||
    nested.BinaryDataBase64 ||
    [];
  if (Array.isArray(base64)) {
    base64.forEach((value) => {
      if (value) items.push({ url: `data:image/jpeg;base64,${value}` });
    });
  }
  return items.map((item) => (typeof item === 'string' ? { url: item } : item)).filter((item) => item.url);
}

const API_KEY_PATHS = {
  CVSync2AsyncSubmitTask: '/api/common/v3/submit_task_v2',
  CVSync2AsyncGetResult: '/api/common/v3/get_result_v2',
  CVProcess: '/api/common/v3/process',
  CVSubmitTask: '/api/common/v3/submit_task',
  CVGetResult: '/api/common/v3/get_result',
  CVCancelTask: '/api/common/v3/cancel_task',
};

function volcErrorDetail(payload, status) {
  const nested = payload?.ResponseMetadata?.Error || payload?.error || payload?.data?.error || {};
  const candidates = [
    nested?.Message,
    nested?.message,
    nested?.Code,
    payload?.message,
    payload?.msg,
    payload?.data?.message,
    payload?.data?.msg,
    payload?.raw,
  ];
  const detail = candidates.find((value) => value !== undefined && value !== null && String(value).trim());
  return detail ? String(detail).slice(0, 280) : `HTTP ${status}`;
}

async function volcOpenApi({ action, body, config, timeoutMs = 120000 }) {
  const endpoint = new URL(config.image.baseUrl);
  const rawBody = JSON.stringify(body);
  const useApiKey = config.image.auth === 'apikey';
  let url;
  let headers;

  if (useApiKey) {
    const fallbackPath = API_KEY_PATHS[action] || API_KEY_PATHS.CVSync2AsyncSubmitTask;
    const configuredPath =
      action === 'CVSync2AsyncGetResult'
        ? config.image.resultPath
        : action === 'CVSync2AsyncSubmitTask'
          ? config.image.submitPath
          : '';
    url = new URL(configuredPath || fallbackPath, endpoint.origin);
    headers = {
      Authorization: `Bearer ${config.image.secretKey}`,
      'Content-Type': 'application/json',
    };
  } else {
    const query = {
      Action: action,
      Version: config.image.version || '2022-08-31',
    };
    headers = signVolcRequest({
      method: 'POST',
      pathname: endpoint.pathname || '/',
      query,
      headers: {
        host: endpoint.host,
        'content-type': 'application/json',
      },
      body: rawBody,
      accessKey: config.image.accessKey,
      secretKey: config.image.secretKey,
      region: config.image.region,
      service: config.image.service,
    });
    url = new URL(`${endpoint.origin}${endpoint.pathname}?${new URLSearchParams(query)}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}：${volcErrorDetail(payload, response.status)}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function volcTaskId(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const result = payload?.Result || payload?.result || {};
  return (
    data.task_id ||
    data.taskId ||
    payload?.task_id ||
    payload?.taskId ||
    result.task_id ||
    result.taskId ||
    result.TaskId ||
    ''
  );
}

function volcStatus(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const result = payload?.Result || payload?.result || {};
  const raw = data.status || data.task_status || data.taskStatus || result.status || result.Status || '';
  const status = String(raw).toLowerCase();
  if (['1', 'processing', 'running', 'pending', 'in_queue'].includes(status)) return 'processing';
  if (['2', 'done', 'success', 'succeed', 'finished'].includes(status)) return 'done';
  if (['3', 'failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return status;
}

async function requestVolcSeedream({ prompt, ratio, config }) {
  const [width, height] = RATIO_DIMENSIONS[ratio] || RATIO_DIMENSIONS['1:1'];
  const baseBody = {
    req_key: config.image.reqKey,
    prompt,
    width,
    height,
    return_url: true,
    seed: -1,
  };
  const action = config.image.action || 'CVSync2AsyncSubmitTask';

  if (action === 'CVProcess') {
    const payload = await volcOpenApi({ action, body: baseBody, config });
    return normalizeVolcItems(payload);
  }

  const submitted = await volcOpenApi({
    action,
    body: baseBody,
    config,
    timeoutMs: 60000,
  });
  const direct = normalizeVolcItems(submitted);
  if (direct.length) return direct;

  const taskId = volcTaskId(submitted);
  if (!taskId) {
    throw new Error(
      `即梦任务提交成功但未返回 task_id：${JSON.stringify(submitted).slice(0, 240)}`,
    );
  }

  const deadline = Date.now() + (config.image.timeoutMs || 180000);
  const interval = config.image.pollIntervalMs || 2000;
  let lastStatus = '';
  while (Date.now() < deadline) {
    await sleep(interval);
    const payload = await volcOpenApi({
      action: 'CVSync2AsyncGetResult',
      body: { req_key: config.image.reqKey, task_id: taskId },
      config,
      timeoutMs: 60000,
    });
    const images = normalizeVolcItems(payload);
    if (images.length) return images;
    lastStatus = volcStatus(payload);
    if (['failed', 'error', 'cancelled', 'canceled'].includes(lastStatus)) {
      const message =
        payload?.data?.message || payload?.data?.error || payload?.message || lastStatus;
      throw new Error(`即梦任务 ${taskId} 失败：${String(message).slice(0, 220)}`);
    }
    if (lastStatus === 'done') {
      throw new Error(`即梦任务 ${taskId} 已完成，但接口未返回图片地址`);
    }
  }
  throw new Error(`即梦任务 ${taskId} 超时（最后状态：${lastStatus || '处理中'}）`);
}

async function requestCogView({ prompt, ratio, config }) {
  const cogview = config.image.cogview || {};
  if (!cogview.key) throw new Error('未配置智谱 CogView API Key');
  const [width, height] = DIMENSIONS[ratio] || DIMENSIONS['1:1'];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cogview.timeoutMs || 120000);
  try {
    const response = await fetch(`${cogview.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cogview.key}`,
      },
      body: JSON.stringify({
        model: cogview.model || 'cogview-3-flash',
        prompt,
        size: `${width}x${height}`,
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        payload?.msg ||
        payload?.raw ||
        `HTTP ${response.status}`;
      throw new Error(`HTTP ${response.status}：${String(message).slice(0, 300)}`);
    }
    return normalizeCogViewItems(payload, { width, height });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCogViewItems(payload, { width, height }) {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.images)
      ? payload.images
      : [];
  return items
    .map((item) => {
      if (typeof item === 'string') return { url: item, width, height };
      const url =
        item?.url ||
        (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
      return url
        ? {
            url,
            width: item.width || width,
            height: item.height || height,
            revisedPrompt: item.revised_prompt,
          }
        : null;
    })
    .filter(Boolean);
}

async function requestArkSeedream({ prompt, ratio, config }) {
  const ark = config.image.ark || {};
  if (!ark.key) throw new Error('未配置火山方舟 ARK API Key');
  const [width, height] = RATIO_DIMENSIONS[ratio] || RATIO_DIMENSIONS['1:1'];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ark.timeoutMs || 180000);
  try {
    const response = await fetch(`${ark.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ark.key}`,
      },
      body: JSON.stringify({
        model: ark.model || 'doubao-seedream-5-0-flash-260915',
        prompt,
        size: `${width}x${height}`,
        response_format: 'url',
        watermark: false,
        // Seedream 5.0 Flash 不支持分组生成/流式，显式不发送这些字段。
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        payload?.msg ||
        payload?.raw ||
        `HTTP ${response.status}`;
      throw new Error(`HTTP ${response.status}：${String(message).slice(0, 300)}`);
    }
    return normalizeSeedreamItems(payload);
  } finally {
    clearTimeout(timer);
  }
}

async function requestSeedream({ prompt, ratio, config }) {
  if (config.image.auth === 'volc' || config.image.auth === 'apikey') {
    return requestVolcSeedream({ prompt, ratio, config });
  }
  const size = (RATIO_DIMENSIONS[ratio] || RATIO_DIMENSIONS['1:1']).join('x');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${config.image.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.image.key}`,
      },
      body: JSON.stringify({
        model: config.image.model,
        prompt,
        size,
        response_format: 'url',
        watermark: false,
        sequential_image_generation: 'disabled',
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    if (!response.ok) {
      const message =
        payload?.error?.message || payload?.message || payload?.raw || `HTTP ${response.status}`;
      throw new Error(String(message).slice(0, 300));
    }
    return normalizeSeedreamItems(payload);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImages({
  prompt,
  ratio = '1:1',
  count = 1,
  style = 'auto',
  model: modelId = '',
  config,
}) {
  const requestedModel = String(modelId || '').trim();
  const selected = requestedModel
    ? getImageModel(requestedModel)
    : getImageModel(defaultImageModel(config));
  if (!selected) {
    throw new Error(`不支持的生图模型：${requestedModel || '未指定'}`);
  }
  if (!isImageModelAvailable(selected, config)) {
    throw new Error(`生图模型「${selected.label}」尚未配置`);
  }

  const safeCount = Math.min(4, Math.max(1, Number(count) || 1));
  if (selected.provider === 'mock') {
    return {
      images: Array.from({ length: safeCount }, (_, index) =>
        mockResult({ prompt, ratio, index, style }),
      ),
      engine: 'mock',
      model: selected.id,
      modelLabel: selected.label,
      warning: '当前使用演示占位图。配置 Seedream、Seedream 5.0 Flash 或智谱 CogView API Key 后重启即可生成真实画面。',
    };
  }

  const request =
    selected.provider === 'cogview'
      ? requestCogView
      : selected.provider === 'ark'
        ? requestArkSeedream
        : requestSeedream;
  const dimensions =
    selected.provider === 'cogview' ? DIMENSIONS : RATIO_DIMENSIONS;
  const modelLabel =
    selected.provider === 'cogview'
      ? `CogView · ${config.image.cogview?.model || 'cogview-3-flash'}`
      : selected.provider === 'ark'
        ? `Seedream · ${config.image.ark?.model || 'doubao-seedream-5-0-flash-260915'}`
        : `Seedream · ${config.image.model}`;

  const tasks = Array.from({ length: safeCount }, () =>
    request({ prompt, ratio, config }),
  );
  const settled = await Promise.allSettled(tasks);
  const images = [];
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.length) {
      images.push(
        ...result.value.map((item) => ({
          ...item,
          width: item.width || dimensions[ratio]?.[0],
          height: item.height || dimensions[ratio]?.[1],
          engine: selected.provider,
          label: modelLabel,
          seed: hashString(`${prompt}-${index}`) % 1000000,
        })),
      );
    } else {
      errors.push(result.status === 'rejected' ? result.reason.message : '接口未返回图片');
    }
  });

  if (!images.length) {
    const detail = errors[0] || '未知错误';
    const authSuffix =
      selected.provider === 'seedream' ? `（鉴权：${config.image.auth}）` : '';
    throw new Error(`${selected.label} 生图失败${authSuffix}：${detail}`);
  }
  return {
    images: images.slice(0, safeCount),
    engine: selected.provider,
    model: selected.id,
    modelLabel: selected.label,
    partialError: errors.length ? `${errors.length} 张生成失败：${errors[0]}` : null,
  };
}
