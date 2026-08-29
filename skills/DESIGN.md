# 面试模拟软件 · 设计规范 (DESIGN.md)

> 写新页面 / 组件时引用本文件（「按 DESIGN.md 的风格写」），保持全站视觉统一。
> 当前系统：**方向 A「像素关卡 / 关卡化进阶练习」**（2026-08-29，花叔 huashu-design 秒数轮盘 →「像素游戏横版叙事」）。
> 完整推导见 `design/direction-approved.md` 与 `design/huashu-3dir/`。旧规范在 git 历史 / `frontend/_backup_prev/`。

## 设计基调

一句话：**「把面试当一款横版闯关游戏——每答一题过一关，一路推进，最后进入结算画面。」**
面试 =「一问一答的回合」+「结束后被记录、被打分」，读成游戏后长出 HUD 骨架。

原则：
- **磷光屏绿是唯一能量色**，代表「前进 / 过关 / GO」；橙红只标「受击 / 危险 / 结束」，小面积。
- **硬边**：所有卡片 / 按钮 / 输入框 `border-radius: 0`，2–4px 实描边。
- **生硬底阴影按钮**：`box-shadow: 0 4px 0 <deep>`，`:active` 时 `translateY(4px)` 消阴影（可按压感）。
- **VT323 读数**：计时 / 评分 / 轮次 / 关卡号用 VT323 像素字；正文一律 Manrope，≥15px，长文不做像素字。
- 默认深色 arcade 底；侧栏「浅色模式」切浅色变体（只换 token）。
- 不编造数据；无 emoji 当图标（图标全部内联线性 SVG）。

## 色彩系统（CSS 变量，见 frontend/style.css `:root`）

| 角色 | 深色（默认） | 浅色 |
|---|---|---|
| `--page` 页面底 | `#090c0a` | `#e7ede3` |
| `--bg` 主区 | `#10160f` | `#f4f7f0` |
| `--bg-2` 侧栏 / 浮层 | `#151d16` | `#ffffff` |
| `--bg-3` 内嵌 / 卡片 | `#1d271e` | `#eef2e8` |
| `--border` / `--border-bright` | `#2b3a2c` / `#3d5540` | `#c3d1bd` / `#93ad8e` |
| `--text` / `--text-dim` / `--text-faint` | `#e9f1e9` / `#a4b7a5` / `#8ba28d` | `#161f14` / `#465043` / `#5b6957` |
| `--energy` 能量色 | `#4fd67f` | `#178a49` |
| `--energy-deep` 按钮底阴影 | `#1f8f4f` | `#0d6234` |
| `--energy-ink` 能量色上的字 | `#07130b` | `#ffffff` |
| `--warn` 受击 / 危险 | `#ff6a45` | `#c83c1c` |
| `--ledge` 次级按钮底阴影 | `#0a3a20` | `#0d6234` |

body 带一层极淡横向 scanline（`repeating-linear-gradient` + `--scan`）。深色模式只改上面 token。

## 字体系统

```css
font-family: "Space Grotesk", sans-serif;   /* 标题 / 按钮 / 品牌字，roman only */
font-family: "Manrope", system-ui, ...;      /* 正文 / UI，中文回退苹方/雅黑 */
font-family: "JetBrains Mono", monospace;    /* 区块标签(uppercase +letter-spacing) / meta / kbd */
font-family: "VT323", monospace;             /* 读数：计时 / 评分 / 轮次 / 关卡号 / STAGE CLEAR */
```

- Space Grotesk 只用于标题、按钮、`.brand-name`、消息里的 h1–h3。一律 `font-style: normal`。
- VT323 只用于「数字读数」和关卡标记，绝不用于正文。
- 正文 15px / 行高 1.7；长题目阅读宽度 ≤ 74ch。区块小标签 JetBrains Mono 11–12px，`text-transform: uppercase`，`letter-spacing: .14–.16em`。

## 间距 / 圆角 / 动效

