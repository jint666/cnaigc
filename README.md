# 墨生 · 中式美学 AIGC

把一句日常描述，交给一座中式美学语料库：检索、解构、润色，再由 **Seedream 4.6 / Seedream 5.0 Flash / CogView-3-Flash** 落成一幅可信的东方画面。润色模型可在 **智谱 GLM-4-Flash** 与 **DeepSeek V4.1 Flash** 之间切换。

这是一个可本地运行的 Demo，用来验证「**RAG 美学知识库 + 专业提示词润色 + Seedream / CogView 生图**」的核心链路。前端接近即梦的生图工作台：底部输入、润色强度、润色模型、风格、生图模型、比例、数量，一键「润色并生成」；右侧抽屉是知识库，可搜索、手动录入、批量上传专业语料；右上角「生成记录」保留最近 10 次作品，支持回看与再生成。

---

## 1. 快速启动

环境要求：**Node.js 20+**，无需安装任何依赖。

```powershell
# 进入项目目录
cd D:\Chinese_Aesthetics_AIGC

# 可选：准备配置文件（不配置也能跑，使用本地润色 + 演示占位图）
Copy-Item .env.example .env

# 启动
npm start
```

打开 <http://127.0.0.1:5173>。

开发模式（改后端自动重启）：

```powershell
npm run dev
```

运行测试：

```powershell
npm test
```

### 运行档位

| 配置 | 润色引擎 | 生图引擎 | 用途 |
| --- | --- | --- | --- |
| 什么都不配 | 本地规则 + RAG | 本地生成演示占位图 | 零成本看完整交互 |
| 只配 `LLM_API_KEY`（智谱） | 大模型润色 | 演示占位图 | 对比大模型润色质量 |
| 再配 `SEEDREAM_ACCESS_KEY` + `SEEDREAM_SECRET_KEY` | 大模型 / 本地 | Seedream 4.6 真实生图 | 完整生产链路 |
| 配 `ARK_API_KEY` 后选 Seedream 5.0 Flash | 大模型 / 本地 | Seedream 5.0 Flash 真实生图 | 速度更快、适合快速出图 |
| 配智谱 Key 后选 CogView | 大模型 / 本地 | CogView-3-Flash 真实生图 | 免费、快速试构图 |
| 配 `ARK_API_KEY` 后选 DeepSeek 润色 | DeepSeek V4.1 Flash | 按所选生图模型 | 中文语义理解更强，适合复杂场景 |

> 没有 Key 时界面会明确标注「演示」。演示图是本地生成的宣纸水墨 SVG 占位图，不是 AI 生图；它只用于验证流程与版式。

---

## 2. 配置 Seedream、Seedream 5.0 Flash、CogView 与润色模型

复制 `.env.example` 为 `.env`，按需填写：

```dotenv
PORT=5173
HOST=127.0.0.1

# 提示词润色：智谱 GLM（OpenAI 兼容）
LLM_API_KEY=your-bigmodel-api-key
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_MODEL=glm-4-flash
# 默认润色模型：glm-4-flash / deepseek-v4.1-flash-economy
LLM_DEFAULT_MODEL=glm-4-flash

# 默认生图模型：auto / seedream / ark / cogview / mock
# 界面里仍可随时切换已配置的模型
IMAGE_PROVIDER=auto

# 即梦 Seedream 4.6（火山引擎 API Key ID + Secret）
SEEDREAM_AUTH=apikey
SEEDREAM_ACCESS_KEY=your-api-key-id
SEEDREAM_SECRET_KEY=your-api-key-secret
SEEDREAM_BASE_URL=https://openapi.cv.volces.com
SEEDREAM_SUBMIT_PATH=/api/common/v3/submit_task_v2
SEEDREAM_RESULT_PATH=/api/common/v3/get_result_v2
SEEDREAM_ACTION=CVSync2AsyncSubmitTask
SEEDREAM_MODEL=seedream-4.6
SEEDREAM_REQ_KEY=jimeng_t2i_v46
SEEDREAM_POLL_INTERVAL_MS=2000
SEEDREAM_TIMEOUT_MS=180000

# Seedream 5.0 Flash 与 DeepSeek 润色（火山方舟 ARK，ark- 开头的 API Key）
ARK_API_KEY=your-ark-api-key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_IMAGE_MODEL=doubao-seedream-5-0-flash-260915
ARK_TIMEOUT_MS=180000
ARK_LLM_MODEL=deepseek-v4-1-flash-economy-261017
ARK_LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 智谱 CogView-3-Flash（默认复用 LLM_API_KEY）
COGVIEW_BASE_URL=https://open.bigmodel.cn/api/paas/v4
COGVIEW_MODEL=cogview-3-flash
COGVIEW_TIMEOUT_MS=120000

# 知识库条目上限
MAX_KNOWLEDGE_ENTRIES=500
```

