<div align="center">

# ✈️ Thunder Stealth: F-117 Operations

**一款基于 Canvas + React 的高性能复古太空射击游戏**

[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-22d3ee?style=flat-square&logo=github)](https://1251639747jm-ctrl.github.io/shootgame/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)

灵感取自 F-117 隐身战机的 retro-modern 弹幕射击游戏 · 同时支持桌面与移动端

[🎮 在线试玩](https://1251639747jm-ctrl.github.io/shootgame/) · [📦 源码](https://github.com/1251639747jm-ctrl/shootgame)

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [我做了什么](#-我做了什么)
- [已完成功能](#-已完成功能)
- [更新与维护中](#-更新与维护中)
- [游戏功能一览](#-游戏功能一览)
- [技术栈](#-技术栈)
- [本地运行](#-本地运行)
- [项目结构](#-项目结构)

---

## 🚀 项目简介

**Thunder Stealth** 是一款纯前端实现的 2D 太空射击游戏。玩家驾驶一架 F-117 风格的隐身战机，在无尽的敌方编队中战斗。游戏采用 HTML5 Canvas 直接绘制，无任何游戏引擎依赖，所有粒子、武器、Boss、AI 行为均为手写实现。

游戏支持三种主玩法：
- **ENGAGE** —— 经典无尽生存模式，难度随时间递增
- **ROGUE RUN** —— 肉鸽闯关模式，三选一武器 + 流派构筑 + 逐层 Boss
- **PRACTICE RANGE** —— 武器试验场，无敌、魔力无限、自由生成 Bot 测试 DPS

---

## 🛠️ 我做了什么

这个项目最初由 AI Studio 自动生成了一个非常基础的初始版本（一架飞机 + 单种敌人 + 一种武器）。我在此基础上做了**几乎完整的重写和扩展**，主要工作包括：

### 🧱 架构层
- 把单一组件拆分为 **Engine / Renderer / InputManager / Entities / 武器子系统** 的分层架构
- 抽离独立的 **肉鸽模式子系统** (`game/rogue/`)，与主玩法解耦
- 设计可扩展的实体系统 + 武器元数据驱动的 UI

### ⚔️ 玩法层
- 从 1 种武器扩展到 **9 种主武器 + 1 种肉鸽专属武器（魔法阵）**
- 从 1 种敌人扩展到 **8 种小怪 + 3 种 Boss**，每种 AI 行为独立编写
- 实现 **3 种主动技能**：护盾 / 黑洞 / 冲击波，带冷却环动画
- **从零设计了完整的肉鸽模式**：流派选择、25+ 种增益、构筑叠加、Boss 层级缩放

### 🎨 表现层
- 全部 UI 图标 **手绘 SVG**（无图片资源），支持激活态发光
- HUD 状态条、虚拟摇杆、技能冷却环、武器六边形按钮均自绘
- 大量粒子特效：尾焰、爆炸、电弧、引力扭曲、激光蓄力等
- 提供 **画质开关**（HIGH / LOW），低端设备也能流畅运行

### 📱 交互层
- 同时适配 **移动端触屏** 和 **桌面键鼠**
  - 移动端：左半屏摇杆移动 + 右半屏长按开火
  - 桌面端：WASD + 鼠标/空格 + Q 切换武器 + 1/2/3 释放技能
- 多点触控不冲突：UI 按钮和摇杆/开火互不干扰

### 🚢 工程层
- 配置 **GitHub Actions** 自动部署到 GitHub Pages
- 高分本地持久化（localStorage）
- 三档难度系统（EASY / NORMAL / HARD），全局生效

---

## ✅ 已完成功能

| 模块 | 状态 | 说明 |
|------|------|------|
| 主菜单 / 设置面板 | ✅ 完成 | 难度切换、画质切换、最高分展示 |
| ENGAGE 无尽模式 | ✅ 完成 | 动态难度、波次系统、Boss 穿插 |
| ROGUE 肉鸽模式 | ✅ 完成 | 流派选择 + 增益构筑 + 无限层 |
| PRACTICE 试验场 | ✅ 完成 | 自由生成 Bot、武器随意切换、无敌模式 |
| 9 种主武器 | ✅ 完成 | 见下方武器列表 |
| 8 种敌人 + 3 种 Boss | ✅ 完成 | 各自独立 AI |
| 3 种主动技能 | ✅ 完成 | 护盾 / 黑洞 / 冲击波 |
| 移动端触控适配 | ✅ 完成 | 双摇杆式布局 |
| 桌面键鼠操作 | ✅ 完成 | WASD / 鼠标 / 热键 |
| 画质分级 | ✅ 完成 | HIGH / LOW 两档粒子密度 |
| 高分持久化 | ✅ 完成 | localStorage |
| 自动部署 (GH Pages) | ✅ 完成 | push to main 自动构建发布 |

---

## 🔧 更新与维护中

下面这些功能仍在迭代或计划中（欢迎 PR / Issue）：

- 🎯 **肉鸽模式平衡性调优** —— Boss 血量曲线、增益强度还在持续打磨
- 🎵 **音效与 BGM** —— 目前无声，后续会加入合成音效或外部音轨
- 💾 **存档系统** —— 肉鸽中途退出保留进度
- 🏆 **成就 / 任务系统** —— 长期目标驱动
- 🤝 **本地双人 / 在线对战** —— 概念阶段
- 🌐 **i18n 多语言** —— 当前仅中英文混排，计划完整 i18n
- 🎨 **更多敌人 & Boss 类型** —— 持续扩充
- 📊 **每局战斗数据统计** —— DPS / 存活时间 / 击杀数等结算面板
- ♿ **无障碍优化** —— 色盲模式、按键映射自定义
- 🐛 **已知问题修复** —— 见 Issues 列表

---

## 🎮 游戏功能一览

### 🔫 武器系统（9 主 + 1 肉鸽专属）

| 图标 | 武器 | 特性 |
|------|------|------|
| 🟡 | **VULCAN**（机枪） | 高射速连发，泛用首选 |
| 🟠 | **SCATTER**（散弹） | 7 发扇形覆盖，近战神器 |
| 🔵 | **HYPER BEAM**（激光） | 蓄力高伤穿透光束 |
| 🟣 | **RAILGUN**（电磁炮） | 一发穿全屏，单体爆发 |
| 🌸 | **MISSILE**（追踪导弹） | 自动追敌，曲线飞行 |
| 💎 | **TESLA**（特斯拉） | 闪电链，自动跳跃 |
| 🔴 | **DOOM BOMB**（巨型炸弹） | 大范围 AOE 清场 |
| 🟧 | **FLAK**（高射炮） | 定时空爆 + 放射状碎片 |
| 🟢 | **HELIX**（螺旋光子） | 双股正弦弹幕 |
| 🟪 | **MAGIC CIRCLE**（魔法阵·肉鸽） | 持续范围伤害，分火/电流派 |

### 💥 主动技能

- **🛡️ SHIELD（护盾）** —— 短时间无敌，反弹近距离弹幕
- **🌀 SINGULARITY（黑洞）** —— 范围吸附敌人与子弹
- **💫 SHOCKWAVE（冲击波）** —— 全屏冲击，清空敌方弹幕

### 👾 敌人种类

- **小怪**：BASIC / FAST / TANK / KAMIKAZE（自爆）/ SHIELDER（带盾）/ SNIPER（远程精确）/ SWARMER（成群出现）
- **Boss**：BOSS（标准）/ BOSS_CARRIER（出小弟）/ BOSS_REAVER（高机动）

### 🎲 肉鸽系统亮点

- **3 种初始武器**：机枪 / 激光 / 魔法阵
- **魔法阵双流派**：🔥 火系（持续灼烧）/ ⚡ 电系（连锁闪电）
- **25+ 种增益卡**，包含通用 / 武器专属 / 元素专属 / 技能解锁
- **每层 3 选 1**，构筑差异化（不会出无效卡，例如激光不会再出散射）
- **Boss 血量随层数递增**，无限挑战

### ⚙️ 设置

- 难度：EASY / NORMAL / HARD
- 画质：HIGH（全特效）/ LOW（节能模式）

---

## 🧰 技术栈

- **前端框架**：React 19 + TypeScript 5.8
- **构建工具**：Vite 6
- **样式**：Tailwind CSS（CDN 直引）
- **图标**：Lucide React + 自绘 SVG
- **渲染**：原生 HTML5 Canvas 2D（无游戏引擎）
- **部署**：GitHub Actions + GitHub Pages
- **存储**：localStorage（高分记录）

---

## 💻 本地运行

**前置要求**：Node.js ≥ 18

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 构建生产版本
npm run build

# 4. 预览生产构建
npm run preview
```

启动后访问 `http://localhost:5173` 即可游玩。

---

## 📂 项目结构

```
shootgame/
├── App.tsx                   # 顶层 UI / 菜单 / HUD
├── index.tsx                 # React 入口
├── index.html                # HTML 入口 + Tailwind CDN
├── types.ts                  # 全局类型定义
├── components/
│   ├── GameCanvas.tsx        # Canvas 容器组件 + ref 暴露
│   └── GameIcons.tsx         # 全部自绘 SVG 图标
├── game/
│   ├── GameEngine.ts         # 主循环 / 调度器
│   ├── Renderer.ts           # Canvas 绘制层
│   ├── InputManager.ts       # 键鼠 + 触屏输入
│   ├── Entities.ts           # 实体基类 / 工厂
│   ├── PlayerModel.ts        # 玩家飞船绘制
│   ├── EnemyModel.ts         # 敌机绘制
│   ├── ShieldModel.ts        # 护盾视觉
│   ├── Laser.ts / Tesla.ts   # 武器子系统
│   ├── Missile.ts / Bomb.ts  # 武器子系统
│   ├── EnemyLaser.ts         # 敌方激光
│   ├── BlackHole.ts          # 黑洞技能
│   └── rogue/                # 肉鸽模式独立子系统
│       ├── RogueEngine.ts    # 肉鸽流程控制
│       ├── RogueTypes.ts     # 流派 / 增益定义
│       ├── RogueUI.ts        # 肉鸽专属 UI（Canvas 绘制）
│       ├── MagicCircle.ts    # 魔法阵武器实现
│       └── index.ts
├── .github/workflows/
│   └── deploy.yml            # GitHub Pages 自动部署
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 📜 License

MIT — 欢迎 fork、二创、提 PR。

---

<div align="center">

**🛩️ 享受飞行，享受射击。Good hunt, pilot.**

</div>
