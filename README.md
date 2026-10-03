# 🎮 Pixel Tank Battle 1990 (像素坦克大战)
### 📱 纯 Android 手机原生环境研发 · 移动优先 · 触控纯享版

[![Platform: Android Termux](https://img.shields.io/badge/Platform-Android%20Termux-brightgreen.svg)](https://github.com/termux/termux-app)
[![Tech: HTML5 Canvas](https://img.shields.io/badge/Tech-HTML5%20Canvas-orange.svg)]()
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Web%20Audio%208--Bit-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)]()

> 本项目为完全在 **Android 手机（Termux 沙盒）** 内借助 **Antigravity AI 智能体** 驱动研发完成的纯手持复古游戏与全套实战教程。

---

## 🌟 核心特性

- **🕹️ 移动端人体工学交互**：
  - 虚拟方向按键（D-Pad）与大尺寸开火按键，专门针对触屏操作优化防误触与按键间距。
  - 支持滑动摇杆与连发模式，操作响应丝滑。
  - 内置振动反馈（Haptic Vibration Feedback，触屏震动更具打击感）。
- **🔊 纯原生 Web Audio 芯片音效**：
  - 无需下载任何外部 MP3/WAV 音频文件。
  - 基于方波振荡器（Square Wave Oscillator）与白噪声发生器纯代码实时合成开火、爆炸、奖励捡取等 8-Bit 复古音效。
- **💥 经典物理与 AI 算法**：
  - 经典地图元素（砖墙、钢墙、草丛隐匿、河流、老鹰基地）。
  - 多兵种敌方坦克（普通型、敏捷型、重装型）。
  - 内置自主研发的“重叠死锁向量解耦算法（Vector Decoupling）”，解决多坦克窄道追击重叠死锁问题。
- **📖 附带万字深度教程**：
  - 详尽包含 Android Termux 极客环境配置、Shizuku 免电脑提权、MT 管理器 MCP 逆向工程服务联动全流程！

---

## 📸 运行效果截图

| 经典开屏界面 | 移动触控实机战斗 |
| :---: | :---: |
| ![Title Screen](images/tank_title_screen.png) | ![Gameplay Action](images/tank_gameplay_action.png) |

| 向量解耦防卡死碰撞修复 | Termux + Shizuku + MCP 闭环架构 |
| :---: | :---: |
| ![Collision Fix](images/tank_collision_fix.png) | ![Architecture Diagram](images/architecture_diagram.png) |

---

## 🚀 手机端本地运行方式

本项目无需任何重度编译或构建环境，在 Android 手机的 Termux 终端中即可一键运行：

1. **进入项目目录**：
   ```bash
   cd ~/projects/tank-game
   ```

2. **启动本地轻量 Web 服务**：
   ```bash
   python3 -m http.server 8080
   ```

3. **在手机浏览器打开体验**：
   ```bash
   termux-open-url http://localhost:8080/index.html
   ```

---

## 📚 教程与文档索引

- [📖 Android 本地运行 Antigravity 智能体全攻略 (Markdown 完整版)](ANDROID_AUTOMATION_TUTORIAL.md)
- [🌐 教程手机离线预览版 (HTML 独立单文件)](tutorial.html)

---

## 📄 开源许可证

本项目遵循 [MIT License](LICENSE) 开源协议。欢迎学习、二创与分享！
