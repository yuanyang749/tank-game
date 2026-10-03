# 🕹️ Antigravity Retro Game Boy Console (掌机模拟器)
### 📱 纯 Android 手机原生环境研发 · 移动优先 · 复古掌机模拟器架构

[![Platform: Android Termux](https://img.shields.io/badge/Platform-Android%20Termux-brightgreen.svg)](https://github.com/termux/termux-app)
[![Handheld: Game Boy DMG--01](https://img.shields.io/badge/Handheld-Game%20Boy%20DMG--01-lightgrey.svg)]()
[![Audio: Web Audio 8--Bit](https://img.shields.io/badge/Audio-Web%20Audio%208--Bit-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 本项目为完全在 **Android 手机（Termux 原生沙盒）** 内借助 **Antigravity AI 智能体** 驱动研发完成的 **Game Boy 复古掌机模拟器** 与多游戏实战工程。

---

## 🌟 核心特性与架构

### 1. 🎮 经典 Game Boy (DMG-01) 掌机模拟器外壳 (`index.html`)
- **真实掌机人体工学设计**：
  - 经典灰白工程塑料质感外壳，右下角标志性圆弧切角。
  - 屏幕边框“DOT MATRIX WITH STEREO SOUND”经典刻字与红蓝双色饰线。
  - 真实通电红色 BATTERY 电池指示灯与开机“*ba-ding!*”清脆晶体音效。
  - 右下角 30° 扬声器音孔格栅。
- **全套手感实体化触控按键**：
  - **滑动十字键 (D-Pad)**：支持手指滑动摇杆式盲操与八方向无缝连贯导航。
  - **倾斜 A / B 键**：经典 -25° 倾角排布，深酒红烤漆质感，带物理震动反馈（Haptic Vibration）。
  - **SELECT / START 橡胶条按键**：经典斜排橡胶质感，用于暂停、开局与重置。
- **多重显示调色板 (Palette Switcher)**：
  - 🟢 **经典点阵 (DMG)**：复古橄榄绿液晶屏点阵滤镜。
  - ⚪ **Pocket 黑白**：高对比度纯净黑白电子屏风格。
  - 🎨 **原彩 (Vivid Color)**：原汁原味的鲜明街机 RGB 色彩。
- **动态卡带插拔系统 (Cartridge Switcher)**：
  - 随时切换游戏卡带，无需刷新页面，自动播放换卡引导与复古开机 Chime 音效。

---

## 🕹️ 内置游戏卡带列表

### 🎮 卡带 1：像素坦克大战 1990 (`games/tank-battle/`)
- **目录结构**：模块化多文件（`css/tank.css`、`js/audio.js`、`js/map.js`、`js/physics.js`、`js/entities.js`、`js/game.js`）。
- **特色**：
  - 经典地图元素（砖墙、钢墙、隐匿树林、河流、老鹰基地）。
  - 多兵种 AI 坦克（普通、敏捷、重装、随机奖励坦克）。
  - 自主研发 **向量解耦碰撞解死锁算法（Vector Decoupling Algorithm）**，彻底避免多坦克挤压卡死。
  - 支持掌机嵌入模式与独立全屏运行模式。

### 👾 卡带 2：太空侵略者 1978 (`games/space-invaders/`)
- **目录结构**：模块化多文件（`css/invaders.css`、`js/audio.js`、`js/player.js`、`js/shields.js`、`js/invaders.js`、`js/game.js`）。
- **特色**：
  - 经典三类外星人矩阵编队（章鱼、螃蟹、鱿鱼，5 行 × 8 列）与 2 帧像素动画。
  - **4 步步进低音进行曲**：速度随外星人数量减少而动态加速（从沉稳到急促狂飙！）。
  - **可破坏防御掩体 (Shield Bunkers)**：基于画布像素级弹坑侵蚀物理（Crater Erosion），子弹射中会真实炸出碎坑！
  - **红色神秘飞碟 (Mystery UFO)**：高空随机呼啸掠过，附带专属高频颤音音效，击落随机奖励 100~300 分。
  - 外星随机闪电/直线炸弹投掷与玩家激光对轰中和机制。

---

## 📂 项目模块化目录树

```
tank-game/
├── index.html                   # 🕹️ Game Boy 掌机主入口模拟器
├── css/
│   └── gameboy.css              # 掌机 DMG-01 仿真外壳、按键与调色板样式
├── js/
│   └── console.js               # 掌机系统 OS、换卡调度、按键桥接与开机音效
├── games/
│   ├── tank-battle/             # 🎮 像素坦克大战模块 (多文件)
│   │   ├── index.html           # 坦克大战入口 (支持独立/嵌入)
│   │   ├── css/tank.css
│   │   └── js/
│   │       ├── audio.js         # Web Audio 8-bit 芯片音效合成
│   │       ├── map.js           # 地图生成与瓦片系统
│   │       ├── physics.js       # 碰撞检测与向量解耦算法
│   │       ├── entities.js      # 坦克、子弹、道具实体类
│   │       └── game.js          # 主循环与控制桥接
│   └── space-invaders/          # 👾 太空侵略者模块 (多文件)
│       ├── index.html           # 太空侵略者入口 (支持独立/嵌入)
│       ├── css/invaders.css
│       └── js/
│           ├── audio.js         # 四音步进低音、激光、飞碟音效
│           ├── player.js        # 玩家炮台与激光移动
│           ├── shields.js       # 像素级可破坏掩体侵蚀算法
│           ├── invaders.js      # 外星人网格编队、炸弹、神秘飞碟
│           └── game.js          # 积分、关卡与主循环
├── docs/                        # 📚 文档归档目录
│   ├── ANDROID_AUTOMATION_TUTORIAL.md # 万字 Termux 自动化开发全攻略
│   ├── tutorial.html            # 教程单文件离线预览版
│   └── images/                  # 运行效果与架构截图
├── images/                      # 根目录图片资源
├── README.md                    # 项目说明文档
└── LICENSE                      # MIT 开源协议
```

---

## 📸 运行效果截图

| 掌机模拟器主界面 | 太空侵略者卡带 |
| :---: | :---: |
| ![Title Screen](images/tank_title_screen.png) | ![Gameplay Action](images/tank_gameplay_action.png) |

| 碰撞解死锁物理修复 | Termux + Shizuku + MCP 闭环架构 |
| :---: | :---: |
| ![Collision Fix](images/tank_collision_fix.png) | ![Architecture Diagram](images/architecture_diagram.png) |

---

## 🚀 手机端本地运行方式

在 Android 手机 Termux 终端中直接启动：

1. **进入项目目录**：
   ```bash
   cd ~/projects/tank-game
   ```

2. **启动本地 Web 静态服务**：
   ```bash
   python3 -m http.server 8080
   ```

3. **在手机浏览器中打开体验**：
   - **Game Boy 掌机总控台**：[http://localhost:8080/index.html](http://localhost:8080/index.html)
   - **独立运行坦克大战**：[http://localhost:8080/games/tank-battle/index.html](http://localhost:8080/games/tank-battle/index.html)
   - **独立运行太空侵略者**：[http://localhost:8080/games/space-invaders/index.html](http://localhost:8080/games/space-invaders/index.html)
   - **阅读极客实战教程**：[http://localhost:8080/tutorial.html](http://localhost:8080/tutorial.html)

---

## 🌐 在线体验 (GitHub Pages)

- **在线 Game Boy 掌机**：[https://yuanyang749.github.io/tank-game/](https://yuanyang749.github.io/tank-game/)
- **GitHub 源码仓库**：[https://github.com/yuanyang749/tank-game](https://github.com/yuanyang749/tank-game)

---

## 📄 开源许可证

本项目遵循 [MIT License](LICENSE) 开源协议。
