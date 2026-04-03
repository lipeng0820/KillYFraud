# 🔪 X 垃圾私信斩杀器 (X-Spam-Killer) - X/Twitter 垃圾信息全自动清理助手

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Style: X Native](https://img.shields.io/badge/Style-X%20Native-black.svg)](https://x.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**X 垃圾私信斩杀器** 是一款专为 X (Twitter) 设计的高性能、全自动化垃圾私信清理扩展。它旨在通过“一键连招”解决 X 平台上泛滥的垃圾诈骗私信请求，将繁琐的“举报-选择分类-发送-屏蔽-关闭”流程缩减为接近零操作的自动化体验。

---

## ✨ 核心特性

### 1. 🎯 狙击准星快速跳转 (Quick Jump)
在 X 首页右下角注入了一个与原生 UI 完美契合的**红色狙击准星**浮动按钮。
- **一键触达**：点击即刻跳转至待处理的“私信请求”界面。
- **原生质感**：采用 X 原生 CSS 变量与圆角逻辑，支持深色/浅色模式自动切换。

### 2. ⚡ 全自动举报连招 (Auto-Reporting Flow)
当你点击私信请求卡片右上角的“删除”图标时，插件将自动接管并瞬间完成：
- **自动触发举报**：识别并点击“举报 @用户”。
- **分类自动选择**：进入 iframe 举报窗口后，精准定位并点击“这是垃圾信息（Spam）”。
- **自动提交**：自动提交报告给 X 安全中心。

### 3. 🤔 审判官模式 (The Judgment Modal)
在执行最终的“屏蔽”操作前，KXF 会弹出一个极具冲击力的自定义审判对话框，交由用户进行最后的裁决：
- **报蔽之 (3s 倒计时)**：默认执行。如果 3 秒内无操作，插件将自动完成“举报+屏蔽”的终极连招。
- **仅举报**：如果你只想举报而不希望屏蔽该用户，点击此项，插件将跳过屏蔽步骤并自动收尾。

### 4. 🧹 强力自动收尾 (Aggressive Modal Closure)
针对 React 18 框架设计的**“亡命连环摧毁器”**：
- **全物理事件模拟**：模拟真实的 `Pointer Events` 手势链，绕过 React 的事件拦截。
- **高频重试机制**：即便在网络极度卡顿的情况下，也会持续尝试关闭“完成”窗口，直至弹窗彻底消失。

---

## 🛠️ 技术原理

- **Manifest V3**：遵循最新的 Chrome 插件标准。
- **Cross-Context Communication**：通过 `window.postMessage` 实现主页面与 X 举报沙箱 `iframe` 之间的状态同步。
- **Event Capture Phase**：利用事件捕获阶段监听（Capture Phase）防止 X 原生 React 事件冒泡拦截。
- **Pointer Event Emulation**：完整模拟 `mouseover` -> `pointerdown` -> `mousedown` -> `mouseup` 链路，确保 UI 响应。

---

## 🚀 安装指南

由于本插件旨在个人私用清理，目前建议通过开发者模式安装：

1.  **下载源码**：克隆或下载本仓库代码到本地。
2.  **进入扩展管理**：在 Chrome/Edge 浏览器地址栏输入 `chrome://extensions/`。
3.  **开启开发者模式**：勾选页面右上角的“开发者模式”。
4.  **加载插件**：点击“加载解压后的扩展程序”，选择包含 `manifest.json` 的项目文件夹。
5.  **开始使用**：刷新 X 页面，找到右下角的**狙击准星**即可开启清理之旅。

---

## 📸 运行预览

> [!TIP]
> 运行过程中，你可以随时通过点击审判层外的区域或点击“仅举报”来手动干扰自动化进程。本插件设计的初衷是“高效而不剥夺控制权”。

---

## ⚠️ 免责声明

本工具仅供学习交流使用。使用本插件进行的举报与屏蔽行为由用户个人承担，请确保你的操作符合 X 平台的社群守则。

---

## 🤝 贡献与反馈

如果你在使用过程中发现了漏网的 UI 或遇到了卡顿，欢迎提交 Issue。

**Kill X Fraud** - 让你的 X 收件箱重回宁静。🔪🛡️
