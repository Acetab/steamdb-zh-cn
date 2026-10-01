# SteamDB 中文汉化（非官方）

在 SteamDB（steamdb.info）网页上把常见界面文本改写为简体中文的浏览器扩展。**非官方项目**，与 SteamDB 网站及其官方扩展无任何关联。


## 特性

**1.0.9**（2026-10-01）：新增用户可选择的词库来源。沿用 1.0.8 的定向翻译保护：通用文字限于界面控件，普通正文和数据需明确上下文规则；未实现通用 Shadow DOM 支持。

当前版本为 **1.0.9**。完整变更见[更新说明](docs/releases/v1.0.9.md)，安装包见[最新 Release](https://github.com/Acetab/steamdb-zh-cn/releases/latest)。

- 控件上下文规则优先于页面词典和通用词典；范围及原文均匹配才替换。
- 单文字节点及属性保留原文记录，历史导航和页面恢复后重新匹配。
- 设计参考 [maboloshi/github-chinese](https://github.com/maboloshi/github-chinese) 和 [MaydayV/github-chinese](https://github.com/MaydayV/github-chinese)，新增逻辑独立实现。
- 扩展版使用打包词库；油猴版可选择自动切换、仅 GitHub、仅 jsDelivr 或仅本地词库，不上传页面内容
- 动态内容监听：搜索建议、切换标签、异步加载的内容自动翻译
- 页面内浮动按钮「译」：暂停/启用汉化、采集未翻译文本
- 词库 2,300+ 条（global 1,570 / pages 695 / attrs 43 / regex 66），覆盖 SteamDB 主要固定界面文本
- 只改写界面文本：自动跳过代码块、可编辑区、超长文本，不翻译游戏名和商店介绍

## 术语口径

- 优先采用 Steam 官方简体中文译法（商店、库、愿望单、免费开玩、完全支持控制器）
- `SUB`、`Depot`、`AppID` 等技术标识保留社区惯用名
- `FPS`、`RPG`、`PvP` 等类型缩写按社区惯例保留英文

## 词条来源说明

词库全部为原创译文，无外来版权负担：

- 短词条（`Monday`→星期一、`Yes`→是）属事实性译法，翻译空间极小，任何译者产出相同，不构成版权问题
- Steam 官方标准术语（完全支持控制器、部分支持控制器）按 Valve 官方译法采用
- 长句与短语均为独立措辞的原创翻译，已通过自动化审计排除与既有汉化脚本雷同
- 代码字段名、品牌/游戏名、句子片段不收入词库
- 词库外置 + CDN 托管的技术方案思路参考了 Chr_ 的 SteamDB_CN 用户脚本；词库内容与翻译引擎均为本项目原创

## 安装

**油猴脚本版**（Tampermonkey / Violentmonkey）：

- 直接安装：<https://raw.githubusercontent.com/Acetab/steamdb-zh-cn/main/dist/steamdb-zh-cn.user.js>

安装后打开 `steamdb.info`，右下角出现「译」按钮即生效。在该菜单选择“词库来源”，当前选项带 ✓；选择后自动刷新，设置跨页面保留。

| 词库来源 | 在线更新行为 | 失败时 |
| --- | --- | --- |
| 自动（默认，保持旧版行为） | 先 GitHub Raw，失败再请求 jsDelivr | 使用本地缓存或安装快照 |
| 仅 GitHub | 只请求 GitHub Raw | 使用本地词库，不切换 CDN |
| 仅 jsDelivr | 只请求 jsDelivr；CDN 内容可能滞后 | 使用本地词库，不请求 GitHub |
| 仅本地词库 | 引擎不主动检查在线词库 | 使用已有缓存或安装快照 |

“仅本地”不控制油猴管理器：安装或更新脚本时，它仍可能下载 `@resource`；脚本自身的自动更新也由油猴设置决定。扩展版始终使用打包词库，不显示在线来源选项。

**扩展版**（Chrome / Edge / Steam 客户端内置浏览器）：

- [下载 1.0.9 ZIP](https://github.com/Acetab/steamdb-zh-cn/releases/download/v1.0.9/steamdb-zh-cn-1.0.9.zip)，解压后加载目录；[CRX 备选包](https://github.com/Acetab/steamdb-zh-cn/releases/download/v1.0.9/steamdb-zh-cn-1.0.9.crx)可能受浏览器安装限制。
- 油猴版与扩展版不要同时启用。此次引擎整改需要更新脚本或扩展，单独更新词库不足以生效。
- 本次已完成隔离 Edge 验证，Steam 内置浏览器尚未实测。

- 本地构建产物：`npm run build` 后取 `build/` 目录（「加载已解压的扩展程序」）或 `build/steamdb-zh-cn-<版本>.zip` / `.crx`
- 打开 `chrome://extensions` → 开启开发者模式 → 「加载已解压的扩展程序」选择 `build/` 目录，或直接拖入 `.crx`

## 构建

```bash
npm run build
```

依次执行：合并词库（`dictionary/` → `translations.zh-CN.json`）→ 词库审计 → 语法检查 → 打包。产物均在 `build/` 目录：

| 文件 | 说明 |
|---|---|
| `steamdb-zh-cn-<版本>.user.js` | 油猴脚本版（词库 @resource 外置） |
| `steamdb-zh-cn-<版本>.zip` / `.crx` | 扩展分发包 |
| `content.js` / `manifest.json` | 未打包扩展目录，供「加载已解压」 |

## 词库维护

词库源文件按页面拆分在 `dictionary/` 目录：

```
dictionary/
├── global.json     # 全局通用词条
├── attrs.json      # placeholder/aria-label/title 属性词条
├── contexts.json   # 控件上下文规则（path/selector/terms，可选 attribute）
├── regex.json      # 带数字/日期的锚定文本
└── pages/          # 按路径前缀分组，如 app.json、charts.json
```

补词流程：采集未翻译文本（「译」菜单）或保存页面 HTML 到 `html-dump/` 后用 `node tools/extract-untracked.mjs` 扫描 → 筛选后加入对应文件 → `npm run build` → 提交（`translations.zh-CN.json` 为发布文件，需一并提交，供油猴加载）。

油猴版先用本地缓存（GM 存储，首次安装为 `@resource` 快照）翻译，再按用户选定的来源更新。在线更新成功后应用词库并重译当前页；仅本地模式不会主动更新。来源选择的具体行为见安装章节。

## 自动发布（可选）

发布前运行 `npm run build` 和 `npm run check`，在 `docs/releases/v<版本>.md` 编写更新说明，并同步 package.json 与 manifest.json。工作流会再次构建和检查，使用对应说明创建 Release。

推送 `v*` 标签触发 GitHub Actions 构建并发布 Release（zip / crx / user.js 三件套），仅在有分发需求时使用：

```bash
git tag v1.0.x && git push --tags
```

## 协议

MIT License。本项目为全新开发，翻译引擎与词库均为本项目原创。