- 4pt 网格；侧栏 gap 15px、section gap 8px。
- **圆角一律 0。**
- 阴影只有一种语言：`0 4px 0 <deep-color>` 的「台阶」阴影 + `:active` 位移。浮层用 `11px 11px 0` 硬投影。
- 过渡 `.05–.08s linear`（硬、快、不缓动）。`spin` / `blink` / `vpulse` 用 `steps()` 做像素跳变感。
- `prefers-reduced-motion`：关掉 spin / blink / vpulse。
- `:focus-visible`：`2px solid var(--energy)` + `outline-offset: 2px`（无圆角、不 animate）。

## 签名元素

1. **HUD 能量轨**：`.chat-main::before` 一条顶部虚线（`repeating-linear-gradient`）。
   `:has(#messages-wrap.visible)` → 转 `--energy`（面试进行中）；`:has(#ended-bar.visible)` → 转 `--warn`。
2. **ROUND 回合编号**：`.messages { counter-reset: round }` + `.message.assistant { counter-increment: round }`
   + `.message.assistant::before { content: "ROUND " counter(round, decimal-leading-zero) }`，VT323 描边小牌。
3. **STAGE CLEAR**：复盘浮层 `.report-hd-left::before`，VT323 描边牌。
4. **关卡路线**：欢迎页 `.level-path`（节点 + 虚线连线 + `START`）。
5. **侧栏 HUD**：`.session-stats` = 一个描边盒，用时 / 轮次 用 VT323 `--energy` 读数；暂停时转 `--warn`。

## 核心组件规范

- **主按钮**（`.new-session-btn` / `.start-btn` / `.settings-save` / `.send-btn` / `.ended-report-btn`）：
  `background: var(--energy); color: var(--energy-ink); border: 2px solid var(--energy); box-shadow: 0 4px 0 var(--energy-deep)`；`:active { transform: translateY(4px); box-shadow: 0 0 0 ... }`。
- **次按钮 / 图标按钮**：`background: var(--bg-3); border: 2px solid var(--border-bright); box-shadow: 0 4px 0 var(--ledge)`。危险操作换 `--warn` 描边 + `--warn-deep` 底阴影。
- **卡片 / 输入框 / chip**：`border: 2px solid var(--border[-bright]); background: var(--bg-2/3)`，零圆角。输入框聚焦 `border-color: var(--energy)`。
- **区块小标签**：JetBrains Mono，uppercase，`letter-spacing: .14em`，`color: var(--text-faint)`，可带 `::after` 发丝线或 `::before` 能量方块。
- **图标**：内联线性 SVG（`stroke-width` 2，可加 `shape-rendering: crispEdges` 求硬），**禁止 emoji**。
- **消息**：面试官发言 = `.message.assistant`，`::before` 出 `ROUND NN`，`.avatar::before` 出「面试官」，正文描边盒 + 左 `--border-bright` 竖条；你的发言右对齐 + 左 `--energy` 竖条 + `--bg-3` 底。
- **指令条**（`.commands`，在 `#input-area` 内、输入框正上方）：胶囊按钮横向排列、`flex-wrap` 自动换行、宽度与输入框对齐（`max-width: 820px`）。中性 `--border-bright` 描边 + `--text-dim` 字，hover 转 `--energy`；`.cmd-end`（结束面试）保持 `--warn` 红描边区分。只在面试进行中出现（随 `#input-area` 显隐），欢迎/结束态不显示。快捷指令**不再放侧栏**——侧栏腾出的空间给历史记录。

## 文案语气

沿用现线上界面原文（用户 2026-08-29 明确要求不改）。基线：第二人称、简洁、不制造紧张。
新增文案跟随这个调性；成功提示用颜色表达，不新增装饰性字符。

## 使用方式

> 「按 DESIGN.md 的规范，帮我写一个 [页面 / 组件]」

会复用上面的 token、字体分工（Space Grotesk / Manrope / JetBrains Mono / VT323）、
台阶阴影按钮、零圆角、能量绿 / 橙红分工和 HUD 语言。