说明：

- 火山引擎控制台的「API Key ID + API Key Secret」不是 IAM AK/SK，不能走 V4 签名。`apikey` 模式使用 `Authorization: Bearer <API Key Secret>`，请求 `openapi.cv.volces.com` 的 `/api/common/v3/*` 路径；`SEEDREAM_ACCESS_KEY` 只作为标识保留。
- 即梦 4.6 使用异步任务：先 `submit_task_v2` 提交，再 `get_result_v2` 轮询；`SEEDREAM_ACTION` 默认已是前者。
- `SEEDREAM_REQ_KEY` 默认填 `jimeng_t2i_v46`；如果控制台给的是灰度服务标识（例如 `jimeng_seedream46_cvtob`），直接替换这一项即可，不需要改代码。
- 如果改用 IAM `AccessKeyID / SecretAccessKey`（`AKLT` 开头），把 `SEEDREAM_AUTH` 设为 `volc`，`SEEDREAM_BASE_URL` 改为 `https://visual.volcengineapi.com`，并补 `SEEDREAM_REGION=cn-north-1`、`SEEDREAM_SERVICE=cv`；此时由 `server/volc.js` 生成 V4 签名。
- 如果改用火山方舟的 OpenAI 兼容接口：把 `SEEDREAM_AUTH` 设为 `bearer`，填 `SEEDREAM_API_KEY`，`SEEDREAM_BASE_URL` 改为 `https://ark.cn-beijing.volces.com/api/v3`，模型 ID 以控制台为准。
- Seedream 5.0 Flash 走独立配置：`ARK_API_KEY`（`ark-` 开头）、`ARK_BASE_URL`、`ARK_IMAGE_MODEL=doubao-seedream-5-0-flash-260915`。它使用方舟 `/images/generations`，请求体不再发送 `sequential_image_generation`（5.0 Flash 不支持），尺寸按比例使用 2K 级显式像素。
- `LLM_API_KEY` 也可用 `DEEPSEEK_API_KEY`；使用智谱时保持 `LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4`。
- 界面底部的「润色」下拉框可在 **智谱 GLM-4-Flash** 与 **DeepSeek V4.1 Flash** 之间切换；后者走火山方舟，复用 `ARK_API_KEY`，模型 ID 为 `deepseek-v4-1-flash-economy-261017`。`LLM_DEFAULT_MODEL` 决定刷新后的默认项。
- DeepSeek V4.1 Flash 默认开启深度思考，本 Demo 在润色请求里显式传 `thinking: { type: "disabled" }`，避免思考 token 挤占输出、拖慢一次润色。若火山方舟返回 `ModelNotOpen` / `OperationDenied.ServiceNotOpen`，请先在 [ARK 开通管理](https://ark.volcengine.com/region:cn-beijing/openManagement) 开通该模型；若返回 `InvalidEndpointOrModel.ModelIDAccessDisabled`，需把 `model` 换成该模型的 `ep-...` 接入点 ID。
- 界面底部的「生图」下拉框可在 **Seedream 4.6**、**Seedream 5.0 Flash** 与 **CogView-3-Flash** 之间切换；未配置 Key 的模型会置灰，当前不可用的模型不会发请求。
- CogView 默认复用智谱的 `LLM_API_KEY`（仅当 `LLM_BASE_URL` 指向 `bigmodel.cn`）；如果润色改用其他厂商，请单独设置 `COGVIEW_API_KEY`。
- CogView 使用官方推荐尺寸映射：`1:1 → 1024x1024`、`3:4 → 864x1152`、`4:3 → 1152x864`、`16:9 → 1440x720`、`9:16 → 720x1440`；Seedream 仍使用 2K 级尺寸。
- 一次可选 1 / 2 / 4 张，服务端会并发请求；部分失败时保留成功的图，并在界面给出提示。
- 修改 `.env` 后需要重启服务。

---

## 3. Demo 使用路径

1. 在底部输入：`生成一个紫砂壶`。
2. 润色强度选「雅」或「极」，风格选「自动」，润色模型选智谱 GLM-4-Flash 或 DeepSeek V4.1 Flash，生图模型选 Seedream 4.6、Seedream 5.0 Flash 或 CogView-3-Flash，比例 1:1。
3. 点击 **润色并生成**：
   - 服务端先用 BM25 风格检索命中紫砂器型、泥料、茶席、光影等语料；
   - 再按强度配额，把专业描述组织成一段完整提示词；
   - 最后把润色后的提示词交给当前选中的生图模型（Seedream 4.6 / Seedream 5.0 Flash / CogView-3-Flash）。
4. 结果页右侧「润色手记」可以看到：原始描述、专业提示词、检索到的语料、关键词、风格与比例。
5. 点击 **润色手记 / 查看完整润色过程**，可看到逐条语料依据、润色思路和负面约束，并能复制提示词。
6. 点击 **仅润色**，不调用生图 API，先审阅提示词；在弹窗里点「用此提示词生成」继续生图。
7. 每次成功生成会自动写入 **生成记录**（右上角「记录」），最多保留最近 10 条。可回看作品与手记、按原提示词「再生成」、单条删除或清空；记录持久化在 `data/history.json`。
8. 点击 **美学知识库**（右上角或左侧「语料」）：
   - 搜索、按分类过滤；
   - 「手动录入」一条专业语料；
   - 拖拽或点击上传 `.md / .txt / .json`，支持多文件；
   - 删除单条；
   - 「恢复内置语料」清空补充内容，回到 28 条测试语料。

### 建议试的四个输入

- `一把紫砂壶，放在原木茶席上，午后窗光`
- `雨后的江南园林，月洞门里有一枝竹`
- `穿宋制汉服的女子，站在回廊下，垂眸`
- `一只汝窑天青釉花器，插一枝白梅`

---

## 4. 知识库：专业人员如何补充

知识库是这套系统的核心资产。当前内置 **28 条**测试语料，覆盖紫砂、瓷器、家具、园林、水墨、工笔、服饰、建筑、色彩、构图、纹样、茶事、节令与负面约束。正式使用时，用专业人员的内容替换或叠加。

### 4.1 在界面里上传

右侧抽屉 → 「上传专业语料」→ 选择文件。支持：

| 格式 | 解析规则 |
| --- | --- |
| `.md` / `.markdown` | **每个 `##` / `###` 标题及其正文**成为一条语料；正文建议 50–600 字 |
| `.txt` | 按空行分段，每段一条；超长段落自动按句切分 |
| `.json` | 条目数组，或 `{ "entries": [...] }` |

Markdown 示例（可直接上传 `samples/中式美学补充示例.md`）：

```markdown
## 紫砂·掇球壶的壸门与颈肩

掇球壶以球体叠积为骨，壶身、壶盖、壶钮形成由大到小的三个球体。
颈肩过渡要圆融，壸门线条要挺拔，整体饱满而不臃肿。
拍摄时用侧逆光勾出球面的转折，泥料砂面在柔光下呈现细密颗粒。

## 建盏·兔毫与油滴的毫纹层次

兔毫盏的毫纹从盏心向口沿放射，线条细密、深浅有致；油滴盏的斑纹
如夜空星点，分布疏朗。两者都依赖窑火自然成纹，不应呈规则印刷感。
```

JSON 示例：

```json
{
  "entries": [
    {
      "title": "明式圈椅的靠背与联帮棍",
      "category": "器物·家具",
      "tags": ["明式家具", "圈椅", "榫卯", "线条"],
      "content": "圈椅的靠背随人体脊线微弯，扶手一顺而下，联帮棍与鹅脖形成虚实。整体重线条、轻雕饰，比例清瘦而有骨力。",
      "promptFragments": [
        "明式圈椅，靠背随脊线微弯",
        "扶手一顺而下，线条清瘦有骨力",
        "榫卯结构外露，不施繁复雕饰"
      ],
      "negativeFragments": ["清式繁雕", "比例笨重"],
      "source": "家具组·王老师"
    }
  ]
}
```

> `promptFragments` 是「可直接复用的视觉短语」，会优先进入提示词；不填时系统会从句子里自动抽取。`negativeFragments` 会进入负面约束。

### 4.2 手工录入

「手动录入」填写标题、分类、正文、标签即可。分类可以留空，系统会按关键词推断；建议沿用内置分类，便于检索与筛选。

### 4.3 数据存储

- 首次启动会用 `data/knowledge.seed.json` 初始化，并写入 `data/knowledge.json`。
- 之后所有新增、删除、导入都持久化到 `data/knowledge.json`。
- `data/knowledge.json` 已加入 `.gitignore`，不会覆盖内置种子。
- 想回到初始状态：界面点「恢复内置语料」，或删除 `data/knowledge.json` 后重启。

生成记录保存在 `data/history.json`，只保留最近 10 条，同样已加入 `.gitignore`。每条记录包含原始输入、润色提示词、强度/风格/模型、手记和图片链接。Seedream / CogView 返回的图片 URL 有有效期，过期后缩略图会失效；需要长期归档时请及时下载原图。

### 4.4 检索是怎么工作的

1. **中文分词**：字符 unigram / bigram / trigram + 英文词，无需外部分词依赖。
2. **BM25 风格打分**：标题权重 3.2、标签 2.8、分类 1.6、正文 1、可复用短语 1.25。
3. **查询扩展**：如「紫砂壶」自动扩展到宜兴紫砂、器型、泥料、茶席等，提升召回。
4. **约束隔离**：`质感·约束` 类语料默认不进入正向描述，只作为负面约束来源。
5. **强度配额**：轻润色取 3 个短语、雅致 6 个、极致 9 个；再叠加风格锚点与质量尾句。
6. **生成**：有 LLM Key 时，把 Top 语料作为上下文，让大模型输出严格 JSON（提示词 / 负面词 / 关键词 / 思路）；失败自动回退本地引擎，不阻断生图。

---

## 5. 界面与设计

- **视觉**：宣纸米色、墨黑、朱砂、玉青；宋体标题 + 无衬线正文；窄墨色侧栏、竖向留白主视觉、印章式 loading。
- **布局**：顶部品牌与引擎状态；中部主视觉 / 结果区；底部悬浮 composer；右侧知识库抽屉。
- **交互**：`Ctrl / ⌘ + Enter` 生成；建议词一键填入；结果图下载；提示词复制；移动端底部导航与单列布局。
- **生成记录**：顶部「记录」入口保存最近 10 条，可回看图片与润色手记、按原参数再生成、单条删除或一键清空。
- **可访问性**：按钮有 `aria-label` / `aria-pressed`，弹窗使用原生 `<dialog>`，支持 `Esc` 关闭，`prefers-reduced-motion` 下关闭动画。
- **安全**：所有用户/知识库内容在渲染前 `escapeHtml`；静态服务做路径穿越校验；API Key 只留在服务端，`/api/health` 不返回密钥。

---

## 6. 项目结构

```text
D:\Chinese_Aesthetics_AIGC
├─ package.json
├─ .env.example
├─ data/
│  ├─ knowledge.seed.json      # 28 条内置测试语料（请保留，作为兜底）
│  ├─ knowledge.json           # 运行时数据（自动生成，已 gitignore）
│  └─ history.json             # 最近 10 条生成记录（自动生成，已 gitignore）
├─ samples/
│  └─ 中式美学补充示例.md       # 可上传的专业语料样例
├─ server/
│  ├─ index.js                 # HTTP 服务、静态资源、API 路由
│  ├─ config.js                # .env 解析与运行档位
│  ├─ knowledge.js             # 解析、存储、BM25 检索
│  ├─ history.js               # 最近 10 条生成记录的清洗与持久化
│  ├─ polish.js               # 主体识别、提示词组织、LLM 润色与回退
│  ├─ llm-models.js           # 可切换润色模型、可用性判断与默认值
│  ├─ styles.js               # 强度 / 风格 / 比例 / 负面词
│  ├─ image.js                # Seedream 4.6 / Seedream 5.0 Flash / CogView 调用 + 演示图
│  ├─ image-models.js         # 可切换生图模型、可用性判断与默认值
│  ├─ volc.js                 # 火山引擎 V4 签名（IAM AK/SK 模式备用）
│  └─ utils.js                # HTTP / 文本工具
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  └─ favicon.svg
└─ test/
   ├─ knowledge.test.js
   ├─ polish.test.js
   ├─ history.test.js
   ├─ image-models.test.js
   ├─ llm-models.test.js
   └─ api.test.js
```

技术选择：**零运行时依赖**，Node 原生 `http` + 原生 `fetch` + 原生 ESM。这样 Demo 不会卡在安装依赖上，也方便后续替换成 Express / Fastify 或接入向量库。

---

## 7. API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 服务状态、当前引擎、知识库统计 |
| GET | `/api/meta` | 润色强度、风格、比例、可选润色与生图模型 |
| GET | `/api/knowledge?q=&category=&limit=` | 查询/筛选语料 |
| POST | `/api/knowledge` | 新增一条语料 |
| POST | `/api/knowledge/import` | 导入 md / txt / json 文本 |
| POST | `/api/knowledge/reset` | 恢复内置语料 |
| DELETE | `/api/knowledge/:id` | 删除一条语料 |
| GET | `/api/history` | 最近 10 条生成记录 |
| DELETE | `/api/history/:id` | 删除一条生成记录 |
| DELETE | `/api/history` | 清空生成记录 |
| POST | `/api/polish` | 只润色，返回提示词与检索依据 |
| POST | `/api/generate` | 按给定提示词生图 |
| POST | `/api/create` | 检索 + 润色 + 生图，一次完成 |

`/api/create` 请求：

```json
{
  "prompt": "生成一个紫砂壶",
  "strength": "medium",
  "style": "auto",
  "imageModel": "seedream-4.6",
  "llmModel": "glm-4-flash",
  "ratio": "1:1",
  "count": 1
}
```

`strength` 取 `light / medium / deep`，`style` 取 `auto / song / ink / gongbi / modern / cinematic / zen`，`imageModel` 取 `seedream-4.6 / seedream-5.0-flash / cogview-3-flash`，`llmModel` 取 `glm-4-flash / deepseek-v4.1-flash-economy`，`ratio` 取 `1:1 / 3:4 / 4:3 / 16:9 / 9:16`，`count` 为 1–4。

---

## 8. 已知边界与后续优化

这是用于验证核心链路的 Demo，刻意保持小而透明。正式产品建议继续做：

1. **检索升级**：当前是 BM25 + 查询扩展。数据量上去后，接入 embedding 向量检索或混合检索；中文可换专业分词器。增加 rerank，提升「紫砂壶 → 器型/泥料」这类专业召回的稳定性。
2. **语料治理**：给专业人员加审核、版本、生效范围、去重与质量评分；支持按朝代 / 器型 / 窑口 / 场景建立结构化标签体系。
3. **提示词评测**：建立「普通输入 → 专业提示词 → 生图」的固定评测集，用人工评分 + 盲测对比，持续调强度配额与风格词库。
4. **生图能力**：接入 Seedream 的图生图 / 参考图 / 局部重绘；保存 seed 以复现；增加组图一致性控制。
5. **产品化**：收藏与分享、多人空间、额度与鉴权、对象存储、任务队列、失败重试、内容安全审核。当前已有本地最近 10 条生成记录，可作为作品历史的起点。
6. **可观测性**：记录每次检索命中、润色耗时、生图耗时与失败原因，形成运营看板。
7. **前端**：如需进一步贴近生产，可迁移到 React / Vue；当前零依赖版本便于快速给专业团队演示与收集反馈。

---

## 9. 常见问题

**Q：为什么生成的图是水墨线稿？**  
A：当前选中的是「演示占位图」，或三个生图模型都没有可用凭据。Seedream 4.6 需要填写 `SEEDREAM_ACCESS_KEY` / `SEEDREAM_SECRET_KEY`；Seedream 5.0 Flash 需要填写 `ARK_API_KEY`；CogView 默认复用智谱 `LLM_API_KEY`。在底部「生图」下拉框选择已配置的模型即可；`IMAGE_PROVIDER` 只决定默认项。若 Seedream 4.6 返回鉴权或 `req_key` 错误，检查控制台开通的是否为 4.6 服务、`SEEDREAM_REQ_KEY` 是否与之匹配。

**Q：润色结果不像大模型写的？**  
A：没有配置 `LLM_API_KEY` 时使用本地规则引擎，优点是稳定、零成本、可解释；配上大模型后会明显更自然。两种模式都会先检索知识库。

**Q：生成记录里的图裂了？**  
A：Seedream / CogView 返回的是临时图片链接，有效期由服务商决定；超过有效期后缩略图会失效。记录中的提示词与参数仍保留，可点「再生成」重新出图。需要长期保留请及时下载原图。

**Q：上传后为什么没搜到？**  
A：检查分类筛选是否选中了其他分类，或搜索词过窄；点「全部」再试。也可以在 `data/knowledge.json` 中确认条目已写入。

**Q：端口被占用？**  
A：改 `.env` 里的 `PORT`，或在启动前关闭占用 5173 的进程。

**Q：可以商用吗？**  
A：代码是 Demo 脚手架；内置语料仅用于测试，正式使用请替换为专业人员授权内容，并遵守即梦 / 火山方舟的服务条款与内容规范。
