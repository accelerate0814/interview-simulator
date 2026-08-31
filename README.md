# 🎯 AI 面试模拟器

基于大模型的模拟面试工具：任意岗位、逐题练习、即时反馈，支持**实时语音作答**、**按简历 / JD 定向出题**、**跨场次记忆**，结束后自动生成带标准答案的面试报告。前端原生 HTML/CSS/JS，后端一个 FastAPI 文件，数据全部存在本地。

## ✨ 功能特性

- **任意岗位、任意级别** — 后端、前端、AI 工程师、产品、运营、HR、财务等均支持，可中途切换角色
- **实时语音作答** — 点麦克风边说边出字（火山引擎流式语音识别大模型 + 大模型纠错，技术术语更准）
- **流式 AI 响应** — 面试官逐 token 实时输出
- **按简历 / JD 定向出题** — 上传简历、保存岗位 JD，面试官优先围绕你的真实项目和目标岗位技术栈提问
- **跨场次记忆** — 记住你是谁（姓名 / 目标岗位 / 技术栈），并自动避免重复问过的题
- **面试知识库** — 导入你自己整理的真实面试题（`.md` / `.docx`），面试时按其风格出新题、偶尔原样重问
- **快捷指令** — 提示、跳过、解析答案、当前得分、加难 / 降难、结束
- **面试历史** — 所有会话本地保存，刷新 / 切换后可恢复继续
- **面试报告** — 完整问答 + 标准答案 + 逐题评分 + 综合结论，可导出 Word
- **多模型支持** — DeepSeek、千问、智谱、OpenAI、Moonshot、OpenRouter（Claude）或任意 OpenAI 兼容接口
- **深色 / 浅色模式**、**可暂停计时器**、**语音播报（TTS）**

---

## 🚀 第一次使用

