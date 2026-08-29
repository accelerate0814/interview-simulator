# 面试模拟软件 · 设计规范 (DESIGN.md)

> 用途：写新页面 / 组件时引用本文件（「按 DESIGN.md 的风格写」），保持全站视觉统一。
> 当前系统：**「The Booth / 录音棚」**（2026-08-29 全量重设计，取代旧「暖橙教练风」）。
> 完整推导见 `design/redesign-2026-08-29/BRIEF.md`。旧规范备份在 git 历史与 `frontend/_backup_warmcoach/`。

## 设计基调

一句话：**「一间安静的练习录音棚 —— 坐下、指示灯亮、你表现、结束后回放这盘带子。」**
用户来练面试本就紧张，界面要克制、低噪、专注，带一点「仪器感」；既沉稳，又让人知道「这是玩真的，不是玩具」。

原则：
- **两色分工即概念**：蓝墨 = 结构 / 动作 / 信任；琥珀 = 「进行中 / 实时 / 待处理」。琥珀绝不用作普通装饰。
- 圆角克制（6 / 10 / 16），不要糖果感。
- 暖中性纸灰，不用纯白 / 纯黑 / 考试系统蓝。
- 留白充足；发丝线分隔，少用卡片盒子。
- 反馈及时且温和；错误不用刺眼纯红。

---

## 色彩系统（CSS 变量，见 frontend/style.css `:root`）

| 角色 | Light | Dark |
|---|---|---|
| `--paper` 页面底 | `#F4F2ED` | `#17181A` |
| `--surface` 卡片/浮层 | `#FCFBF8` | `#212225` |
| `--sunken` 侧栏/输入 | `#ECE9E1` | `#131416` |
| `--ink` 标题/主文 | `#242320` | `#EDEBE6` |
| `--ink-soft` 正文 | `#55514A` | `#B7B2A9` |
| `--ink-faint` 注释/占位 | `#8E877A` | `#7C766B` |
| `--line` / `--line-strong` 分隔 | `#E1DDD2` / `#D0CABB` | `#2E2F31` / `#3C3D40` |
| `--blue` 主色 | `#22405C` | `#7FA8CC` |
| `--blue-tint` / `--blue-wash` | `#E4EAF0` / `#EEF2F6` | `#1E2A36` / `#1A232D` |
| `--ember` 信号色（进行中） | `#C2702A` | `#D98A45` |
| `--green` 参考答案/优势 | `#3C6E52` | `#7FB394` |
| `--danger` 破坏性操作 | `#A34B3C` | `#D08573` |

深色模式只改上面这些 token；组件 CSS 一律引用 token，不写死色值。

---

## 字体系统

```css
--font-display: 'Fraunces', 'Songti SC', Georgia, serif;      /* 标题，roman only，稀用 */
--font:         'IBM Plex Sans', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;  /* 正文 / UI */
--mono:         'IBM Plex Mono', 'SF Mono', Consolas, monospace;  /* 计时 / 分数 / 轮次 / 标签 / kbd */
```

- **Fraunces** 只用于：欢迎页 H1、浮层标题、复盘大标题、消息里的 h1–h3。一律 `font-style: normal`（斜体标题是头号 AI tell）。
- **Plex Mono** 用于一切「读数」：计时、评分、轮次、区块小标签（uppercase + letter-spacing）、快捷键提示、meta 行。
- 正文 15px / 行高 1.75；长题目阅读宽度 ≤ 68ch。

字号：display `clamp(30px,4.2vw,42px)` / 大标题 18–20 / 卡片标题 14–16 / 正文 15 / 注释 12.5 / mono 标签 10–10.5。

---

## 间距 / 圆角 / 阴影 / 动效

- 4pt 网格，语义 token：`--space-2xs 4 / xs 8 / sm 12 / md 16 / lg 24 / xl 32 / 2xl 48`。
- 圆角：`--radius-sm 6 / md 10 / lg 16 / full 999`（胶囊只给 preset chip 一类）。
- 阴影：单层低扩散，`--shadow-sm / md / lg`。
- 动效：标准 `--dur 160ms` + `--ease cubic-bezier(.2,0,0,1)`；浮层/欢迎 240ms 上浮淡入。
- `prefers-reduced-motion`：全量降级（≤90ms、去呼吸动画）。
- `:focus-visible`：2px `--blue` 实心环 + 2px offset，出现瞬间不 animate。

---

## 签名元素：状态条（status rail）

聊天列（`.chat-main`）左缘一条 3px 竖条，纯 CSS `:has()` 跟随会话状态，app.js 零改动：

| 状态 | 表现 |
|---|---|
| 未开始 | 透明 |
| 进行中 | `--ember` 实心，顶部 44px 缓慢呼吸（tally 指示灯） |
| 暂停 | `--ember` 虚线，不呼吸 |
| 已结束 | 转 `--blue` 实心，不呼吸 |

同一逻辑下：进行中时侧栏计时数字也转 `--ember`。这是全站唯一记忆点，其余一律安静。

---

## 核心组件规范

- **主按钮**：`background: var(--blue); color: var(--on-blue); border-radius: var(--radius-md)`；hover 只变色，不上浮（唯一允许 hover 上浮 2px 的是欢迎页主 CTA）。
- **次按钮**：透明底 + `--line-strong` 描边 + `--ink-soft` 字。
- **卡片**：`--surface` 底 + 1px `--line` + `--radius-md`，`--shadow-sm` 或无阴影。
- **输入框**：`--sunken` 底 + 1px `--line-strong`，聚焦 `border-color: var(--blue)` + `box-shadow: 0 0 0 3px var(--blue-wash)`。
- **区块小标签**：mono / 10px / uppercase / `letter-spacing:.1em` / `--ink-faint`，下方一条 `--line` 发丝线。
- **进度 / 读数**：mono + `font-variant-numeric: tabular-nums`。
- **图标**：统一 1.6–1.8px 描边线性 SVG（`.ic`），**禁止 emoji 当图标**。
- **消息**：面试官发言不用气泡（mono 小标「面试官」+ 正文）；用户发言右对齐 `--blue-tint` 块。

---

## 文案语气

像一个话不多、说话准的教练。第二人称，主动语态，**不用感叹号，不用「哦 / 呢 / 啦」兜底**，不编造数据 / 评价。

| 场景 | 避免 | 推荐 |
|---|---|---|
| 回答未完成 | 「错误：未填写答案」 | 「还差一点，再想想」 |
| 计时结束 | 「超时！」 | 「时间到，先看看这场的表现」 |
| 反馈较差 | 「回答不合格」 | 「这个方向可以再打磨，试试从 XX 切入」 |
| 成功提示 | 「✓ 已保存」 | 「已保存」（用颜色表示成功，不用 ✓ 字符） |

---

## 使用方式

> 「按 DESIGN.md 的规范，帮我写一个 [页面 / 组件]」

会复用上面的 token、字体分工、状态条语义和文案语气，保证全站统一。
