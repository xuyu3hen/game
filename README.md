# 🧠 记忆力训练游戏

一个基于原生 HTML + CSS + JavaScript 的记忆力训练游戏，包含两种游戏模式，无需任何依赖。

## 🎮 游戏模式

### 翻牌配对（Memory Cards）
- 点击卡片翻开，找到所有相同的 emoji 配对
- 三种难度：**简单（4×4）**、**中等（4×5）**、**困难（5×6）**
- 记录步数和时间，争取最少步数通关

### 序列记忆（Simon Says）
- 观察颜色按钮的亮起序列，然后按相同顺序点击
- 每关序列增加一步，无限关卡
- 记录最高关卡数，挑战自己

## 🚀 如何运行

直接用浏览器打开 `index.html` 即可，无需安装任何依赖。

```bash
# 如果有 Python
python -m http.server 8080
# 如果有 Node.js
npx serve .
```

## 📁 文件结构

```
game/
├── index.html   # 主页面（首页 + 两个游戏界面）
├── style.css    # 所有样式（深色主题 + 响应式）
├── game.js      # 游戏逻辑（翻牌 + Simon）
└── README.md    # 本文件
```

## ✨ 功能特性

- 🌙 深色主题，护眼设计
- 📱 响应式布局，支持手机和桌面
- 💾 自动保存最佳成绩（localStorage）
- 🎯 流畅翻牌动画（3D 翻转效果）
- 💡 Simon 按钮发光特效
- 🏆 关卡完成 / 失败弹窗

## 🌐 在线体验

直接克隆并打开 `index.html`：
```bash
git clone https://github.com/xuyu3hen/game.git
cd game
open index.html
```
