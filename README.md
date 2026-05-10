# 🎯 AI 面试模拟器

基于 AI 的模拟面试工具，支持实时语音输入、流式响应、面试历史记录和自动生成报告，完全在本地浏览器中运行。

## ✨ 功能特性

- **任意岗位、任意级别** — 后端、前端、AI 工程师、产品、HR 等均支持
- **语音输入** — 点击麦克风直接说话（支持 Chrome / Edge）
- **流式 AI 响应** — 逐 token 实时输出
- **快捷指令** — 提示、跳过、解析答案、得分、加难/降难
- **面试历史** — 所有会话本地保存，随时恢复
- **面试报告** — 完整问答记录 + 标准答案 + 评分 + Word 导出
- **多模型支持** — DeepSeek、千问、智谱、OpenAI、Moonshot、OpenRouter（Claude）或任意 OpenAI 兼容接口
- **深色模式** — 侧边栏一键切换
- **暂停计时器** — 点击计时器卡片暂停 / 恢复（上厕所也不怕 😄）

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本 | 备注 |
|---|---|---|
| Python | 3.9 + | [python.org](https://www.python.org/downloads/) |
| Git | 任意版本 | [git-scm.com](https://git-scm.com/) |
| 浏览器 | Chrome / Edge | 语音输入必须使用这两款浏览器 |

> 需要任意一家支持厂商的 API Key。详见 [模型配置](#-模型配置)。

---

### Windows

```bat
# 1. 克隆仓库
git clone https://github.com/accelerate0814/interview-simulator.git
cd interview-simulator

# 2. 创建 .env 文件
copy backend\.env.example backend\.env

# 3. 双击 start.bat  — 或在终端运行：
start.bat
```

服务启动后访问 **http://localhost:8000**，请使用 Chrome 或 Edge 打开。

---

### macOS

```bash
# 1. 克隆仓库
git clone https://github.com/accelerate0814/interview-simulator.git
cd interview-simulator

# 2. 创建 .env 文件
cp backend/.env.example backend/.env

# 3. 添加执行权限并启动
chmod +x start.sh
./start.sh
```

> **macOS 提示：** 如果系统提示安全警告，运行 `xattr -d com.apple.quarantine start.sh` 后重试。

服务启动后访问 **http://localhost:8000**。

---

### Linux

```bash
# 1. 克隆仓库
git clone https://github.com/accelerate0814/interview-simulator.git
cd interview-simulator

# 2. 创建 .env 文件
cp backend/.env.example backend/.env

# 3. 添加执行权限并启动
chmod +x start.sh
./start.sh
```

> **Linux 提示：** 语音输入使用 Web Speech API，**仅 Chrome 支持**（Firefox 不支持）。如需安装 Chrome：
> ```bash
> # Ubuntu / Debian
> wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
> sudo sh -c 'echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list'
> sudo apt update && sudo apt install -y google-chrome-stable
> ```

服务启动后访问 **http://localhost:8000**。

---

## 🔑 模型配置

支持**两种方式**设置 API Key：

### 方式 A — 界面配置（推荐，无需重启）

1. 在浏览器中打开应用
2. 点击侧边栏的 **⚙️ 模型配置**
3. 选择厂商预设，填入 API Key，点击保存

| 厂商 | 获取 API Key | 备注 |
|---|---|---|
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) | 推荐 — 性价比最高 |
| **千问（Qianwen）** | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) | 阿里云 |
| **智谱（Zhipu）** | [open.bigmodel.cn](https://open.bigmodel.cn) | 有免费额度 |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | 国内需要代理 |
| **Moonshot** | [platform.moonshot.cn](https://platform.moonshot.cn) | Kimi，国内可直连 |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | 可代理 Claude、GPT-4o、Gemini 等 |

### 方式 B — `.env` 文件（服务端默认值）

编辑 `backend/.env`：

```env
DEEPSEEK_API_KEY=sk-你的key
```

> 界面配置的优先级高于 `.env`。如果两者都未配置，聊天区域会显示认证错误。

---

## 💬 使用方法

1. **开始** — 在欢迎页面点击 **开始面试**
2. **告知 AI** 你的目标岗位、级别和方向，例如："后端工程师，Senior，分布式系统"
3. **回答** — 文字输入或点击麦克风 🎙 语音作答
4. **使用侧边栏快捷指令**：

| 指令 | 效果 |
|---|---|
| 💡 提示 | 获取当前题目的提示 |
| ⏭ 跳过 | 跳过当前题目 |
| 📝 解析答案 | 显示当前题目的标准答案 |
| 📊 当前得分 | 显示实时评分 |
| 🔥 加大难度 | 提升后续题目难度 |
| 🌊 降低难度 | 降低后续题目难度 |
| 🏁 结束面试 | 结束本次会话并显示评分 |

5. **报告** — 结束面试后，点击 **📋 生成面试报告** 生成完整报告（含标准答案），点击 **⬇ 下载 Word** 导出文档。

6. **历史记录** — 所有会话保存在侧边栏，点击任意会话可恢复继续。

7. **暂停** — 点击 **时长** 计时器卡片可暂停 / 恢复，暂停期间计时停止。

---

## 📁 项目结构

```
interview-simulator/
├── backend/
│   ├── main.py          # FastAPI 后端（对话、会话管理、报告、Word 导出）
│   ├── skill.md         # 面试模拟器系统提示词
│   ├── requirements.txt # Python 依赖
│   ├── .env.example     # 环境变量模板
│   └── interviews.db    # SQLite 数据库（自动创建，已加入 .gitignore）
├── frontend/
│   ├── index.html       # 单页应用
│   ├── style.css        # 样式（亮色 + 深色模式）
│   ├── app.js           # 所有前端逻辑
│   └── marked.min.js    # Markdown 渲染（本地，不依赖 CDN）
├── start.bat            # Windows 启动脚本
├── start.sh             # macOS / Linux 启动脚本
└── README.md
```

---

## 🔧 手动启动（不使用启动脚本）

```bash
cd backend

# 创建并激活虚拟环境
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务器
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## ❓ 常见问题

**Q：语音输入没有反应。**  
A：请确保使用 **Chrome 或 Edge** 浏览器。Firefox 不支持 Web Speech API。同时检查浏览器是否已授予麦克风权限。

**Q：聊天区域出现 ⚠️ 错误。**  
A：API Key 未配置或无效。打开 ⚙️ 模型配置，填入有效的 Key 后保存。

**Q：可以使用 Claude 吗？**  
A：可以。将 [OpenRouter](https://openrouter.ai) 作为厂商，模型填写 `anthropic/claude-sonnet-4-5` 或其他 Claude 模型即可。

**Q：面试历史保存在哪里？**  
A：保存在 `backend/interviews.db`（SQLite）。该文件已加入 `.gitignore`，不会被上传到代码仓库。

**Q：如何清除所有历史记录？**  
A：删除 `backend/interviews.db` 文件，重启服务器即可。

**Q：生成报告很慢。**  
A：报告生成需要对完整对话内容发起一次独立的 AI 请求，通常需要 10–30 秒，视厂商和网络状况而定。

---

## 🛠️ 技术栈

| 层次 | 技术 |
|---|---|
| 后端 | Python · FastAPI · aiosqlite · python-docx |
| AI 接入 | OpenAI 兼容 SDK（DeepSeek / 千问 / 智谱 / OpenAI 等） |
| 流式传输 | Server-Sent Events（SSE）over HTTP POST |
| 前端 | 原生 HTML · CSS · JavaScript（无框架） |
| 语音 | Web Speech API（浏览器内置） |
| 存储 | SQLite（本地） |

---

## 📄 License

MIT — 自由使用、Fork 和修改。
