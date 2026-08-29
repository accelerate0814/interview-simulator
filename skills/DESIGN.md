# 面试模拟软件 · 设计规范 (DESIGN.md)

> 用途:把这份文件放进项目根目录,每次让 Claude 帮你写新页面/组件时,
> 引用本文件("按照 DESIGN.md 的风格写"),就能保持全站视觉统一。

## 设计基调
一句话概括:**"像一位经验丰富、说话温和的面试教练,而不是冷冰冰的考官系统。"**
用户来这里练习面试,本身就会紧张,界面要负责"降压",不要用尖锐、冷硬的视觉语言。

设计原则:
- 圆润 > 直角:所有卡片、按钮、输入框统一大圆角
- 暖色 > 冷色:主色调避免纯黑/纯蓝这类"考试系统感"配色
- 留白充足:避免信息拥挤造成额外焦虑
- 反馈及时且温和:错误提示用鼓励性文案,不用刺眼的红色警告

---

## 色彩系统 (CSS 变量)

```css
:root {
  /* 主色 - 暖橙/珊瑚色系,友好不刺激 */
  --color-primary: #FF8A65;
  --color-primary-hover: #FF7043;
  --color-primary-light: #FFE0D6;

  /* 辅助色 - 柔和黄,用于提示/高亮 */
  --color-accent: #FFC864;

  /* 中性色 - 暖灰而非冷灰 */
  --color-bg: #FFF8F3;          /* 页面背景:米白偏暖 */
  --color-surface: #FFFFFF;      /* 卡片背景 */
  --color-border: #F0E4DA;

  --color-text-primary: #3D3229;   /* 深棕灰,替代纯黑 */
  --color-text-secondary: #8A7A6D;

  /* 状态色 - 柔和版本,避免刺眼 */
  --color-success: #7FB88A;
  --color-warning: #F2B84B;
  --color-error: #E8998D;        /* 珊瑚红,不用刺眼的纯红 */

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-full: 999px;

  /* 阴影 - 柔和弥散,不用生硬投影 */
  --shadow-card: 0 4px 20px rgba(61, 50, 41, 0.06);
  --shadow-hover: 0 8px 28px rgba(61, 50, 41, 0.10);
}
```

---

## 字体系统

```css
--font-family: "Nunito", "PingFang SC", "Microsoft YaHei", sans-serif;
```
- 首选 **Nunito**(圆润无衬线字体,自带友好感),中文回退苹方/微软雅黑
- 标题:600 字重,不用过粗的 800/900(避免压迫感)
- 正文:16px / 1.6 行高,保证长题目阅读舒适

字号刻度:
| 用途 | 大小 |
|---|---|
| 页面大标题 | 28px |
| 卡片标题 | 20px |
| 正文 | 16px |
| 辅助说明 | 14px |

---

## 间距系统
统一使用 8px 基准网格:8 / 16 / 24 / 32 / 48 px

---

## 核心组件规范

### 按钮
```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);   /* 胶囊型按钮,更柔和 */
  padding: 12px 28px;
  font-weight: 600;
  border: none;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-hover);
}
```

### 卡片(题目卡、反馈卡)
```css
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
}
```

### 输入框(回答区)
```css
.input-area {
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  padding: 16px;
  font-size: 16px;
  transition: border-color 0.2s;
}
.input-area:focus {
  border-color: var(--color-primary);
  outline: none;
}
```

### 进度指示(面试进度条)
- 用圆点/胶囊分段进度条,而非生硬的方块进度条
- 已完成用主色,当前用主色描边,未完成用浅灰

---

## 文案语气规范
这部分和视觉同样重要,直接影响"减压"效果:

| 场景 | 避免 | 推荐 |
|---|---|---|
| 回答未完成提示 | "错误:未填写答案" | "还差一点点,要不要再想想?" |
| 计时结束 | "超时!" | "时间到啦,先看看你的表现吧" |
| 反馈较差的回答 | "回答不合格" | "这个方向可以再打磨一下,试试从XX角度切入" |

---

## 动效原则
- 所有过渡统一用 `0.2s ease` 或 `0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- 卡片出现用轻微上浮+淡入,不用生硬的瞬间切换
- 避免闪烁、抖动类"警示型"动效——面试场景不需要制造紧张感

---

## 使用方式
每次让我写新页面/组件时,可以直接说:
> "按照 DESIGN.md 的规范,帮我写一个 [具体页面/组件]"

我会复用上面的色值、圆角、字体和文案语气,保证整个项目风格统一。