### 1. 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Python | 3.9+ | [python.org](https://www.python.org/downloads/) |
| Git | 任意 | [git-scm.com](https://git-scm.com/) |
| 浏览器 | Chrome / Edge | 语音输入需要（`localhost` 下即可，无需 HTTPS） |

> 不需要 ffmpeg。语音由浏览器直接采集 PCM 推给后端。

### 2. 克隆并创建配置文件

**Windows**

```bat
git clone https://github.com/accelerate0814/interview-simulator.git
cd interview-simulator
copy backend\.env.example backend\.env
```

**macOS / Linux**

```bash
git clone https://github.com/accelerate0814/interview-simulator.git
cd interview-simulator
cp backend/.env.example backend/.env
```

启动脚本在 `backend/.env` 不存在时会拒绝运行。这一步现在**不需要**填任何 key —— 对话模型可以启动后在界面里配。

### 3. 启动

**Windows** — 双击 `start.bat`，或在终端：

```bat
start.bat
```

**macOS / Linux**

```bash
chmod +x start.sh
./start.sh
```

脚本会自动创建虚拟环境、安装依赖、启动服务。首次安装依赖需要一两分钟。

> **macOS 安全警告**：`xattr -d com.apple.quarantine start.sh` 后重试。

### 4. 打开并配置对话模型

用 **Chrome / Edge** 打开 **http://localhost:8000**，然后：

1. 点侧边栏 **⚙️ 模型配置**
2. 选一个厂商预设（推荐 DeepSeek），填入 API Key，保存

即可点「开始面试」。语音输入是可选项，见下一节。

---

## 🎙 语音输入配置（可选）

语音识别用**火山引擎 · 流式语音识别大模型（Seed-ASR / SAUC）**，需要单独开通。没配置时麦克风按钮会自动隐藏，其它功能不受影响。

1. 打开[火山引擎语音技术控制台](https://console.volcengine.com/speech/app) → 创建应用 → 开通「**流式语音识别大模型**」
   （不是「录音文件识别」，也不是小模型版）
2. 在该服务页面拿到：
   - **API Key**（新版鉴权，形如 `xxxxxxxx-xxxx-...`）
   - **Resource ID** —— 以服务页「调用示例」里写的为准，通常是 `volc.seedasr.sauc.duration`
3. 填入 `backend/.env`：

   ```env
   VOLC_ASR_API_KEY=你的-api-key
   VOLC_ASR_RESOURCE_ID=volc.seedasr.sauc.duration
   ```

4. **重启后端**（改 `.env` 后必须重启，`--reload` 不会自动加载 `.env`）

原始转写结果会再用你配的**对话模型**过一遍纠错（把 "bow MQ" 修成 "BullMQ" 这类），纠错失败则回退到原始文本。

> 老版控制台鉴权（App ID + Access Token）也支持：留空 `VOLC_ASR_API_KEY`，改填 `VOLC_ASR_APP_KEY` 和 `VOLC_ASR_ACCESS_KEY`。

---

## 🔑 模型配置

支持**两种方式**设置对话模型 API Key，界面配置优先级更高：

### 方式 A — 界面配置（推荐，无需重启）

**⚙️ 模型配置** → 选厂商预设 → 填 API Key → 保存。配置存在浏览器 `localStorage`。

| 厂商 | 获取 API Key | 备注 |
|---|---|---|
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) | 推荐 — 性价比最高 |
| **千问（Qianwen）** | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) | 阿里云百炼 |
| **智谱（Zhipu）** | [open.bigmodel.cn](https://open.bigmodel.cn) | 有免费额度 |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | 国内需代理 |
| **Moonshot** | [platform.moonshot.cn](https://platform.moonshot.cn) | Kimi，国内可直连 |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | 可代理 Claude / GPT-4o / Gemini |

### 方式 B — `.env` 文件（服务端默认值）

编辑 `backend/.env`：

```env
DEEPSEEK_API_KEY=sk-你的key
```

> 如果两者都没配，聊天区会显示认证错误。

### 可选：语义去重 Embedding

历史题目超过 ~50 道后，跨场次去重会用 Embedding 做语义相似判断。在 `backend/.env` 配 `EMBEDDING_API_KEY`（多数对话厂商没有 Embedding 接口，默认走 OpenAI）。不配则退化为按时间的近期列表，其它不受影响。

---

## 💬 使用方法

1. **开始** — 欢迎页点 **开始面试**。可选择「按简历 / JD 开始」或「通用模式开始」
2. **告知 AI** 目标岗位、级别、方向，例如："后端工程师，Senior，分布式系统"
3. **回答** — 文字输入，或点麦克风 🎙 边说边出字（停止后自动纠错并填入输入框）
4. **快捷指令**（输入框上方）：

   | 指令 | 效果 |
   |---|---|
   | 💡 提示 | 当前题目的提示 |
   | ⏭ 跳过 | 跳过当前题目 |
   | 📝 解析答案 | 显示标准答案 |
   | 📊 当前得分 | 实时评分卡 |
   | 🔥 加大难度 / 🌊 降低难度 | 调整后续题目难度 |
   | 🏁 结束面试 | 结束并显示评分 |

5. **报告** — 结束后点 **生成面试报告**，再点 **下载 Word** 导出
6. **历史** — 侧边栏点任意会话恢复继续
7. **暂停** — 点「时长」计时卡暂停 / 恢复

### 我的资料（定向出题）

侧边栏 **我的资料** 里：

- **简历** — 上传 PDF / Word / txt（只保留最新一份）
- **岗位 JD** — 可保存多条

开始面试时勾选，面试官会优先深挖简历里的项目、并结合 JD 技术栈出题。

### 面试知识库

侧边栏 **面试知识库** 里导入你整理的真实面试题（`.md` / `.docx`），AI 会自动拆成一条条题目。面试时有概率原样重问、或模仿其风格出新题。

---

## 📁 项目结构

```
interview-simulator/
├── backend/
│   ├── main.py          # 整个后端：对话、会话、报告、Word 导出、语音转写 WS、简历/JD、知识库
│   ├── skill.md         # 面试官系统提示词（改这个 = 改面试行为）
│   ├── requirements.txt
│   ├── .env.example     # 环境变量模板
│   └── interviews.db    # SQLite（自动创建，已 gitignore；删掉即清空历史）
├── frontend/
│   ├── index.html       # 单页应用
│   ├── style.css        # 样式（深色 + 浅色）
│   ├── app.js           # 全部前端逻辑
│   ├── pcm-worklet.js   # AudioWorklet：麦克风降采样为 16k PCM（语音输入用）
│   └── marked.min.js    # 本地 Markdown 渲染，不依赖 CDN
├── sauc_python/         # 火山引擎 SAUC WebSocket 客户端（帧编解码，被后端复用）
├── start.bat            # Windows 启动脚本
├── start.sh             # macOS / Linux 启动脚本
└── README.md
```

---

## 🔧 手动启动（不用启动脚本）

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> 前端是后端挂载的静态文件，没有单独的前端服务或构建步骤。

---

## ❓ 常见问题

**Q：麦克风按钮不见了。**
A：说明后端没配火山引擎语音识别的 key。见 [语音输入配置](#-语音输入配置可选)。配好后**重启后端**再刷新页面。

**Q：改了 `.env` 没生效。**
A：`.env` 只在启动时读一次，`--reload` 不会因它变化重启。改完要**完全停掉后端再重新启动**（注意别开了多个进程抢 8000 端口）。

**Q：点麦克风报 403 / requested resource not granted。**
A：火山引擎那边「流式语音识别大模型」没开通成功，或 `VOLC_ASR_RESOURCE_ID` 前缀不对（`volc.seedasr.*` 还是 `volc.bigasr.*`）。以服务页「调用示例」里的值为准。

**Q：语音识别把术语识别错了。**
A：原始转写会用你配的对话模型纠错。确保 ⚙️ 模型配置里填了有效的 key，否则纠错会跳过、直接用原文。

**Q：聊天区出现 ⚠️ 错误。**
A：对话模型 API Key 未配置或无效。打开 ⚙️ 模型配置填有效 key。

**Q：可以用 Claude 吗？**
A：可以。厂商选 [OpenRouter](https://openrouter.ai)，模型填 `anthropic/claude-sonnet-4-5` 等。

**Q：面试历史存在哪？怎么清空？**
A：`backend/interviews.db`（SQLite，已 gitignore）。删掉该文件重启即清空全部历史、简历、JD、跨场次记忆。

**Q：生成报告很慢。**
A：报告需对完整对话发起一次独立 AI 请求，通常 10–30 秒。

---

## 🛠️ 技术栈

| 层次 | 技术 |
|---|---|
| 后端 | Python · FastAPI（单文件）· aiosqlite · python-docx |
| 对话 AI | OpenAI 兼容 SDK（DeepSeek / 千问 / 智谱 / OpenAI / Claude via OpenRouter …） |
| 语音识别 | 火山引擎 SAUC 流式语音识别大模型（WebSocket 中转）+ 大模型纠错 |
| 流式传输 | 对话 = SSE over POST；语音 = 浏览器 ↔ 后端 ↔ 火山 双 WebSocket |
| 前端 | 原生 HTML · CSS · JavaScript（无框架、无构建）· AudioWorklet |
| 存储 | SQLite（本地）+ 浏览器 localStorage |

---

## 📄 License

MIT — 自由使用、Fork 和修改。
